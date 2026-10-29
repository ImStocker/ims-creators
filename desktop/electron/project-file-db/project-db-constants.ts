import path from "node:path";

export const PROJECT_META_FOLDER = '.imsc'
/**
 * Machine-local state lives in a subfolder of `.imsc`, never at its top level:
 * `.imsc/.gitignore` ignores this folder while leaving `index.json`,
 * `settings.json` etc. committable — see `project-meta-layout.ts`.
 */
export const PROJECT_META_LOCAL_FOLDER = '.imsc-local'
export const PROJECT_META_LOCAL = `${PROJECT_META_FOLDER}/${PROJECT_META_LOCAL_FOLDER}`

/** Shared: project identity. Safe to commit. */
export const PROJECT_META_INDEX = `${PROJECT_META_FOLDER}/index.json`
/** Shared: project-level settings (export formats). Safe to commit. */
export const PROJECT_META_SETTINGS = `${PROJECT_META_FOLDER}/settings.json`
/** Local: cloud-project binding and other per-machine info. Never commit. */
export const PROJECT_META_LOCAL_INDEX = `${PROJECT_META_LOCAL}/local.json`
/** Local: AI session history. Never commit. */
export const PROJECT_META_AI_CHAT = `${PROJECT_META_LOCAL}/ai-chat.json`
/** Local: parcel watcher snapshot. Never commit. */
export const PROJECT_META_FS_WATCHER_SNAPSHOT = `${PROJECT_META_LOCAL}/fs-snapshot.txt`
/** Local: sync state, id-claim registry, file mapping. Never commit. */
export const PROJECT_META_DB = path.join(PROJECT_META_LOCAL, 'project.db');
/** Bare filename of the local database. */
export const PROJECT_META_DB_NAME = path.basename(PROJECT_META_DB);
/** SQLite journal/WAL/SHM files — only meaningful next to their database. */
export const PROJECT_META_DB_SIDECAR_NAMES = [
  `${PROJECT_META_DB_NAME}-journal`,
  `${PROJECT_META_DB_NAME}-wal`,
  `${PROJECT_META_DB_NAME}-shm`,
];
/** Keeps `PROJECT_META_LOCAL_FOLDER` out of git while `.imsc/` stays tracked. */
export const PROJECT_META_GITIGNORE = `${PROJECT_META_FOLDER}/.gitignore`

/**
 * Local files that used to sit directly in `.imsc/` before the local/shared
 * split, besides the database (and its sidecars). Migrated into
 * `PROJECT_META_LOCAL_FOLDER` on first load — see `project-meta-layout.ts`.
 */
export const PROJECT_META_LEGACY_LOCAL_FILES = [
  'ai-chat.json',
  'fs-snapshot.txt',
] as const;

export const ASSET_BASE_ORDERING = [
  'index',
  'title',
  'name',
  'createdAt',
  'id',
];

export const WORKSPACE_BASE_ORDERING = [
  'index',
  'title',
  'name',
  'createdAt',
  'id',
];

export type AssetSaveFormat = 'ima' | 'json';

export const ASSET_SAVE_FORMAT_SETTING_KEY = 'assetSaveFormat';
export const ASSET_SAVE_FORMAT_DEFAULT: AssetSaveFormat = 'json';
