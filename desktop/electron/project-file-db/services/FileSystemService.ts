import { ProjectFileDb, type ProjectFileDbAsset, type ProjectFileDbWorkspace } from "../ProjectFileDb";
import fs from 'node:fs';
import * as node_path from 'path';
import { AssetRights } from '~ims-app-base/logic/types/Rights';
import { v4 as uuidv4 } from 'uuid';
import { absolutePathToUuid, isDir, prepareFileBasenameByEntityTitle } from "../utils/files";
import { MARKDOWN_ASSET_ID, BLOCK_NAME_META, BLOCK_ID_META, BLOCK_TYPE_META } from "~ims-app-base/logic/constants";
import SystemBundle from "../system-assets-bundle.json"
import watcher, { type AsyncSubscription, type Event } from "@parcel/watcher"
import path from "node:path";
import { PROJECT_META_FOLDER, PROJECT_META_FS_WATCHER_SNAPSHOT } from "../project-db-constants";
import log from 'electron-log/main';
import { ProjectFileDbTransaction } from "../logic/ProjectFileDbTransaction";
import { plainBlockToAssigned } from "../logic/asset-ops";
import { assignPlainValueToAssetProps, getAssetPropType } from '~ims-app-base/logic/types/Props';
   
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
export const WORKSPACE_EXT = '.imw.json'
export const WORKSPACE_EXT_TEST_REGEXP = /\.imw[ \d\(\)\[\]_]*\.json$/i

export const ATTACHMENTS_FOLDER = 'attachments'

const NEW_FORMAT_EXT_TEST_REGEXP = /(?: - \d+)?\.json$/i

function isNewFormatJsonFile(localName: string): boolean {
    return localName.endsWith('.json')
        && !ASSET_EXT_TEST_REGEXP.test(localName)
        && !WORKSPACE_EXT_TEST_REGEXP.test(localName);
}

function prepareEntityTitle(filename: string, title: string | null, ext_regexp: RegExp): string {
    const title_to_filename = title ? prepareFileBasenameByEntityTitle(title) : '';
    const filename_without_ext = filename.replace(ext_regexp, '') 
    const filename_without_index = filename_without_ext.replace(/ - \d+$/, '');  // Remove index if name was used
    if (title_to_filename === filename_without_index && title){
        return title
    }
    else {
        return filename_without_ext
    }
}


export class FileSystemService{

    private _fsWatcherSubscription: AsyncSubscription | null = null;
    private _fsExpectChanges: FileSystemExpectChange[] = []
    private _fsPendingFSEvents: Event[] = []
    private _fsPendingFSInWork = false

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
    
        const local_path = node_path.relative(this.db.localPath, absolutePath)
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
                const asset = JSON.parse(file) as ProjectFileDbAsset;
                asset.title = prepareEntityTitle(local_name, asset.title, ASSET_EXT_TEST_REGEXP)
                asset.localName = local_name
                asset.workspaceId = parentWorkspaceId;
                asset.createdAt = created_at;
                asset.updatedAt = updated_at;
                asset.projectId = this.db.info.id ?? '';
                asset.rights = AssetRights.FULL_ACCESS;
                // On-disk blocks are plain — store them in assigned (flatten) form
                asset.blocks = (asset.blocks ?? []).map(block => plainBlockToAssigned(block as any));
                return {
                    type: 'asset',
                    localPath: local_path,
                    asset
                }
            }
            else if (WORKSPACE_EXT_TEST_REGEXP.test(local_name)){
                const workspace_info = JSON.parse(file) as ProjectFileDbWorkspace;
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
                    }
                    else {
                        asset = this._loadPlainJsonAsset(parsed, local_name, local_path, parentWorkspaceId, created_at, updated_at, absolutePath, rootPath);
                    }
                    return {
                        type: 'asset',
                        localPath: local_path,
                        asset
                    };
                }
            }
        }
        else if(extname === '.md'){
            const asset_full: ProjectFileDbAsset = {
                id: absolutePathToUuid(absolutePath, rootPath),
                projectId: this.db.project.db.info.id ?? '',
                workspaceId: parentWorkspaceId,
                name: null,
                title: node_path.basename(local_name, extname),
                icon: 'markdown-fill',
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
                ownIcon: 'markdown-fill',
                blocks: [{
                    id: uuidv4(),
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
                    }),
                    computed: assignPlainValueToAssetProps({}, {
                        format: 'md',
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
                        value: file,
                    }),
                    computed: assignPlainValueToAssetProps({}, {
                        value: file,
                    }),
                    inherited: {},
                }],
                comments: [],
                references: [],
                lastViewedAt: null,
                localName: local_name,
            };
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
            if (parent && parent.typeIds.length > 0) {
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
    

    async _loadFolderAsWorkspaceImpl(absolutePath: string, parentWorkspaceId: string | null, getWorkspaceMeta: () => Promise<ProjectFileDbWorkspace | null>, root_path: string): Promise<{
        workspace: ProjectFileDbWorkspace,
        localPath: string,
        content: FileSystemWorkspaceContent
    }>{
        const local_path = node_path.relative(this.db.localPath, absolutePath) + WORKSPACE_EXT
        let workspace = await getWorkspaceMeta();
        if(!workspace){
            const file_info = await fs.promises.stat(absolutePath);
            const created_at = file_info.birthtime.toISOString();
            const updated_at = file_info.mtime.toISOString();
            const title = node_path.basename(absolutePath);
            const local_name = title + WORKSPACE_EXT;
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
                localName: local_name,
            }
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

                const local_path = node_path.relative(this.db.localPath, node_path.join(absolutePath, item.name))
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
        this.db.asset.systemAssets.addMany((SystemBundle.assets as unknown as ProjectFileDbAsset[]).map(toSystemAsset))
        this.db.asset.assets.addMany((SystemBundle.assets as unknown as ProjectFileDbAsset[]).map(toSystemAsset));
        this.db.workspace.workspaces.addMany((SystemBundle.workspaces as unknown as ProjectFileDbWorkspace[]).map(workspace => {
            return {...workspace, rights: 1}
        }));

        const user_files = await this.loadWorkspaceContentFromPath(this.db.localPath, this.db.RootGddFolder.id, this.db.localPath);
        this.db.asset.assets.addMany(user_files.assets.map(asset => asset.entry));
        this.db.workspace.workspaces.add(this.db.RootGddFolder)
        this.db.workspace.workspaces.addMany(user_files.workspaces.map(workspace => workspace.entry));

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
