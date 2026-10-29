import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// NOTE: electron / electron-log / electron-json-storage are stubbed globally
// via aliases in vitest.config.ts (test/mocks/*), so ProjectFileDb can be
// initialized headlessly here. The parcel watcher is stubbed per-file: these
// tests exercise the local↔cloud root-id swap (bind/reload/registry), not
// watcher delivery — and it removes native watcher crashes from the equation.
vi.mock('@parcel/watcher', () => ({
    default: {
        subscribe: async () => ({ unsubscribe: async () => {} }),
        writeSnapshot: async () => {},
    },
}));

import { ProjectFileDb } from '../ProjectFileDb';
import { requestProjectDb, closeProjectDb } from '../project-registry';
import { ROOT_WORKSPACE_UNRESOLVED_ERROR } from '../services/SyncService/SyncService';
import { LOCAL_ROOT_WORKSPACE_ID, resolveCloudRootWorkspaceId } from '#bridge/utils/cloud-root';

const FIXTURE_DIR = fileURLToPath(new URL('./project-data', import.meta.url));
const PROJECT_ID = 'EWvDFxqn';
/** Stand-in for the server id of the project's gdd root workspace. */
const SERVER_ROOT_ID = '33333333-4444-4444-8444-555555555555';

function makeProject(): { dir: string; root: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ims-root-swap-'));
    const dir = path.join(root, 'project');
    fs.cpSync(FIXTURE_DIR, dir, { recursive: true });
    // Start from a freshly initialized meta/database (no leftovers from specs
    // that init the fixture in place).
    fs.rmSync(path.join(dir, '.imsc'), { recursive: true, force: true });
    return { dir, root };
}

function cleanup(root: string) {
    fs.rmSync(root, { recursive: true, force: true });
}

/** No user entity may reference the local placeholder root once bound. */
function expectNoPlaceholderRefs(db: ProjectFileDb) {
    for (const w of db.workspace.workspaces.iterate()) {
        if (w.projectId !== PROJECT_ID) continue;
        expect(w.id).not.toBe(LOCAL_ROOT_WORKSPACE_ID);
        expect(w.parentId).not.toBe(LOCAL_ROOT_WORKSPACE_ID);
    }
    for (const a of db.asset.assets.iterate()) {
        if (a.projectId !== PROJECT_ID) continue;
        expect(a.workspaceId).not.toBe(LOCAL_ROOT_WORKSPACE_ID);
    }
}

// ─── resolveCloudRootWorkspaceId ─────────────────────────────────────────────

test('resolveCloudRootWorkspaceId picks the gdd root by machine name', () => {
    expect(
        resolveCloudRootWorkspaceId([
            { id: '1', name: 'discussions' },
            { id: SERVER_ROOT_ID, name: 'gdd' },
        ]),
    ).toBe(SERVER_ROOT_ID);
});

test('resolveCloudRootWorkspaceId never accepts the placeholder id', () => {
    // A buggy sync may have uploaded the placeholder as a second "gdd" root —
    // it must be ignored in favor of the real one.
    expect(
        resolveCloudRootWorkspaceId([
            { id: LOCAL_ROOT_WORKSPACE_ID, name: 'gdd' },
            { id: SERVER_ROOT_ID, name: 'gdd' },
        ]),
    ).toBe(SERVER_ROOT_ID);
    // …and if the placeholder is the only candidate, binding must refuse.
    expect(resolveCloudRootWorkspaceId([{ id: LOCAL_ROOT_WORKSPACE_ID, name: 'gdd' }])).toBeNull();
    expect(resolveCloudRootWorkspaceId([{ id: LOCAL_ROOT_WORKSPACE_ID }])).toBeNull();
});

test('resolveCloudRootWorkspaceId only accepts a real gdd root, refuses anything else', () => {
    // No guessing: without a machine-named gdd root there is no valid
    // candidate — a lone root workspace included (it may be anything).
    expect(resolveCloudRootWorkspaceId([{ id: 'only-root', name: null }])).toBeNull();
    // Multiple roots, none named gdd — ambiguous: refuse rather than guess.
    expect(
        resolveCloudRootWorkspaceId([
            { id: 'a', name: 'discussions' },
            { id: 'b', name: 'tasks' },
        ]),
    ).toBeNull();
    expect(resolveCloudRootWorkspaceId([])).toBeNull();
});

// ─── bind → reload invariants ────────────────────────────────────────────────

test('cloud bind swaps in the server root id and a reload derives it', async () => {
    const { dir, root } = makeProject();
    const db = new ProjectFileDb(dir);
    try {
        // First load: a local project (no root id yet).
        await db.init({ id: PROJECT_ID, title: 'Test project', rootWorkspaceId: null });
        expect(db.RootGddFolder.id).toBe(LOCAL_ROOT_WORKSPACE_ID);

        // Bind (recreate with the server root id) — what connectToCloudProject does.
        await db.init({ id: PROJECT_ID, title: 'Test project', rootWorkspaceId: SERVER_ROOT_ID, recreate: true });
        expect(db.RootGddFolder.id).toBe(SERVER_ROOT_ID);
        expectNoPlaceholderRefs(db);

        const meta = JSON.parse(fs.readFileSync(path.join(dir, '.imsc', 'index.json'), 'utf-8'));
        const local = JSON.parse(
            fs.readFileSync(path.join(dir, '.imsc', '.imsc-local', 'local.json'), 'utf-8'),
        );
        // The cloud binding is machine-local: a git clone of this project must
        // start unbound instead of inheriting PROJECT_ID.
        expect(meta.id).toBeUndefined();
        expect(local.id).toBe(PROJECT_ID);
        expect(meta.rootWorkspaceId).toBe(SERVER_ROOT_ID);

        await db.destroy();

        // Reload: a fresh instance must derive the same root purely from meta.
        const db2 = new ProjectFileDb(dir);
        await db2.init();
        expect(db2.info.rootWorkspaceId).toBe(SERVER_ROOT_ID);
        expect(db2.RootGddFolder.id).toBe(SERVER_ROOT_ID);
        expectNoPlaceholderRefs(db2);
        await db2.destroy();
    }
    finally {
        cleanup(root);
    }
});

// ─── unresolved-root guard ───────────────────────────────────────────────────

test('bound project with no rootWorkspaceId pauses sync instead of uploading the placeholder', async () => {
    const { dir, root } = makeProject();
    // Legacy meta: valid cloud id but no rootWorkspaceId (the broken state
    // produced by the old bind-miss / pre-field projects).
    fs.mkdirSync(path.join(dir, '.imsc'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, '.imsc', 'index.json'),
        JSON.stringify({ id: PROJECT_ID, title: 'Test project', inited: true }),
        'utf-8',
    );
    const db = new ProjectFileDb(dir);
    try {
        await db.init();
        expect(db.info.rootWorkspaceId).toBeFalsy();
        expect(db.RootGddFolder.id).toBe(LOCAL_ROOT_WORKSPACE_ID);

        // syncProject checks the cloud account before anything else (there is
        // none in tests), so exercise the root guard through
        // resyncAssetsAndWorkspaces, which gates on it directly.
        await db.sync.resyncAssetsAndWorkspaces([], []);
        const paused = await db.sync.getCurrentSyncState();
        expect(paused.error).toBe(ROOT_WORKSPACE_UNRESOLVED_ERROR);

        // Repair path: recreate with the resolved server root id — the guard
        // must stop firing; ghost ids match no rows, so nothing hits a server.
        await db.sync.changeCurrentState({ error: null });
        await db.init({ id: PROJECT_ID, title: 'Test project', rootWorkspaceId: SERVER_ROOT_ID, recreate: true });
        expect(db.RootGddFolder.id).toBe(SERVER_ROOT_ID);
        await db.sync.resyncAssetsAndWorkspaces(['ghost-asset'], ['ghost-workspace']);
        expect((await db.sync.getCurrentSyncState()).error).toBeNull();
    }
    finally {
        await db.destroy().catch(() => {});
        cleanup(root);
    }
});

// ─── registry / destroy race ─────────────────────────────────────────────────

test('registry keeps one instance per path across destroys; init waits instead of throwing', async () => {
    const { dir, root } = makeProject();
    try {
        const a = requestProjectDb(dir);
        await a.init({ id: PROJECT_ID, title: 'Test project', rootWorkspaceId: SERVER_ROOT_ID });

        // destroy() sets the flag synchronously — we are deterministically
        // inside the destroy window of a cloud-bind recreate.
        const destroying = a.destroy();
        expect(a.isDestroying).toBe(true);

        // Old code spawned a SECOND ProjectFileDb here, cached it, and let it
        // serve sync/index.json with a stale root id.
        const b = requestProjectDb(dir);
        expect(b).toBe(a);

        // init() during destroy waits it out instead of throwing
        // "Cannot init destroying ProjectFileDb".
        const reinit = b.init();
        await destroying;
        await reinit;

        expect(a.info.rootWorkspaceId).toBe(SERVER_ROOT_ID);
        expect(a.RootGddFolder.id).toBe(SERVER_ROOT_ID);
        expect(requestProjectDb(dir)).toBe(a);

        await closeProjectDb(dir);
    }
    finally {
        cleanup(root);
    }
});
