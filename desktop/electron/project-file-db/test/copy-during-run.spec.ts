import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Deterministic watcher: no real subscription — fs events are injected manually
// so event orderings can be reproduced exactly.
vi.mock('@parcel/watcher', () => ({
    default: {
        subscribe: async () => ({ unsubscribe: async () => {} }),
        writeSnapshot: async () => {},
    },
}));

import { ProjectFileDb } from '../ProjectFileDb';
import { ProjectFileDbTransaction } from '../logic/ProjectFileDbTransaction';
import type { ProjectFileDbAsset } from '../ProjectFileDb';

// ─── Scenario: Explorer copies folder `X` (assets A1, A2) while the app runs ──
//
// Locally the claim machinery gives `X - 2` a new workspace id and the copied
// assets new ids. Whatever lands in the collection as `workspaceId` is what
// sync uploads (the create payload is built from `assets.byId`), so every
// ordering must end with the copied assets pointing at the copy's workspace.

const W_X = 'aaaa0000-0000-0000-0000-000000000010';
const A1_ID = 'bbbb0000-0000-0000-0000-000000000001';
const A2_ID = 'bbbb0000-0000-0000-0000-000000000002';

function assetJson(id: string, title: string, workspace_id: string | null): Record<string, unknown> {
    return {
        id,
        title,
        name: null,
        icon: 'file-paper-2-fill',
        typeIds: [],
        parentIds: [],
        workspaceId: workspace_id,
        index: null,
        comments: [],
        references: [],
        blocks: [{
            id: 'blk-' + id,
            type: 'props',
            name: 'description',
            title: null,
            index: 1,
            own: true,
            ownTitle: null,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
            props: { value: 'x' },
            computed: { value: 'x' },
            inherited: {},
        }],
    };
}

function writeOriginalProject(dir: string) {
    fs.mkdirSync(path.join(dir, 'X'), { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'X', '.imw'),
        JSON.stringify({ id: W_X, title: 'X', props: {} }, null, 1),
        'utf8',
    );
    for (const [name, id] of [['A1.ima.json', A1_ID], ['A2.ima.json', A2_ID]] as const) {
        fs.writeFileSync(
            path.join(dir, 'X', name),
            JSON.stringify(assetJson(id, name.replace('.ima.json', ''), W_X), null, 1),
            'utf8',
        );
    }
}

type InjectedEvent = { type: 'create' | 'update' | 'delete'; path: string };

async function injectAndDrain(db: ProjectFileDb, events: InjectedEvent[]) {
    const fs_any = db.fileSystem as any;
    for (const event of events) fs_any._fsPendingFSEvents.push(event);
    fs_any._resortPendingFSEvents();
    await fs_any._handlePendingFSEvents();
    // let any chained pass settle
    while (fs_any._fsPendingFSInWork) await new Promise(r => setTimeout(r, 5));
}

async function assertCopyAttachedToItsWorkspace(db: ProjectFileDb) {
    const ws_copy = db.workspace.findByLocalDirPath('X - 2');
    expect(ws_copy, 'workspace `X - 2` must exist in the collection').toBeTruthy();
    expect(ws_copy!.id).not.toBe(W_X);

    for (const name of ['A1.ima.json', 'A2.ima.json']) {
        const matches = [...db.asset.assets.iterate()].filter(a => a.localName === name);
        // exactly one original + one copy — no duplicate rows for the same file
        const in_copy = matches.find(a => a.workspaceId === ws_copy!.id);
        expect(in_copy, `copied ${name} must be attached to \`X - 2\` (${ws_copy!.id}); ` +
            `got: ${matches.map(a => `${a.id}@${a.workspaceId}`).join(', ')}`).toBeTruthy();
        expect(in_copy!.id).not.toBe(name.startsWith('A1') ? A1_ID : A2_ID);

        // the exact payload sync would upload for this asset
        const to_server = await db.sync.convertLocalAssetToServer(in_copy!);
        expect(to_server.workspaceId).toBe(ws_copy!.id);
    }

    // originals are untouched
    expect(db.asset.assets.byId.get(A1_ID)?.workspaceId).toBe(W_X);
    expect(db.asset.assets.byId.get(A2_ID)?.workspaceId).toBe(W_X);
    expect(db.workspace.workspaces.byId.get(W_X)?.localName).toBe('X');
}

async function newProject(): Promise<{ db: ProjectFileDb; dir: string; root: string }> {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ims-copy-run-'));
    const dir = path.join(root, 'project');
    fs.mkdirSync(dir, { recursive: true });
    writeOriginalProject(dir);
    const db = new ProjectFileDb(dir);
    await db.init({ id: null, title: 'copy during run', rootWorkspaceId: null });
    return { db, dir, root };
}

async function cleanup(db: ProjectFileDb | null, root: string) {
    if (db) await db.destroy();
    fs.rmSync(root, { recursive: true, force: true });
}

// ─── Ordering 1: single batch (folder event + file events together) ──────────

test('copy during app run, single watcher batch: copies attach to the new workspace', async () => {
    const { db, dir, root } = await newProject();
    try {
        fs.cpSync(path.join(dir, 'X'), path.join(dir, 'X - 2'), { recursive: true });

        await injectAndDrain(db, [
            { type: 'create', path: path.join(dir, 'X - 2') },
            { type: 'create', path: path.join(dir, 'X - 2', '.imw') },
            { type: 'create', path: path.join(dir, 'X - 2', 'A1.ima.json') },
            { type: 'create', path: path.join(dir, 'X - 2', 'A2.ima.json') },
        ]);

        await assertCopyAttachedToItsWorkspace(db);

        // the re-id write-back normalized the legacy positional workspaceId
        const ws_copy = db.workspace.findByLocalDirPath('X - 2')!;
        const on_disk = JSON.parse(fs.readFileSync(path.join(dir, 'X - 2', 'A1.ima.json'), 'utf8'));
        expect(on_disk.workspaceId).toBe(ws_copy.id);
    }
    finally {
        await cleanup(db, root);
    }
});

// ─── Invariant: a workspace id swap re-points already-inserted children ──────

test('workspace id swap at runtime re-points assets and nested workspaces', async () => {
    const { db, root } = await newProject();
    try {
        const child = await db.workspace.workspacesCreate({ title: 'Sub', parentId: W_X });
        expect(child.parentId).toBe(W_X);

        const NEW_ID = 'cccc0000-0000-0000-0000-000000000099';
        const tx = new ProjectFileDbTransaction(db);
        const ws_x = db.workspace.workspaces.byId.get(W_X)!;
        tx.changeWorkspace(ws_x, { ...ws_x, id: NEW_ID });
        await tx.commit({ fsProcessed: true });

        // the old row is gone, children follow the new id
        expect(db.workspace.workspaces.byId.get(W_X)).toBeUndefined();
        expect(db.workspace.workspaces.byId.get(NEW_ID)).toBeDefined();
        expect(db.asset.assets.byId.get(A1_ID)?.workspaceId).toBe(NEW_ID);
        expect(db.asset.assets.byId.get(A2_ID)?.workspaceId).toBe(NEW_ID);
        expect(db.workspace.workspaces.byId.get(child.id)?.parentId).toBe(NEW_ID);

        // re-pointed entities are queued for sync
        const rows: { id: string }[] = await db.dataSource.query(
            'SELECT id FROM assets WHERE need_sync IS NOT NULL');
        expect(rows.map(r => r.id)).toEqual(expect.arrayContaining([A1_ID, A2_ID]));
    }
    finally {
        await cleanup(db, root);
    }
});

// ─── Ordering 2: file events in an earlier batch than the folder event ───────

test('copy during app run, files delivered before the folder: copies still attach to the new workspace', async () => {
    const { db, dir, root } = await newProject();
    try {
        fs.cpSync(path.join(dir, 'X'), path.join(dir, 'X - 2'), { recursive: true });

        // batch 1: only files (folder create not delivered yet)
        await injectAndDrain(db, [
            { type: 'create', path: path.join(dir, 'X - 2', 'A1.ima.json') },
            { type: 'create', path: path.join(dir, 'X - 2', 'A2.ima.json') },
        ]);
        // batch 2: the folder itself
        await injectAndDrain(db, [
            { type: 'create', path: path.join(dir, 'X - 2') },
        ]);

        await assertCopyAttachedToItsWorkspace(db);
    }
    finally {
        await cleanup(db, root);
    }
});

// ─── Ordering 3: folder event while the copy is still empty, files later ─────

test('copy during app run, folder event arrives while empty: copies attach to the new workspace', async () => {
    const { db, dir, root } = await newProject();
    try {
        // dir appears first, contents not yet written
        fs.mkdirSync(path.join(dir, 'X - 2'));
        await injectAndDrain(db, [
            { type: 'create', path: path.join(dir, 'X - 2') },
        ]);
        // files arrive afterwards
        fs.cpSync(path.join(dir, 'X'), path.join(dir, 'X - 2'), { recursive: true });
        await injectAndDrain(db, [
            { type: 'create', path: path.join(dir, 'X - 2', '.imw') },
            { type: 'create', path: path.join(dir, 'X - 2', 'A1.ima.json') },
            { type: 'create', path: path.join(dir, 'X - 2', 'A2.ima.json') },
        ]);

        await assertCopyAttachedToItsWorkspace(db);
    }
    finally {
        await cleanup(db, root);
    }
});

// ─── Ordering 5: folder event while empty, files, then ANOTHER folder event ──
//
// The dangerous one: the first (empty) folder event synthesizes an id; the
// `.imw` arriving later is ignored (not a .json); a subsequent folder event
// re-reads the `.imw`, collides with the original workspace and re-ids the
// folder AFTER children are already inserted.

test('copy during app run, folder event repeats after files: copies attach to the FINAL workspace id', async () => {
    const { db, dir, root } = await newProject();
    try {
        // batch 1: dir appears, still empty → synthesized workspace id
        fs.mkdirSync(path.join(dir, 'X - 2'));
        await injectAndDrain(db, [
            { type: 'create', path: path.join(dir, 'X - 2') },
        ]);
        // batch 2: contents arrive
        fs.cpSync(path.join(dir, 'X'), path.join(dir, 'X - 2'), { recursive: true });
        await injectAndDrain(db, [
            { type: 'create', path: path.join(dir, 'X - 2', '.imw') },
            { type: 'create', path: path.join(dir, 'X - 2', 'A1.ima.json') },
            { type: 'create', path: path.join(dir, 'X - 2', 'A2.ima.json') },
        ]);
        // batch 3: Explorer touches the dir when the copy finishes
        await injectAndDrain(db, [
            { type: 'update', path: path.join(dir, 'X - 2') },
        ]);

        await assertCopyAttachedToItsWorkspace(db);
    }
    finally {
        await cleanup(db, root);
    }
});

// ─── Ordering 4: folder re-event after everything is in place (update) ───────

test('copy during app run, folder update event after files: copies attach to the new workspace', async () => {
    const { db, dir, root } = await newProject();
    try {
        fs.cpSync(path.join(dir, 'X'), path.join(dir, 'X - 2'), { recursive: true });

        await injectAndDrain(db, [
            { type: 'create', path: path.join(dir, 'X - 2', '.imw') },
            { type: 'create', path: path.join(dir, 'X - 2', 'A1.ima.json') },
            { type: 'create', path: path.join(dir, 'X - 2', 'A2.ima.json') },
        ]);
        await injectAndDrain(db, [
            { type: 'update', path: path.join(dir, 'X - 2') },
        ]);

        await assertCopyAttachedToItsWorkspace(db);
    }
    finally {
        await cleanup(db, root);
    }
});
