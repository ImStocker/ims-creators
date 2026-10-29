import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// NOTE: electron / electron-log / electron-json-storage are stubbed globally
// via aliases in vitest.config.ts (test/mocks/*), so ProjectFileDb can be
// initialized headlessly here.

import { ProjectFileDb } from '../ProjectFileDb';
import { ProjectService } from '../services/ProjectService';

const FIXTURE_DIR = fileURLToPath(new URL('./project-data', import.meta.url));
const PROJECT_ID = 'EWvDFxqn';

const CHARACTERS_ID = '0312ebc4-bf36-452a-ac0d-a67023c7ed9f';
const ALLIES_ID = '604bd733-4080-4ed9-b8cf-54e4c7678c48';
const ABILITIES_ID = 'fc054243-5903-4830-ad07-95e72094656a';

/**
 * Rewrite a legacy project copy (`name.imw.json` next to `name/`) into the
 * new format (`name/.imw` inside the folder), recursively.
 */
function migrateLegacyToNewFormat(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        if (entry.isFile() && entry.name.endsWith('.imw.json')) {
            const base = entry.name.substring(0, entry.name.length - '.imw.json'.length);
            const folder = path.join(dir, base);
            if (fs.existsSync(folder) && fs.statSync(folder).isDirectory()) {
                fs.copyFileSync(path.join(dir, entry.name), path.join(folder, '.imw'));
                fs.unlinkSync(path.join(dir, entry.name));
            }
        }
        else if (entry.isDirectory()) {
            migrateLegacyToNewFormat(path.join(dir, entry.name));
        }
    }
}

async function loadDb(options?: { newFormat?: boolean }): Promise<{
    db: ProjectFileDb;
    dir: string;
    projectDir: string;
}> {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ims-workspace-meta-'));
    const project_dir = path.join(root, 'project');
    fs.cpSync(FIXTURE_DIR, project_dir, { recursive: true });
    // The fixture may contain a leftover .imsc/.imsc-local/project.db from other specs —
    // each test must start with a freshly initialized database.
    fs.rmSync(path.join(project_dir, '.imsc'), { recursive: true, force: true });
    if (options?.newFormat) {
        migrateLegacyToNewFormat(project_dir);
    }
    const db = new ProjectFileDb(project_dir);
    await db.init({ id: PROJECT_ID, title: 'Test project', rootWorkspaceId: null });
    return { db, dir: root, projectDir: project_dir };
}

async function cleanup(db: ProjectFileDb, dir: string) {
    await db.destroy();
    fs.rmSync(dir, { recursive: true, force: true });
}

function countWorkspacesOnDisk(dir: string): string[] {
    const result: string[] = [];
    const walk = (current: string) => {
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            if (entry.name.startsWith('.')) continue;
            if (entry.isDirectory()) {
                if (fs.existsSync(path.join(current, entry.name, '.imw'))) {
                    result.push(path.join(current, entry.name));
                }
                walk(path.join(current, entry.name));
            }
        }
    };
    walk(dir);
    return result;
}

function findWorkspace(db: ProjectFileDb, localName: string) {
    return [...db.workspace.workspaces.iterate()]
        .find(workspace => workspace.localName === localName);
}

test('new format: project loads from folder/.imw meta files', async () => {
    const { db, dir, projectDir } = await loadDb({ newFormat: true });
    try {
        const characters = db.workspace.workspaces.byId.get(CHARACTERS_ID);
        expect(characters).toBeDefined();
        expect(characters?.title).toBe('Characters');
        expect(characters?.localName).toBe('Characters');

        const allies = db.workspace.workspaces.byId.get(ALLIES_ID);
        expect(allies).toBeDefined();
        expect(allies?.parentId).toBe(CHARACTERS_ID);
        expect(allies?.localName).toBe('Allies');

        // Path resolution works off the plain folder name
        expect(db.workspace.findByLocalDirPath('Characters')?.id).toBe(CHARACTERS_ID);
        expect(db.workspace.findByLocalDirPath(path.join('Characters', 'Allies'))?.id).toBe(ALLIES_ID);

        // No workspace may carry a legacy meta localName in a new-format project
        for (const workspace of db.workspace.workspaces.iterate()) {
            if (workspace.projectId !== PROJECT_ID) continue;
            expect(workspace.localName?.endsWith('.imw.json')).toBe(false);
        }
        // Sanity: the conversion actually produced in-folder metas
        expect(countWorkspacesOnDisk(projectDir).length).toBeGreaterThan(0);
    }
    finally {
        await cleanup(db, dir);
    }
});

test('legacy format: project still loads from sibling name.imw.json meta files', async () => {
    const { db, dir } = await loadDb();
    try {
        const characters = db.workspace.workspaces.byId.get(CHARACTERS_ID);
        expect(characters?.title).toBe('Characters');
        expect(characters?.localName).toBe('Characters.imw.json');

        const allies = db.workspace.workspaces.byId.get(ALLIES_ID);
        expect(allies?.parentId).toBe(CHARACTERS_ID);
        expect(allies?.localName).toBe('Allies.imw.json');

        // Path resolution accepts both localName forms
        expect(db.workspace.findByLocalDirPath('Characters')?.id).toBe(CHARACTERS_ID);
        expect(db.workspace.findByLocalDirPath(path.join('Characters', 'Allies'))?.id).toBe(ALLIES_ID);
    }
    finally {
        await cleanup(db, dir);
    }
});

test('changing a title migrates the legacy sibling meta to folder/.imw', async () => {
    const { db, dir, projectDir } = await loadDb();
    try {
        const legacy_meta = path.join(projectDir, 'Abilities.imw.json');
        expect(fs.existsSync(legacy_meta)).toBe(true);

        await db.workspace.workspacesChange(ABILITIES_ID, { title: 'Skillz' });

        // Folder renamed, meta moved inside, legacy sibling removed
        expect(fs.existsSync(path.join(projectDir, 'Skillz', '.imw'))).toBe(true);
        expect(fs.existsSync(path.join(projectDir, 'Abilities'))).toBe(false);
        expect(fs.existsSync(legacy_meta)).toBe(false);

        const abilities = db.workspace.workspaces.byId.get(ABILITIES_ID);
        expect(abilities?.title).toBe('Skillz');
        expect(abilities?.localName).toBe('Skillz');

        // No duplicate workspace appears after a reload from disk
        await db.destroy();
        fs.rmSync(path.join(projectDir, '.imsc'), { recursive: true, force: true });
        const db2 = new ProjectFileDb(projectDir);
        try {
            await db2.init({ id: PROJECT_ID, title: 'Test project', rootWorkspaceId: null });
            expect(db2.workspace.workspaces.byId.get(ABILITIES_ID)?.localName).toBe('Skillz');
            const skillz_count = [...db2.workspace.workspaces.iterate()]
                .filter(workspace => workspace.title === 'Skillz')
                .length;
            expect(skillz_count).toBe(1);
        }
        finally {
            await db2.destroy();
        }
    }
    finally {
        await cleanup(db, dir);
    }
});

test('rename keeping the derived folder name does not create a " - 2" copy', async () => {
    const { db, dir, projectDir } = await loadDb();
    try {
        // Trailing space trims back to the very same file basename
        await db.workspace.workspacesChange(ABILITIES_ID, { title: 'Abilities ' });

        expect(fs.existsSync(path.join(projectDir, 'Abilities', '.imw'))).toBe(true);
        expect(fs.existsSync(path.join(projectDir, 'Abilities - 2'))).toBe(false);
        expect(fs.existsSync(path.join(projectDir, 'Abilities.imw.json'))).toBe(false);
        expect(db.workspace.workspaces.byId.get(ABILITIES_ID)?.localName).toBe('Abilities');
    }
    finally {
        await cleanup(db, dir);
    }
});

test('moving a workspace to another parent keeps its folder name', async () => {
    const { db, dir, projectDir } = await loadDb();
    try {
        await db.workspace.workspacesChange(ALLIES_ID, { parentId: db.RootGddFolder.id });

        expect(fs.existsSync(path.join(projectDir, 'Allies', '.imw'))).toBe(true);
        expect(fs.existsSync(path.join(projectDir, 'Allies - 2'))).toBe(false);
        expect(fs.existsSync(path.join(projectDir, 'Characters', 'Allies'))).toBe(false);
        expect(fs.existsSync(path.join(projectDir, 'Characters', 'Allies.imw.json'))).toBe(false);

        const allies = db.workspace.workspaces.byId.get(ALLIES_ID);
        expect(allies?.parentId).toBe(db.RootGddFolder.id);
        expect(allies?.localName).toBe('Allies');
        expect(db.workspace.findByLocalDirPath('Allies')?.id).toBe(ALLIES_ID);
    }
    finally {
        await cleanup(db, dir);
    }
});

test('creating a workspace writes folder/.imw (no sibling meta)', async () => {
    const { db, dir, projectDir } = await loadDb({ newFormat: true });
    try {
        const created = await db.workspace.workspacesCreate({
            title: 'New Workspace',
            parentId: null,
        });

        const meta_path = path.join(projectDir, 'New Workspace', '.imw');
        expect(fs.existsSync(meta_path)).toBe(true);
        expect(fs.existsSync(path.join(projectDir, 'New Workspace.imw.json'))).toBe(false);

        const meta = JSON.parse(fs.readFileSync(meta_path, 'utf8'));
        expect(meta.id).toBe(created.id);
        expect(meta.title).toBe('New Workspace');

        expect(db.workspace.workspaces.byId.get(created.id)?.localName).toBe('New Workspace');
    }
    finally {
        await cleanup(db, dir);
    }
});

test('deleting a workspace removes its folder including the .imw meta', async () => {
    const { db, dir, projectDir } = await loadDb({ newFormat: true });
    try {
        expect(fs.existsSync(path.join(projectDir, 'Abilities', '.imw'))).toBe(true);

        await db.workspace.workspacesDelete(ABILITIES_ID);

        expect(fs.existsSync(path.join(projectDir, 'Abilities'))).toBe(false);
        expect(db.workspace.workspaces.byId.get(ABILITIES_ID)).toBeUndefined();
    }
    finally {
        await cleanup(db, dir);
    }
});

test('import migrates legacy sibling metas and keeps new-format metas', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ims-workspace-meta-import-'));
    const src = path.join(root, 'src');
    const target = path.join(root, 'target');
    try {
        // Legacy template archive layout: gdd wrapper with sibling metas
        fs.mkdirSync(path.join(src, 'gdd', 'Characters', 'Allies'), { recursive: true });
        fs.writeFileSync(path.join(src, 'gdd.imw.json'), JSON.stringify({
            id: 'ws-gdd', title: 'GDD', name: null, parentId: null, index: null, props: {},
        }));
        fs.writeFileSync(path.join(src, 'gdd', 'Characters.imw.json'), JSON.stringify({
            id: 'ws-char', title: 'Characters', name: null, parentId: 'ws-gdd', index: null, props: {},
        }));
        fs.writeFileSync(path.join(src, 'gdd', 'Characters', 'Allies.imw.json'), JSON.stringify({
            id: 'ws-allies', title: 'Allies', name: null, parentId: 'ws-char', index: null, props: {},
        }));
        // A new-format folder alongside — its meta must be taken from inside
        fs.mkdirSync(path.join(src, 'gdd', 'Items'), { recursive: true });
        fs.writeFileSync(path.join(src, 'gdd', 'Items', '.imw'), JSON.stringify({
            id: 'ws-items', title: 'Items', name: null, parentId: 'ws-gdd', index: null, props: {},
        }));

        const db = new ProjectFileDb(target);
        try {
            const service = new ProjectService(db);
            await service.convertImportedRootToTarget(src, target, 'ws-root', 'json');

            // The gdd wrapper is unwrapped, not imported as a nested workspace
            expect(fs.existsSync(path.join(target, 'gdd'))).toBe(false);

            // Legacy sibling metas were migrated into <folder>/.imw with their ids
            const char_meta = JSON.parse(fs.readFileSync(path.join(target, 'Characters', '.imw'), 'utf8'));
            expect(char_meta.id).toBe('ws-char');
            const allies_meta = JSON.parse(fs.readFileSync(path.join(target, 'Characters', 'Allies', '.imw'), 'utf8'));
            expect(allies_meta.id).toBe('ws-allies');
            const items_meta = JSON.parse(fs.readFileSync(path.join(target, 'Items', '.imw'), 'utf8'));
            expect(items_meta.id).toBe('ws-items');

            // No legacy meta files survive in the target
            const leftovers: string[] = [];
            const walk = (current: string) => {
                for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
                    if (entry.name.startsWith('.')) continue;
                    if (entry.name.endsWith('.imw.json')) leftovers.push(path.join(current, entry.name));
                    if (entry.isDirectory()) walk(path.join(current, entry.name));
                }
            };
            walk(target);
            expect(leftovers).toEqual([]);
        }
        finally {
            await db.destroy();
        }
    }
    finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
