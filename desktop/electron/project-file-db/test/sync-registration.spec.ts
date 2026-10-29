import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// NOTE: electron / electron-log / electron-json-storage are stubbed globally
// via aliases in vitest.config.ts (test/mocks/*), so ProjectFileDb can be
// initialized headlessly here.

import { ProjectFileDb } from '../ProjectFileDb';

const FIXTURE_DIR = fileURLToPath(new URL('./project-data', import.meta.url));
const PROJECT_ID = 'EWvDFxqn';

async function loadDb(): Promise<{ db: ProjectFileDb; dir: string }> {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ims-sync-registration-'));
    const project_dir = path.join(root, 'project');
    fs.cpSync(FIXTURE_DIR, project_dir, { recursive: true });
    // The fixture may contain a leftover .imsc/.imsc-local/project.db from other specs —
    // each test must start with a freshly initialized database.
    fs.rmSync(path.join(project_dir, '.imsc'), { recursive: true, force: true });
    const db = new ProjectFileDb(project_dir);
    await db.init({ id: PROJECT_ID, title: 'Test project', rootWorkspaceId: null });
    return { db, dir: root };
}

async function cleanup(db: ProjectFileDb, dir: string) {
    await db.destroy();
    fs.rmSync(dir, { recursive: true, force: true });
}

async function queryIds(db: ProjectFileDb, table: 'assets' | 'workspaces'): Promise<string[]> {
    const rows: { id: string }[] = await db.dataSource.query(`SELECT id FROM ${table}`);
    return rows.map(row => row.id);
}

function userAssetIds(db: ProjectFileDb): string[] {
    return [...db.asset.assets.iterate()]
        .filter(asset => asset.projectId === PROJECT_ID)
        .map(asset => asset.id);
}

function userWorkspaceIds(db: ProjectFileDb): string[] {
    return [...db.workspace.workspaces.iterate()]
        .filter(workspace => workspace.projectId === PROJECT_ID)
        .map(workspace => workspace.id);
}

test('project init registers every user asset and workspace in the sync tables', async () => {
    const { db, dir } = await loadDb();
    try {
        const expected_assets = userAssetIds(db);
        expect(expected_assets.length).toBeGreaterThan(0);
        // System assets (other projectId) must never be registered for sync
        const system_assets = [...db.asset.assets.iterate()]
            .filter(asset => asset.projectId !== PROJECT_ID);
        expect(system_assets.length).toBeGreaterThan(0);

        const asset_rows: { id: string; need_sync: string | null }[] =
            await db.dataSource.query('SELECT id, need_sync FROM assets');
        expect(asset_rows.map(row => row.id).sort()).toEqual([...expected_assets].sort());
        for (const row of asset_rows) {
            expect(row.need_sync).not.toBeNull();
        }
        for (const system_asset of system_assets) {
            expect(asset_rows.some(row => row.id === system_asset.id)).toBe(false);
        }

        const expected_workspaces = userWorkspaceIds(db);
        expect(expected_workspaces.length).toBeGreaterThan(0);
        const workspace_rows: { id: string; need_sync: string | null }[] =
            await db.dataSource.query('SELECT id, need_sync FROM workspaces');
        expect(workspace_rows.map(row => row.id).sort()).toEqual([...expected_workspaces].sort());
        for (const row of workspace_rows) {
            expect(row.need_sync).not.toBeNull();
        }
    }
    finally {
        await cleanup(db, dir);
    }
});

test('resyncAll re-registers entities missing from the sync tables', async () => {
    const { db, dir } = await loadDb();
    try {
        // Simulate a broken project: entities exist on disk/in memory but their
        // sync rows were never written (the original bug).
        await db.dataSource.query('DELETE FROM assets');
        await db.dataSource.query('DELETE FROM workspaces');
        expect(await queryIds(db, 'assets')).toEqual([]);
        expect(await queryIds(db, 'workspaces')).toEqual([]);

        // No cloud account in tests — syncProject() exits after registration,
        // which is exactly what must happen for Re-sync to repair the project.
        await db.sync.resyncAll();

        expect((await queryIds(db, 'assets')).sort()).toEqual([...userAssetIds(db)].sort());
        expect((await queryIds(db, 'workspaces')).sort()).toEqual([...userWorkspaceIds(db)].sort());

        const unmarked: { id: string }[] = await db.dataSource.query(
            'SELECT id FROM assets WHERE need_sync IS NULL',
        );
        expect(unmarked).toEqual([]);
    }
    finally {
        await cleanup(db, dir);
    }
});

test('ensureEntitiesRegistered is idempotent and never touches existing rows', async () => {
    const { db, dir } = await loadDb();
    try {
        await db.dataSource.query(
            `UPDATE assets SET need_sync = '2020-01-01T00:00:00.000Z', synced_at = '2020-01-01T00:00:01.000Z'`,
        );
        const before: { id: string; need_sync: string; synced_at: string }[] =
            await db.dataSource.query('SELECT id, need_sync, synced_at FROM assets');
        expect(before.length).toBeGreaterThan(0);

        await db.sync.ensureEntitiesRegistered();
        await db.sync.ensureEntitiesRegistered();

        const after: { id: string; need_sync: string; synced_at: string }[] =
            await db.dataSource.query('SELECT id, need_sync, synced_at FROM assets');
        expect(after).toEqual(before);
    }
    finally {
        await cleanup(db, dir);
    }
});

test('local-only project registers nothing in the sync tables', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ims-sync-registration-'));
    const project_dir = path.join(root, 'project');
    fs.cpSync(FIXTURE_DIR, project_dir, { recursive: true });
    // Start from a freshly initialized database (no leftover rows to inherit).
    fs.rmSync(path.join(project_dir, '.imsc'), { recursive: true, force: true });
    const db = new ProjectFileDb(project_dir);
    try {
        await db.init({ id: null, title: 'Local project', rootWorkspaceId: null });
        expect(await queryIds(db, 'assets')).toEqual([]);
        expect(await queryIds(db, 'workspaces')).toEqual([]);

        await db.sync.resyncAll();
        expect(await queryIds(db, 'assets')).toEqual([]);
        expect(await queryIds(db, 'workspaces')).toEqual([]);
    }
    finally {
        await cleanup(db, root);
    }
});
