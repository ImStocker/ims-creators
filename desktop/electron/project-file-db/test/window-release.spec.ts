import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BrowserWindow } from 'electron';

// NOTE: electron / electron-log / electron-json-storage are stubbed globally
// via aliases in vitest.config.ts (test/mocks/*), so ProjectFileDb can be
// initialized headlessly here.

import { requestProjectDb, releaseProjectDbForWindow, closeProjectDb } from '../project-registry';

const FIXTURE_DIR = fileURLToPath(new URL('./project-data', import.meta.url));
const PROJECT_ID = 'EWvDFxqn';

/** The registry only uses windows as Set keys — a plain object will do. */
const fakeWindow = () => ({}) as BrowserWindow;

function makeProject(prefix: string): { dir: string; root: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    const dir = path.join(root, 'project');
    fs.cpSync(FIXTURE_DIR, dir, { recursive: true });
    fs.rmSync(path.join(dir, '.imsc'), { recursive: true, force: true });
    return { dir, root };
}

function cleanup(root: string) {
    fs.rmSync(root, { recursive: true, force: true });
}

/** A destroyed ProjectFileDb has no info; an inited one always does. */
function isAlive(db: ReturnType<typeof requestProjectDb>): boolean {
    try {
        return !!db.info;
    } catch {
        return false;
    }
}

// ─── window release ──────────────────────────────────────────────────────────

test('last window release destroys the db; other windows keep it alive', async () => {
    const { dir, root } = makeProject('ims-window-release-');
    const winA = fakeWindow();
    const winB = fakeWindow();
    try {
        const db = requestProjectDb(dir, winA);
        await db.init({ id: PROJECT_ID, title: 'Test project', rootWorkspaceId: null });
        requestProjectDb(dir, winB);
        expect(isAlive(db)).toBe(true);

        // First window gone: the second still owns the project — the folder
        // must stay locked (db, watcher and all).
        await releaseProjectDbForWindow(winA);
        expect(isAlive(db)).toBe(true);
        expect(requestProjectDb(dir)).toBe(db);

        // Last window gone: the db must be destroyed so SQLite and the
        // parcel watcher release the project folder.
        await releaseProjectDbForWindow(winB);
        expect(isAlive(db)).toBe(false);

        // The entry left the map: the next open gets a fresh instance.
        const reopened = requestProjectDb(dir);
        expect(reopened).not.toBe(db);
        await closeProjectDb(dir);
    }
    finally {
        cleanup(root);
    }
});

test('releasing a window that never held the project is a no-op', async () => {
    const { dir, root } = makeProject('ims-window-release-');
    const holder = fakeWindow();
    const stranger = fakeWindow();
    try {
        const db = requestProjectDb(dir, holder);
        await db.init({ id: PROJECT_ID, title: 'Test project', rootWorkspaceId: null });

        await releaseProjectDbForWindow(stranger);
        expect(isAlive(db)).toBe(true);

        await releaseProjectDbForWindow(holder);
        expect(isAlive(db)).toBe(false);
    }
    finally {
        await closeProjectDb(dir).catch(() => {});
        cleanup(root);
    }
});

test('beforeDestroy runs while the db is still alive and receives its path', async () => {
    const { dir, root } = makeProject('ims-window-release-');
    const win = fakeWindow();
    try {
        const db = requestProjectDb(dir, win);
        await db.init({ id: PROJECT_ID, title: 'Test project', rootWorkspaceId: null });

        const seen: string[] = [];
        await releaseProjectDbForWindow(win, async (projectPath) => {
            // MCP sessions must be closed against a live db — mirroring the
            // ordering closeProject() already guarantees.
            expect(isAlive(db)).toBe(true);
            seen.push(projectPath);
        });

        expect(seen).toEqual([path.normalize(dir)]);
        expect(isAlive(db)).toBe(false);
    }
    finally {
        await closeProjectDb(dir).catch(() => {});
        cleanup(root);
    }
});

test('a failing beforeDestroy does not prevent the destroy', async () => {
    const { dir, root } = makeProject('ims-window-release-');
    const win = fakeWindow();
    try {
        const db = requestProjectDb(dir, win);
        await db.init({ id: PROJECT_ID, title: 'Test project', rootWorkspaceId: null });

        await releaseProjectDbForWindow(win, async () => {
            throw new Error('MCP close failed');
        });
        expect(isAlive(db)).toBe(false);
    }
    finally {
        await closeProjectDb(dir).catch(() => {});
        cleanup(root);
    }
});

test('a rejecting destroy does not block releasing other projects', async () => {
    const a = makeProject('ims-window-release-');
    const b = makeProject('ims-window-release-');
    const win = fakeWindow();
    let dbA: ReturnType<typeof requestProjectDb> | null = null;
    let dbB: ReturnType<typeof requestProjectDb> | null = null;
    try {
        dbA = requestProjectDb(a.dir, win);
        await dbA.init({ id: PROJECT_ID, title: 'Project A', rootWorkspaceId: null });
        dbB = requestProjectDb(b.dir, win);
        await dbB.init({ id: PROJECT_ID, title: 'Project B', rootWorkspaceId: null });

        // One project's teardown fails (e.g. a hung watcher) — the other must
        // still be released, and the call itself must not reject.
        const failing = vi
            .spyOn(dbA, 'destroy')
            .mockRejectedValue(new Error('destroy failed'));

        await expect(releaseProjectDbForWindow(win)).resolves.toBeUndefined();

        expect(isAlive(dbB)).toBe(false);

        failing.mockRestore();
        await dbA.destroy().catch(() => {});
    }
    finally {
        await closeProjectDb(a.dir).catch(() => {});
        await closeProjectDb(b.dir).catch(() => {});
        cleanup(a.root);
        cleanup(b.root);
    }
});
