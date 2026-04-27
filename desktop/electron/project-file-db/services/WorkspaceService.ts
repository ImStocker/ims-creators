import type { AssetQueryWhere } from "~ims-app-base/logic/types/AssetsType";
import type { IProjectDatabaseWorkspace } from "~ims-app-base/logic/types/IProjectDatabase";
import type { ApiRequestList, ApiResultListWithTotal } from "~ims-app-base/logic/types/ProjectTypes";
import { compareAssetPropValues, assignPlainValueToAssetProps, convertAssetPropsToPlainObject } from "~ims-app-base/logic/types/Props";
import type { AssetPropsSelectionOrder } from "~ims-app-base/logic/types/PropsSelection";
import type { WorkspaceQueryDTOWhere, Workspace, ChangeWorkspaceRequest, WorkspaceMoveParams, WorkspaceMoveResult } from "~ims-app-base/logic/types/Workspaces";
import { type ProjectFileDb, type ProjectFileDbWorkspace } from "../ProjectFileDb";
import { ProjectFileDbCollection } from "../ProjectFileDbCollection";
import fs from 'node:fs';
import { v4 as uuidv4 } from 'uuid';
import * as node_path from 'path';
import { AssetRights } from "~ims-app-base/logic/types/Rights";
import { applyImsFileLocationChange, forbiddenFilenameCharsRegexp, getIndexRangeStartAndStep, getWorkspaceLocalPath, getWorkspaceLocalPathById, prepareFileBasenameByEntityTitle } from "../utils/files";
import { generateNextUniqueNameNumber } from "~ims-app-base/logic/utils/stringUtils";
import JSZip from "jszip";
import { once } from "node:events";
import { PassThrough, type Writable } from "node:stream";
import { shell, ipcMain } from 'electron'
import { WORKSPACE_BASE_ORDERING } from "../project-db-constants";
import { WORKSPACE_EXT } from "./FileSystemService";
import { SQLITE_NOW_STM, type WorkspaceEntity } from "./SyncService/SyncService";
   
export class WorkspaceService implements IProjectDatabaseWorkspace{

    workspaces = new ProjectFileDbCollection<ProjectFileDbWorkspace>();
    
    constructor(public db: ProjectFileDb){

    }
    
    getWorkspaceById(id: string): ProjectFileDbWorkspace | null {
        return this.workspaces.byId.get(id) ?? null;
    }
    getWorkspaceParentsById(id: string):Map<string, ProjectFileDbWorkspace> {
        const workspaces_map = new Map<string, ProjectFileDbWorkspace>();
        const workspace = this.getWorkspaceById(id);
        if(workspace){
            workspaces_map.set(workspace.id, workspace);
            if(workspace.parentId){
                const parents = this.getWorkspaceParentsById(workspace.parentId);
                parents.forEach((val) => workspaces_map.set(val.id, val))
            }
        }
        return workspaces_map;
    }

    public async loadAssetWorkspacesTree(workspaceIds: string[]): Promise<Map<string, ProjectFileDbWorkspace>>{
        const workspaces_map = new Map<string, ProjectFileDbWorkspace>();
        for(const workspace_id of workspaceIds){
            if(workspace_id){
                const workspace = this.getWorkspaceParentsById(workspace_id);
                workspace.forEach((val) => workspaces_map.set(val.id, val))
            }
        }
        return workspaces_map;
    }


    private async _searchWorkspaces(where: WorkspaceQueryDTOWhere): Promise<ProjectFileDbWorkspace[]>{
        if (Object.keys(where).length === 0){
            return [...this.workspaces.iterate()]
        }

        const result = [];
        let available_workspace_map = new Map();
        if(where.hasAssets){
            const passed_assets = await this.db.asset.searchAssets(typeof where.hasAssets === 'object' ? where.hasAssets as AssetQueryWhere : {});
            available_workspace_map = await this.loadAssetWorkspacesTree(passed_assets.map(item => (item as any).workspaceId));
        }
        for(const workspace of this.workspaces.iterate()){
            let is_passed = true;
            if(where.parentId !== undefined){
                if(workspace.parentId !== where.parentId) {
                    is_passed = false;
                }
            }
            if (is_passed && where.ids) {
                if (Array.isArray(where.ids)){
                    if (!where.ids.includes(workspace.id)) {
                        is_passed = false;
                    }
                }
                else {
                    if (where.ids !== workspace.id) {
                        is_passed = false;
                    }
                }
            }
            if(is_passed && where.isSystem !== undefined){
                if(where.isSystem) {
                    is_passed = workspace.projectId !== this.db.info.id;
                }
                else {
                    is_passed = workspace.projectId === this.db.info.id;
                }
            }
            if(is_passed && where.hasAssets !== undefined){
                if (where.hasAssets) {
                    is_passed = available_workspace_map.has(workspace.id);
                }
                else {
                    is_passed = !available_workspace_map.has(workspace.id);
                }
            }
            if (is_passed && where.names){
                is_passed = workspace.name ? where.names.includes(workspace.name) : false;
            }
            if(is_passed) {
                result.push(workspace);
            }
        }
        return result;
    }
    
    private async _sortWorkspaces(workspaces: ProjectFileDbWorkspace[], order: AssetPropsSelectionOrder[]): Promise<ProjectFileDbWorkspace[]>{
        const order_items = order && order.length > 0 ? order : WORKSPACE_BASE_ORDERING;
        return workspaces.sort((a,b) => {
            for(const order_item of order_items){
                let order_field: string;
                let order_desc = false;
                if(typeof order_item === 'object'){
                    order_field = order_item.prop;
                    order_desc = order_item.desc ?? false;
                }
                else {
                    order_field = order_item;
                }
                const a_val = this.db.asset.getAssetField(a as any, order_field);
                const b_val = this.db.asset.getAssetField(b as any, order_field);
                const res = compareAssetPropValues(a_val, b_val);
                if(res !== 0){
                    return order_desc ? res : -res;
                }
            }
            return 0;
        });
    }
    async workspacesGet(query: ApiRequestList<WorkspaceQueryDTOWhere>): Promise<ApiResultListWithTotal<Workspace>> {
        let workspaces = await this._searchWorkspaces( query.where ? query.where : {});
        workspaces = await this._sortWorkspaces(workspaces, query.order ?? []);
        const total = workspaces.length;
        if(query.count || query.offset){
           workspaces = workspaces.slice(query.offset ?? 0, query.count);
        }
        const res = {
            list: workspaces.map((workspace) => {
                    const props = assignPlainValueToAssetProps({}, workspace.props)
                    return {
                        ...workspace,
                        unread: 0,
                        props: props
                    }
                }),
            total,
        } 
        return res;
    }
    async workspacesCreate(params: ChangeWorkspaceRequest, options?: {fsProcessed?: true}): Promise<Workspace> {
        const workspace_id = params.id ?? uuidv4();
        const workspace_props = assignPlainValueToAssetProps({}, params.props ?? {})
        const workspace_file_basename = params.title ? params.title : workspace_id;
        let parent_workspace_path = this.db.localPath;
        if(params.parentId) {
            parent_workspace_path = getWorkspaceLocalPathById(params.parentId, this.db)
        }
        const suggest_title = generateNextUniqueNameNumber(
            (workspace_file_basename ?? 'untitled').replace(forbiddenFilenameCharsRegexp, '_').trim(),
            (name) => !fs.existsSync(node_path.join(parent_workspace_path, name + '')),
        );
        const suggest_title_with_ext = suggest_title + '.imw.json'
        const workspace_local_path_meta = node_path.join(parent_workspace_path, suggest_title_with_ext);
        const workspace: ProjectFileDbWorkspace = {
            id: workspace_id,
            title: params.title ?? '',
            name: params.name ?? null,
            parentId: params.parentId ?? null,
            projectId: this.db.project.db.info.id ?? '',
            createdAt: (new Date()).toISOString(),
            updatedAt: (new Date()).toISOString(),
            rights: AssetRights.FULL_ACCESS,
            index: params.index ?? null,
            props: workspace_props,
            localName: suggest_title_with_ext,
        };
        this.workspaces.add(workspace);
        if(!options?.fsProcessed){
            const workspace_local_path_folder = workspace_local_path_meta.replace(/\.imw\.json$/, '');
            await this.db.fileSystem.expectFsChange([
                workspace_local_path_meta,
                workspace_local_path_folder
            ], async () => {
                await fs.promises.writeFile(workspace_local_path_meta, JSON.stringify(workspace, null, 1));
                await fs.promises.mkdir(workspace_local_path_folder);
            })
        }
        await this.markNotSyncedWorkspace(workspace_id);
        
        this.db.sendProjectChange({
            aUpsIds: [],
            aDelIds: [],
            wUpsIds: [workspace_id],
            wDelIds: [],
            wTchIds: workspace.parentId ? [workspace.parentId] : [],
            instigator: null
        });
        return workspace;
    }
    private async markNotSyncedWorkspace(id: string){
        await this.db.dataSource.createQueryRunner().query(`
            INSERT INTO workspaces (id, need_sync)
            VALUES (?,${SQLITE_NOW_STM}) ON CONFLICT (id) DO UPDATE SET need_sync = ${SQLITE_NOW_STM};
        `, [id]);
    }
    async workspacesChange(workspace_id: string, params: ChangeWorkspaceRequest, options?: {fsProcessed?: true}): Promise<Workspace> {
        const workspace = this.workspaces.byId.get(workspace_id);
        if(!workspace) {
            throw new Error("Workspace doesn't exist");
        }
        const props = params.props ? assignPlainValueToAssetProps({}, params.props) : {};
        const new_workspace_info: ProjectFileDbWorkspace = {
            ...workspace,
            ...params,
            props,
            id: workspace.id,
        }
        
        if(!options?.fsProcessed){
            const old_path = getWorkspaceLocalPath(workspace, this.db);
            let local_path = old_path;
            if(params.parentId !== undefined || params.title !== undefined) {
                local_path = await applyImsFileLocationChange(new_workspace_info, old_path, this.db);
                new_workspace_info.localName = node_path.basename(local_path);
            }
            // сохраняю информацию о файле
            await fs.promises.writeFile(local_path, JSON.stringify(new_workspace_info, null, 1));
        }
        this.workspaces.replace(new_workspace_info);
        await this.markNotSyncedWorkspace(workspace_id);
               
        const wTchIds = [];
        if(workspace.parentId !== new_workspace_info.parentId){
            if(workspace.parentId){
              wTchIds.push(workspace.parentId)  
            }
            if(new_workspace_info.parentId){
              wTchIds.push(new_workspace_info.parentId)  
            }
        }
        this.db.sendProjectChange({
            aUpsIds: [],
            aDelIds: [],
            wUpsIds: [workspace.id],
            wDelIds: [],
            wTchIds,
            instigator: null
        });

        return new_workspace_info;
    }

    async saveWorkspaceFileToFile(workspace: ProjectFileDbWorkspace, file_path: string){      
        const writableStream = fs.createWriteStream(file_path);
        this.saveWorkspaceFileToStream(workspace, writableStream);
        writableStream.end();
        await once(writableStream, 'finish');
    }

    saveWorkspaceFileToStream(workspace: ProjectFileDbWorkspace, stream: Writable){
        stream.write(JSON.stringify({
            ...workspace,
            localPath: undefined,
            rights: undefined
        }, null, 1))
    }

    getNestedWorkspaces(workspace_id: string): ProjectFileDbWorkspace[] {
        let workspaces = this.workspaces.iterate().filter(w => w.parentId === workspace_id);
        let res = [...workspaces];
        for (const workspace of workspaces){
            res = [
                ...res,
                ...this.getNestedWorkspaces(workspace.id)
            ]
        }
        return res;
    }
    
    async getWorkspaceLocalPath(workspace_id: string){
        return getWorkspaceLocalPathById(workspace_id, this.db);
    }

    private async _deleteWorkspaceFileFromFilesystem(workspace: ProjectFileDbWorkspace){
        if (!workspace.localName) return;

        const local_path_folder = getWorkspaceLocalPath(workspace, this.db)
        const local_path_meta = local_path_folder + ".imw.json";

        await this.db.fileSystem.expectFsChange([
            local_path_folder, local_path_meta
        ], async () => {
            // 1. Delete meta file
            try {
                await shell.trashItem(local_path_meta);
            }
            catch (err: any){
                // Ignore error
            }
            
            // 2. Delete entire folder
            try {
                await shell.trashItem(local_path_folder);
            }
            catch (err: any){
                // Ignore error
            }
        })
    }

    async workspacesDelete(workspace_id: string, options?: {fsProcessed?: true}): Promise<void> {
        const workspace = this.workspaces.byId.get(workspace_id);
        if (!workspace){
            console.warn('Workspace not found');
            return;
        }
        const nested_workspaces = this.getNestedWorkspaces(workspace_id);
        const nested_assets = await this.db.asset.searchAssets({
            workspaceids: workspace_id
        })
        if(workspace.localName && !options?.fsProcessed) {
            await this._deleteWorkspaceFileFromFilesystem(workspace);
        }
        this.workspaces.delete(workspace_id);
        for (const nested_workspace of nested_workspaces){
            this.workspaces.delete(nested_workspace.id)
        }
        for (const nested_asset of nested_assets){
            this.db.asset.deleteOwnAssetFromCollectionOnly(nested_asset.id);
        }
        await this.markNotSyncedWorkspace(workspace_id);
                       
        this.db.sendProjectChange({
            aUpsIds: [],
            aDelIds: [workspace.id],
            wUpsIds: [],
            wDelIds: [],
            wTchIds: workspace.parentId ? [workspace.parentId] : [],
            instigator: null
        });
    }
    
    async workspacesMove(params: WorkspaceMoveParams): Promise<WorkspaceMoveResult> {
        const avail_workspaces = await this.workspacesGet({
            where: {
                ids: params.ids,
            }
        });
        const touchedWIds: string[] = [];

        const generated_indexes = new Map<string, number>();
        if (params.indexFrom !== undefined || params.indexTo !== undefined){
            const avail_ids = new Set(avail_workspaces.list.map((w) => w.id));
            
            let cur_index: number | null | undefined = undefined;
            let index_step: number = 0;
            if (params.indexFrom !== undefined || params.indexTo !== undefined){
                if (params.indexFrom === null){
                cur_index = null
                }
                else if (params.indexTo === null){
                cur_index = params.indexFrom;
                }
                else {
                const start_and_step = getIndexRangeStartAndStep(
                    params.indexFrom, params.indexTo, avail_ids.size
                )
                cur_index = start_and_step.start;
                index_step = start_and_step.step;
                }
            }

            const affected_ids: string[] = [];
            if (avail_ids.size > 0 && cur_index !== null && cur_index !== undefined) {
                for (const workspace_id of params.ids) {
                    if (avail_ids.has(workspace_id)) {
                        generated_indexes.set(workspace_id, cur_index);
                        const workspace_info = avail_workspaces.list.find(w => w.id);
                        if(workspace_info && workspace_info.localName){
                            workspace_info.index = cur_index;
                            await fs.promises.writeFile(workspace_info.localName, JSON.stringify(workspace_info, null, 1));
                            this.workspaces.replace(workspace_info);
                        }
                        cur_index += index_step;
                        affected_ids.push(workspace_id);
                    }
                }
            }
        }

        if (params.parentId !== undefined){
            if (params.parentId){
                touchedWIds.push(params.parentId)
            }
            for (const workspace of avail_workspaces.list){
                if (workspace.parentId !== params.parentId){
                    if (workspace.parentId){
                        touchedWIds.push(workspace.parentId)
                    }
                    const new_workspace_info = {...workspace, parentId: params.parentId}
                    const old_path = getWorkspaceLocalPath(workspace, this.db);
                    const local_path = await applyImsFileLocationChange(new_workspace_info, old_path, this.db);
                    new_workspace_info.localName = node_path.basename(local_path);
                    await fs.promises.writeFile(local_path, JSON.stringify(new_workspace_info, null, 1));
                    this.workspaces.replace(new_workspace_info);
                }
            }
        }

                
        this.db.sendProjectChange({
            aUpsIds: [],
            aDelIds: [],
            wUpsIds: params.ids,
            wDelIds: [],
            wTchIds: [...new Set(touchedWIds)],
            instigator: null
        });

        return {
            list: avail_workspaces.list.map(w => {
                const generated_index = generated_indexes.get(w.id);
                return {
                    id: w.id,
                    parentId: params.parentId !== undefined ? params.parentId : w.parentId,
                    index: generated_index !== undefined ? generated_index : w.index
                }
            }),
            touchedWIds: [...new Set(touchedWIds)]
        };  
    }

    private async _exportToZip(workspaceId: string, targetZip: JSZip, subfolder = ''){
        const assets = await this.db.asset.getAssetFulls({
            where: {
                workspaceId: workspaceId
            }
        })
        const used_names = new Set<string>();
        for (const asset of assets.list){
            const name = this.db.asset.getAssetFileSavingFilename(asset, (val) => !used_names.has(val))
            used_names.add(name);
            const writeStream = new PassThrough();
            targetZip.file((subfolder ? subfolder + "/" : '') + name, writeStream);
            this.db.asset.saveAssetFileToStream(asset, writeStream);
            writeStream.end();
        }
        const workspaces = await this._searchWorkspaces({
            parentId: workspaceId
        })
        for (const workspace of workspaces){
            const name = generateNextUniqueNameNumber(
                prepareFileBasenameByEntityTitle(workspace.title ?? 'untitled'),
                (val) => !used_names.has(val),
                ' - ',
                 '.imw.json'
            );
            const basename = name.substring(0, name.length - '.imw.json'.length)
            used_names.add(name);
            const writeStream = new PassThrough();
            targetZip.file((subfolder ? subfolder + "/" : '') + name, writeStream);
            this.saveWorkspaceFileToStream(workspace, writeStream);
            writeStream.end();
            await this._exportToZip(workspace.id, targetZip, (subfolder ? subfolder + "/" : '') + basename)
        }
    }

    async exportToFile(workspaceId: string, targetPath: string){
        const zip = new JSZip();
        await this._exportToZip(workspaceId, zip)
        
        const zip_stream = zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
            .pipe(fs.createWriteStream(targetPath));
        await once(zip_stream, 'finish');
    }
    
    findByLocalDirPath(localDirPath: string): ProjectFileDbWorkspace | null {
        if (!localDirPath || localDirPath === '.') return this.db.RootGddFolder;
        const segments = localDirPath.split(/\\\//);
        let current_workspace = this.db.RootGddFolder;
        for (const segment of segments){
            const next = this.workspaces.iterate().find(x => x.localName === segment + WORKSPACE_EXT && x.parentId === current_workspace.id);
            if (!next) return null;
            current_workspace = next;
        }
        return current_workspace;
    }
}