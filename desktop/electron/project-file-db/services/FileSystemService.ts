import { ProjectFileDb, type ProjectFileDbAsset, type ProjectFileDbWorkspace } from "../ProjectFileDb";
import fs from 'node:fs';
import * as node_path from 'path';
import { AssetRights } from '~ims-app-base/logic/types/Rights';
import { v4 as uuidv4 } from 'uuid';
import { absolutePathToUuid, isDir, isDirSync, getWorkspaceLocalPathFolder, getAssetLocalPath } from "../utils/files";
import { MARKDOWN_ASSET_ID, BLOCK_NAME_META, BLOCK_ID_META, BLOCK_TYPE_META } from "~ims-app-base/logic/constants";
import SystemBundle from "../system-assets-bundle.json"
import watcher, { type AsyncSubscription, type Event } from "@parcel/watcher"
import path from "node:path";
import { PROJECT_META_FOLDER, PROJECT_META_FS_WATCHER_SNAPSHOT } from "../project-db-constants";
import log from 'electron-log/main';
import { ProjectFileDbTransaction } from "../logic/ProjectFileDbTransaction";
import { plainBlockToAssigned } from "../logic/asset-ops";
import { assignPlainValueToAssetProps, getAssetPropType } from '~ims-app-base/logic/types/Props';
import { parseMarkdownFrontmatter, MARKDOWN_DEFAULT_ICON, type MarkdownFrontmatterMeta } from '../logic/markdown-frontmatter';
import { resolveWorkspaceClaims, compareClaimInfo, type WorkspaceClaimant, type ClaimResolution, type ClaimInfo } from '../logic/id-claim';
   
const MARKDOWN_BLOCK_ID_META = '00000000-0000-0000-0000-390000000001';

type FileSystemExpectChange = {
    filepaths: string[]
}

type FileSystemEntryWithLocalPath<T> = {
    entry: T,
    localPath: string
}

type FileSystemWorkspaceContent = {
    assets: FileSystemEntryWithLocalPath<ProjectFileDbAsset>[],
    workspaces: FileSystemEntryWithLocalPath<ProjectFileDbWorkspace>[],
}

const PARCEL_WATCHER_DELAY = 100;

export const ASSET_EXT = '.ima.json'
export const ASSET_EXT_TEST_REGEXP = /\.ima[ \d\(\)\[\]_]*\.json$/i
/**
 * Legacy workspace meta: a `name.imw.json` file sitting NEXT TO the `name/`
 * folder. Kept readable for old projects; never written anymore.
 */
export const WORKSPACE_EXT = '.imw.json'
export const WORKSPACE_EXT_TEST_REGEXP = /\.imw[ \d\(\)\[\]_]*\.json$/i
/**
 * Current workspace meta: a dot-file INSIDE the workspace folder, so the meta
 * travels with the folder on rename/move (the legacy sibling file did not,
 * which broke identity when a folder was renamed outside the app).
 */
export const WORKSPACE_META_FILENAME = '.imw'

export const ATTACHMENTS_FOLDER = 'attachments'

/**
 * Extension of new-format files. Copy markers (` - N`) are part of the file
 * name and must never be stripped when deriving a title from it.
 */
const NEW_FORMAT_EXT_TEST_REGEXP = /\.json$/i

function isNewFormatJsonFile(localName: string): boolean {
    return localName.endsWith('.json')
        && !ASSET_EXT_TEST_REGEXP.test(localName)
        && !WORKSPACE_EXT_TEST_REGEXP.test(localName);
}

function prepareEntityTitle(filename: string, title: string | null, ext_regexp: RegExp): string {
    // Titles are shown exactly as they exist: the title stored in the file
    // always wins verbatim; only when it's absent do we fall back to the file
    // name (extension stripped, copy suffix ` - N` kept — it is part of the
    // name, never removed).
    if (title) return title;
    return filename.replace(ext_regexp, '');
}


export class FileSystemService{

    private _fsWatcherSubscription: AsyncSubscription | null = null;
    private _fsExpectChanges: FileSystemExpectChange[] = []
    private _fsPendingFSEvents: Event[] = []
    private _fsPendingFSInWork = false

    // Id-claim state (see meta/devdocs/desktop-id-claim.md): which ids are
    // owned by which artifact during this session. Seeded with system ids on
    // init; never released during the session (tombstones are the registry's job).
    private _claimedWorkspaceIds = new Set<string>();
    private _claimedWorkspacePaths = new Map<string, string>(); // id -> key path of its artifact
    private _claimedAssetIds = new Set<string>();
    private _assetClaimants = new Map<string, { absPath: string; relPath: string; claimedAt: number | null; asset: ProjectFileDbAsset }>();
    private _wsClaimResolution: Map<string, ClaimResolution> | null = null;
    private _loadingPhase = false;

    constructor(public db: ProjectFileDb){

    }

    private async _loadFile(absolutePath: string, parentWorkspaceId: string | null, rootPath: string): Promise<{
        type: 'asset',
        asset: ProjectFileDbAsset,
        localPath: string
    } | {
        type: 'workspace',
        workspace: ProjectFileDbWorkspace,
        localPath: string
    } | null>{
    
        const local_path = node_path.relative(rootPath, absolutePath)
        const local_name = node_path.basename(absolutePath);
        const extname = node_path.extname(local_name);
        
        if (extname !== '.json' && extname !== '.md'){
            return null
        }

        let file_info: fs.Stats;
        try {
            file_info = await fs.promises.stat(absolutePath);
        }
        catch (err: any){
            if (err.code === 'ENOENT'){
                return null;
            }
            throw err;
        }

        const created_at = file_info.birthtime.toISOString();
        const updated_at = file_info.mtime.toISOString();

        const file = await fs.promises.readFile(absolutePath, { encoding: 'utf8' });
        if (extname === '.json') {
            if (ASSET_EXT_TEST_REGEXP.test(local_name)) {
                const asset = JSON.parse(file) as ProjectFileDbAsset & { __meta?: { idClaimedAt?: unknown } };
                // Id claim lives under `__meta` (see meta/devdocs/desktop-id-claim.md)
                asset.idClaimedAt = typeof asset.__meta?.idClaimedAt === 'number' ? asset.__meta.idClaimedAt : null;
                delete asset.__meta;
                asset.title = prepareEntityTitle(local_name, asset.title, ASSET_EXT_TEST_REGEXP)
                asset.localName = local_name
                asset.workspaceId = parentWorkspaceId;
                asset.createdAt = created_at;
                asset.updatedAt = updated_at;
                asset.projectId = this.db.info.id ?? '';
                asset.rights = AssetRights.FULL_ACCESS;
                // On-disk blocks are plain — store them in assigned (flatten) form
                asset.blocks = (asset.blocks ?? []).map(block => plainBlockToAssigned(block as any));
                await this._claimAssetEntry(asset, absolutePath, rootPath);
                return {
                    type: 'asset',
                    localPath: local_path,
                    asset
                }
            }
            else if (WORKSPACE_EXT_TEST_REGEXP.test(local_name)){
                const resolution = this._wsClaimResolution?.get(absolutePath);
                if (resolution?.action === 'drop') {
                    log.info('id-claim: conflicting folderless meta not loaded', absolutePath);
                    return null;
                }
                // Pairing check must mirror the folder walk: only a meta named
                // exactly `<folder>.imw.json` with the folder present counts as folder-backed
                const legacy_base = local_name.endsWith(WORKSPACE_EXT)
                    ? local_name.substring(0, local_name.length - WORKSPACE_EXT.length)
                    : null;
                const legacy_folder = legacy_base
                    ? node_path.join(node_path.dirname(absolutePath), legacy_base)
                    : null;
                const folder_path = legacy_folder && isDirSync(legacy_folder) ? legacy_folder : null;
                if (folder_path && fs.existsSync(node_path.join(folder_path, WORKSPACE_META_FILENAME))) {
                    // In-folder `.imw` owns the folder's identity — a leftover
                    // legacy sibling must not load as a second workspace
                    log.info('id-claim: leftover legacy meta next to in-folder .imw not loaded', absolutePath);
                    return null;
                }
                const workspace_info = JSON.parse(file) as ProjectFileDbWorkspace & { idClaimedAt?: unknown };
                if (resolution?.action === 'reid') workspace_info.id = resolution.newId;
                workspace_info.idClaimedAt = typeof workspace_info.idClaimedAt === 'number' ? workspace_info.idClaimedAt : null;
                workspace_info.title = prepareEntityTitle(local_name, workspace_info.title, WORKSPACE_EXT_TEST_REGEXP)
                workspace_info.localName = local_name
                workspace_info.parentId = parentWorkspaceId;
                workspace_info.createdAt = created_at;
                workspace_info.updatedAt = updated_at;
                workspace_info.projectId = this.db.info.id ?? '';
                workspace_info.rights = AssetRights.FULL_ACCESS;
                if(workspace_info.name === 'gdd') {
                    workspace_info.name = null; // gdd is reserved workspace name
                }
                workspace_info.id = await this._claimWorkspaceEntry(
                    workspace_info.id,
                    absolutePath,
                    folder_path ?? absolutePath,
                    rootPath,
                    'legacy'
                );
                return {
                    type: 'workspace',
                    localPath: local_path,
                    workspace: workspace_info
                };
            }
            else if (isNewFormatJsonFile(local_name)) {
                const parsed = JSON.parse(file);
                if (parsed && typeof parsed === 'object') {
                    let asset: ProjectFileDbAsset;
                    if (parsed.__meta && typeof parsed.__meta.id === 'string') {
                        asset = this._loadNewFormatAsset(parsed, local_name, local_path, parentWorkspaceId, created_at, updated_at);
                        // Id claim lives under `__meta`
                        asset.idClaimedAt = typeof parsed.__meta.idClaimedAt === 'number' ? parsed.__meta.idClaimedAt : null;
                    }
                    else {
                        asset = this._loadPlainJsonAsset(parsed, local_name, local_path, parentWorkspaceId, created_at, updated_at, absolutePath, rootPath);
                        asset.idClaimedAt = null;
                    }
                    await this._claimAssetEntry(asset, absolutePath, rootPath);
                    return {
                        type: 'asset',
                        localPath: local_path,
                        asset
                    };
                }
            }
        }
        else if(extname === '.md'){
            const { meta: fm_meta, content: md_content } = parseMarkdownFrontmatter(file);
            const fm_values: Record<string, unknown> =
                fm_meta?.values && typeof fm_meta.values === 'object' && !Array.isArray(fm_meta.values)
                    ? fm_meta.values
                    : {};
            const own_icon: string = fm_meta?.icon ?? MARKDOWN_DEFAULT_ICON;
            const asset_full: ProjectFileDbAsset = {
                id: fm_meta?.id ?? absolutePathToUuid(absolutePath, rootPath),
                projectId: this.db.project.db.info.id ?? '',
                workspaceId: parentWorkspaceId,
                name: fm_meta?.name ?? null,
                title: node_path.basename(local_name, extname),
                icon: own_icon,
                isAbstract: false,
                typeIds: [MARKDOWN_ASSET_ID],
                createdAt: created_at,
                updatedAt: updated_at,
                deletedAt: null,
                rights: AssetRights.FULL_ACCESS,
                index: null,
                creatorUserId: null,
                unread: 0,
                hasImage: false,
                parentIds: [MARKDOWN_ASSET_ID],
                ownTitle: null,
                ownIcon: own_icon,
                blocks: [{
                    id: MARKDOWN_BLOCK_ID_META,
                    type: 'props',
                    name: BLOCK_NAME_META,
                    title: null,
                    index: 0,
                    createdAt: created_at,
                    updatedAt: updated_at,
                    ownTitle: null,
                    own: true,
                    props: assignPlainValueToAssetProps({}, {
                        format: 'md',
                        ...fm_values,
                    }),
                    computed: assignPlainValueToAssetProps({}, {
                        format: 'md',
                        ...fm_values,
                    }),
                    inherited: {},
                },
                {
                    id: uuidv4(),
                    type: 'markdown',
                    name: null,
                    title: null,
                    index: 1,
                    createdAt: created_at,
                    updatedAt: updated_at,
                    ownTitle: null,
                    own: true,
                    props: assignPlainValueToAssetProps({}, {
                        value: md_content,
                    }),
                    computed: assignPlainValueToAssetProps({}, {
                        value: md_content,
                    }),
                    inherited: {},
                }],
                comments: [],
                references: [],
                lastViewedAt: null,
                localName: local_name,
            };
            await this._claimAssetEntry(asset_full, absolutePath, rootPath);
            return {
                type: 'asset',
                localPath: local_path,
                asset: asset_full
            };
        }
        return null;
    }

    private _loadNewFormatAsset(
        parsed: any,
        local_name: string,
        local_path: string,
        parentWorkspaceId: string | null,
        created_at: string,
        updated_at: string,
    ): ProjectFileDbAsset {
        const meta = parsed.__meta;
        const file_timestamps = { createdAt: created_at, updatedAt: updated_at };

        // Build __meta block
        const meta_values = (meta.values && typeof meta.values === 'object') ? meta.values : {};
        const blocks: ProjectFileDbAsset['blocks'] = [{
            id: BLOCK_ID_META,
            type: BLOCK_TYPE_META,
            name: BLOCK_NAME_META,
            title: null,
            index: 0,
            ...file_timestamps,
            ownTitle: null,
            own: true,
            props: assignPlainValueToAssetProps({}, { ...meta_values }),
            computed: assignPlainValueToAssetProps({}, { ...meta_values }),
            inherited: {},
        }];

        // Build blocks from __meta.blocks metadata
        const blocks_meta = Array.isArray(meta.blocks) ? meta.blocks : [];
        for (const bm of blocks_meta) {
            if (!bm || typeof bm !== 'object' || !bm.id) continue;

            if (bm.deleted) {
                blocks.push({
                    id: bm.id,
                    type: 'props',
                    name: bm.name ?? null,
                    title: null,
                    index: 0,
                    ...file_timestamps,
                    ownTitle: null,
                    own: true,
                    delete: true,
                    props: assignPlainValueToAssetProps({}, {}),
                    computed: assignPlainValueToAssetProps({}, {}),
                    inherited: {},
                });
                continue;
            }

            // Look up value from top-level keys
            const key = bm.name ? bm.name : `@${bm.id}`;
            const raw_value = parsed[key];

            const block_meta =
                bm.meta && typeof bm.meta === 'object' && !Array.isArray(bm.meta)
                    ? bm.meta
                    : null;

            if (raw_value === undefined && !block_meta) {
                // Block referenced in metadata but no value at top-level — skip
                continue;
            }

            const block_type = bm.type || 'props';
            let block_props: Record<string, any> = {};

            // markdown/text/prop store their `value` directly at the top-level key
            const value_unwrapped =
                block_type === 'markdown' || block_type === 'text' || block_type === 'prop';

            if (raw_value !== undefined) {
                const type = getAssetPropType(raw_value);
                if (type !== undefined){
                    block_props = { value: raw_value };
                }
                else if (typeof raw_value === 'object' && raw_value !== null && !Array.isArray(raw_value)) {
                    block_props = { ...raw_value };
                } else {
                    // Primitive or array — wrap in value
                    block_props = { value: raw_value };
                }
            }

            // Restore block meta keys (own props that aren't stored at the root) back into the block
            if (block_meta) {
                block_props = { ...block_props, ...block_meta };
            }

            blocks.push({
                id: bm.id,
                type: block_type,
                name: bm.name ?? null,
                title: bm.title ?? null,
                index: bm.index ?? 0,
                createdAt: bm.createdAt ?? created_at,
                updatedAt: bm.updatedAt ?? updated_at,
                ownTitle: null,
                own: true,
                props: assignPlainValueToAssetProps({}, block_props),
                computed: assignPlainValueToAssetProps({}, block_props),
                inherited: {},
            });
        }

        // Compute typeIds from parent (system assets are already in collection)
        let typeIds: string[] = [];
        const parentIds = Array.isArray(meta.parentIds) ? meta.parentIds : [];
        if (parentIds.length > 0) {
            const parent = this.db.asset.assets.byId.get(parentIds[0]);
            if (parent) {
                typeIds = [parent.id, ...parent.typeIds];
            }
        }

        return {
            id: meta.id,
            projectId: meta.projectId ?? this.db.info.id ?? '',
            workspaceId: parentWorkspaceId,
            name: null,
            title: prepareEntityTitle(local_name, meta.title ?? null, NEW_FORMAT_EXT_TEST_REGEXP),
            icon: meta.icon ?? null,
            isAbstract: !!meta.isAbstract,
            typeIds,
            createdAt: created_at,
            updatedAt: updated_at,
            deletedAt: null,
            rights: AssetRights.FULL_ACCESS,
            index: meta.index ?? null,
            creatorUserId: null,
            unread: 0,
            hasImage: false,
            parentIds,
            ownTitle: null,
            ownIcon: meta.icon ?? null,
            blocks,
            comments: [],
            references: [],
            lastViewedAt: null,
            localName: local_name,
        };
    }

    /**
     * Load an arbitrary .json file (no __meta) as an asset. Each top-level
     * attribute becomes a block: scalar values become prop blocks with an
     * inferred __type, arrays become multi-value prop blocks, objects stay
     * as props blocks with per-attribute type metadata.
     */
    private _loadPlainJsonAsset(
        parsed: any,
        local_name: string,
        local_path: string,
        parentWorkspaceId: string | null,
        created_at: string,
        updated_at: string,
        absolutePath: string,
        rootPath: string,
    ): ProjectFileDbAsset {
        const title = node_path.basename(local_name, '.json');
        const file_timestamps = { createdAt: created_at, updatedAt: updated_at };

        const blocks: ProjectFileDbAsset['blocks'] = [{
            id: BLOCK_ID_META,
            type: BLOCK_TYPE_META,
            name: BLOCK_NAME_META,
            title: null,
            index: 0,
            ...file_timestamps,
            ownTitle: null,
            own: true,
            props: assignPlainValueToAssetProps({}, {}),
            computed: assignPlainValueToAssetProps({}, {}),
            inherited: {},
        }];

        const is_plain_object = parsed && typeof parsed === 'object' && !Array.isArray(parsed);
        if (is_plain_object) {
            let index = 1;
            for (const [key, value] of Object.entries(parsed)) {
                if (key === '__meta') {
                    // Reserved key — skip
                    continue;
                }
                const is_array = Array.isArray(value);
                const is_object = typeof value === 'object' && value !== null && !is_array;
                const block_type = is_object ? 'props' : 'prop';
                const prop_type = is_array
                    ? jsonArrayToPropType(value)
                    : (is_object ? null : jsonValueToPropType(value));
                let block_props: Record<string, any>;
                if (is_object) {
                    block_props = { ...value, __props: buildStructPropMeta(value as Record<string, unknown>) };
                } else {
                    block_props = { value, ...(prop_type ? { __type: prop_type } : {}) };
                    if (is_array) block_props.__multiple = true;
                }
                const block_computed = { ...block_props };
                blocks.push({
                    id: uuidv4(),
                    type: block_type,
                    name: key,
                    title: null,
                    index,
                    ...file_timestamps,
                    ownTitle: null,
                    own: true,
                    props: assignPlainValueToAssetProps({}, block_props),
                    computed: assignPlainValueToAssetProps({}, block_computed),
                    inherited: {},
                });
                index++;
            }
        }

        return {
            id: absolutePathToUuid(absolutePath, rootPath),
            projectId: this.db.project.db.info.id ?? '',
            workspaceId: parentWorkspaceId,
            name: null,
            title,
            icon: 'file-code-line',
            isAbstract: false,
            typeIds: [],
            createdAt: created_at,
            updatedAt: updated_at,
            deletedAt: null,
            rights: AssetRights.FULL_ACCESS,
            index: null,
            creatorUserId: null,
            unread: 0,
            hasImage: false,
            parentIds: [],
            ownTitle: null,
            ownIcon: 'file-code-line',
            blocks,
            comments: [],
            references: [],
            lastViewedAt: null,
            localName: local_name,
        };
    }

    private async _loadFileItems(items: fs.Dirent[], path: string, parentWorkspaceId: string, rootPath: string): Promise<{
        assets: Map<string, FileSystemEntryWithLocalPath<ProjectFileDbAsset>>,
        workspaces: Map<string, FileSystemEntryWithLocalPath<ProjectFileDbWorkspace>>,
    }>{
        const assets = new Map<string, FileSystemEntryWithLocalPath<ProjectFileDbAsset>>();
        const workspaces = new Map<string, FileSystemEntryWithLocalPath<ProjectFileDbWorkspace>>();
        for (const item of items) {
            if (item.name.startsWith('.')){
                continue;
            }
            if (item.isFile()){
                try {
                    const loaded = await this._loadFile(
                        node_path.join(path, item.name),
                        parentWorkspaceId,
                        rootPath
                    )
                    if (loaded){
                        if (loaded.type === 'asset'){
                            assets.set(item.name, {
                                entry: loaded.asset,
                                localPath: loaded.localPath
                            })
                        }
                        else if (loaded.type === 'workspace'){
                            workspaces.set(item.name, {
                                entry: loaded.workspace,
                                localPath: loaded.localPath
                            })
                        }
                    }
                }
                catch(err) {
                    console.log('failed to read', item.name, err);
                }
            }
        }
        return {
            assets,
            workspaces
        }
    }

    async loadFolderAsWorkspace(absolutePath: string, parentWorkspaceId: string | null, rootPath: string): Promise<{
        workspace: ProjectFileDbWorkspace,
        localPath: string,
        content: FileSystemWorkspaceContent
    }>{
        return this._loadFolderAsWorkspaceImpl(absolutePath, parentWorkspaceId, async () => {
            const abs_path = absolutePath + WORKSPACE_EXT;
            const file = await this._loadFile(abs_path, parentWorkspaceId, rootPath);
            if (file?.type ==='workspace'){
                return file.workspace
            }
            return null;
        }, rootPath)        
    }

    /**
     * Load the new-format meta file (`folder/.imw`). Returns null when absent.
     * Title rule (same as `prepareEntityTitle`): a title stored in `.imw` is
     * used verbatim; the folder basename — copy suffix ` - N` included — is
     * only the fallback when the meta carries no title.
     */
    private async _loadWorkspaceInsideMeta(absoluteFolderPath: string, parentWorkspaceId: string | null, root_path: string): Promise<ProjectFileDbWorkspace | null> {
        const meta_path = node_path.join(absoluteFolderPath, WORKSPACE_META_FILENAME);
        let file: string;
        try {
            file = await fs.promises.readFile(meta_path, { encoding: 'utf8' });
        }
        catch (err: any){
            if (err.code === 'ENOENT'){
                return null;
            }
            throw err;
        }
        const file_info = await fs.promises.stat(meta_path);
        const title = node_path.basename(absoluteFolderPath);
        let workspace_info: (ProjectFileDbWorkspace & { idClaimedAt?: unknown }) | null;
        try {
            workspace_info = JSON.parse(file) as ProjectFileDbWorkspace & { idClaimedAt?: unknown };
        }
        catch {
            // Unreadable `.imw` (e.g. unresolved merge conflict) — fall back to
            // legacy meta / folder synthesis instead of failing the whole load
            return null;
        }
        workspace_info.idClaimedAt = typeof workspace_info.idClaimedAt === 'number' ? workspace_info.idClaimedAt : null;
        // Titles are shown as stored: a title inside `.imw` wins verbatim; the
        // folder basename (copy suffix ` - N` kept) is only the fallback when
        // the meta carries none — same rule as prepareEntityTitle.
        if (!workspace_info.title) {
            workspace_info.title = title;
        }
        workspace_info.localName = title
        workspace_info.parentId = parentWorkspaceId;
        workspace_info.createdAt = file_info.birthtime.toISOString();
        workspace_info.updatedAt = file_info.mtime.toISOString();
        workspace_info.projectId = this.db.info.id ?? '';
        workspace_info.rights = AssetRights.FULL_ACCESS;
        if(workspace_info.name === 'gdd') {
            workspace_info.name = null; // gdd is reserved workspace name
        }
        return workspace_info;
    }
    

    async _loadFolderAsWorkspaceImpl(absolutePath: string, parentWorkspaceId: string | null, getWorkspaceMeta: () => Promise<ProjectFileDbWorkspace | null>, root_path: string): Promise<{
        workspace: ProjectFileDbWorkspace,
        localPath: string,
        content: FileSystemWorkspaceContent
    }>{
        const local_path = node_path.relative(root_path, absolutePath)
        // New format first (meta inside the folder), legacy sibling meta as fallback
        let workspace = await this._loadWorkspaceInsideMeta(absolutePath, parentWorkspaceId, root_path);
        let source: 'folder' | 'legacy' | 'synthesized' = workspace ? 'folder' : 'legacy';
        if(!workspace){
            workspace = await getWorkspaceMeta();
            if (workspace) source = 'legacy';
        }
        if(!workspace){
            source = 'synthesized';
            const file_info = await fs.promises.stat(absolutePath);
            const created_at = file_info.birthtime.toISOString();
            const updated_at = file_info.mtime.toISOString();
            const title = node_path.basename(absolutePath);
            workspace = {
                id: absolutePathToUuid(absolutePath, root_path),
                title: title,
                name: null,
                parentId: parentWorkspaceId,
                projectId: this.db.project.db.info.id ?? '',
                createdAt: created_at,
                updatedAt: updated_at,
                rights: AssetRights.FULL_ACCESS,
                index: null,
                props: {},
                localName: title,
            }
        }
        if (source !== 'legacy') {
            // Legacy metas were already resolved/claimed when read as files;
            // folder metas and synthesized folders resolve here — before the
            // content walk, so children attribute to the final id.
            const resolution = this._wsClaimResolution?.get(absolutePath);
            if (resolution?.action === 'reid') workspace.id = resolution.newId;
            workspace.id = await this._claimWorkspaceEntry(workspace.id, absolutePath, absolutePath, root_path, source);
        }
        const content = await this.loadWorkspaceContentFromPath(
            absolutePath,
            workspace.id,
            root_path
        )
        return {
            workspace, 
            localPath: local_path,
            content
        }
    }

    async loadWorkspaceContentFromPath(absolutePath: string, parentWorkspaceId: string, root_path: string): Promise<FileSystemWorkspaceContent>{
        const items = await fs.promises.readdir(absolutePath, {
            withFileTypes: true,
        });
        const { assets, workspaces } = await this._loadFileItems(items, absolutePath, parentWorkspaceId, root_path);
        const res_assets = [...assets.values()]
        const res_workspaces = [...workspaces.values()]
        for (const item of items) {
            if (item.isDirectory()) {
                if (root_path === absolutePath && (item.name.startsWith('.') || item.name === 'attachments')){
                    continue; // Ignore service folders
                }

                const local_path = node_path.relative(root_path, node_path.join(absolutePath, item.name))
                const local_name = item.name + WORKSPACE_EXT
                const folder = node_path.join(absolutePath, item.name);
                const exist_workspace = workspaces.get(local_name) ?? null
                const loaded_workspace = await this._loadFolderAsWorkspaceImpl(
                    folder,
                    parentWorkspaceId,
                    async () => exist_workspace?.entry ?? null,
                    root_path
                );
                if (!exist_workspace){
                    res_workspaces.push({
                        entry: loaded_workspace.workspace,
                        localPath: local_path
                    });
                }
                res_assets.push(...loaded_workspace.content.assets);
                res_workspaces.push(...loaded_workspace.content.workspaces);
            }
        }
        return {
            assets: res_assets,
            workspaces: res_workspaces,
        }
    }

    async loadAssetFromFile(absolutePath: string, parentWorkspaceId: string | null, rootPath: string): Promise<ProjectFileDbAsset | null> {
        const loaded = await this._loadFile(absolutePath, parentWorkspaceId, rootPath);
        return loaded && loaded.type === 'asset' ? loaded.asset : null;
    }

    // ─── Id claim resolution (see meta/devdocs/desktop-id-claim.md) ───────────

    private _relPortablePath(absolute_path: string): string {
        return node_path.relative(this.db.localPath, absolute_path).split(/[\\/]/).join('/');
    }

    /**
     * Session-scoped workspace id claim. A re-claimed id (system id stolen by a
     * file, duplicated meta whose load-time write-back previously failed, or a
     * copy arriving at runtime) is replaced — the incoming artifact always
     * loses to the already-established owner. The new id is written back so it
     * is stable across loads.
     */
    private async _claimWorkspaceEntry(
        id: string,
        key_path: string,
        candidate_base: string,
        root_path: string,
        kind: 'legacy' | 'folder' | 'synthesized',
    ): Promise<string> {
        if (!id) return id;
        if (!this._claimedWorkspaceIds.has(id)) {
            this._claimedWorkspaceIds.add(id);
            this._claimedWorkspacePaths.set(id, key_path);
            return id;
        }
        if (this._claimedWorkspacePaths.get(id) === key_path) {
            return id; // the same artifact re-processed (repeated watcher events)
        }
        const new_id = await this._assignNewId('workspace', candidate_base, root_path);
        log.warn('id-claim: duplicate workspace id replaced', { from: id, to: new_id, key: key_path });
        this._claimedWorkspaceIds.add(new_id);
        this._claimedWorkspacePaths.set(new_id, key_path);
        const stamp = Date.now();
        try {
            if (kind === 'legacy') {
                await this._rewriteWorkspaceMetaAt(key_path, new_id, stamp);
            }
            else if (kind === 'folder') {
                await this._rewriteWorkspaceMetaAt(node_path.join(key_path, WORKSPACE_META_FILENAME), new_id, stamp);
            }
            // synthesized: no meta file yet — the id persists on first save
            await this._registryMarkResolved(new_id, stamp, this._relPortablePath(key_path));
        }
        catch (err: any) {
            log.error('id-claim: write-back failed', key_path, err.message);
        }
        return new_id;
    }

    /**
     * Session-scoped asset id claim. At load time the portable chain decides
     * (compareClaimInfo); at runtime the already-loaded claimant always wins.
     * Displacing an earlier claimant only rewrites its file — references to
     * the id intentionally follow the surviving identity.
     */
    private async _claimAssetEntry(asset: ProjectFileDbAsset, absolute_path: string, root_path: string): Promise<void> {
        const id = asset.id;
        if (!id) return;
        const rel_path = this._relPortablePath(absolute_path);
        if (!this._claimedAssetIds.has(id)) {
            this._claimedAssetIds.add(id);
            this._assetClaimants.set(id, { absPath: absolute_path, relPath: rel_path, claimedAt: asset.idClaimedAt ?? null, asset });
            return;
        }
        const existing = this._assetClaimants.get(id);
        if (existing && existing.absPath === absolute_path) {
            return; // the same file re-processed
        }
        if (!existing || !this._loadingPhase) {
            // Id owned by a system/tx-noted entity, or a runtime copy — incoming loses
            await this._reidAssetEntry(asset, absolute_path);
            return;
        }
        const current: ClaimInfo = { claimedAt: asset.idClaimedAt ?? null, relPath: rel_path };
        if (compareClaimInfo(current, existing) < 0) {
            // Current file wins the chain: the earlier claimant takes a new id
            const new_id = await this._assignNewId('asset', existing.absPath, root_path);
            log.info('id-claim: earlier asset claimant displaced', { from: id, to: new_id, path: existing.absPath });
            const stamp = Date.now();
            existing.asset.id = new_id;
            existing.asset.idClaimedAt = stamp;
            try {
                await this._rewriteAssetFile(existing.absPath, new_id, stamp, existing.asset.workspaceId);
                await this._registryMarkResolved(new_id, stamp, existing.relPath);
            }
            catch (err: any) {
                log.error('id-claim: write-back failed', existing.absPath, err.message);
            }
            this._claimedAssetIds.add(new_id);
            this._assetClaimants.set(new_id, { absPath: existing.absPath, relPath: existing.relPath, claimedAt: stamp, asset: existing.asset });
            this._assetClaimants.set(id, { absPath: absolute_path, relPath: rel_path, claimedAt: current.claimedAt, asset });
        }
        else {
            await this._reidAssetEntry(asset, absolute_path);
        }
    }

    private async _reidAssetEntry(asset: ProjectFileDbAsset, absolute_path: string): Promise<void> {
        const root_path = this.db.localPath;
        const new_id = await this._assignNewId('asset', absolute_path, root_path);
        const stamp = Date.now();
        log.warn('id-claim: duplicate asset id replaced', { from: asset.id, to: new_id, path: absolute_path });
        asset.id = new_id;
        asset.idClaimedAt = stamp;
        try {
            await this._rewriteAssetFile(absolute_path, new_id, stamp, asset.workspaceId);
            await this._registryMarkResolved(new_id, stamp, this._relPortablePath(absolute_path));
        }
        catch (err: any) {
            log.error('id-claim: write-back failed', absolute_path, err.message);
        }
        this._claimedAssetIds.add(new_id);
        this._assetClaimants.set(new_id, {
            absPath: absolute_path,
            relPath: this._relPortablePath(absolute_path),
            claimedAt: stamp,
            asset,
        });
    }

    /**
     * Deterministic path-derived id when free, random uuid fallback otherwise
     * (a path-derived id can itself be taken after moves/copies of previously
     * generated ids). The random branch is machine-local — it converges across
     * machines through the write-back.
     */
    private async _assignNewId(kind: 'workspace' | 'asset', base_abs_path: string, root_path: string): Promise<string> {
        const claimed = kind === 'workspace' ? this._claimedWorkspaceIds : this._claimedAssetIds;
        const candidate = absolutePathToUuid(base_abs_path, root_path);
        if (!claimed.has(candidate) && !(await this._registryHasId(candidate))) {
            claimed.add(candidate);
            return candidate;
        }
        let random_id = '';
        do {
            random_id = uuidv4();
        } while (claimed.has(random_id) || (await this._registryHasId(random_id)));
        claimed.add(random_id);
        log.warn('id-claim: path-derived id already used, generated a random id', { kind, base: base_abs_path, candidate, random: random_id });
        return random_id;
    }

    /** Raw rewrite of a workspace meta: id and/or claim stamp, format-preserving. */
    private async _rewriteWorkspaceMetaAt(file_path: string, new_id: string | null, claim_stamp: number | null): Promise<void> {
        await this.expectFsChange([file_path], async () => {
            const raw = JSON.parse(await fs.promises.readFile(file_path, 'utf8'));
            if (new_id !== null) raw.id = new_id;
            if (claim_stamp !== null) raw.idClaimedAt = claim_stamp;
            if (node_path.basename(file_path) === WORKSPACE_META_FILENAME) {
                delete raw.parentId; // new `.imw` files don't store parentId
            }
            await fs.promises.writeFile(file_path, JSON.stringify(raw, null, 1), 'utf8');
        });
    }

    /**
     * Raw rewrite of an asset file: identity under `__meta` (new format) or
     * top-level (legacy flat `.ima.json`). Files without a recognized
     * on-disk identity (plain json / markdown) are in-memory only.
     * Legacy flat files also carry a positional `workspaceId` — keep it in
     * sync so the on-disk state matches the collection.
     */
    private async _rewriteAssetFile(file_path: string, new_id: string | null, claim_stamp: number | null, workspace_id?: string | null): Promise<void> {
        await this.expectFsChange([file_path], async () => {
            const raw = JSON.parse(await fs.promises.readFile(file_path, 'utf8'));
            const has_meta_id = raw && typeof raw.__meta === 'object' && raw.__meta !== null && typeof raw.__meta.id === 'string';
            if (has_meta_id) {
                if (new_id !== null) raw.__meta.id = new_id;
                if (claim_stamp !== null) raw.__meta.idClaimedAt = claim_stamp;
            }
            else if (raw && typeof raw.id === 'string' && ASSET_EXT_TEST_REGEXP.test(node_path.basename(file_path))) {
                if (new_id !== null) raw.id = new_id;
                if (claim_stamp !== null) {
                    raw.__meta = {
                        ...(typeof raw.__meta === 'object' && raw.__meta !== null ? raw.__meta : {}),
                        idClaimedAt: claim_stamp,
                    };
                }
                if (workspace_id !== undefined && raw.workspaceId !== workspace_id) {
                    raw.workspaceId = workspace_id;
                }
            }
            else {
                return; // no recognized on-disk identity — nothing to persist
            }
            await fs.promises.writeFile(file_path, JSON.stringify(raw, null, 1), 'utf8');
        });
    }

    /**
     * Phase 1: collect every workspace claimant in the tree — legacy sibling
     * metas, in-folder `.imw` files and synthesized (meta-less) folders —
     * mirroring exactly which files/folders the loader treats as workspaces.
     */
    private async _scanWorkspaceClaims(root_path: string): Promise<WorkspaceClaimant[]> {
        const claimants: WorkspaceClaimant[] = [];
        const folders: { folderPath: string; hasImw: boolean }[] = [];
        const read_claim = (parsed: any): number | null =>
            typeof parsed?.idClaimedAt === 'number' ? parsed.idClaimedAt : null;

        const walk = async (dir: string, is_root: boolean): Promise<void> => {
            const items = await fs.promises.readdir(dir, { withFileTypes: true });
            const dir_names = new Set(items.filter(i => i.isDirectory()).map(i => i.name));
            for (const item of items) {
                if (item.isFile()) {
                    if (item.name.startsWith('.')) continue; // mirror _loadFileItems
                    if (!WORKSPACE_EXT_TEST_REGEXP.test(item.name) || !item.name.endsWith(WORKSPACE_EXT)) continue;
                    const abs = node_path.join(dir, item.name);
                    const base = item.name.substring(0, item.name.length - WORKSPACE_EXT.length);
                    const folder_path = dir_names.has(base) ? node_path.join(dir, base) : null;
                    try {
                        const parsed = JSON.parse(await fs.promises.readFile(abs, 'utf8'));
                        if (typeof parsed?.id !== 'string' || !parsed.id) continue;
                        claimants.push({
                            keyPath: abs,
                            kind: 'legacy',
                            folderPath: folder_path,
                            id: parsed.id,
                            claimedAt: read_claim(parsed),
                            parsed,
                            relPath: this._relPortablePath(abs),
                        });
                    }
                    catch { /* unreadable — the loader skips it too */ }
                }
                else if (item.isDirectory()) {
                    if (is_root && (item.name.startsWith('.') || item.name === ATTACHMENTS_FOLDER)) continue; // mirror walk
                    const folder_path = node_path.join(dir, item.name);
                    const meta_path = node_path.join(folder_path, WORKSPACE_META_FILENAME);
                    const has_imw = fs.existsSync(meta_path);
                    folders.push({ folderPath: folder_path, hasImw: has_imw });
                    if (has_imw) {
                        try {
                            const parsed = JSON.parse(await fs.promises.readFile(meta_path, 'utf8'));
                            if (typeof parsed?.id === 'string' && parsed.id) {
                                claimants.push({
                                    keyPath: folder_path,
                                    kind: 'folder',
                                    folderPath: folder_path,
                                    id: parsed.id,
                                    claimedAt: read_claim(parsed),
                                    parsed,
                                    relPath: this._relPortablePath(meta_path),
                                });
                            }
                        }
                        catch { /* unreadable `.imw` — the loader synthesizes the folder */ }
                    }
                    await walk(folder_path, false);
                }
            }
        };
        await walk(root_path, true);

        // Synthesized claimants: folders without in-folder `.imw` and without an
        // exact legacy meta pair — the loader derives their id from the path.
        const paired_folders = new Set(
            claimants.filter(c => c.kind === 'legacy' && c.folderPath).map(c => c.folderPath as string),
        );
        for (const folder of folders) {
            if (folder.hasImw || paired_folders.has(folder.folderPath)) continue;
            claimants.push({
                keyPath: folder.folderPath,
                kind: 'synthesized',
                folderPath: folder.folderPath,
                id: absolutePathToUuid(folder.folderPath, root_path),
                claimedAt: null,
                parsed: null,
                relPath: this._relPortablePath(folder.folderPath),
            });
        }
        return claimants;
    }

    /** Persist resolution outcomes into the meta files (loser re-id write-back). */
    private async _writeClaimResolutions(claimants: WorkspaceClaimant[], resolutions: Map<string, ClaimResolution>): Promise<void> {
        if (resolutions.size === 0) return;
        const by_key = new Map(claimants.map(c => [c.keyPath, c]));
        for (const [key, resolution] of resolutions) {
            const claimant = by_key.get(key);
            if (!claimant) continue;
            if (resolution.action === 'drop') {
                log.info('id-claim: conflicting folderless meta dropped from identity', key, claimant.id);
                continue;
            }
            const stamp = Date.now();
            log.info('id-claim: duplicate workspace id replaced', { key, from: claimant.id, to: resolution.newId });
            if (!claimant.parsed) continue; // synthesized — the id persists on first save
            try {
                const file_path = claimant.kind === 'legacy'
                    ? claimant.keyPath
                    : node_path.join(claimant.folderPath as string, WORKSPACE_META_FILENAME);
                await this.expectFsChange([file_path], async () => {
                    claimant.parsed!.id = resolution.newId;
                    claimant.parsed!.idClaimedAt = stamp;
                    if (claimant.kind !== 'legacy') {
                        delete claimant.parsed!.parentId; // new `.imw` files don't store parentId
                    }
                    await fs.promises.writeFile(file_path, JSON.stringify(claimant.parsed, null, 1), 'utf8');
                });
                await this._registryMarkResolved(resolution.newId, stamp, this._relPortablePath(file_path));
            }
            catch (err: any) {
                log.error('id-claim: write-back failed', key, err.message);
            }
        }
    }

    /**
     * Path-based invariant sweep for a folder that just resolved its
     * workspace: every asset file under it must resolve, in the collection,
     * to the folder's final workspace id. Rows inserted before the folder was
     * known (file events batched ahead of the folder event) or surviving an
     * id swap are re-attached explicitly per file — instead of relying on the
     * exist-lookup miss — via the standard load+claim path, so replace-by-id
     * heals stale rows and ids stay stable.
     */
    private async _sweepFolderAssetFiles(
        tx: ProjectFileDbTransaction,
        folder_abs_path: string,
        workspace_id: string,
        root_path: string,
    ): Promise<void> {
        const walk = async (dir: string): Promise<void> => {
            let items: fs.Dirent[];
            try {
                items = await fs.promises.readdir(dir, { withFileTypes: true });
            }
            catch {
                return; // vanished mid-copy — nothing to reconcile
            }
            for (const item of items) {
                if (item.name.startsWith('.')) continue;
                const abs = node_path.join(dir, item.name);
                if (item.isDirectory()) {
                    await walk(abs);
                    continue;
                }
                if (!ASSET_EXT_TEST_REGEXP.test(item.name)) continue;
                const local_path = node_path.relative(root_path, abs);
                const row = this.db.asset.findByLocalPath(local_path);
                if (row && row.workspaceId === workspace_id) continue;
                const entry = await this._loadFile(abs, workspace_id, root_path);
                if (entry?.type === 'asset') {
                    tx.changeAsset(row, entry.asset);
                }
            }
        };
        await walk(folder_abs_path);
    }

    // ─── Id-claim registry (`id_claims` table, machine-local) ─────────────────

    private async _registryHasId(id: string): Promise<boolean> {
        try {
            const rows: { entity_id: string }[] = await this.db.dataSource.query(
                'SELECT entity_id FROM id_claims WHERE entity_id = ?',
                [id],
            );
            return rows.length > 0;
        }
        catch {
            return false; // table absent (first run before migrations) or db not ready
        }
    }

    private async _registryMarkResolved(id: string, claimed_at: number, file_path: string | null): Promise<void> {
        try {
            const now = Date.now();
            await this.db.dataSource.query(
                `INSERT INTO id_claims (entity_id, claimed_at, first_seen_at, file_path, source, changed_at)
                 VALUES (?, ?, ?, ?, 'resolved', ?)
                 ON CONFLICT (entity_id) DO UPDATE SET
                    claimed_at = excluded.claimed_at,
                    file_path = excluded.file_path,
                    source = 'resolved',
                    changed_at = excluded.changed_at`,
                [id, claimed_at, now, file_path, now],
            );
        }
        catch { /* registry-only bookkeeping — never blocks loading */ }
    }

    /**
     * Record every loaded user entity in the id registry (first-seen wins).
     * Called right after init; rows are never deleted — an id whose file is
     * gone stays claimed, which is exactly the tombstone case the registry
     * exists for.
     */
    async registerIdClaims(): Promise<void> {
        const now = Date.now();
        const rows: (string | number | null)[][] = [];
        const rel = (absolute_path: string) => this._relPortablePath(absolute_path);
        const project_id = this.db.info.id;
        try {
            for (const workspace of this.db.workspace.workspaces.iterate()) {
                if (workspace.projectId !== project_id) continue;
                let file_path: string | null = null;
                try { file_path = rel(getWorkspaceLocalPathFolder(workspace, this.db)); } catch { file_path = null; }
                rows.push([workspace.id, workspace.idClaimedAt ?? null, now, file_path, 'file', now]);
            }
            for (const asset of this.db.asset.assets.iterate()) {
                if (asset.projectId !== project_id) continue;
                if (this.db.asset.systemAssets.byId.has(asset.id)) continue;
                let file_path: string | null = null;
                try { file_path = rel(getAssetLocalPath(asset, this.db)); } catch { file_path = null; }
                rows.push([asset.id, asset.idClaimedAt ?? null, now, file_path, 'file', now]);
            }
            const CHUNK = 80; // sqlite parameter limit headroom
            for (let i = 0; i < rows.length; i += CHUNK) {
                const chunk = rows.slice(i, i + CHUNK);
                const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
                await this.db.dataSource.query(
                    `INSERT INTO id_claims (entity_id, claimed_at, first_seen_at, file_path, source, changed_at)
                     VALUES ${placeholders} ON CONFLICT (entity_id) DO NOTHING`,
                    chunk.flat(),
                );
            }
        }
        catch (err: any) {
            log.error('id-claim: registry population failed', err.message);
        }
    }

    /**
     * Keep the session claim sets current for entities created/changed outside
     * the loaders (transactions). Path-aware: a re-appearance of the id at the
     * SAME path is the same entity; at a different path it is a copy and loses.
     */
    noteWorkspaceClaim(workspace: ProjectFileDbWorkspace): void {
        if (!workspace.id) return;
        this._claimedWorkspaceIds.add(workspace.id);
        try {
            const folder = getWorkspaceLocalPathFolder(workspace, this.db);
            const key = workspace.localName?.endsWith(WORKSPACE_EXT)
                ? folder + WORKSPACE_EXT  // legacy sibling meta keys by its file
                : folder;
            this._claimedWorkspacePaths.set(workspace.id, key);
        }
        catch { /* path unresolvable — id-only claim */ }
    }

    noteAssetClaim(asset: ProjectFileDbAsset): void {
        if (!asset.id) return;
        this._claimedAssetIds.add(asset.id);
        try {
            const abs_path = getAssetLocalPath(asset, this.db);
            this._assetClaimants.set(asset.id, {
                absPath: abs_path,
                relPath: this._relPortablePath(abs_path),
                claimedAt: asset.idClaimedAt ?? null,
                asset,
            });
        }
        catch { /* path unresolvable — id-only claim */ }
    }

    private _getWatcherIgnore(): string[]{
        return [
            '**/' + PROJECT_META_FOLDER
        ]
    }

    private _findExistentEntryByLocalPath(localPath: string): {
        type: 'asset',
        asset: ProjectFileDbAsset,
    } | {
        type: 'workspace',
        workspace: ProjectFileDbWorkspace,
    } | null {
        const has_workspace_meta_suffix = localPath.substring(localPath.length - WORKSPACE_EXT.length, localPath.length) === WORKSPACE_EXT

        const exists_asset = !has_workspace_meta_suffix ? this.db.asset.findByLocalPath(localPath) : null
        if (exists_asset){
            return {
                type: 'asset',
                asset: exists_asset
            }
        }

        let workspace_meta_local_path = has_workspace_meta_suffix ? localPath.substring(0, localPath.length - WORKSPACE_EXT.length) : localPath;
        const exists_workspace = this.db.workspace.findByLocalDirPath(workspace_meta_local_path);

        if (exists_workspace){
            return {
                type: 'workspace',
                workspace: exists_workspace
            }
        }

        return null;
    }

    private async _handlePendingFSEvents(){
        if (this._fsPendingFSInWork){
            return;
        }
        if (this._fsPendingFSEvents.length === 0){
            return;
        }
        this._fsPendingFSInWork = true;
        try {
            const events = this._fsPendingFSEvents;
            this._fsPendingFSEvents = []

            const root_path = this.db.localPath;
            const deleting_assets = new Map<string, ProjectFileDbAsset>()
            const deleting_workspaces = new Map<string, ProjectFileDbWorkspace>();

            const tx = new ProjectFileDbTransaction(this.db)
            const upsertWorkspace = async (localPath: string, workspace: ProjectFileDbWorkspace) => {
                const exist = this._findExistentEntryByLocalPath(localPath);
                deleting_workspaces.delete(workspace.id) // Workspace moved
                tx.changeWorkspace(
                    exist?.type === 'workspace' ? exist.workspace : null,
                    workspace
                )
                await tx.flush({
                    fsProcessed: true
                })
            }
            const upsertAsset = async (localPath: string, asset: ProjectFileDbAsset) => {
                const exist = this._findExistentEntryByLocalPath(localPath);
                deleting_assets.delete(asset.id) // Asset moved
                tx.changeAsset(
                    exist?.type === 'asset' ? exist.asset : null,
                    asset,
                )
            }

            for (const event of events){
                const local_path = event.path.substring(this.db.localPath.length + 1);
                if (event.type === 'create' || event.type === 'update'){
                    const parent_workspace_local_path = node_path.dirname(local_path);
                    const parent_workspace = this.db.workspace.findByLocalDirPath(parent_workspace_local_path);
                    const parent_workspace_id = parent_workspace ? parent_workspace.id : this.db.RootGddFolder.id

                    const is_dir = await isDir(event.path);
                    if (is_dir){
                        const loaded_new_dir = await this.loadFolderAsWorkspace(
                            event.path,
                            parent_workspace_id,
                            root_path
                        )
                        await upsertWorkspace(
                            loaded_new_dir.localPath,
                            loaded_new_dir.workspace
                        )
                        for (const e of loaded_new_dir.content.workspaces){
                            await upsertWorkspace(e.localPath, e.entry)
                        }
                        for (const e of loaded_new_dir.content.assets){
                            await upsertAsset(e.localPath, e.entry)
                        }
                        // Invariant sweep: descendant rows inserted before this
                        // folder was known (files batched ahead of the folder
                        // event) must not keep a stale workspace id.
                        await this._sweepFolderAssetFiles(
                            tx,
                            event.path,
                            loaded_new_dir.workspace.id,
                            root_path
                        )
                    }
                    else {
                        const new_entry = await this._loadFile(
                            event.path, 
                            parent_workspace_id,
                            root_path
                        )
                        if (new_entry?.type === 'asset') {
                            await upsertAsset(new_entry.localPath, new_entry.asset)
                        }
                        else if (new_entry?.type === 'workspace'){
                            await upsertWorkspace(new_entry.localPath, new_entry.workspace)
                        }
                    }
                }
                else {
                    const exist = this._findExistentEntryByLocalPath(local_path);
                    if (exist?.type === 'asset') deleting_assets.set(exist.asset.id, exist.asset)
                    else if (exist?.type === 'workspace') deleting_workspaces.set(exist.workspace.id, exist.workspace)
                }
            }

            // Apply delete
            for (const deleting_asset of deleting_assets.values()){
                tx.changeAsset(deleting_asset, null)
            }
            for (const deleting_workspace of deleting_workspaces.values()){
                tx.changeWorkspace(deleting_workspace, null)
            }

            await tx.commit({
                fsProcessed: true
            })
        }
        catch (err: any){
            log.error('FileSystemService: handling fs events', err.message, err.stack)
        }
        finally{
            this._fsPendingFSInWork = false;
        }
        if (this._fsPendingFSEvents.length > 0){
            this._handlePendingFSEvents() // No await;
        }
    }

    private async _resortPendingFSEvents(){
        let sorted_events: Event[] = [];
        const event_by_path = new Map<string, Event>()

        for (const event of this._fsPendingFSEvents){
            const cur = event_by_path.get(event.path)
            if (!cur || cur.type === 'update') event_by_path.set(event.path, event);
            else if (cur.type === 'delete' && event.type === 'create'){
                event_by_path.set(event.path, {
                    path: cur.path,
                    type: 'update'
                })
            } 
            else if (cur.type === 'create' && event.type === 'delete'){
                event_by_path.delete(event.path)
            }
        }

        sorted_events = [...event_by_path.values()];
        sorted_events.sort((a, b) => {
            const a_index = a.type === 'delete' ? 1 : (a.type === 'create' ? 2 : 3)
            const b_index = b.type === 'delete' ? 1 : (b.type === 'create' ? 2 : 3)
            if (a_index !== b_index){
                return a_index - b_index;
            }
            return a.path.localeCompare(b.path);
        })
        this._fsPendingFSEvents = sorted_events;
    }

    private async _initWatcher(){
        const ignoringPaths = new Set<string>([           
        ])
        this._fsWatcherSubscription = await watcher.subscribe(this.db.localPath, async (err, events) => {
            if (err){
                log.error('FS Watcher error', err.message);
                return;
            }

            let any_added = false;
            for (const event of events){
                let ignored = ignoringPaths.has(event.path) || 
                              this._fsExpectChanges.some(expect => expect.filepaths.some(f => event.path.startsWith(f)));
                if (ignored){
                    continue;
                }
                const local_path = node_path.relative(this.db.localPath, event.path);
                if (local_path === ATTACHMENTS_FOLDER || local_path === ''){
                    continue;
                }
                const segments = event.path.split(/[\/\\]/g);
                const has_hidden_segment = segments.some(s => s.startsWith('.'));
                if (has_hidden_segment){
                    continue;
                }

                this._fsPendingFSEvents.push(event)
                any_added = true;
            }
            
            if (any_added){
                this._resortPendingFSEvents();
                this._handlePendingFSEvents() // No await;
            }
        }, {
            ignore: this._getWatcherIgnore()
        });
    }

    public async expectFsChange<T>(filepaths: string[], action: () => Promise<T>): Promise<T>{
        const expectChange: FileSystemExpectChange = {
            filepaths: filepaths.map(f => node_path.normalize(f))
        }
        this._fsExpectChanges.push(expectChange);
        try {
            return await action()
        }
        finally {
            // Additional delay before cleanup, because parcel watcher has internal debounce
            setTimeout(() => {
                const ind = this._fsExpectChanges.indexOf(expectChange);
                if (ind >= 0) this._fsExpectChanges.splice(ind, 1);
            }, PARCEL_WATCHER_DELAY)
        }
    }


    async init(){


        this.db.asset.assets.clear();
        this.db.asset.systemAssets.clear();
        this.db.workspace.workspaces.clear();

        // System
        const toSystemAsset = (asset: ProjectFileDbAsset): ProjectFileDbAsset => ({
            ...asset,
            rights: 1,
            blocks: (asset.blocks ?? []).map(block => plainBlockToAssigned(block as any)),
        })
        const system_assets = (SystemBundle.assets as unknown as ProjectFileDbAsset[]).map(toSystemAsset);
        const system_workspaces = (SystemBundle.workspaces as unknown as ProjectFileDbWorkspace[]).map(workspace => {
            return {...workspace, rights: 1}
        });
        this.db.asset.systemAssets.addMany(system_assets)
        this.db.asset.assets.addMany(system_assets);
        this.db.workspace.workspaces.addMany(system_workspaces);

        // Id-claim session state (see meta/devdocs/desktop-id-claim.md)
        this._claimedWorkspaceIds = new Set<string>([...system_workspaces.map(w => w.id), this.db.RootGddFolder.id]);
        this._claimedWorkspacePaths = new Map<string, string>();
        this._claimedAssetIds = new Set<string>(system_assets.map(a => a.id));
        this._assetClaimants = new Map();
        this._wsClaimResolution = null;

        this._loadingPhase = true;
        try {
            // Phase 1: scan every workspace claimant in the tree and resolve
            // duplicate-id conflicts globally (any nesting depth) before any
            // content walk attributes children to an id.
            const claimants = await this._scanWorkspaceClaims(this.db.localPath);
            this._wsClaimResolution = await resolveWorkspaceClaims(claimants, {
                rootPath: this.db.localPath,
                isIdTaken: async (id) => this._claimedWorkspaceIds.has(id) || (await this._registryHasId(id)),
                randomId: () => uuidv4(),
            });
            await this._writeClaimResolutions(claimants, this._wsClaimResolution);

            // Phase 2: normal walk — losers take pre-assigned ids, drops are skipped
            const user_files = await this.loadWorkspaceContentFromPath(this.db.localPath, this.db.RootGddFolder.id, this.db.localPath);
            this.db.asset.assets.addMany(user_files.assets.map(asset => asset.entry));
            this.db.workspace.workspaces.add(this.db.RootGddFolder)
            this.db.workspace.workspaces.addMany(user_files.workspaces.map(workspace => workspace.entry));
        }
        finally {
            this._loadingPhase = false;
            this._wsClaimResolution = null;
        }

        //  New-format assets don't store typeIds. Rebuild them
        this.db.asset.rebuildTypeStructure();
        
        this._initWatcher();
    }

    async destroy(){

        try {
            await watcher.writeSnapshot(this.db.localPath, path.join(this.db.localPath, PROJECT_META_FS_WATCHER_SNAPSHOT),{
                ignore: this._getWatcherIgnore()
            })
        }
        catch (err: any){
            log.error('Failed to write fs snapshot', err.message)
        }
        if (this._fsWatcherSubscription){
            this._fsWatcherSubscription.unsubscribe();
            this._fsWatcherSubscription = null;
        }
    }
}

function jsonValueToPropType(value: unknown): string | null {
    if (typeof value === 'string') return 'text';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'checkbox';
    return null;
}

function jsonArrayToPropType(value: unknown[]): string | null {
    let detected: string | null = null;
    for (let index = 0; index < value.length; index++) {
        const item_type = jsonValueToPropType(value[index]);
        if (index === 0) {
            detected = item_type;
        } else if (item_type !== detected) {
            return null;
        }
    }
    return detected;
}

function buildStructPropMeta(value: Record<string, unknown>): Record<string, unknown> {
    const meta: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
        const is_array = Array.isArray(item);
        const entry: Record<string, unknown> = {};
        if (is_array) {
            entry.type = jsonArrayToPropType(item as unknown[]);
            entry.multiple = true;
        } else {
            entry.type = jsonValueToPropType(item);
        }
        meta[key] = entry;
    }
    return meta;
}
