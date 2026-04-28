import { ProjectFileDb, type ProjectFileDbAsset, type ProjectFileDbWorkspace } from "../ProjectFileDb";
import fs from 'node:fs';
import * as node_path from 'path';
import { AssetRights } from '~ims-app-base/logic/types/Rights';
import { v4 as uuidv4 } from 'uuid';
import { absolutePathToUuid, isDir, isDirSync } from "../utils/files";
import { MARKDOWN_ASSET_ID, BLOCK_NAME_META } from "~ims-app-base/logic/constants";
import SystemBundle from "../system-assets-bundle.json"
import watcher, { type AsyncSubscription, type Event } from "@parcel/watcher"
import path from "node:path";
import { PROJECT_META_FOLDER, PROJECT_META_FS_WATCHER_SNAPSHOT } from "../project-db-constants";
import log from 'electron-log/main';
   
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

export const WORKSPACE_EXT = '.imw.json'

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
            if (/\.ima[ \d\(\)\[\]_]*\.json$/i.test(local_name)) {
                const asset = JSON.parse(file) as ProjectFileDbAsset;
                asset.localName = local_name
                asset.workspaceId = parentWorkspaceId;
                asset.createdAt = created_at;
                asset.updatedAt = updated_at;
                return {
                    type: 'asset',
                    localPath: local_path,
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
                    localPath: local_path,
                    workspace: workspace_info
                };
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
                localPath: local_path,
                asset: asset_full
            };
        }
        return null;
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
            const upserting_assets = new Map<string, ProjectFileDbAsset>()
            const upserting_workspaces = new Map<string, ProjectFileDbWorkspace>()

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
                        upserting_workspaces.set(
                            loaded_new_dir.localPath,
                            loaded_new_dir.workspace
                        )
                        for (const e of loaded_new_dir.content.workspaces){
                            upserting_workspaces.set(e.localPath, e.entry)
                        }
                        for (const e of loaded_new_dir.content.assets){
                            upserting_assets.set(e.localPath, e.entry)
                        }
                    }
                    else {
                        const new_entry = await this._loadFile(
                            event.path, 
                            parent_workspace_id,
                            root_path
                        )
                        if (new_entry?.type === 'asset') {
                            upserting_assets.set(new_entry.localPath, new_entry.asset)
                        }
                        else if (new_entry?.type === 'workspace'){
                            upserting_workspaces.set(new_entry.localPath, new_entry.workspace)
                        }
                    }
                }
                else {
                    const exist = this._findExistentEntryByLocalPath(local_path);
                    if (exist?.type === 'asset') deleting_assets.set(exist.asset.id, exist.asset)
                    else if (exist?.type === 'workspace') deleting_workspaces.set(exist.workspace.id, exist.workspace)
                }
            }


            for (const [local_path, ups_workspace] of upserting_workspaces){
                const exist = this._findExistentEntryByLocalPath(local_path);
                deleting_workspaces.delete(ups_workspace.id) // Workspace moved
                if (exist?.type === 'workspace'){
                    await this.db.workspace.workspacesChange(
                        ups_workspace.id,
                        ups_workspace,
                        {
                            fsProcessed: true
                        }
                    )

                }
                else {
                    await this.db.workspace.workspacesCreate(
                        ups_workspace, 
                        {
                            fsProcessed: true
                        })
                }
            }

            for (const [local_path, ups_asset] of upserting_assets){
                // TODO: check parent order?
                const exist = this._findExistentEntryByLocalPath(local_path);
                const asset = this.db.sync.prepareAssetToServer(ups_asset);
                deleting_assets.delete(ups_asset.id) // Asset moved
                if (exist?.type === 'asset'){
                    await this.db.asset.assetsChange(
                    {
                        where: {
                            id: ups_asset.id,
                        },
                        set: asset,
                    }, {
                        fsProcessed: true
                    })
                } else {
                    await this.db.asset.assetsCreate(
                    {
                        set: asset,
                        id: ups_asset.id,
                        localName: ups_asset.localName
                    }, {
                        fsProcessed: true
                    })
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
        const ignoringPaths = new Set([
            path.join(this.db.localPath, '.imsc', 'project.db-journal'),
            path.join(this.db.localPath, '.imsc', 'project.db'),            
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
                ...asset.entry,
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
                ...workspace.entry, 
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
