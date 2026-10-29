import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// NOTE: electron / electron-log / electron-json-storage are stubbed globally
// via aliases in vitest.config.ts (test/mocks/*), so ProjectFileDb can be
// initialized headlessly here. The parcel watcher is stubbed per-file: these
// tests exercise server-state clearing at the detach/re-bind boundary, not
// watcher delivery — and it removes native watcher crashes from the equation.
vi.mock('@parcel/watcher', () => ({
    default: {
        subscribe: async () => ({ unsubscribe: async () => {} }),
        writeSnapshot: async () => {},
    },
}));

import { ProjectFileDb } from '../ProjectFileDb';
import { SyncCurrentStateStatus } from '#bridge/types/SyncTypes';

const FIXTURE_DIR = fileURLToPath(new URL('./project-data', import.meta.url));
const PROJECT_ID = 'EWvDFxqn';
const OLD_ROOT_ID = '33333333-4444-4444-8444-555555555555';
const NEW_ROOT_ID = '77777777-8888-4444-8444-999999999999';

function makeProject(): { dir: string; root: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ims-server-state-'));
    const dir = path.join(root, 'project');
    fs.cpSync(FIXTURE_DIR, dir, { recursive: true });
    fs.rmSync(path.join(dir, '.imsc'), { recursive: true, force: true });
    return { dir, root };
}

function cleanup(root: string) {
    fs.rmSync(root, { recursive: true, force: true });
}

/** Everything a previous cloud binding can leave behind in the project DB. */
async function poisonWithPreviousBinding(db: ProjectFileDb): Promise<void> {
    // server snapshots whose parent/workspace ids point at the OLD root
    const stale_state = JSON.stringify({ workspaceId: OLD_ROOT_ID, parentId: OLD_ROOT_ID });
    for (const table of ['assets', 'workspaces']) {
        await db.dataSource.query(
            `UPDATE ${table} SET server_state = ?, synced_at = ?, need_sync = ?, conflict = ?, conflict_message = ?`,
            [stale_state, '2020-01-01T00:00:00.000Z', '2020-01-02T00:00:00.000Z', 'ERROR',
                "Workspace doesn't exist in project"],
        );
    }
    // attachment upload mapping from the old file storage
    await db.dataSource.query(
        `INSERT INTO files (server_file_id, local_path, server_store, created_at) VALUES (?, ?, ?, ?)`,
        ['ffffffff-0000-0000-0000-000000000001', 'attachments/old.png', 'store-old', '2020-01-01T00:00:00.000Z'],
    );
    // sync cursor + error history of the old binding
    await db.dataSource.query(`INSERT INTO sync_logs (sync_start) VALUES (?)`, ['2020-01-01T00:00:00.000Z']);
    await db.sync.changeCurrentState({ error: 'stale cloud error' });
    await db.sync.pauseSyncProject();
}

async function tableCounts(db: ProjectFileDb): Promise<Record<'assets' | 'workspaces' | 'files' | 'sync_logs', number>> {
    const count = async (table: string): Promise<number> => {
        const rows: { n: number }[] = await db.dataSource.query(`SELECT COUNT(*) AS n FROM ${table}`);
        return rows[0].n;
    };
    return {
        assets: await count('assets'),
        workspaces: await count('workspaces'),
        files: await count('files'),
        sync_logs: await count('sync_logs'),
    };
}

test('detach clears every trace of the previous cloud binding', async () => {
    const { dir, root } = makeProject();
    const db = new ProjectFileDb(dir);
    try {
        await db.init({ id: PROJECT_ID, title: 'Test project', rootWorkspaceId: OLD_ROOT_ID, recreate: true });
        await poisonWithPreviousBinding(db);

        // What unlinkCloudProject does: recreate as local-only, then clear.
        await db.init({ id: null, title: 'Test project', rootWorkspaceId: null, recreate: true });
        await db.sync.clearServerState();

        expect(await tableCounts(db)).toEqual({ assets: 0, workspaces: 0, files: 0, sync_logs: 0 });

        const state = await db.sync.getCurrentSyncState();
        expect(state.error).toBeNull();
        expect(state.status).not.toBe(SyncCurrentStateStatus.PAUSE);
        // the old binding's pause flag must not survive into a future bind
        expect(await db.settings.getKey('syncOnPause', false)).toBe(false);
    }
    finally {
        await db.destroy().catch(() => {});
        cleanup(root);
    }
});

test('re-bind after clearing starts fresh: registration without any server_state', async () => {
    const { dir, root } = makeProject();
    const db = new ProjectFileDb(dir);
    try {
        await db.init({ id: PROJECT_ID, title: 'Test project', rootWorkspaceId: OLD_ROOT_ID, recreate: true });
        await poisonWithPreviousBinding(db);
        await db.init({ id: null, title: 'Test project', rootWorkspaceId: null, recreate: true });
        await db.sync.clearServerState();

        // Bind to a NEW cloud project — ensureEntitiesRegistered must rebuild
        // the sync rows from scratch (need_sync set, no stale snapshots).
        await db.init({ id: PROJECT_ID, title: 'Test project', rootWorkspaceId: NEW_ROOT_ID, recreate: true });
        expect(db.RootGddFolder.id).toBe(NEW_ROOT_ID);

        for (const table of ['assets', 'workspaces']) {
            const rows: { need_sync: string | null, server_state: string | null, conflict: string | null }[] =
                await db.dataSource.query(`SELECT need_sync, server_state, conflict FROM ${table}`);
            expect(rows.length).toBeGreaterThan(0);
            for (const row of rows) {
                expect(row.need_sync).not.toBeNull();
                expect(row.server_state).toBeNull();
                expect(row.conflict).toBeNull();
            }
        }
        // nothing else from the old binding either
        expect(await tableCounts(db)).toMatchObject({ files: 0, sync_logs: 0 });
    }
    finally {
        await db.destroy().catch(() => {});
        cleanup(root);
    }
});
