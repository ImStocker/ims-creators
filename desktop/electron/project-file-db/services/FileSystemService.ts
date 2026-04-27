import { ProjectFileDb, type ProjectFileDbAsset, type ProjectFileDbWorkspace } from "../ProjectFileDb";
import fs from 'node:fs';
import * as node_path from 'path';
import { AssetRights } from '~ims-app-base/logic/types/Rights';
import { v4 as uuidv4 } from 'uuid';
import { absolutePathToUuid, isDir, isDirSync } from "../utils/files";
import { MARKDOWN_ASSET_ID, BLOCK_NAME_META } from "~ims-app-base/logic/constants";
import SystemBundle from "../system-assets-bundle.json"
import watcher, { type AsyncSubscription } from "@parcel/watcher"
import path from "node:path";
import { PROJECT_META_FOLDER, PROJECT_META_FS_WATCHER_SNAPSHOT } from "../project-db-constants";
import log from 'electron-log/main';
   
type FileSystemExpectChange = {
    filepaths: string[]
}

type FileSystemWorkspaceContent = {
    assets: ProjectFileDbAsset[],
    workspaces: ProjectFileDbWorkspace[],
}

const PARCEL_WATCHER_DELAY = 100;

export const WORKSPACE_EXT = '.imw.json'

export class FileSystemService{

    private _fsWatcherSubscription: AsyncSubscription | null = null;
    private _fsExpectChanges: FileSystemExpectChange[] = []

    constructor(public db: ProjectFileDb){

    }

    private async _loadFile(localPath: string, parentWorkspaceId: string | null, rootPath: string): Promise<{
        type: 'asset',
        asset: ProjectFileDbAsset
    } | {
        type: 'workspace',
        workspace: ProjectFileDbWorkspace
    } | null>{
    
        const local_name = node_path.basename(localPath);
        const extname = node_path.extname(local_name);
        
        if (extname !== '.json' && extname !== '.md'){
            return null
        }

        let file_info: fs.Stats;
        try {
            file_info = await fs.promises.stat(localPath);
        }
        catch (err: any){
            if (err.code === 'ENOENT'){
                return null;
            }
            throw err;
        }

        const created_at = file_info.birthtime.toISOString();
        const updated_at = file_info.mtime.toISOString();

        const file = await fs.promises.readFile(localPath, { encoding: 'utf8' });
        if (extname === '.json') {
            if (/\.ima[ \d\(\)\[\]_]*\.json$/i.test(local_name)) {
                const asset = JSON.parse(file) as ProjectFileDbAsset;
                asset.localName = local_name
                asset.workspaceId = parentWorkspaceId;
                asset.createdAt = created_at;
                asset.updatedAt = updated_at;
                return {
                    type: 'asset',
                    asset
                }
            }
            else if (/\.imw[ \d\(\)\[\]_]*\.json$/i.test(local_name)){
                const workspace_info = JSON.parse(file) as ProjectFileDbWorkspace;
                workspace_info.localName = local_name
                workspace_info.parentId = parentWorkspaceId;
                workspace_info.createdAt = created_at;
                workspace_info.updatedAt = updated_at;
                return {
                    type: 'workspace',
                    workspace: workspace_info
                };
            }
        }
        else if(extname === '.md'){
            const asset_full: ProjectFileDbAsset = {
                id: absolutePathToUuid(localPath, rootPath),
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
                    props: {
                        format: 'md',
                    },
                    computed: {
                        format: 'md',
                    },
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
                    props: {
                        value: file,
                    },
                    computed: {
                        value: file,
                    },
                    inherited: {},
                }],
                comments: [],
                references: [],
                lastViewedAt: null,
                localName: local_name,
            };
            return {
                type: 'asset',
                asset: asset_full
            };
        }
        return null;
    }

    private async _loadFileItems(items: fs.Dirent[], path: string, parentWorkspaceId: string, rootPath: string): Promise<{
        assets: Map<string, ProjectFileDbAsset>,
        workspaces: Map<string, ProjectFileDbWorkspace>,
    }>{
        const assets = new Map<string, ProjectFileDbAsset>();
        const workspaces = new Map<string, ProjectFileDbWorkspace>();
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
                            assets.set(item.name, loaded.asset)
                        }
                        else if (loaded.type === 'workspace'){
                            workspaces.set(item.name, loaded.workspace)
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

    async loadFolderAsWorkspace(path: string, parentWorkspaceId: string | null, rootPath: string): Promise<{
        workspace: ProjectFileDbWorkspace,
        content: FileSystemWorkspaceContent
    }>{
        return this._loadFolderAsWorkspaceImpl(path, parentWorkspaceId, async () => {
            const local_path = path + WORKSPACE_EXT;
            const file = await this._loadFile(local_path, parentWorkspaceId, rootPath);
            if (file?.type ==='workspace'){
                return file.workspace
            }
            return null;
        }, rootPath)        
    }
    

    async _loadFolderAsWorkspaceImpl(path: string, parentWorkspaceId: string | null, getWorkspaceMeta: () => Promise<ProjectFileDbWorkspace | null>, root_path: string): Promise<{
        workspace: ProjectFileDbWorkspace,
        content: FileSystemWorkspaceContent
    }>{
        let workspace = await getWorkspaceMeta();
        if(!workspace){
            const file_info = await fs.promises.stat(path);
            const created_at = file_info.birthtime.toISOString();
            const updated_at = file_info.mtime.toISOString();
            const title = node_path.basename(path);
            const local_name = title + WORKSPACE_EXT;
            workspace = {
                id: absolutePathToUuid(path, root_path),
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
            path,
            workspace.id,
            root_path
        )
        return {
            workspace, 
            content
        }
    }

    async loadWorkspaceContentFromPath(path: string, parentWorkspaceId: string, root_path: string): Promise<FileSystemWorkspaceContent>{
        const items = await fs.promises.readdir(path, {
            withFileTypes: true,
        });
        const { assets, workspaces } = await this._loadFileItems(items, path, parentWorkspaceId, root_path);
        const res_assets = [...assets.values()]
        const res_workspaces = [...workspaces.values()]
        for (const item of items) {
            if (item.isDirectory()) {
                if (root_path === path && (item.name.startsWith('.') || item.name === 'attachments')){
                    continue; // Ignore service folders
                }

        // if (item.name === 'Story'){
        // debugger;
        // }
                const local_name = item.name + WORKSPACE_EXT
                const folder = node_path.join(path, item.name);
                const exist_workspace = workspaces.get(local_name) ?? null
                const loaded_workspace = await this._loadFolderAsWorkspaceImpl(
                    folder,
                    parentWorkspaceId,
                    async () => exist_workspace,
                    root_path
                );
                if (!exist_workspace){
                    res_workspaces.push(loaded_workspace.workspace);
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

    private _getWatcherIgnore(): string[]{
        return [
            '**/' + PROJECT_META_FOLDER
        ]
    }

    private async _createWorkspaceWithAssets(
        loaded_new_dir: {
            workspace: ProjectFileDbWorkspace;
            content: FileSystemWorkspaceContent;
        },
        created_workspace_ids: Set<string>,
        workspaceId: string
    ){
        if(created_workspace_ids.has(workspaceId)) {
            return;
        }
        let workspace = loaded_new_dir.content.workspaces.find(w => w.id === workspaceId);
        if (!workspace) {
            if(loaded_new_dir.workspace.id === workspaceId) {
                workspace = loaded_new_dir.workspace;
            }
            else {
                return null;
            }
        }
        if(workspace.parentId && loaded_new_dir.workspace.id !== workspaceId){
            await this._createWorkspaceWithAssets(loaded_new_dir, created_workspace_ids, workspace.parentId)
        }
        await this.db.workspace.workspacesCreate(
        {
            ...workspace,
            ...(workspace.parentId ? {} : {
                parentId: loaded_new_dir.workspace.id
            }),
        },
        {
            fsProcessed: true,
        })
        for(const content_asset of loaded_new_dir.content.assets){
            if(workspaceId !== content_asset.workspaceId) {
                continue;
            }
            const asset = this.db.sync.prepareAssetToServer(content_asset);
            await this.db.asset.assetsCreate(
            {
                ...asset,
                id: content_asset.id,
            }, {
                fsProcessed: true,
            })
        }
        created_workspace_ids.add(workspace.id);
    }

    private async _createWorkspacesWithAssets(
        loaded_new_dir: {
            workspace: ProjectFileDbWorkspace;
            content: FileSystemWorkspaceContent;
        },
        created_workspace_ids: Set<string>,
    ){
        await this._createWorkspaceWithAssets(loaded_new_dir, created_workspace_ids, loaded_new_dir.workspace.id);
        for(const workspace of loaded_new_dir.content.workspaces){
            if(created_workspace_ids.has(workspace.id)) {
                continue;
            }
            if(workspace.parentId && !created_workspace_ids.has(workspace.parentId)){
                await this._createWorkspaceWithAssets(loaded_new_dir, created_workspace_ids, workspace.parentId)
            }
            await this._createWorkspaceWithAssets(loaded_new_dir, created_workspace_ids, workspace.id);
        }
    }

    private async _initWatcher(){
        this._fsWatcherSubscription = await watcher.subscribe(this.db.localPath, async (err, events) => {
            if (err){
                log.error('FS Watcher error', err.message);
                return;
            }

            const sorted_events = [...events].sort((a, b) => {
                const a_index = a.type === 'delete' ? 1 : 2
                const b_index = b.type === 'delete' ? 1 : 2
                return a_index - b_index;
            })
            // debugger;
            const root_path = this.db.localPath;
            const deleting_assets = new Map<string, ProjectFileDbAsset>()
            const deleting_workspaces = new Map<string, ProjectFileDbWorkspace>();
            for (const event of sorted_events){
                let ignored = this._fsExpectChanges.some(expect => expect.filepaths.some(f => event.path.startsWith(f)));
                if (ignored){
                    continue;
                }

                const local_path = event.path.substring(this.db.localPath.length + 1);
                if (local_path === path.join('.imsc', 'project.db-journal') || path.join('.imsc', 'project.db')){

                }

                const has_workspace_meta_suffix = /\.imw\.json$/.test(local_path);
                
                // Find exists entities
                let exists_workspace: ProjectFileDbWorkspace | null = null
                const exists_asset = !has_workspace_meta_suffix ? this.db.asset.findByLocalPath(local_path) : null;
                if (!exists_asset) {
                    let workspace_meta_local_path = has_workspace_meta_suffix ? local_path.substring(0, local_path.length - WORKSPACE_EXT.length) : local_path;
                    exists_workspace = this.db.workspace.findByLocalDirPath(workspace_meta_local_path);
                }

                // Apply changes
                if (event.type === 'delete'){
                    if (exists_asset){
                        deleting_assets.set(exists_asset.id, exists_asset);
                    }
                    else if (exists_workspace){
                        deleting_workspaces.set(exists_workspace.id, exists_workspace);
                    }
                }
                else if (event.type === 'create' || event.type === 'update'){
                    const parent_workspace_local_path = node_path.dirname(local_path);
                    const parent_workspace = this.db.workspace.findByLocalDirPath(parent_workspace_local_path);
                    if (!parent_workspace){
                        continue; // Parent workspace not found;
                    }
                    const is_dir = await isDir(event.path);
                    if (is_dir){
                        const loaded_new_dir = await this.loadFolderAsWorkspace(
                            event.path,
                            parent_workspace.id,
                            root_path
                        )
                        let created_workspace_ids = new Set<string>();
                        await this._createWorkspacesWithAssets(loaded_new_dir, created_workspace_ids);
                    }
                    else {
                        const new_entry = await this._loadFile(event.path, parent_workspace.id, root_path)
                        if (!new_entry){
                            continue;
                        }
                        if (new_entry.type === 'asset'){
                            if (deleting_assets.has(new_entry.asset.id)){
                                // Asset moved
                                deleting_assets.delete(new_entry.asset.id)
                            }
                            const asset = this.db.sync.prepareAssetToServer(new_entry.asset);
                            if (exists_asset){
                                await this.db.asset.assetsChange(
                                {
                                    where: {
                                        id: new_entry.asset.id,
                                    },
                                    set: asset,
                                }, {
                                    fsProcessed: true
                                })
                            } else {
                                await this.db.asset.assetsCreate(
                                {
                                    set: asset,
                                    id: new_entry.asset.id,
                                }, {
                                    fsProcessed: true
                                })
                            }
                        }
                        else if (new_entry.type === 'workspace'){
                            if (deleting_workspaces.has(new_entry.workspace.id)){
                                // Workspace moved
                                deleting_workspaces.delete(new_entry.workspace.id)
                            }
                            if (exists_workspace){
                                await this.db.workspace.workspacesChange(new_entry.workspace.id,
                                {
                                    ...new_entry.workspace,
                                }, {
                                    fsProcessed: true
                                })
                            } else {
                                await this.db.workspace.workspacesCreate(
                                {
                                    ...new_entry.workspace,
                                }, {
                                    fsProcessed: true
                                })
                            }
                        }
                    }

                }
                else {
                    log.error('Unexpected fs change type', event.type)
                }
            }
    
            // Apply delete
            if(deleting_assets.size > 0) {
                await this.db.asset.assetsDelete(
                    {
                        id: [...deleting_assets.keys()],
                    },
                    {
                        pid: this.db.info.id,
                        fsProcessed: true
                    }
                )
            }
            for (const deleting_workspace_id of deleting_workspaces.keys()){
                await this.db.workspace.workspacesDelete(deleting_workspace_id, {
                    fsProcessed: true
                });
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
        this.db.asset.systemAssets.addMany((SystemBundle.assets as unknown as ProjectFileDbAsset[]).map(asset => {
            return {...asset, rights: 1}
        }))
        this.db.asset.assets.addMany((SystemBundle.assets as unknown as ProjectFileDbAsset[]).map(asset => {
            return {...asset, rights: 1}
        }));
        this.db.workspace.workspaces.addMany((SystemBundle.workspaces as unknown as ProjectFileDbWorkspace[]).map(workspace => {
            return {...workspace, rights: 1}
        }));

        // User
        // await new Promise((res) => setTimeout(res, 5000))
        // debugger;
        const user_files = await this.loadWorkspaceContentFromPath(this.db.localPath, this.db.RootGddFolder.id, this.db.localPath);
        this.db.asset.assets.addMany(user_files.assets.map(asset => {
            const changed_asset: ProjectFileDbAsset = { 
                ...asset,
                projectId: this.db.info.id,
                rights: 5
            }
            if (!changed_asset.workspaceId){
                changed_asset.workspaceId = this.db.RootGddFolder.id;
            }
            return changed_asset
        }));
        this.db.workspace.workspaces.add(this.db.RootGddFolder)
        this.db.workspace.workspaces.addMany(user_files.workspaces.map(workspace => {
            const changed_workspace =  {
                ...workspace, 
                projectId: this.db.info.id,
                rights: 5
            }
            if (!changed_workspace.parentId){
                changed_workspace.parentId = this.db.RootGddFolder.id;
            }
            return changed_workspace
        }));
        
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
