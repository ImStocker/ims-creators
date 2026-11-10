import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// NOTE: electron / electron-log / electron-json-storage are stubbed globally
// via aliases in vitest.config.ts (test/mocks/*), so ProjectFileDb can be
// initialized headlessly here.

// An attachment upload is a real HTTP POST to the file storage — stub axios so
// these specs can assert what the sync pushed without leaving the machine.
vi.mock('axios', () => {
    const mock = vi.fn();
    return { default: mock, get: mock, post: mock, create: () => mock };
});

import axios from 'axios';
import type { AssetPropValueFile } from '~ims-app-base/logic/types/Props';
import { ProjectFileDb } from '../ProjectFileDb';

const FIXTURE_DIR = fileURLToPath(new URL('./project-data', import.meta.url));
const PROJECT_ID = 'EWvDFxqn';

const ASSET_ID = '55555555-5555-4555-8555-555555555555';
const LOCAL_FILE_ID = '99999999-9999-4999-8999-999999999999';
const CLOUD_FILE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

type ApiMock = {
    /** Assets the simulated server knows about (id -> AssetFull-ish). */
    server_assets: Map<string, Record<string, any>>;
    /** Payloads passed to assets/create, in call order. */
    create_calls: { id: string; set: Record<string, any> }[];
    /** Endpoints passed to api.download (server-side attachment fetches). */
    download_attempts: string[];
};

/**
 * Replace db.api.call / db.api.download with an in-memory server: assets/full
 * answers from `server_assets`, assets/create stores an echo of the local asset
 * in its server shape, the file-storage token endpoint answers, and every
 * download fails — a server whose attachment is gone. Anything else throws, so
 * the test fails loudly on an unexpected endpoint.
 */
function installApiMock(db: ProjectFileDb): ApiMock {
    const mock: ApiMock = {
        server_assets: new Map(),
        create_calls: [],
        download_attempts: [],
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
            mock.create_calls.push({ id: params.id, set: params.set });
            const local = db.asset.assets.byId.get(params.id);
            if (!local) throw new Error(`assets/create for an unknown asset: ${params.id}`);
            const server_asset = await db.sync.convertLocalAssetToServer(local);
            mock.server_assets.set(params.id, server_asset);
            return { objects: { assetFulls: { [params.id]: server_asset } }, total: 1 };
        }
        if (/^file\/p-[^/]+\/token$/.test(endpoint)) {
            return { token: 'test-token' };
        }
        throw new Error(`Unexpected api call: ${method} ${endpoint}`);
    };
    (db.api as any).download = async (_service: any, _method: string, endpoint: string) => {
        mock.download_attempts.push(endpoint);
        throw new Error('File not found');
    };
    return mock;
}

async function loadDb(): Promise<{ db: ProjectFileDb; dir: string }> {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ims-sync-missing-file-'));
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

/** Settle every pre-existing sync row so only the test's own asset is pending. */
async function markAllSynced(db: ProjectFileDb) {
    await db.dataSource.query('UPDATE assets SET synced_at = need_sync');
    await db.dataSource.query('UPDATE workspaces SET synced_at = need_sync');
}

async function getAssetRow(db: ProjectFileDb, id: string): Promise<{
    need_sync: string | null;
    synced_at: string | null;
    conflict: string | null;
    conflict_message: string | null;
    server_state: string | null;
}> {
    const rows = await db.dataSource.query(
        'SELECT need_sync, synced_at, conflict, conflict_message, server_state FROM assets WHERE id = ?',
        [id],
    );
    expect(rows.length).toBe(1);
    return rows[0];
}

async function createAssetWithFileProp(db: ProjectFileDb, file_prop: AssetPropValueFile) {
    await db.asset.assetsCreate({
        id: ASSET_ID,
        set: {
            title: 'Asset with attachment',
            blocks: {
                fileblock: {
                    name: 'fileblock',
                    title: 'File block',
                    type: 'props',
                    index: 0,
                    props: { myfile: file_prop },
                },
            },
        },
    });
}

/** The `myfile` prop as it was pushed to the server (props changes are [from, to]). */
function findPushedFileProp(set: Record<string, any>): AssetPropValueFile | undefined {
    for (const block of Object.values(set.blocks ?? {}) as any[]) {
        const changes: any[] = Array.isArray(block.props) ? block.props : [block.props];
        for (const change of changes) {
            if (change && change.myfile) return change.myfile;
        }
    }
    return undefined;
}

function axiosCallCount(): number {
    return (axios as any).mock.calls.length;
}

test('a deleted local attachment does not fail the asset: the prop is pushed as-is', async () => {
    const { db, dir } = await loadDb();
    try {
        await markAllSynced(db);
        const mock = installApiMock(db);
        // attachments/gone.png is deliberately never written to disk.
        await createAssetWithFileProp(db, {
            FileId: LOCAL_FILE_ID, Title: 'gone.png', Size: 10, Dir: 'attachments', Store: 'loc-project',
        });
        const uploads_before = axiosCallCount();

        await db.sync.syncAssetsAndWorkspaces();

        expect(mock.create_calls.length).toBe(1);
        const pushed = findPushedFileProp(mock.create_calls[0].set);
        expect(pushed).toBeTruthy();
        expect(pushed!.Store).toBe('loc-project');
        expect(pushed!.FileId).toBe(LOCAL_FILE_ID);
        // Nothing could be uploaded — and nothing was.
        expect(axiosCallCount()).toBe(uploads_before);

        const row = await getAssetRow(db, ASSET_ID);
        expect(row.conflict).toBeNull();
        expect(row.conflict_message).toBeNull();
    }
    finally {
        await cleanup(db, dir);
    }
});

test('a deleted attachment that was uploaded before reuses its cloud reference', async () => {
    const { db, dir } = await loadDb();
    try {
        await markAllSynced(db);
        const mock = installApiMock(db);
        await db.dataSource.query(
            `INSERT INTO files (server_file_id, local_path, server_store, created_at) VALUES (?, ?, ?, ?)`,
            [CLOUD_FILE_ID, path.join('attachments', 'gone.png'), 'cloud-files', '2026-01-01T00:00:00.000Z'],
        );
        await createAssetWithFileProp(db, {
            FileId: LOCAL_FILE_ID, Title: 'gone.png', Size: 10, Dir: 'attachments', Store: 'loc-project',
        });
        const uploads_before = axiosCallCount();

        await db.sync.syncAssetsAndWorkspaces();

        expect(mock.create_calls.length).toBe(1);
        const pushed = findPushedFileProp(mock.create_calls[0].set);
        expect(pushed).toBeTruthy();
        // The cloud file recorded for this path goes out instead of the local prop.
        expect(pushed!.Store).toBe('cloud-files');
        expect(pushed!.FileId).toBe(CLOUD_FILE_ID);
        expect(axiosCallCount()).toBe(uploads_before);

        const row = await getAssetRow(db, ASSET_ID);
        expect(row.conflict).toBeNull();
        expect(row.conflict_message).toBeNull();
    }
    finally {
        await cleanup(db, dir);
    }
});

test('an attachment outside attachments/ is uploaded from its Dir/Title path', async () => {
    const { db, dir } = await loadDb();
    try {
        await markAllSynced(db);
        const mock = installApiMock(db);
        fs.mkdirSync(path.join(db.localPath, 'assets'), { recursive: true });
        fs.writeFileSync(path.join(db.localPath, 'assets', 'logo.png'), 'hello');
        (axios as any).mockResolvedValue({
            data: { fileId: CLOUD_FILE_ID, title: 'logo.png', size: 5, dir: 'assets', store: 'cloud-files' },
        });
        await createAssetWithFileProp(db, {
            FileId: LOCAL_FILE_ID, Title: 'logo.png', Size: 5, Dir: 'assets', Store: 'loc-project',
        });

        await db.sync.syncAssetsAndWorkspaces();

        expect(axiosCallCount()).toBeGreaterThan(0);
        expect(mock.create_calls.length).toBe(1);
        const pushed = findPushedFileProp(mock.create_calls[0].set);
        expect(pushed).toBeTruthy();
        expect(pushed!.Store).toBe('cloud-files');
        expect(pushed!.FileId).toBe(CLOUD_FILE_ID);
        expect(JSON.stringify(mock.create_calls[0].set)).not.toContain('loc-project');

        const files: { server_file_id: string; server_store: string }[] = await db.dataSource.query(
            'SELECT server_file_id, server_store FROM files WHERE local_path = ?',
            [path.join('assets', 'logo.png')],
        );
        expect(files.length).toBe(1);
        expect(files[0].server_file_id).toBe(CLOUD_FILE_ID);

        const row = await getAssetRow(db, ASSET_ID);
        expect(row.conflict).toBeNull();
        expect(row.conflict_message).toBeNull();
    }
    finally {
        await cleanup(db, dir);
    }
});

test('a broken server-side attachment link does not fail the asset sync', async () => {
    const { db, dir } = await loadDb();
    try {
        await markAllSynced(db);
        const mock = installApiMock(db);
        await createAssetWithFileProp(db, {
            FileId: CLOUD_FILE_ID, Title: 'remote.png', Size: 5, Dir: null, Store: 'cloud-files',
        });

        // The asset already sits on the server in exactly this state, so the run
        // only has to pull it back down — and the download fails every time.
        const local = db.asset.assets.byId.get(ASSET_ID);
        expect(local).toBeTruthy();
        const server_asset = await db.sync.convertLocalAssetToServer(local!);
        mock.server_assets.set(ASSET_ID, server_asset);
        await db.dataSource.query('UPDATE assets SET server_state = ? WHERE id = ?',
            [JSON.stringify(server_asset), ASSET_ID]);

        await db.sync.syncAssetsAndWorkspaces();

        // props + computed both carry the file value, so each is pulled once.
        expect(mock.download_attempts.length).toBeGreaterThan(0);
        for (const endpoint of mock.download_attempts) {
            expect(endpoint).toBe(`file/cloud-files/${CLOUD_FILE_ID}`);
        }
        // No local changes, so nothing was pushed.
        expect(mock.create_calls.length).toBe(0);

        const row = await getAssetRow(db, ASSET_ID);
        expect(row.conflict).toBeNull();
        expect(row.conflict_message).toBeNull();

        // The prop keeps its server reference — it is retried on a later sync.
        const local_after = db.asset.assets.byId.get(ASSET_ID)!;
        const block = local_after.blocks.find((b) => b.name === 'fileblock');
        expect(block).toBeTruthy();
        const prop = block!.props.myfile as AssetPropValueFile;
        expect(prop.Store).toBe('cloud-files');
        expect(prop.FileId).toBe(CLOUD_FILE_ID);
    }
    finally {
        await cleanup(db, dir);
    }
});
