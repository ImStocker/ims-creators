import path from "node:path";

export const PROJECT_META_FOLDER = '.imsc'
export const PROJECT_META_INDEX = '.imsc/index.json'
export const PROJECT_META_SETTINGS = '.imsc/settings.json'
export const PROJECT_META_AI_CHAT = '.imsc/ai-chat.json'
export const PROJECT_META_FS_WATCHER_SNAPSHOT = '.imsc/fs-snapshot.txt'
export const PROJECT_META_DB = path.join('.imsc', 'project.db');

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