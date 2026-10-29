import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// NOTE: electron / electron-log / electron-json-storage are stubbed globally
// via aliases in vitest.config.ts (test/mocks/*), so ProjectFileDb can be
// initialized headlessly here. The parcel watcher is stubbed per-file: these
// tests exercise title derivation at load, not watcher delivery — and it
// removes native watcher crashes from the equation.
vi.mock('@parcel/watcher', () => ({
    default: {
        subscribe: async () => ({ unsubscribe: async () => {} }),
        writeSnapshot: async () => {},
    },
}));

import { ProjectFileDb } from '../ProjectFileDb';

// ─── Title derivation rule ───────────────────────────────────────────────────
// The title stored in the file (`title` / `__meta.title` / `.imw`) is shown
// verbatim; only when it is absent do we fall back to the file/folder name —
// with the copy suffix ` - N` kept, because it is part of the name.

async function newProjectDir(): Promise<{ dir: string; root: string }> {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ims-entity-titles-'));
    const dir = path.join(root, 'project');
    fs.mkdirSync(dir, { recursive: true });
    return { root, dir };
}

async function loadProject(dir: string): Promise<ProjectFileDb> {
    const db = new ProjectFileDb(dir);
    await db.init({ id: null, title: 'Entity titles test', rootWorkspaceId: null });
    return db;
}

async function cleanup(db: ProjectFileDb | null, root: string) {
    if (db) await db.destroy();
    fs.rmSync(root, { recursive: true, force: true });
}

function write(folder: string, name: string, data: Record<string, unknown>) {
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, name), JSON.stringify(data, null, 1), 'utf8');
}

function legacyAssetJson(id: string, title?: string): Record<string, unknown> {
    return {
        id,
        ...(title !== undefined ? { title } : {}),
        name: null,
        typeIds: [],
        parentIds: [],
        workspaceId: null,
        index: null,
        comments: [],
        references: [],
        blocks: [],
    };
}

function titleOfAsset(db: ProjectFileDb, localName: string): string | undefined {
    return [...db.asset.assets.iterate()].find(a => a.localName === localName)?.title ?? undefined;
}

test('legacy asset: stored title wins verbatim; file name (suffix kept) otherwise', async () => {
    const { dir, root } = await newProjectDir();
    let db: ProjectFileDb | null = null;
    try {
        write(dir, 'Stored - 2.ima.json', legacyAssetJson('aaaaaaaa-0000-0000-0000-000000000001', 'Totally Different'));
        write(dir, 'NoTitle - 2.ima.json', legacyAssetJson('aaaaaaaa-0000-0000-0000-000000000002'));

        db = await loadProject(dir);

        // Old rule showed the file name whenever title and name diverged.
        expect(titleOfAsset(db, 'Stored - 2.ima.json')).toBe('Totally Different');
        // No stored title → file name exactly, ` - 2` included.
        expect(titleOfAsset(db, 'NoTitle - 2.ima.json')).toBe('NoTitle - 2');
    }
    finally {
        await cleanup(db, root);
    }
});

test('new-format asset: __meta.title wins; copy suffix kept when absent', async () => {
    const { dir, root } = await newProjectDir();
    let db: ProjectFileDb | null = null;
    try {
        write(dir, 'Widget - 2.json', {
            __meta: { id: 'bbbbbbbb-0000-0000-0000-000000000001', title: 'Widget Prime' },
        });
        write(dir, 'Plain - 2.json', {
            __meta: { id: 'bbbbbbbb-0000-0000-0000-000000000002' },
        });

        db = await loadProject(dir);

        // Old rule dropped ` - 2` from the file name and ignored a divergent title.
        expect(titleOfAsset(db, 'Widget - 2.json')).toBe('Widget Prime');
        expect(titleOfAsset(db, 'Plain - 2.json')).toBe('Plain - 2');
    }
    finally {
        await cleanup(db, root);
    }
});

test('workspace folder: .imw title wins; folder name (suffix kept) otherwise', async () => {
    const { dir, root } = await newProjectDir();
    let db: ProjectFileDb | null = null;
    try {
        write(path.join(dir, 'FolderCopy - 2'), '.imw', {
            id: 'cccccccc-0000-0000-0000-000000000001', title: 'FolderOriginal', props: {},
        });
        write(path.join(dir, 'NoMetaTitle - 2'), '.imw', {
            id: 'cccccccc-0000-0000-0000-000000000002', props: {},
        });
        fs.mkdirSync(path.join(dir, 'Bare - 2'), { recursive: true });
        // Folderless legacy meta with a stored title of its own.
        write(dir, 'StoredWs - 2.imw.json', {
            id: 'cccccccc-0000-0000-0000-000000000003', title: 'StoredWs Title', name: null, parentId: null, index: null, props: {},
        });

        db = await loadProject(dir);

        // Old rule replaced a divergent .imw title with the folder basename.
        expect(db.workspace.findByLocalDirPath('FolderCopy - 2')?.title).toBe('FolderOriginal');
        expect(db.workspace.findByLocalDirPath('NoMetaTitle - 2')?.title).toBe('NoMetaTitle - 2');
        expect(db.workspace.findByLocalDirPath('Bare - 2')?.title).toBe('Bare - 2');
        expect(
            [...db.workspace.workspaces.iterate()].find(w => w.localName === 'StoredWs - 2.imw.json')?.title,
        ).toBe('StoredWs Title');
    }
    finally {
        await cleanup(db, root);
    }
});
