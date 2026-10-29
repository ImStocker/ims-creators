import fs from 'node:fs';
import path from 'node:path';
import log from 'electron-log/main';
import {
    PROJECT_META_FOLDER,
    PROJECT_META_GITIGNORE,
    PROJECT_META_INDEX,
    PROJECT_META_LOCAL,
    PROJECT_META_LOCAL_FOLDER,
    PROJECT_META_LOCAL_INDEX,
    PROJECT_META_DB_NAME,
    PROJECT_META_DB_SIDECAR_NAMES,
    PROJECT_META_LEGACY_LOCAL_FILES,
} from './project-db-constants';

/**
 * `.imsc/` layout: shared files at the top level, machine-local state in
 * `.imsc/.imsc-local/`.
 *
 *   .imsc/
 *   ├── index.json          shared — project identity (title, rootWorkspaceId)
 *   ├── settings.json       shared — project settings (export formats)
 *   ├── .gitignore          shared — keeps `.imsc-local/` out of version control
 *   └── .imsc-local/        local — never committed
 *       ├── local.json      local — cloud-project binding
 *       ├── project.db      local — sync state, id-claim registry, file map
 *       ├── ai-chat.json    local — AI session history
 *       └── fs-snapshot.txt local — watcher snapshot
 *
 * Everything here runs before the project is read, so a project written by an
 * older build is migrated in place on first load. All operations are
 * idempotent and tolerate a partially-migrated folder.
 */

export type ProjectLocalInfo = {
    /** Cloud project id this folder is bound to. Empty/absent = local-only. */
    id?: string;
};

async function pathExists(target: string): Promise<boolean> {
    try {
        await fs.promises.access(target);
        return true;
    } catch {
        return false;
    }
}

/**
 * Write JSON atomically: a concurrent load must never read a half-written
 * file — a torn read throws on JSON.parse and the project fails to open.
 */
export async function writeJsonAtomic(target: string, value: unknown): Promise<void> {
    const tmp = target + '.tmp';
    await fs.promises.writeFile(tmp, JSON.stringify(value), 'utf-8');
    await fs.promises.rename(tmp, target);
}

async function readJsonOrNull<T>(target: string): Promise<T | null> {
    try {
        return JSON.parse(await fs.promises.readFile(target, 'utf-8')) as T;
    } catch {
        // Missing or unreadable: the caller decides whether that is fatal.
        return null;
    }
}

export async function readProjectLocalInfo(localPath: string): Promise<ProjectLocalInfo> {
    const target = path.join(localPath, PROJECT_META_LOCAL_INDEX);
    let raw: string;
    try {
        raw = await fs.promises.readFile(target, 'utf-8');
    } catch {
        // Absent is normal: brand-new project, local-only project, or a git
        // clone (local.json is deliberately not committed).
        return {};
    }
    try {
        const info = JSON.parse(raw);
        return info && typeof info === 'object' ? info : {};
    } catch (err: any) {
        // Present but unreadable — say so, the cloud binding is lost until the
        // file is repaired.
        log.error('meta layout: unreadable local.json, cloud binding cannot be restored:', err.message);
        return {};
    }
}

export async function writeProjectLocalInfo(localPath: string, info: ProjectLocalInfo): Promise<void> {
    await writeJsonAtomic(path.join(localPath, PROJECT_META_LOCAL_INDEX), info);
}

/**
 * Move the pre-split local files out of `.imsc/` into `.imsc/.imsc-local/`.
 *
 * Skips anything already present at the destination so a half-finished
 * migration is never overwritten with stale data; the skipped file is picked
 * up on a later load once the destination clears.
 *
 * The database and its SQLite sidecars move as a unit: a `-journal`/`-wal`
 * file must never end up beside a *different* database, or SQLite would try
 * to replay it against the wrong file.
 */
async function migrateLegacyLocalFiles(localPath: string): Promise<void> {
    const metaDir = path.join(localPath, PROJECT_META_FOLDER);
    const localDir = path.join(localPath, PROJECT_META_LOCAL);

    let entries: string[];
    try {
        entries = await fs.promises.readdir(metaDir);
    } catch {
        return;
    }
    const present = new Set(entries);

    const moveOne = async (name: string): Promise<boolean> => {
        if (!present.has(name)) return false;
        const from = path.join(metaDir, name);
        const to = path.join(localDir, name);
        if (await pathExists(to)) return false;
        try {
            await fs.promises.rename(from, to);
            return true;
        } catch (err: any) {
            // Never fail the load over a moved file: the next open retries.
            log.error(`meta layout: failed to move ${name} into ${PROJECT_META_LOCAL}:`, err.message);
            return false;
        }
    };

    // Sidecars only follow the database when the database itself moved.
    if (await moveOne(PROJECT_META_DB_NAME)) {
        for (const sidecar of PROJECT_META_DB_SIDECAR_NAMES) {
            await moveOne(sidecar);
        }
    }
    for (const name of PROJECT_META_LEGACY_LOCAL_FILES) {
        await moveOne(name);
    }
}

/**
 * The cloud binding used to live in the shared `index.json`. Move it to the
 * machine-local `local.json`, so a git clone starts unbound instead of
 * inheriting the committer's cloud project id (two clones of one bound
 * project would otherwise share a single cloud binding).
 *
 * Leaves `index.json` untouched when it cannot be parsed — the project load
 * reports that error with its own context.
 */
async function migrateCloudBinding(localPath: string): Promise<void> {
    const indexPath = path.join(localPath, PROJECT_META_INDEX);
    const index = await readJsonOrNull<Record<string, any>>(indexPath);
    if (!index) return;

    const indexId = typeof index.id === 'string' ? index.id : '';
    if ('id' in index) {
        delete index.id;
        if (indexId) {
            const localInfo = await readProjectLocalInfo(localPath);
            if (!localInfo.id) {
                localInfo.id = indexId;
                await writeProjectLocalInfo(localPath, localInfo);
            }
        }
        try {
            await writeJsonAtomic(indexPath, index);
        } catch (err: any) {
            log.error('meta layout: failed to rewrite index.json:', err.message);
        }
    }
}

const LOCAL_IGNORE_LINES = [
    '# IMS Creators: machine-local project state — never commit this folder.',
    `${PROJECT_META_LOCAL_FOLDER}/`,
    // Insurance: pre-split leftovers a migration could not move (e.g. a locked
    // file) must not be committed either.
    `${PROJECT_META_DB_NAME}*`,
    ...PROJECT_META_LEGACY_LOCAL_FILES,
    '*.tmp',
];

/**
 * Drop `.imsc/.gitignore` so `.imsc-local/` stays out of git while the shared
 * files in `.imsc/` remain committable. Only written when absent — a user who
 * trimmed or extended it keeps their version.
 */
async function ensureLocalIgnoreFile(localPath: string): Promise<void> {
    const target = path.join(localPath, PROJECT_META_GITIGNORE);
    if (await pathExists(target)) return;
    try {
        await fs.promises.writeFile(target, LOCAL_IGNORE_LINES.join('\n') + '\n', 'utf-8');
    } catch (err: any) {
        log.error('meta layout: failed to write .imsc/.gitignore:', err.message);
    }
}

/**
 * Prepare `.imsc/` for a load: create both folders, migrate a pre-split
 * layout, split the cloud binding out of the shared index, and keep the local
 * folder out of version control. Safe to call on every load.
 */
export async function prepareProjectMeta(localPath: string): Promise<void> {
    // recursive: creates `.imsc/.imsc-local` (and `.imsc`) in one step —
    // better-sqlite3 will not create a missing parent directory for the DB.
    await fs.promises.mkdir(path.join(localPath, PROJECT_META_LOCAL), { recursive: true });

    await migrateLegacyLocalFiles(localPath);
    await migrateCloudBinding(localPath);
    await ensureLocalIgnoreFile(localPath);
}
