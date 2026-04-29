import type { AssetQueryWhere } from "~ims-app-base/logic/types/AssetsType";
import type { IProjectDatabaseWorkspace, ProjectContentChangeEventArg } from "~ims-app-base/logic/types/IProjectDatabase";
import type { ApiRequestList, ApiResultListWithTotal } from "~ims-app-base/logic/types/ProjectTypes";
import { compareAssetPropValues, assignPlainValueToAssetProps, convertAssetPropsToPlainObject } from "~ims-app-base/logic/types/Props";
import type { AssetPropsSelectionOrder } from "~ims-app-base/logic/types/PropsSelection";
import type { WorkspaceQueryDTOWhere, Workspace, ChangeWorkspaceRequest, WorkspaceMoveParams, WorkspaceMoveResult } from "~ims-app-base/logic/types/Workspaces";
import { type ProjectFileDb, type ProjectFileDbWorkspace } from "../ProjectFileDb";
import { ProjectFileDbCollection } from "../logic/ProjectFileDbCollection";
import fs from 'node:fs';
import { v4 as uuidv4 } from 'uuid';
import * as node_path from 'path';
import { AssetRights } from "~ims-app-base/logic/types/Rights";
import { applyImsFileLocationChange, forbiddenFilenameCharsRegexp, getIndexRangeStartAndStep, getWorkspaceLocalPathFolder, getWorkspaceLocalPathFolderById, prepareFileBasenameByEntityTitle } from "../utils/files";
import { generateNextUniqueNameNumber } from "~ims-app-base/logic/utils/stringUtils";
import JSZip from "jszip";
import { once } from "node:events";
import { PassThrough, type Writable } from "node:stream";
import { shell, ipcMain } from 'electron'
import { WORKSPACE_BASE_ORDERING } from "../project-db-constants";
import { WORKSPACE_EXT } from "./FileSystemService";
import { SQLITE_NOW_STM, type WorkspaceEntity } from "./SyncService/SyncService";
import { ProjectFileDbTransaction } from "../logic/ProjectFileDbTransaction";
   
export type WorkspaceServiceChangeWorkspaceRequest = ChangeWorkspaceRequest & { localName?: string }

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
    private async _workspacesGetDb(query: ApiRequestList<WorkspaceQueryDTOWhere>): Promise<ApiResultListWithTotal<ProjectFileDbWorkspace>> {
        let workspaces = await this._searchWorkspaces( query.where ? query.where : {});
        workspaces = await this._sortWorkspaces(workspaces, query.order ?? []);
        const total = workspaces.length;
        if(query.count || query.offset){
           workspaces = workspaces.slice(query.offset ?? 0, query.count);
        }
        const res = {
            list: workspaces,
            total,
        } 
        return res;
    }
    async workspacesGet(query: ApiRequestList<WorkspaceQueryDTOWhere>): Promise<ApiResultListWithTotal<Workspace>> {
        const res = await this._workspacesGetDb(query);
        return {
            list: res.list.map((workspace) => {
                    const props = assignPlainValueToAssetProps({}, workspace.props)
                    return {
                        ...workspace,
                        unread: 0,
                        props
                    }
                }),
            total: res.total
        }
    }
    async workspacesCreate(params: WorkspaceServiceChangeWorkspaceRequest): Promise<Workspace> {
        const workspace_id = params.id ?? uuidv4();
        const workspace_props = params.props ? convertAssetPropsToPlainObject(params.props) : {}

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
            localName: params.localName
        };
        const tx = new ProjectFileDbTransaction(this.db)
        tx.changeWorkspace(null, workspace);    
        await tx.commit();

        return {
            ...workspace,
            props: params.props ? params.props : {}
        };
    }
    async workspacesChange(workspace_id: string, params: ChangeWorkspaceRequest): Promise<Workspace> {
        const workspace = this.workspaces.byId.get(workspace_id);
        if(!workspace) {
            throw new Error("Workspace doesn't exist");
        }
        const props = params.props ? convertAssetPropsToPlainObject(params.props) : {};
        const new_workspace_info: ProjectFileDbWorkspace = {
            ...workspace,
            ...params,
            props,
            id: workspace.id,
        }
        const tx = new ProjectFileDbTransaction(this.db)
        tx.changeWorkspace(workspace, new_workspace_info);    
        await tx.commit();
        
        return {
            ...new_workspace_info,
            props: assignPlainValueToAssetProps({}, new_workspace_info.props)
        };
    }


    async saveWorkspaceFileToFile(workspace: ProjectFileDbWorkspace, file_path: string){   
        await this.db.fileSystem.expectFsChange([file_path], async () => {    
            const writableStream = fs.createWriteStream(file_path);
            this.saveWorkspaceFileToStream(workspace, writableStream);
            writableStream.end();
            await once(writableStream, 'finish');
        })
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
    
    async getWorkspaceLocalPathFolder(workspace_id: string){
        return getWorkspaceLocalPathFolderById(workspace_id, this.db);
    }

    async workspacesDelete(workspace_id: string): Promise<void> {
        const workspace = this.workspaces.byId.get(workspace_id);
        if (!workspace){
            console.warn('Workspace not found');
            return;
        }
        const tx = new ProjectFileDbTransaction(this.db)
        tx.changeWorkspace(workspace, null);    
        await tx.commit();
    }
    
    async workspacesMove(params: WorkspaceMoveParams): Promise<WorkspaceMoveResult> {
        const avail_workspaces = await this._workspacesGetDb({
            where: {
                ids: params.ids,
            }
        });
        
        const tx = new ProjectFileDbTransaction(this.db)

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

            if (avail_ids.size > 0 && cur_index !== null && cur_index !== undefined) {
                for (const workspace_id of params.ids) {
                    if (avail_ids.has(workspace_id)) {
                        generated_indexes.set(workspace_id, cur_index);
                        const workspace_info = avail_workspaces.list.find(w => w.id);
                        if (!workspace_info){
                            continue;
                        }
                        const new_workspace_info = {
                            ...workspace_info,
                            index: cur_index
                        }
                        tx.changeWorkspace(workspace_info, new_workspace_info)
                        cur_index += index_step;
                    }
                }
            }
        }

        if (params.parentId !== undefined){
            for (const workspace of avail_workspaces.list){
                if (workspace.parentId !== params.parentId){
                    const new_workspace_info = {
                        ...workspace, 
                        parentId: params.parentId
                    }
                    tx.changeWorkspace(workspace, new_workspace_info)
                }
            }
        }

        await tx.commit()        
        return {
            list: avail_workspaces.list.map(w => {
                const generated_index = generated_indexes.get(w.id);
                return {
                    id: w.id,
                    parentId: params.parentId !== undefined ? params.parentId : w.parentId,
                    index: generated_index !== undefined ? generated_index : w.index
                }
            }),
            touchedWIds: tx.touchedWIds
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
                WORKSPACE_EXT
            );
            const basename = name.substring(0, name.length - WORKSPACE_EXT.length)
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