import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// ── Shared imports ────────────────────────────────────────────────────────────
import { mergeBlocksToSave, buildNewAsset } from '~/project-file-db/logic/asset-ops';
import { serializeAssetToJSON, serializeWorkspaceToJSON } from '~/project-file-db/logic/serialize';
import SystemBundle from '~/project-file-db/system-assets-bundle.json';
import type { ProjectFileDbAssetBlock, ProjectFileDbInfo } from '~/project-file-db/ProjectFileDb';

// ── Constants (mirrors open-source/desktop/electron/project-file-db/) ──────────

export const PROJECT_META_FOLDER = '.imsc';
export const PROJECT_META_INDEX = '.imsc/index.json';

export const ASSET_EXT = '.ima.json';
export const ASSET_EXT_RE = /\.ima[ \d()[\]_]*\.json$/i;
export const WORKSPACE_EXT = '.imw.json';
export const WORKSPACE_EXT_RE = /\.imw[ \d()[\]_]*\.json$/i;

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.nuxt', '.nitro', 'dist', 'dist-electron',
  'dist-client', '.output', '.cache', 'attachments',
]);

import { MARKDOWN_ASSET_ID } from '~ims-app-base/logic/constants';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ImsProjectInfo = ProjectFileDbInfo;

export type ImsAssetBlock = ProjectFileDbAssetBlock;

export type ImsAssetOnDisk = {
  id: string;
  projectId?: string;
  title: string | null;
  name: string | null;
  icon?: string | null;
  typeIds: string[];
  parentIds: string[];
  workspaceId: string | null;
  index: number | null;
  isAbstract?: boolean;
  comments?: unknown[];
  references?: unknown[];
  blocks?: ImsAssetBlock[];
  values: Record<string, Record<string, unknown>>;
  // Not stored on disk, populated at read time:
  createdAt?: string;
  updatedAt?: string;
  localName?: string;
};

export type ImsWorkspaceOnDisk = {
  id: string;
  title: string | null;
  name: string | null;
  parentId: string | null;
  projectId?: string;
  index: number | null;
  props?: Record<string, unknown>;
  // Not stored on disk, populated at read time:
  createdAt?: string;
  updatedAt?: string;
  localName?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const FORBIDDEN_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;
const MAX_FILENAME_LEN = 128;

function prepareFileBasenameByEntityTitle(title: string): string {
  return title.replace(FORBIDDEN_FILENAME_CHARS, '_').substring(0, MAX_FILENAME_LEN).trim();
}

function absolutePathToUuid(filepath: string, rootPath: string): string {
  const relativePath = path.relative(rootPath, filepath).replaceAll('\\', '/');
  const md5 = crypto.createHash('md5').update(relativePath).digest('hex');
  return md5.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
}

function uniqueName(
  base: string,
  suffix: string,
  exists: (name: string) => boolean,
): string {
  const candidate = base + suffix;
  if (!exists(candidate)) return candidate;

  const numMatch = base.match(/(\d+)$/);
  let stem = base;
  let n = 2;
  if (numMatch) {
    stem = base.slice(0, -numMatch[0].length);
    n = parseInt(numMatch[1], 10) + 1;
  }
  for (let i = n; i < n + 10_000; i++) {
    const c = `${stem}${i}${suffix}`;
    if (!exists(c)) return c;
  }
  return `${stem}${Date.now()}${suffix}`;
}

// ── ImsProject ────────────────────────────────────────────────────────────────

export class ImsProject {
  readonly rootPath: string;

  private _info: ImsProjectInfo | null = null;
  private _assets = new Map<string, ImsAssetOnDisk>();
  private _workspaces = new Map<string, ImsWorkspaceOnDisk>();
  private _assetPaths = new Map<string, string>(); // id → absolute .ima.json path
  private _workspacePaths = new Map<string, string>(); // id → absolute .imw.json path

  constructor(projectRootPath: string) {
    this.rootPath = path.resolve(projectRootPath);
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  get info(): ImsProjectInfo {
    if (!this._info) throw new Error('Project not loaded. Call load() first.');
    return this._info;
  }

  get assets(): ReadonlyMap<string, ImsAssetOnDisk> {
    return this._assets;
  }

  get workspaces(): ReadonlyMap<string, ImsWorkspaceOnDisk> {
    return this._workspaces;
  }

  /** Scan the project folder and load all data into memory. */
  load(): void {
    this._assets.clear();
    this._workspaces.clear();
    this._assetPaths.clear();
    this._workspacePaths.clear();

    // 1. Read project info
    this._info = this._readProjectInfo();

    // 2. Load system assets (types, etc.) for block inheritance
    for (const sysAsset of (SystemBundle as any).assets) {
      this._assets.set(sysAsset.id, { ...sysAsset, workspaceId: null });
    }
    for (const sysWs of (SystemBundle as any).workspaces) {
      this._workspaces.set(sysWs.id, { ...sysWs, workspaceId: null } as any);
    }

    // 3. Recursively scan the project root
    this._scanDirectory(this.rootPath, null);
  }

  /** Reload a single asset from disk by ID. */
  reloadAsset(assetId: string): ImsAssetOnDisk | null {
    const p = this._assetPaths.get(assetId);
    if (!p) return null;
    try {
      const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));
      const asset: ImsAssetOnDisk = {
        ...raw,
        localName: path.basename(p),
        createdAt: new Date(fs.statSync(p).birthtime).toISOString(),
        updatedAt: new Date(fs.statSync(p).mtime).toISOString(),
      };
      this._assets.set(assetId, asset);
      return asset;
    } catch {
      this._assets.delete(assetId);
      this._assetPaths.delete(assetId);
      return null;
    }
  }

  // ── Project Info ──────────────────────────────────────────────────────────

  private _readProjectInfo(): ImsProjectInfo {
    const metaPath = path.join(this.rootPath, PROJECT_META_INDEX);
    try {
      const raw = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      return {
        id: raw.id ?? '',
        title: raw.title ?? path.basename(this.rootPath),
        inited: !!raw.inited,
        rootWorkspaceId: raw.rootWorkspaceId ?? null,
      };
    } catch {
      return {
        id: '',
        title: path.basename(this.rootPath),
        inited: false,
        rootWorkspaceId: null,
      };
    }
  }

  // ── Directory Scanning ────────────────────────────────────────────────────

  private _scanDirectory(dirPath: string, parentWorkspaceId: string | null): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    // First pass: read files (.ima.json, .imw.json)
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (entry.name.startsWith('.')) continue;

      const ext = path.extname(entry.name);
      if (ext !== '.json' && ext !== '.md') continue;

      const absPath = path.join(dirPath, entry.name);

      if (ASSET_EXT_RE.test(entry.name)) {
        this._loadAssetFile(absPath, parentWorkspaceId);
      } else if (WORKSPACE_EXT_RE.test(entry.name)) {
        this._loadWorkspaceFile(absPath, parentWorkspaceId);
      } else if (ext === '.md') {
        this._loadMarkdownFile(absPath, entry.name, parentWorkspaceId);
      }
    }

    // Second pass: recurse into directories (each directory = workspace)
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;

      const folderPath = path.join(dirPath, entry.name);
      const metaPath = folderPath + WORKSPACE_EXT;

      // Ensure workspace metadata exists for the directory
      let wsId: string;
      const existingWs = this._findWorkspaceByPath(metaPath);
      if (existingWs) {
        wsId = existingWs.id;
      } else {
        wsId = absolutePathToUuid(folderPath, this.rootPath);
        const ws: ImsWorkspaceOnDisk = {
          id: wsId,
          title: entry.name,
          name: null,
          parentId: parentWorkspaceId,
          index: null,
          props: {},
          localName: entry.name + WORKSPACE_EXT,
          createdAt: new Date(fs.statSync(folderPath).birthtime).toISOString(),
          updatedAt: new Date(fs.statSync(folderPath).mtime).toISOString(),
        };
        this._workspaces.set(wsId, ws);
        this._workspacePaths.set(wsId, metaPath);
      }

      this._scanDirectory(folderPath, wsId);
    }
  }

  private _loadAssetFile(absPath: string, parentWorkspaceId: string | null): void {
    try {
      const raw = JSON.parse(fs.readFileSync(absPath, 'utf-8'));
      const stat = fs.statSync(absPath);
      const asset: ImsAssetOnDisk = {
        ...raw,
        workspaceId: parentWorkspaceId,
        localName: path.basename(absPath),
        createdAt: new Date(stat.birthtime).toISOString(),
        updatedAt: new Date(stat.mtime).toISOString(),
        values: raw.values ?? {},
      };
      this._assets.set(asset.id, asset);
      this._assetPaths.set(asset.id, absPath);
    } catch {
      // Skip unreadable files
    }
  }

  private _loadWorkspaceFile(absPath: string, parentWorkspaceId: string | null): void {
    try {
      const raw = JSON.parse(fs.readFileSync(absPath, 'utf-8'));
      const stat = fs.statSync(absPath);
      const ws: ImsWorkspaceOnDisk = {
        ...raw,
        parentId: raw.parentId ?? parentWorkspaceId,
        localName: path.basename(absPath),
        createdAt: new Date(stat.birthtime).toISOString(),
        updatedAt: new Date(stat.mtime).toISOString(),
        props: raw.props ?? {},
      };
      if (ws.name === 'gdd') ws.name = null; // gdd is reserved
      this._workspaces.set(ws.id, ws);
      this._workspacePaths.set(ws.id, absPath);
    } catch {
      // Skip unreadable files
    }
  }

  private _loadMarkdownFile(absPath: string, filename: string, parentWorkspaceId: string | null): void {
    try {
      const content = fs.readFileSync(absPath, 'utf-8');
      const stat = fs.statSync(absPath);
      const id = absolutePathToUuid(absPath, this.rootPath);
      const title = path.basename(filename, '.md');
      const asset: ImsAssetOnDisk = {
        id,
        title,
        name: null,
        typeIds: [MARKDOWN_ASSET_ID],
        parentIds: [MARKDOWN_ASSET_ID],
        workspaceId: parentWorkspaceId,
        index: null,
        values: {},
        localName: filename,
        createdAt: new Date(stat.birthtime).toISOString(),
        updatedAt: new Date(stat.mtime).toISOString(),
      };
      this._assets.set(id, asset);
      this._assetPaths.set(id, absPath);
    } catch {
      // Skip unreadable files
    }
  }

  private _findWorkspaceByPath(absPath: string): ImsWorkspaceOnDisk | undefined {
    for (const [id, p] of this._workspacePaths) {
      if (p === absPath) return this._workspaces.get(id);
    }
    return undefined;
  }

  // ── Asset Operations ──────────────────────────────────────────────────────

  getAsset(id: string): ImsAssetOnDisk | undefined {
    return this._assets.get(id);
  }

  listAssets(filter?: { workspaceId?: string; typeId?: string }): ImsAssetOnDisk[] {
    const result: ImsAssetOnDisk[] = [];
    for (const [, a] of this._assets) {
      if (filter?.workspaceId && a.workspaceId !== filter.workspaceId) continue;
      if (filter?.typeId && !a.typeIds.includes(filter.typeId)) continue;
      result.push(a);
    }
    return result;
  }

  createAsset(params: {
    title: string;
    workspaceId?: string | null;
    parentIds?: string[];
    typeIds?: string[];
    name?: string | null;
    values?: Record<string, Record<string, unknown>>;
    blocks?: ImsAssetBlock[];
    id?: string;
  }): ImsAssetOnDisk {
    const wsId = params.workspaceId ?? null;

    // Determine target directory
    let targetDir = this.rootPath;
    if (wsId) {
      const wsDir = this._getWorkspaceDir(wsId);
      if (!wsDir) throw new Error(`Workspace "${wsId}" not found`);
      targetDir = wsDir;
    }

    // Resolve parent type for block inheritance
    let parentAsset = null;
    if (params.parentIds && params.parentIds.length > 0) {
      const parentId = params.parentIds[0];
      const parent = this._assets.get(parentId);
      if (parent) {
        parentAsset = parent as any;
      }
    }

    // Use shared buildNewAsset to create asset with proper block inheritance
    const assetObj = buildNewAsset(
      {
        id: params.id,
        workspaceId: wsId,
        title: params.title,
        name: params.name ?? null,
        typeIds: params.typeIds ?? params.parentIds ?? [],
        parentIds: params.parentIds ?? [],
      },
      parentAsset as any,
      this.info.id,
    );

    // Merge any user-provided blocks via shared mergeBlocksToSave
    let blocks = assetObj.blocks as ImsAssetBlock[];
    if (params.blocks && params.blocks.length > 0) {
      // Merge user blocks into the inherited blocks
      const blocksByKey: Record<string, any> = {};
      for (const block of params.blocks) {
        const key = block.name || `@${block.id}`;
        blocksByKey[key] = {
          type: block.type,
          name: block.name,
          title: block.title,
          index: block.index,
          props: block.props,
        };
      }
      blocks = mergeBlocksToSave(blocks as any, blocksByKey) as ImsAssetBlock[];
    }

    // Generate filename
    const baseName = prepareFileBasenameByEntityTitle(params.title || 'untitled');
    const filename = uniqueName(baseName, ASSET_EXT, (name) =>
      fs.existsSync(path.join(targetDir, name)),
    );

    const absPath = path.join(targetDir, filename);
    const id = assetObj.id;

    const asset: ImsAssetOnDisk = {
      id,
      title: params.title,
      name: params.name ?? null,
      typeIds: assetObj.typeIds,
      parentIds: assetObj.parentIds,
      workspaceId: wsId,
      index: null,
      references: (assetObj as any).references ?? [],
      blocks,
      values: params.values ?? {},
      localName: filename,
      createdAt: (assetObj as any).createdAt,
      updatedAt: (assetObj as any).updatedAt,
    };

    this._writeAssetFile(asset, absPath);
    this._assets.set(id, asset);
    this._assetPaths.set(id, absPath);
    return asset;
  }

  changeAsset(
    id: string,
    patch: {
      title?: string;
      name?: string | null;
      typeIds?: string[];
      parentIds?: string[];
      workspaceId?: string | null;
      values?: Record<string, Record<string, unknown>>;
      blocks?: ImsAssetBlock[];
    },
  ): ImsAssetOnDisk {
    const asset = this._assets.get(id);
    if (!asset) throw new Error(`Asset "${id}" not found`);

    const oldPath = this._assetPaths.get(id)!;
    const oldWsId = asset.workspaceId;

    // Apply patches
    if (patch.title !== undefined) asset.title = patch.title;
    if (patch.name !== undefined) asset.name = patch.name;
    if (patch.typeIds !== undefined) asset.typeIds = patch.typeIds;
    if (patch.parentIds !== undefined) asset.parentIds = patch.parentIds;
    if (patch.workspaceId !== undefined) asset.workspaceId = patch.workspaceId;
    if (patch.values !== undefined) asset.values = patch.values;
    asset.updatedAt = new Date().toISOString();

    // Merge blocks using shared function
    if (patch.blocks !== undefined && asset.blocks) {
      const blocksByKey: Record<string, any> = {};
      for (const block of patch.blocks) {
        const key = block.name || `@${block.id}`;
        blocksByKey[key] = {
          type: block.type,
          name: block.name,
          title: block.title,
          index: block.index,
          props: block.props,
          computed: block.computed,
          inherited: block.inherited,
        };
      }
      asset.blocks = mergeBlocksToSave(asset.blocks as any, blocksByKey) as ImsAssetBlock[];
    }

    // Determine if we need to move the file (workspace change or title change)
    let newPath = oldPath;
    const wsChanged = patch.workspaceId !== undefined && patch.workspaceId !== oldWsId;
    const titleChanged = patch.title !== undefined && patch.title !== asset.title;

    if (wsChanged || titleChanged) {
      let targetDir = this.rootPath;
      const finalWsId = asset.workspaceId;
      if (finalWsId) {
        const wsDir = this._getWorkspaceDir(finalWsId);
        if (!wsDir) throw new Error(`Workspace "${finalWsId}" not found`);
        targetDir = wsDir;
      }

      const baseName = prepareFileBasenameByEntityTitle(asset.title || 'untitled');
      const filename = uniqueName(baseName, ASSET_EXT, (name) => {
        const p = path.join(targetDir, name);
        return p !== oldPath && fs.existsSync(p);
      });

      newPath = path.join(targetDir, filename);
      asset.localName = filename;

      // Move file on disk
      this._deleteFileFromDisk(oldPath);
      this._writeAssetFile(asset, newPath);
      this._assetPaths.set(id, newPath);
    } else {
      // Just overwrite in place
      this._writeAssetFile(asset, oldPath);
    }

    return asset;
  }

  deleteAsset(id: string): boolean {
    const asset = this._assets.get(id);
    if (!asset) return false;

    const filePath = this._assetPaths.get(id);
    if (filePath) {
      this._deleteFileFromDisk(filePath);
    }

    this._assets.delete(id);
    this._assetPaths.delete(id);
    return true;
  }

  // ── Workspace Operations ──────────────────────────────────────────────────

  getWorkspace(id: string): ImsWorkspaceOnDisk | undefined {
    return this._workspaces.get(id);
  }

  listWorkspaces(filter?: { parentId?: string | null }): ImsWorkspaceOnDisk[] {
    const result: ImsWorkspaceOnDisk[] = [];
    for (const ws of this._workspaces.values()) {
      if (filter?.parentId !== undefined && ws.parentId !== filter.parentId) continue;
      result.push(ws);
    }
    return result;
  }

  createWorkspace(params: {
    title: string;
    parentId?: string | null;
    index?: number | null;
    props?: Record<string, unknown>;
    id?: string;
  }): ImsWorkspaceOnDisk {
    const parentId = params.parentId ?? null;

    // Determine parent directory
    let parentDir = this.rootPath;
    if (parentId) {
      const dir = this._getWorkspaceDir(parentId);
      if (!dir) throw new Error(`Parent workspace "${parentId}" not found`);
      parentDir = dir;
    }

    // Generate folder + meta file
    const folderName = prepareFileBasenameByEntityTitle(params.title || 'untitled');
    const folderPath = path.join(parentDir, folderName);
    const metaPath = folderPath + WORKSPACE_EXT;

    // Ensure unique folder name
    let finalFolder = folderPath;
    let n = 2;
    while (fs.existsSync(finalFolder + WORKSPACE_EXT)) {
      finalFolder = `${folderPath} - ${n}`;
      n++;
    }

    const id = params.id ?? absolutePathToUuid(finalFolder, this.rootPath);
    const now = new Date().toISOString();

    const ws: ImsWorkspaceOnDisk = {
      id,
      title: params.title,
      name: null,
      parentId,
      index: params.index ?? null,
      props: params.props ?? {},
      localName: path.basename(finalFolder) + WORKSPACE_EXT,
      createdAt: now,
      updatedAt: now,
    };

    // Create directory and meta file using shared serialization
    fs.mkdirSync(finalFolder, { recursive: true });
    const finalMetaPath = finalFolder + WORKSPACE_EXT;
    const wsData = serializeWorkspaceToJSON(ws);
    fs.writeFileSync(finalMetaPath, JSON.stringify(wsData, null, 1), 'utf-8');

    this._workspaces.set(id, ws);
    this._workspacePaths.set(id, finalMetaPath);
    return ws;
  }

  // ── Internal Helpers ──────────────────────────────────────────────────────

  private _getWorkspaceDir(wsId: string): string | null {
    // For the root GDD folder, return project root
    if (wsId === this.info.rootWorkspaceId) {
      return this.rootPath;
    }

    const ws = this._workspaces.get(wsId);
    if (!ws) return null;

    const metaPath = this._workspacePaths.get(wsId);
    if (!metaPath) return null;

    // The directory is the meta path without .imw.json
    const dir = metaPath.replace(/\.imw\.json$/, '');
    return dir;
  }

  private _writeAssetFile(asset: ImsAssetOnDisk, filePath: string): void {
    // Use shared serialization — produces canonical Desktop format (blocks + values)
    const onDisk = serializeAssetToJSON(asset as any);
    fs.writeFileSync(filePath, JSON.stringify(onDisk, null, 2), 'utf-8');
  }

  private _deleteFileFromDisk(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Best effort
    }
  }
}
