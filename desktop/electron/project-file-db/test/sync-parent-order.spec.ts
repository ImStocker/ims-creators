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

const PARENT_ID = '11111111-1111-4111-8111-111111111111';
const CHILD_ID = '22222222-2222-4222-8222-222222222222';
const CYCLE_A_ID = '33333333-3333-4333-8333-333333333333';
const CYCLE_B_ID = '44444444-4444-4444-8444-444444444444';

type ApiMock = {
    /** Assets the simulated server knows about (id -> AssetFull-ish). */
    server_assets: Map<string, Record<string, any>>;
    /** Ids passed to assets/create, in call order. */
    create_attempts: string[];
    /** Ids whose assets/create must fail (simulated server-side rejection). */
    fail_create: Set<string>;
};

/**
 * Replace db.api.call with an in-memory server: assets/full answers from
 * `server_assets`, assets/create registers the asset unless its id is in
 * `fail_create`. Anything else throws, so the test fails loudly on an
 * unexpected endpoint.
 */
function installApiMock(db: ProjectFileDb): ApiMock {
    const mock: ApiMock = {
        server_assets: new Map(),
        create_attempts: [],
        fail_create: new Set(),
    };
    (db.api as any).call = async (_service: any, method: string, endpoint: string, params?: any) => {
        if (endpoint === 'assets/full') {
            const where = JSON.parse(params.where);
            const assetFulls: Record<string, any> = {};
            for (const id of where.id as string[]) {
                const asset = mock.server_assets.get(id);
                if (asset) assetFulls[id] = asset;
            }
            return { objects: { assetFulls }, total: Object.keys(assetFulls).length };
        }
        if (endpoint === 'assets/create') {
            mock.create_attempts.push(params.id);
            if (mock.fail_create.has(params.id)) {
                throw new Error(`Parent asset not found: ${params.id}`);
            }
            // Echo the pushed change back the way the server would.
            const full = {
                id: params.id,
                title: params.set?.title ?? null,
                name: params.set?.name ?? null,
                index: params.set?.index ?? null,
                ownIcon: params.set?.icon ?? null,
                isAbstract: params.set?.isAbstract ?? false,
                parentIds: params.set?.parentIds ?? [],
                workspaceId: params.set?.workspaceId ?? null,
                blocks: [],
            };
            mock.server_assets.set(params.id, full);
            return { objects: { assetFulls: { [params.id]: full } }, total: 1 };
        }
        throw new Error(`Unexpected api call: ${method} ${endpoint}`);
    };
    return mock;
}

async function loadDb(): Promise<{ db: ProjectFileDb; dir: string }> {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ims-sync-parent-order-'));
    const project_dir = path.join(root, 'project');
    fs.cpSync(FIXTURE_DIR, project_dir, { recursive: true });
    // Each test must start with a freshly initialized database.
    fs.rmSync(path.join(project_dir, '.imsc'), { recursive: true, force: true });
    const db = new ProjectFileDb(project_dir);
    await db.init({ id: PROJECT_ID, title: 'Test project', rootWorkspaceId: null });
    return { db, dir: root };
}

async function cleanup(db: ProjectFileDb, dir: string) {
    await db.destroy();
    fs.rmSync(dir, { recursive: true, force: true });
}

/** Settle every pre-existing sync row so only the test's own assets are pending. */
async function markAllSynced(db: ProjectFileDb) {
    await db.dataSource.query('UPDATE assets SET synced_at = need_sync');
    await db.dataSource.query('UPDATE workspaces SET synced_at = need_sync');
}

async function getAssetRow(db: ProjectFileDb, id: string): Promise<{
    need_sync: string | null;
    synced_at: string | null;
    conflict: string | null;
    server_state: string | null;
}> {
    const rows = await db.dataSource.query(
        'SELECT need_sync, synced_at, conflict, server_state FROM assets WHERE id = ?',
        [id],
    );
    expect(rows.length).toBe(1);
    return rows[0];
}

test('a failed parent blocks its child; the next run re-pushes the parent and then the child', async () => {
    const { db, dir } = await loadDb();
    try {
        await markAllSynced(db);
        const mock = installApiMock(db);

        await db.asset.assetsCreate({ id: PARENT_ID, set: { title: 'Parent' } });
        await db.asset.assetsCreate({ id: CHILD_ID, set: { title: 'Child', parentIds: [PARENT_ID] } });

        mock.fail_create.add(PARENT_ID);
        await db.sync.syncAssetsAndWorkspaces();

        // The parent was attempted and failed; the child must NOT have been pushed.
        expect(mock.create_attempts).toContain(PARENT_ID);
        expect(mock.create_attempts).not.toContain(CHILD_ID);

        const child_row = await getAssetRow(db, CHILD_ID);
        expect(child_row.conflict).toBeNull();
        // Left untouched — still pending for the next run.
        expect(child_row.synced_at).toBeNull();

        const parent_row = await getAssetRow(db, PARENT_ID);
        expect(parent_row.conflict).toBe('ERROR');

        // Exactly the blocked child is still waiting for upload.
        expect(await (db.sync as any)._countPendingSyncRows()).toBe(1);

        // The failure clears: the next run heals the parent first, then the child.
        mock.fail_create.delete(PARENT_ID);
        await db.sync.syncAssetsAndWorkspaces();

        expect(mock.create_attempts.filter(id => id === PARENT_ID).length).toBe(2);
        expect(mock.create_attempts).toContain(CHILD_ID);

        const parent_after = await getAssetRow(db, PARENT_ID);
        expect(parent_after.conflict).toBeNull();
        expect(parent_after.server_state).not.toBeNull();
        expect(parent_after.server_state).not.toBe('null');

        const child_after = await getAssetRow(db, CHILD_ID);
        expect(child_after.conflict).toBeNull();
        expect(child_after.server_state).not.toBeNull();
        expect(child_after.server_state).not.toBe('null');
        expect(child_after.synced_at).not.toBeNull();

        // Everything settled — nothing left to report as pending.
        expect(await (db.sync as any)._countPendingSyncRows()).toBe(0);
    }
    finally {
        await cleanup(db, dir);
    }
});

test('a parent cycle cannot stall the sync run', async () => {
    const { db, dir } = await loadDb();
    try {
        await markAllSynced(db);
        const mock = installApiMock(db);

        await db.asset.assetsCreate({ id: CYCLE_A_ID, set: { title: 'A' } });
        await db.asset.assetsCreate({ id: CYCLE_B_ID, set: { title: 'B', parentIds: [CYCLE_A_ID] } });
        // Close the cycle by direct mutation: the normal change API computes full
        // assets recursively and would itself overflow on a cycle long before
        // sync runs — a cycle can only arrive via corrupted or server-pulled data,
        // which is exactly what the sync-time guard has to survive.
        const asset_a = db.asset.assets.byId.get(CYCLE_A_ID);
        expect(asset_a).toBeTruthy();
        asset_a!.parentIds = [CYCLE_B_ID];

        // Must complete (no infinite recursion) and push both sides of the cycle.
        await db.sync.syncAssetsAndWorkspaces();

        expect(mock.create_attempts).toContain(CYCLE_A_ID);
        expect(mock.create_attempts).toContain(CYCLE_B_ID);

        const a_row = await getAssetRow(db, CYCLE_A_ID);
        expect(a_row.conflict).toBeNull();
        expect(a_row.server_state).not.toBeNull();
        expect(a_row.server_state).not.toBe('null');

        const b_row = await getAssetRow(db, CYCLE_B_ID);
        expect(b_row.conflict).toBeNull();
        expect(b_row.server_state).not.toBe('null');
    }
    finally {
        await cleanup(db, dir);
    }
});

test('a parent missing from the sync tables is registered and pushed before the child', async () => {
    const { db, dir } = await loadDb();
    try {
        await markAllSynced(db);
        const mock = installApiMock(db);

        await db.asset.assetsCreate({ id: PARENT_ID, set: { title: 'Parent' } });
        await db.asset.assetsCreate({ id: CHILD_ID, set: { title: 'Child', parentIds: [PARENT_ID] } });
        // Simulate the registration leak: the parent exists locally but has no
        // sync row at all, so it is invisible to the pending-batch query.
        await db.dataSource.query('DELETE FROM assets WHERE id = ?', [PARENT_ID]);

        await db.sync.syncAssetsAndWorkspaces();

        // Parent healed first (registered + pushed), then the child.
        expect(mock.create_attempts).toEqual([PARENT_ID, CHILD_ID]);

        const parent_row = await getAssetRow(db, PARENT_ID);
        expect(parent_row.server_state).not.toBeNull();
        expect(parent_row.server_state).not.toBe('null');
        expect(parent_row.conflict).toBeNull();

        const child_row = await getAssetRow(db, CHILD_ID);
        expect(child_row.conflict).toBeNull();
        expect(child_row.server_state).not.toBeNull();
        expect(child_row.server_state).not.toBe('null');
    }
    finally {
        await cleanup(db, dir);
    }
});
