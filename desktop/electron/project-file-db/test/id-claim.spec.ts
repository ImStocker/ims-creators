import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// NOTE: electron / electron-log / electron-json-storage are stubbed globally
// via aliases in vitest.config.ts (test/mocks/*), so ProjectFileDb can be
// initialized headlessly here. The parcel watcher is stubbed per-file: these
// tests exercise id-claim resolution (load/write-back/reload), not watcher
// delivery — and it removes native watcher teardown from the equation.
vi.mock('@parcel/watcher', () => ({
    default: {
        subscribe: async () => ({ unsubscribe: async () => {} }),
        writeSnapshot: async () => {},
    },
}));

import { ProjectFileDb } from '../ProjectFileDb';
import {
    resolveWorkspaceClaims,
    compareClaimInfo,
    type WorkspaceClaimant,
} from '../logic/id-claim';
import { absolutePathToUuid } from '../utils/files';

// ─── Pure resolution logic ────────────────────────────────────────────────────

const ROOT = path.join(os.tmpdir(), 'ims-id-claim-unit-root');

function claimant(overrides: Partial<WorkspaceClaimant>): WorkspaceClaimant {
    return {
        keyPath: 'k',
        kind: 'folder',
        folderPath: 'f',
        id: 'id-1',
        claimedAt: null,
        parsed: {},
        relPath: 'x',
        ...overrides,
    };
}

const noTaken = async () => false;
const randomId = () => 'random-id-' + Math.random().toString(16).slice(2);

test('claim chain: explicit claim beats fieldless, earlier claim wins, path breaks ties', () => {
    const fielded_late = claimant({ claimedAt: 2000, relPath: 'a' });
    const fielded_early = claimant({ claimedAt: 1000, relPath: 'b' });
    const fieldless = claimant({ claimedAt: null, relPath: 'c' });

    expect(compareClaimInfo(fielded_early, fielded_late)).toBeLessThan(0);
    expect(compareClaimInfo(fielded_late, fielded_early)).toBeGreaterThan(0);
    expect(compareClaimInfo(fielded_late, fieldless)).toBeLessThan(0);
    // equal claims → binary path comparison (locale-independent)
    expect(compareClaimInfo(
        claimant({ relPath: 'A/x' }),
        claimant({ relPath: 'B/x' }),
    )).toBeLessThan(0);
    expect(compareClaimInfo(
        claimant({ relPath: 'B/x' }),
        claimant({ relPath: 'A/x' }),
    )).toBeGreaterThan(0);
});

test('copy-extension claimant loses regardless of path order (relational, any localization)', () => {
    // 'X - 2/…' < 'X/…' in binary compare — the copy must still lose
    expect(compareClaimInfo(
        claimant({ relPath: 'X - 2/.imw' }),
        claimant({ relPath: 'X/.imw' }),
    )).toBeGreaterThan(0);
    expect(compareClaimInfo(
        claimant({ relPath: 'X/.imw' }),
        claimant({ relPath: 'X - 2/.imw' }),
    )).toBeLessThan(0);
    // the marker can be on any path segment — asset files keep identical names
    expect(compareClaimInfo(
        claimant({ relPath: 'X - 2/A1.ima.json' }),
        claimant({ relPath: 'X/A1.ima.json' }),
    )).toBeGreaterThan(0);
    // legacy meta suffix form
    expect(compareClaimInfo(
        claimant({ relPath: 'X (2).imw.json' }),
        claimant({ relPath: 'X.imw.json' }),
    )).toBeGreaterThan(0);
    // copy-marker on the file name itself
    expect(compareClaimInfo(
        claimant({ relPath: 'A/Fire - 2.ima.json' }),
        claimant({ relPath: 'A/Fire.ima.json' }),
    )).toBeGreaterThan(0);
    // localized forms — matched relationally, no suffix enumeration:
    expect(compareClaimInfo(
        claimant({ relPath: 'X - копия/.imw' }),
        claimant({ relPath: 'X/.imw' }),
    )).toBeGreaterThan(0);
    expect(compareClaimInfo(
        claimant({ relPath: 'X - копия (2)/.imw' }),
        claimant({ relPath: 'X/.imw' }),
    )).toBeGreaterThan(0);
    expect(compareClaimInfo(
        claimant({ relPath: 'X - Copy (2)/.imw' }),
        claimant({ relPath: 'X/.imw' }),
    )).toBeGreaterThan(0);
    // synthesized claimant (no `.imw` segment) vs in-folder meta
    expect(compareClaimInfo(
        claimant({ relPath: 'X - 2' }),
        claimant({ relPath: 'X/.imw' }),
    )).toBeGreaterThan(0);
    // NOT a copy: name continues without a marker ('X2' vs 'X') → path decides
    expect(compareClaimInfo(
        claimant({ relPath: 'X2/.imw' }),
        claimant({ relPath: 'X/.imw' }),
    )).toBeGreaterThan(0); // '/' (0x2F) < '2' (0x32) → base first anyway
    // both copies → plain path compare stays
    expect(compareClaimInfo(
        claimant({ relPath: 'X - 2/.imw' }),
        claimant({ relPath: 'X - 3/.imw' }),
    )).toBeLessThan(0);
});

test('single claimant and disjoint ids produce no resolutions', async () => {
    const result = await resolveWorkspaceClaims([
        claimant({ keyPath: 'a', id: 'one', folderPath: ROOT + '/A' }),
        claimant({ keyPath: 'b', id: 'two', folderPath: ROOT + '/B' }),
    ], { rootPath: ROOT, isIdTaken: noTaken, randomId });
    expect(result.size).toBe(0);
});

test('folderless meta loses its id to a folder owner regardless of claim age', async () => {
    const owner_folder = path.join(ROOT, 'Enemies');
    const result = await resolveWorkspaceClaims([
        // folderless meta with the OLDEST claim — survival rules come first
        claimant({ keyPath: 'ghost', kind: 'legacy', folderPath: null, id: 'dup', claimedAt: 100 }),
        claimant({ keyPath: owner_folder, kind: 'folder', folderPath: owner_folder, id: 'dup', claimedAt: null }),
    ], { rootPath: ROOT, isIdTaken: noTaken, randomId });

    expect(result.get('ghost')).toEqual({ action: 'drop' });
    // folder owner keeps its id — nothing to assign
    expect(result.has(owner_folder)).toBe(false);
});

test('folderless-only conflict keeps exactly one keeper', async () => {
    const result = await resolveWorkspaceClaims([
        claimant({ keyPath: 'm2', kind: 'legacy', folderPath: null, id: 'dup', claimedAt: null, relPath: 'b' }),
        claimant({ keyPath: 'm1', kind: 'legacy', folderPath: null, id: 'dup', claimedAt: 50, relPath: 'z' }),
        claimant({ keyPath: 'm3', kind: 'legacy', folderPath: null, id: 'dup', claimedAt: null, relPath: 'a' }),
    ], { rootPath: ROOT, isIdTaken: noTaken, randomId });

    // m1 has the explicit claim → keeper even with the worst path;
    // both fieldless losers are dropped
    expect(result.get('m2')).toEqual({ action: 'drop' });
    expect(result.get('m3')).toEqual({ action: 'drop' });
    expect(result.has('m1')).toBe(false); // keeper
});

test('conflicting folder owners: loser gets the deterministic path-derived id', async () => {
    const folder_a = path.join(ROOT, 'Alpha');
    const folder_b = path.join(ROOT, 'Beta');
    const result = await resolveWorkspaceClaims([
        claimant({ keyPath: folder_a, folderPath: folder_a, id: 'dup', relPath: 'Alpha/.imw' }),
        claimant({ keyPath: folder_b, folderPath: folder_b, id: 'dup', relPath: 'Beta/.imw' }),
    ], { rootPath: ROOT, isIdTaken: noTaken, randomId });

    expect(result.has(folder_a)).toBe(false); // 'Alpha/.imw' < 'Beta/.imw' → keeper
    expect(result.get(folder_b)).toEqual({ action: 'reid', newId: absolutePathToUuid(folder_b, ROOT) });
});

test('path-derived candidate that is already taken falls back to a random id', async () => {
    const folder_b = path.join(ROOT, 'Beta');
    const candidate = absolutePathToUuid(folder_b, ROOT);
    const result = await resolveWorkspaceClaims([
        claimant({ keyPath: path.join(ROOT, 'Alpha'), folderPath: path.join(ROOT, 'Alpha'), id: 'dup', relPath: 'Alpha/.imw' }),
        claimant({ keyPath: folder_b, folderPath: folder_b, id: 'dup', relPath: 'Beta/.imw' }),
    ], {
        rootPath: ROOT,
        isIdTaken: async (id) => id === candidate, // registry says the candidate was used historically
        randomId,
    });

    const resolution = result.get(folder_b);
    expect(resolution?.action).toBe('reid');
    expect(resolution).toBeDefined();
    if (resolution && resolution.action === 'reid') {
        expect(resolution.newId).not.toBe(candidate);
        expect(resolution.newId.startsWith('random-id-')).toBe(true);
    }
});

test('resolution is independent of claimant order (same input, same outcome)', async () => {
    const folder_a = path.join(ROOT, 'Alpha');
    const folder_b = path.join(ROOT, 'Beta');
    const inputs = () => [
        claimant({ keyPath: folder_a, folderPath: folder_a, id: 'dup', claimedAt: null, relPath: 'Alpha/.imw' }),
        claimant({ keyPath: folder_b, folderPath: folder_b, id: 'dup', claimedAt: null, relPath: 'Beta/.imw' }),
        claimant({ keyPath: 'stray', kind: 'legacy', folderPath: null, id: 'dup', claimedAt: null, relPath: 'stray.imw.json' }),
    ];
    const first = await resolveWorkspaceClaims(inputs(), { rootPath: ROOT, isIdTaken: noTaken, randomId });
    const second = await resolveWorkspaceClaims([...inputs()].reverse(), { rootPath: ROOT, isIdTaken: noTaken, randomId });

    expect([...first.entries()].sort()).toEqual([...second.entries()].sort());
    expect(first.get('stray')).toEqual({ action: 'drop' });
});

test('a leftover legacy meta next to an in-folder .imw is dropped (even with different ids)', async () => {
    const folder = path.join(ROOT, 'Mixed');
    const result = await resolveWorkspaceClaims([
        claimant({ keyPath: path.join(folder, 'Mixed.imw.json'), kind: 'legacy', folderPath: folder, id: 'legacy-id', relPath: 'Mixed/Mixed.imw.json' }),
        claimant({ keyPath: folder, kind: 'folder', folderPath: folder, id: 'folder-id', relPath: 'Mixed/.imw' }),
    ], { rootPath: ROOT, isIdTaken: noTaken, randomId });

    expect(result.get(path.join(folder, 'Mixed.imw.json'))).toEqual({ action: 'drop' });
    expect(result.has(folder)).toBe(false);
});

// ─── Integration: real project loads ─────────────────────────────────────────

async function newProjectDir(): Promise<{ dir: string; root: string }> {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ims-id-claim-'));
    const dir = path.join(root, 'project');
    fs.mkdirSync(dir, { recursive: true });
    return { root, dir };
}

async function loadProject(dir: string): Promise<ProjectFileDb> {
    const db = new ProjectFileDb(dir);
    await db.init({ id: null, title: 'Id claim test', rootWorkspaceId: null });
    return db;
}

async function reloadProject(db: ProjectFileDb, dir: string): Promise<ProjectFileDb> {
    await db.destroy();
    fs.rmSync(path.join(dir, '.imsc'), { recursive: true, force: true });
    return loadProject(dir);
}

async function cleanup(db: ProjectFileDb | null, root: string) {
    if (db) await db.destroy();
    fs.rmSync(root, { recursive: true, force: true });
}

function writeLegacyMeta(dir: string, name: string, data: Record<string, unknown>) {
    fs.writeFileSync(path.join(dir, name), JSON.stringify(data, null, 1), 'utf8');
}

function writeImw(folder: string, data: Record<string, unknown>) {
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, '.imw'), JSON.stringify(data, null, 1), 'utf8');
}

function assetJson(id: string, title: string): Record<string, unknown> {
    return {
        id,
        title,
        name: null,
        icon: 'file-paper-2-fill',
        typeIds: [],
        parentIds: [],
        workspaceId: null,
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

function writeAsset(folder: string, name: string, data: Record<string, unknown>) {
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, name), JSON.stringify(data, null, 1), 'utf8');
}

const DUP_WS = 'aaaaaaaa-0000-0000-0000-000000000001';
const HERO_ASSET = 'bbbbbbbb-0000-0000-0000-000000000001';

test('Start_ru scenario: folder-backed meta wins, folderless duplicate dropped, edit migrates without ENOENT', async () => {
    const { dir, root } = await newProjectDir();
    let db: ProjectFileDb | null = null;
    try {
        writeLegacyMeta(dir, 'Enemies.imw.json', { id: DUP_WS, title: 'Enemies', name: null, parentId: null, index: null, props: {} });
        writeLegacyMeta(dir, 'Враги.imw.json', { id: DUP_WS, title: 'Враги', name: null, parentId: null, index: null, props: {} });
        writeAsset(path.join(dir, 'Enemies'), 'Hero.ima.json', assetJson(HERO_ASSET, 'Hero'));

        db = await loadProject(dir);

        const holders = [...db.workspace.workspaces.iterate()].filter(w => w.id === DUP_WS);
        expect(holders.length).toBe(1);
        expect(holders[0].localName).toBe('Enemies.imw.json');
        expect(holders[0].title).toBe('Enemies');
        // the folderless duplicate never becomes an entity
        expect([...db.workspace.workspaces.iterate()].some(w => w.localName === 'Враги.imw.json')).toBe(false);
        expect(db.workspace.findByLocalDirPath('Enemies')?.id).toBe(DUP_WS);
        const hero = db.asset.assets.byId.get(HERO_ASSET);
        expect(hero?.workspaceId).toBe(DUP_WS);

        // editing used to crash with ENOENT on `<folder>/.imw`
        await db.workspace.workspacesChange(DUP_WS, { title: 'Враги' });
        expect(fs.existsSync(path.join(dir, 'Враги', '.imw'))).toBe(true);
        expect(fs.existsSync(path.join(dir, 'Enemies'))).toBe(false);
        expect(fs.existsSync(path.join(dir, 'Enemies.imw.json'))).toBe(false); // migrated away
        expect(fs.existsSync(path.join(dir, 'Враги.imw.json'))).toBe(true); // stray left on disk

        // Reload: the new in-folder meta owns the folder; the stray sibling must not load
        db = await reloadProject(db, dir);
        const after = [...db.workspace.workspaces.iterate()].filter(w => w.id === DUP_WS);
        expect(after.length).toBe(1);
        expect(after[0].localName).toBe('Враги');
        expect([...db.workspace.workspaces.iterate()].some(w => w.localName === 'Враги.imw.json')).toBe(false);
    }
    finally {
        await cleanup(db, root);
    }
});

test('manually copied workspace folder becomes an independent workspace (write-back, idempotent reload)', async () => {
    const { dir, root } = await newProjectDir();
    let db: ProjectFileDb | null = null;
    try {
        const id = 'cccccccc-0000-0000-0000-000000000001';
        writeImw(path.join(dir, 'Alpha'), { id, title: 'Alpha', props: {} });
        writeImw(path.join(dir, 'Beta'), { id, title: 'Beta', props: {} });
        writeAsset(path.join(dir, 'Alpha'), 'One.ima.json', assetJson('dddddddd-0000-0000-0000-000000000001', 'One'));
        writeAsset(path.join(dir, 'Beta'), 'Two.ima.json', assetJson('dddddddd-0000-0000-0000-000000000002', 'Two'));

        db = await loadProject(dir);

        const beta_id = absolutePathToUuid(path.join(dir, 'Beta'), dir);
        const alpha = db.workspace.workspaces.byId.get(id);
        expect(alpha?.localName).toBe('Alpha');
        const beta = db.workspace.workspaces.byId.get(beta_id);
        expect(beta?.localName).toBe('Beta');
        // exactly two workspaces — no silent merge
        const user_ws = [...db.workspace.workspaces.iterate()].filter(w => !w.id.startsWith('00000000-'));
        expect(user_ws.length).toBe(2);
        // children attribute to their own folder's workspace
        expect(db.asset.assets.byId.get('dddddddd-0000-0000-0000-000000000001')?.workspaceId).toBe(id);
        expect(db.asset.assets.byId.get('dddddddd-0000-0000-0000-000000000002')?.workspaceId).toBe(beta_id);

        // write-back: loser file carries the new id, a claim stamp and no parentId
        const beta_meta = JSON.parse(fs.readFileSync(path.join(dir, 'Beta', '.imw'), 'utf8'));
        expect(beta_meta.id).toBe(beta_id);
        expect(typeof beta_meta.idClaimedAt).toBe('number');
        expect('parentId' in beta_meta).toBe(false);
        // winner file untouched (still fieldless, id unchanged)
        const alpha_meta = JSON.parse(fs.readFileSync(path.join(dir, 'Alpha', '.imw'), 'utf8'));
        expect(alpha_meta.id).toBe(id);
        expect('idClaimedAt' in alpha_meta).toBe(false);

        // Idempotent: a reload produces the same identities, no re-resolution
        db = await reloadProject(db, dir);
        expect(db.workspace.workspaces.byId.get(id)?.localName).toBe('Alpha');
        expect(db.workspace.workspaces.byId.get(beta_id)?.localName).toBe('Beta');
    }
    finally {
        await cleanup(db, root);
    }
});

test('Explorer copy while app closed: original keeps identity, the copy is re-id\'d (copy-suffix tie-break)', async () => {
    const { dir, root } = await newProjectDir();
    let db: ProjectFileDb | null = null;
    try {
        const ws_id = '99999999-0000-0000-0000-000000000001';
        const a1_id = '88888888-0000-0000-0000-000000000001';
        writeImw(path.join(dir, 'X'), { id: ws_id, title: 'X', props: {} });
        writeAsset(path.join(dir, 'X'), 'A1.ima.json', assetJson(a1_id, 'A1'));
        // Explorer copy made while the app is not running
        fs.cpSync(path.join(dir, 'X'), path.join(dir, 'X - 2'), { recursive: true });

        db = await loadProject(dir);

        // the original keeps BOTH the workspace and the asset identity
        expect(db.workspace.workspaces.byId.get(ws_id)?.localName).toBe('X');
        expect(db.asset.assets.byId.get(a1_id)?.workspaceId).toBe(ws_id);

        // the copy is fully re-identified and attached to its own workspace
        const copy_ws = db.workspace.findByLocalDirPath('X - 2');
        expect(copy_ws).toBeTruthy();
        expect(copy_ws!.id).not.toBe(ws_id);
        const copy_asset = [...db.asset.assets.iterate()]
            .find(x => x.localName === 'A1.ima.json' && x.id !== a1_id);
        expect(copy_asset).toBeDefined();
        expect(copy_asset!.workspaceId).toBe(copy_ws!.id);

        // write-backs persist the resolution (incl. positional workspaceId)
        const copy_meta = JSON.parse(fs.readFileSync(path.join(dir, 'X - 2', '.imw'), 'utf8'));
        expect(copy_meta.id).toBe(copy_ws!.id);
        const copy_file = JSON.parse(fs.readFileSync(path.join(dir, 'X - 2', 'A1.ima.json'), 'utf8'));
        expect(copy_file.id).toBe(copy_asset!.id);
        expect(copy_file.workspaceId).toBe(copy_ws!.id);
        // original files untouched
        expect(JSON.parse(fs.readFileSync(path.join(dir, 'X', '.imw'), 'utf8')).id).toBe(ws_id);
        expect(JSON.parse(fs.readFileSync(path.join(dir, 'X', 'A1.ima.json'), 'utf8')).id).toBe(a1_id);
    }
    finally {
        await cleanup(db, root);
    }
});

test('manually copied asset file becomes an independent asset; block ids are untouched', async () => {
    const { dir, root } = await newProjectDir();
    let db: ProjectFileDb | null = null;
    try {
        const fire_id = 'eeeeeeee-0000-0000-0000-000000000001';
        writeAsset(path.join(dir, 'A'), 'Fire.ima.json', assetJson(fire_id, 'Fire'));
        writeAsset(path.join(dir, 'B'), 'Fire.ima.json', assetJson(fire_id, 'Fire'));

        db = await loadProject(dir);

        const loser_file_path = path.join(dir, 'B', 'Fire.ima.json');
        const expected_loser_id = absolutePathToUuid(loser_file_path, dir);
        const loser_file = JSON.parse(fs.readFileSync(loser_file_path, 'utf8'));
        const winner = db.asset.assets.byId.get(fire_id);
        const loser = db.asset.assets.byId.get(expected_loser_id);

        expect(winner).toBeDefined();
        expect(loser).toBeDefined();
        expect(winner?.localName).toBe('Fire.ima.json');
        expect(loser?.localName).toBe('Fire.ima.json');
        expect(winner?.workspaceId).toBe(absolutePathToUuid(path.join(dir, 'A'), dir));
        expect(loser?.workspaceId).toBe(absolutePathToUuid(path.join(dir, 'B'), dir));

        // re-id is persisted under __meta, with a claim stamp…
        expect(loser_file.id).toBe(expected_loser_id);
        expect(typeof loser_file.__meta.idClaimedAt).toBe('number');
        // …and block ids stay file-scoped — never regenerated
        expect(loser_file.blocks[0].id).toBe('blk-' + fire_id);
        // winner file untouched
        const winner_file = JSON.parse(fs.readFileSync(path.join(dir, 'A', 'Fire.ima.json'), 'utf8'));
        expect(winner_file.id).toBe(fire_id);

        // stable across reload
        db = await reloadProject(db, dir);
        expect(db.asset.assets.byId.get(fire_id)).toBeDefined();
        expect(db.asset.assets.byId.get(expected_loser_id)).toBeDefined();
    }
    finally {
        await cleanup(db, root);
    }
});

test('unique folderless meta is kept and gains its folder on first edit (mkdir guard)', async () => {
    const { dir, root } = await newProjectDir();
    let db: ProjectFileDb | null = null;
    try {
        const ghost_id = 'ffffffff-0000-0000-0000-000000000001';
        writeLegacyMeta(dir, 'Ghost.imw.json', { id: ghost_id, title: 'Ghost', name: null, parentId: null, index: null, props: {} });

        db = await loadProject(dir);
        expect(db.workspace.workspaces.byId.get(ghost_id)?.localName).toBe('Ghost.imw.json');

        // used to fail with ENOENT opening `<folder>/.imw`
        await db.workspace.workspacesChange(ghost_id, { title: 'Ghost2' });
        expect(fs.existsSync(path.join(dir, 'Ghost2', '.imw'))).toBe(true);
        expect(fs.existsSync(path.join(dir, 'Ghost.imw.json'))).toBe(false);
        expect(db.workspace.workspaces.byId.get(ghost_id)?.localName).toBe('Ghost2');
        const meta = JSON.parse(fs.readFileSync(path.join(dir, 'Ghost2', '.imw'), 'utf8'));
        expect('parentId' in meta).toBe(false);

        db = await reloadProject(db, dir);
        expect(db.workspace.workspaces.byId.get(ghost_id)?.localName).toBe('Ghost2');
    }
    finally {
        await cleanup(db, root);
    }
});

test('nested workspaces without parentId in .imw resolve their parent from the folder', async () => {
    const { dir, root } = await newProjectDir();
    let db: ProjectFileDb | null = null;
    try {
        db = await loadProject(dir);
        const parent = await db.workspace.workspacesCreate({ title: 'Parent', parentId: null });
        const child = await db.workspace.workspacesCreate({ title: 'Child', parentId: parent.id });

        const child_meta = JSON.parse(fs.readFileSync(path.join(dir, 'Parent', 'Child', '.imw'), 'utf8'));
        expect(child_meta.id).toBe(child.id);
        expect('parentId' in child_meta).toBe(false);
        expect(typeof child_meta.idClaimedAt).toBe('number'); // stamped at creation

        db = await reloadProject(db, dir);
        expect(db.workspace.workspaces.byId.get(child.id)?.parentId).toBe(parent.id);
        expect(db.workspace.workspaces.byId.get(parent.id)?.parentId).toBe(db.RootGddFolder.id);
    }
    finally {
        await cleanup(db, root);
    }
});

test('id registry: rows are populated and veto a historically used path-derived candidate', async () => {
    const { dir, root } = await newProjectDir();
    let db: ProjectFileDb | null = null;
    try {
        writeLegacyMeta(dir, 'Legacy.imw.json', { id: '11111111-0000-0000-0000-000000000001', title: 'Legacy', name: null, parentId: null, index: null, props: {} });
        fs.mkdirSync(path.join(dir, 'Legacy'), { recursive: true });

        db = await loadProject(dir);
        const rows: { entity_id: string; source: string }[] =
            await db.dataSource.query('SELECT entity_id, source FROM id_claims');
        expect(rows.some(r => r.entity_id === '11111111-0000-0000-0000-000000000001')).toBe(true);

        // Simulate a historical claim on the id that the conflict loser's
        // folder path would generate (e.g. the id was used by a since-deleted file)
        const candidate = absolutePathToUuid(path.join(dir, 'C'), dir);
        const now = Date.now();
        await db.dataSource.query(
            `INSERT INTO id_claims (entity_id, claimed_at, first_seen_at, file_path, source, changed_at)
             VALUES (?, NULL, ?, NULL, 'file', ?)`,
            [candidate, now, now],
        );
        await db.destroy();
        db = null;

        // Same-second conflict appears: loser folder C must NOT get `candidate`
        const dup = '22222222-0000-0000-0000-000000000001';
        writeImw(path.join(dir, 'A'), { id: dup, title: 'A', props: {} });
        writeImw(path.join(dir, 'C'), { id: dup, title: 'C', props: {} });

        db = await loadProject(dir);
        const loser_meta = JSON.parse(fs.readFileSync(path.join(dir, 'C', '.imw'), 'utf8'));
        expect(loser_meta.id).not.toBe(candidate);
        expect(loser_meta.id).not.toBe(dup);
        expect(typeof loser_meta.idClaimedAt).toBe('number');
        // resolution persisted with source 'resolved'
        const resolved: { entity_id: string; source: string }[] =
            await db.dataSource.query(`SELECT entity_id, source FROM id_claims WHERE source = 'resolved'`);
        expect(resolved.some(r => r.entity_id === loser_meta.id)).toBe(true);
        // keeper keeps the id
        expect(db.workspace.workspaces.byId.get(dup)?.localName).toBe('A');
    }
    finally {
        await cleanup(db, root);
    }
});
