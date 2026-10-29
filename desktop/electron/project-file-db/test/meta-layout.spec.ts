import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// NOTE: electron / electron-log / electron-json-storage are stubbed globally
// via aliases in vitest.config.ts (test/mocks/*), so ProjectFileDb can be
// initialized headlessly here.

import { ProjectFileDb } from '../ProjectFileDb';
import {
    PROJECT_META_FOLDER,
    PROJECT_META_LOCAL_FOLDER,
    PROJECT_META_LOCAL_INDEX,
    PROJECT_META_SETTINGS,
    PROJECT_META_GITIGNORE,
    PROJECT_META_AI_CHAT,
    PROJECT_META_FS_WATCHER_SNAPSHOT,
    PROJECT_META_DB,
} from '../project-db-constants';
import { prepareProjectMeta } from '../project-meta-layout';

/** Bare filenames the layout constants resolve to. */
const DB_FILE = path.basename(PROJECT_META_DB);
const CHAT_FILE = path.basename(PROJECT_META_AI_CHAT);
const SNAPSHOT_FILE = path.basename(PROJECT_META_FS_WATCHER_SNAPSHOT);

const FIXTURE_DIR = fileURLToPath(new URL('./project-data', import.meta.url));
const PROJECT_ID = 'EWvDFxqn';
/** Id of an entity that is NOT in the fixture — only the registry can hold it. */
const GHOST_CLAIM_ID = 'deadbeef-0000-4000-8000-000000000001';

function makeProject(): { dir: string; root: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ims-meta-layout-'));
    const dir = path.join(root, 'project');
    fs.cpSync(FIXTURE_DIR, dir, { recursive: true });
    fs.rmSync(path.join(dir, PROJECT_META_FOLDER), { recursive: true, force: true });
    return { dir, root };
}

function cleanup(root: string) {
    fs.rmSync(root, { recursive: true, force: true });
}

function readJson(file: string): Record<string, any> {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

const meta = (dir: string, ...parts: string[]) => path.join(dir, PROJECT_META_FOLDER, ...parts);
const local = (dir: string, ...parts: string[]) =>
    path.join(dir, PROJECT_META_FOLDER, PROJECT_META_LOCAL_FOLDER, ...parts);

/** Build a project with the current layout, then roll the meta back to the
 *  pre-split shape an older build would have left behind. */
async function makeLegacyProject(): Promise<{ dir: string; root: string }> {
    const { dir, root } = makeProject();
    const db = new ProjectFileDb(dir);
    await db.init({ id: PROJECT_ID, title: 'Test project', rootWorkspaceId: null });

    // A claim for an entity that is not on disk: only a real, migrated
    // project.db can still know about it after the reload below.
    await db.dataSource.query(
        `INSERT INTO id_claims (entity_id, claimed_at, first_seen_at, file_path, source, changed_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [GHOST_CLAIM_ID, null, Date.now(), 'Ghost.md', 'file', Date.now()],
    );
    await db.destroy();

    // Roll the meta folder back to the flat pre-split layout.
    for (const name of [DB_FILE, CHAT_FILE, SNAPSHOT_FILE]) {
        const from = local(dir, name);
        const to = meta(dir, name);
        if (fs.existsSync(from)) fs.renameSync(from, to);
    }
    fs.writeFileSync(
        meta(dir, CHAT_FILE),
        JSON.stringify({ sessions: [{ id: 's1', title: 'Old session' }], turns: [] }),
        'utf-8',
    );
    fs.writeFileSync(meta(dir, SNAPSHOT_FILE), 'legacy snapshot', 'utf-8');

    // The binding used to live in the shared index.json.
    const index = readJson(meta(dir, 'index.json'));
    fs.writeFileSync(meta(dir, 'index.json'), JSON.stringify({ ...index, id: PROJECT_ID }), 'utf-8');
    fs.rmSync(local(dir, 'local.json'), { force: true });

    return { dir, root };
}

// ─── fresh project ───────────────────────────────────────────────────────────

test('a fresh project gets the shared/local split', async () => {
    const { dir, root } = makeProject();
    const db = new ProjectFileDb(dir);
    try {
        await db.init({ id: PROJECT_ID, title: 'Test project', rootWorkspaceId: null });

        // Both folders exist, and the database lives in the local one.
        expect(fs.existsSync(local(dir))).toBe(true);
        expect(fs.existsSync(local(dir, DB_FILE))).toBe(true);
        expect(fs.existsSync(meta(dir, DB_FILE))).toBe(false);

        // index.json is shared and carries no cloud binding…
        const index = readJson(meta(dir, 'index.json'));
        expect(index.id).toBeUndefined();
        expect(index.title).toBe('Test project');
        expect(index.rootWorkspaceId).toBeNull();

        // …while the binding is machine-local.
        expect(readJson(local(dir, 'local.json')).id).toBe(PROJECT_ID);
        expect(db.info.id).toBe(PROJECT_ID);

        // .imsc/.gitignore keeps the local folder out of git, plus any
        // pre-split leftover a migration failed to move.
        const ignore = fs.readFileSync(meta(dir, '.gitignore'), 'utf-8');
        expect(ignore).toContain('.imsc-local/');
        expect(ignore).toContain('project.db*');
        expect(ignore).toContain('ai-chat.json');

        // Shared settings stay at the top level of .imsc/.
        fs.writeFileSync(meta(dir, 'settings.json'), JSON.stringify({ 'export-format': {} }), 'utf-8');
        await prepareProjectMeta(dir);
        expect(fs.existsSync(meta(dir, 'settings.json'))).toBe(true);
        expect(fs.existsSync(local(dir, 'settings.json'))).toBe(false);
    } finally {
        await db.destroy().catch(() => {});
        cleanup(root);
    }
});

// ─── migration of a pre-split project ────────────────────────────────────────

test('an old flat .imsc is migrated in place on load', async () => {
    const { dir, root } = await makeLegacyProject();

    // Sanity: the fixture really is in the old shape.
    expect(fs.existsSync(meta(dir, DB_FILE))).toBe(true);
    expect(fs.existsSync(local(dir, DB_FILE))).toBe(false);
    expect(readJson(meta(dir, 'index.json')).id).toBe(PROJECT_ID);
    expect(fs.existsSync(local(dir, 'local.json'))).toBe(false);

    const db = new ProjectFileDb(dir);
    try {
        await db.init();

        // Local files moved, shared files did not.
        expect(fs.existsSync(meta(dir, DB_FILE))).toBe(false);
        expect(fs.existsSync(local(dir, DB_FILE))).toBe(true);
        expect(fs.existsSync(meta(dir, CHAT_FILE))).toBe(false);
        expect(fs.existsSync(local(dir, CHAT_FILE))).toBe(true);
        expect(fs.existsSync(meta(dir, SNAPSHOT_FILE))).toBe(false);
        expect(fs.existsSync(local(dir, SNAPSHOT_FILE))).toBe(true);
        expect(fs.existsSync(meta(dir, 'index.json'))).toBe(true);

        // Cloud binding split out of the shared file.
        expect(readJson(meta(dir, 'index.json')).id).toBeUndefined();
        expect(readJson(local(dir, 'local.json')).id).toBe(PROJECT_ID);
        expect(db.info.id).toBe(PROJECT_ID);

        // Local state actually survived: a claim for an entity that is not on
        // disk can only come from the migrated database.
        const rows = await db.dataSource.query(
            `SELECT entity_id FROM id_claims WHERE entity_id = ?`,
            [GHOST_CLAIM_ID],
        );
        expect(rows.length).toBe(1);

        // Local content is still readable after the move.
        const chat = JSON.parse(fs.readFileSync(local(dir, CHAT_FILE), 'utf-8'));
        expect(chat.sessions[0].title).toBe('Old session');
    } finally {
        await db.destroy().catch(() => {});
        cleanup(root);
    }
});

test('the migration is idempotent and never clobbers an already-migrated file', async () => {
    const { dir, root } = makeProject();
    try {
        await prepareProjectMeta(dir);
        fs.writeFileSync(local(dir, DB_FILE), 'MIGRATED');
        // A stray pre-split leftover sitting next to the migrated file.
        fs.writeFileSync(meta(dir, DB_FILE), 'STALE');

        await prepareProjectMeta(dir);
        expect(fs.readFileSync(local(dir, DB_FILE), 'utf-8')).toBe('MIGRATED');

        // Once the destination is gone the leftover is picked up on the next
        // load — a half-finished migration is always retried, never lost.
        fs.rmSync(local(dir, DB_FILE));
        await prepareProjectMeta(dir);
        expect(fs.existsSync(local(dir, DB_FILE))).toBe(true);
        expect(fs.existsSync(meta(dir, DB_FILE))).toBe(false);
    } finally {
        cleanup(root);
    }
});

test('sqlite sidecars only follow the database they belong to', async () => {
    const { dir, root } = makeProject();
    try {
        await prepareProjectMeta(dir);

        // The whole database is still pre-split: it and its journal move
        // together.
        fs.writeFileSync(meta(dir, DB_FILE), 'DB');
        fs.writeFileSync(meta(dir, `${DB_FILE}-journal`), 'JOURNAL');
        await prepareProjectMeta(dir);
        expect(fs.existsSync(local(dir, `${DB_FILE}-journal`))).toBe(true);
        expect(fs.existsSync(meta(dir, `${DB_FILE}-journal`))).toBe(false);

        // An orphan sidecar with no database beside it must NOT be replayed
        // against the already-migrated database.
        fs.writeFileSync(meta(dir, `${DB_FILE}-wal`), 'ORPHAN WAL');
        await prepareProjectMeta(dir);
        expect(fs.existsSync(meta(dir, `${DB_FILE}-wal`))).toBe(true);
        expect(fs.existsSync(local(dir, `${DB_FILE}-wal`))).toBe(false);
        expect(fs.readFileSync(local(dir, DB_FILE), 'utf-8')).toBe('DB');
    } finally {
        cleanup(root);
    }
});

test('a user-edited .imsc/.gitignore is left alone', async () => {
    const { dir, root } = makeProject();
    try {
        await prepareProjectMeta(dir);
        fs.writeFileSync(meta(dir, '.gitignore'), '.imsc-local/\n# my own note\n', 'utf-8');

        await prepareProjectMeta(dir);
        expect(fs.readFileSync(meta(dir, '.gitignore'), 'utf-8')).toContain('my own note');
    } finally {
        cleanup(root);
    }
});

// ─── constants agree with the implementation ─────────────────────────────────

test('the database path resolves inside .imsc/.imsc-local', () => {
    const dir = path.join('projects', 'demo');
    expect(path.join(dir, PROJECT_META_DB)).toBe(
        path.join(dir, PROJECT_META_FOLDER, PROJECT_META_LOCAL_FOLDER, 'project.db'),
    );
    expect(PROJECT_META_AI_CHAT).toBe('.imsc/.imsc-local/ai-chat.json');
    expect(PROJECT_META_LOCAL_INDEX).toBe('.imsc/.imsc-local/local.json');
    expect(PROJECT_META_SETTINGS).toBe('.imsc/settings.json');
    expect(PROJECT_META_GITIGNORE).toBe('.imsc/.gitignore');
});
