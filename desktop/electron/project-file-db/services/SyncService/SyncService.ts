import { HttpMethods, Service } from "~ims-app-base/logic/managers/ApiWorker";
import type { AssetsFullResult, AssetBlockParamsDTO, AssetsChangeResult, AssetSetDTO, AssetFull } from "~ims-app-base/logic/types/AssetsType";
import type { ChangesStreamResponse, ChangesStreamRequest, ApiResultListWithTotal } from "~ims-app-base/logic/types/ProjectTypes";
import { stringifyAssetNewBlockRef, assignPlainValueToAssetProps, type AssetProps, diffAssetPropObjects, getAssetPropType, AssetPropType, type AssetPropValueFile, type AssetPropValueText, type AssetPropsPlainObjectValue, convertAssetPropsToPlainObject, type AssetPropValue } from "~ims-app-base/logic/types/Props";
import { type AssetPropWhere } from "~ims-app-base/logic/types/PropsWhere";
import type { Workspace, WorkspaceQueryDTOWhere } from "~ims-app-base/logic/types/Workspaces";
import log from 'electron-log/main';
import type { ChangeWorkspaceDTO } from "~ims-app-base/logic/types/RightsAndRoles";
import { syncEntity, type SyncTableRow } from "./sync-helpers";
import type { ProjectFileDb, ProjectFileDbAsset, ProjectFileDbWorkspace } from "../../ProjectFileDb";
import type { AssetBlockEntity } from "~ims-app-base/logic/types/BlocksType";
import * as node_path from 'path';
import fs from 'node:fs'
import crypto from 'crypto';
import axios from "axios";
import type { SyncInfo } from "#logic/types/SyncTypes";
import { SyncCurrentStateStatus, type SyncCurrentState } from "#bridge/types/SyncTypes";

const SYNC_CHUNK_SIZE = 50;
export const SQLITE_NOW_STM = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;
const ATTACHMENTS_DIR = 'attachments';

export type ProjectDbFile = {
    server_file_id: string,
    local_path: string,
    server_store: string
}

type ServerAssetToCheckChange = {
    title: AssetFull['title'],
    name: AssetFull['name'],
    index: AssetFull['index'],
    ownIcon: AssetFull['ownIcon'],
    isAbstract: AssetFull['isAbstract'],
    parentIds: AssetFull['parentIds'],
    workspaceId: AssetFull['workspaceId'],
    blocks: {
        id: AssetFull['blocks'][0]['id'],
        title: AssetFull['blocks'][0]['title'],
        name: AssetFull['blocks'][0]['name'],
        type: AssetFull['blocks'][0]['type'],
        index: AssetFull['blocks'][0]['index'],
        props: AssetFull['blocks'][0]['props'],
    }[]
}

type ServerWorkspaceToCheckChange = {
    title: Workspace['title'],
    name: Workspace['name'],
    index: Workspace['index'],
    parentId: Workspace['parentId'],
    props: Workspace['props'],
}

export class SyncService {

    private _syncProcessRunning = false;
    private _synchronizationTimer: NodeJS.Timeout | undefined;
    private _currentState: SyncCurrentState = {
        status: SyncCurrentStateStatus.FREE,
        hasChanges: false,
        error: null
    };

    constructor(public db: ProjectFileDb){

    }

    async changeAutoSynchronization(new_val: number){
        await this.db.settings.setKey('syncWithCloud', new_val);
        if(this._synchronizationTimer){
            clearInterval(this._synchronizationTimer);
            this._synchronizationTimer = undefined;
        }
        if(new_val > 0) {
            this._synchronizationTimer = setInterval(() => {
                this.syncProject();
            }, new_val * 1000);
        }
    }

    async init(){
        const syncWithCloudTime = await this.db.settings.getKey('syncWithCloud', 60);
        if(syncWithCloudTime > 0) {
            this._synchronizationTimer = setInterval(() => {
                this.syncProject();
            }, syncWithCloudTime * 1000);
        }        
    }

    destroy(){
        if(this._synchronizationTimer){
           clearInterval(this._synchronizationTimer); 
           this._synchronizationTimer = undefined
        }
    }

    async getSyncErrors(): Promise<SyncInfo> {
        let sync_info: SyncInfo = {
            syncEnd: null,
            syncState: null,
            assets: [],
            workspaces: [],
            error: null,
        }
        const last_sync_db_res: {
            id: string,
            sync_start: string | null,
            sync_state: string | null,
            error: string | null
        }[] = await this.db.dataSource.createQueryRunner().query(`
            SELECT id, sync_start, sync_state, error
            FROM sync_logs
            WHERE sync_end IS NOT NULL
            ORDER BY id DESC
            LIMIT 1; 
        `);
        if(last_sync_db_res.length > 0) {
            sync_info.syncEnd = last_sync_db_res[0].sync_start;
            sync_info.syncState = last_sync_db_res[0].sync_state;
            sync_info.error = last_sync_db_res[0].error;

            sync_info.assets =await this.db.dataSource.createQueryRunner().query(`
                SELECT id, title, need_sync, synced_at, conflict, conflict_message
                FROM assets
                WHERE need_sync > synced_at OR (need_sync IS NOT NULL AND synced_at IS NULL) OR conflict IS NOT NULL
                ORDER BY need_sync DESC, id DESC
            `, []);
            
            sync_info.workspaces =await this.db.dataSource.createQueryRunner().query(`
                SELECT id, title, need_sync, synced_at, conflict, conflict_message
                FROM workspaces
                WHERE need_sync > synced_at OR (need_sync IS NOT NULL AND synced_at IS NULL) OR conflict IS NOT NULL
                ORDER BY need_sync DESC, id DESC
            `, []);
        }
        return sync_info;
    }

    getCurrentSyncState(){
        return {...this._currentState};
    }

    changeCurrentState(changes: {
        status?: SyncCurrentStateStatus,
        hasChanges?: boolean,
        error?: string | null
    }){
        let has_changes = false;
        if(changes.status !== undefined  && changes.status !== this._currentState.status) {
            this._currentState.status = changes.status;
            has_changes = true;
        }
        if(changes.hasChanges !== undefined && changes.hasChanges !== this._currentState.hasChanges) {
            this._currentState.hasChanges = changes.hasChanges;
            has_changes = true;
        }
        if(changes.error !== undefined && changes.error !== this._currentState.error) {
            this._currentState.error = changes.error;
            has_changes = true;
        }
        if(has_changes){
            this.db.sendSyncState(this._currentState);
        }
    }

    async resyncAssetsAndWorkspaces(
        asset_ids: string[],
        workspace_ids: string[],
    ){
        await this.db.dataSource.createQueryRunner().query(`
            UPDATE workspaces
            SET need_sync = ${SQLITE_NOW_STM}, conflict = NULL, conflict_message = NULL
            WHERE id IN (`+ workspace_ids.map(i => `?`) +`) 
        `, [...workspace_ids]);
        await this.db.dataSource.createQueryRunner().query(`
            UPDATE assets
            SET need_sync = ${SQLITE_NOW_STM}, conflict = NULL, conflict_message = NULL
            WHERE id IN (`+ asset_ids.map(i => `?`) +`) 
        `, [...asset_ids]);
        const db_workspaces: SyncTableRow[] = await this.db.dataSource.createQueryRunner().query(`
            SELECT id,server_state,server_deleted
            FROM workspaces
            WHERE id IN (`+ workspace_ids.map(i => `?`) +`) 
        `, [...workspace_ids]);
        await this._syncWorkspaces(db_workspaces);
        const db_assets: SyncTableRow[] = await this.db.dataSource.createQueryRunner().query(`
            SELECT id,server_state,server_deleted
            FROM assets
            WHERE id IN (`+ asset_ids.map(i => `?`) +`) 
        `, [...asset_ids]);
        await this._syncAssets(db_assets);
    }

    async pauseSyncProject(){
        this._synchronizationTimer = undefined;
        this.changeCurrentState({
            status: SyncCurrentStateStatus.PAUSE,
        });
    }
    
    async resumeSyncProject(){
        await this.syncProject();
        this._synchronizationTimer = setInterval(() => {
            this.syncProject();
        }, 60 * 1000);
    }

    async syncProject(){
        if (this._syncProcessRunning) return;
        if (!this.db.info.id) return;
        let sync_log_id: number | null = null;
        try{
            this._syncProcessRunning = true;
            this.changeCurrentState({
                status: SyncCurrentStateStatus.IN_PROCESS
            });
            const insert_res: {id: number}[] = await this.db.dataSource.createQueryRunner().query(`
                INSERT INTO sync_logs (sync_start)
                VALUES (${SQLITE_NOW_STM}) RETURNING id;
            `);
            sync_log_id = insert_res[0].id;
            await this.checkUnsyncedAssetsAndWorkspaces(sync_log_id);
            await this.syncAssetsAndWorkspaces();
            this.changeCurrentState({
                status: SyncCurrentStateStatus.FREE,
                hasChanges: false,
                error: null,
            });
        }
        catch(err: any){
            if(sync_log_id) {
                await this.db.dataSource.createQueryRunner().query(`
                    UPDATE sync_logs
                    SET error = ?
                    WHERE id = ?
                `, [ err.message, sync_log_id]);  
            }
            else {
                log.error('Sync failed', err);
            }
            this.changeCurrentState({
                status: SyncCurrentStateStatus.FREE,
                error: err.message,
            });
        }
        finally {
            if(sync_log_id) {
                await this.db.dataSource.createQueryRunner().query(`
                    UPDATE sync_logs
                    SET sync_end = ${SQLITE_NOW_STM}
                    WHERE id = ?
                `, [sync_log_id]);
            }
            this._syncProcessRunning = false;
        }
    }

    async checkUnsyncedAssetsAndWorkspaces(sync_log_id: number) {
        const last_sync_db_res: {
            id: string,
            sync_start: string | null,
            sync_state: string | null
        }[] = await this.db.dataSource.createQueryRunner().query(`
            SELECT id, sync_start, sync_state
            FROM sync_logs
            WHERE error IS NULL AND sync_end IS NOT NULL
            ORDER BY id DESC
            LIMIT 1; 
        `);

        const assetDeletedIdsMap = new Map<string, string>();
        const assetUpdatedIdsMap = new Map<string, string>();
        const workspaceDeletedIdsMap = new Map<string, string>();
        const workspaceUpdatedIdsMap = new Map<string, string>(); 
    
        const asset_condition: AssetPropWhere = {
            issystem: false,
            inside: 'gdd'
        };
    
        const workspace_condition: WorkspaceQueryDTOWhere = {
            insideName: 'gdd',
        };
        let has_more = true;
        let last_asset_id = null as string | null;
        let last_workspace_id = null as string | null;
        let last_time = last_sync_db_res[0]?.sync_state;
        if(last_time) {
            while (has_more) {
                const changes: ChangesStreamResponse = await this.db.api.call(
                    Service.CREATORS,
                    HttpMethods.POST,
                    `project/changes/stream/get`, 
                    {
                        dateFrom: last_time,
                        lastAssetId: last_asset_id ?? undefined,
                        lastWorkspaceId: last_workspace_id ?? undefined,
                        count: SYNC_CHUNK_SIZE,
                        whereAssets: asset_condition,
                        whereWorkspaces: workspace_condition,                
                    } as ChangesStreamRequest
                );
                has_more = !!changes.last && changes.more;
                if (changes.last) {
                    last_time = changes.last.date;
                    last_asset_id = changes.last.assetId;
                    last_workspace_id = changes.last.workspaceId;
                }
                const assets = await this.db.asset.assetsGetShort({
                    where: {
                        id: [...changes.assetUpdatedIds, ...changes.assetDeletedIds]
                    }
                })
                for(const updated_id of changes.assetUpdatedIds){
                    assetDeletedIdsMap.delete(updated_id);
                    assetUpdatedIdsMap.set(updated_id, assets.list.find(a => a.id === updated_id)?.title ?? '');
                }
                for(const deleted_id of changes.assetDeletedIds){
                    assetUpdatedIdsMap.delete(deleted_id);
                    assetDeletedIdsMap.set(deleted_id, assets.list.find(a => a.id === deleted_id)?.title ?? '');
                }

                for(const updated_id of changes.workspaceUpdatedIds){
                    workspaceDeletedIdsMap.delete(updated_id);
                    workspaceUpdatedIdsMap.set(updated_id, this.db.workspace.getWorkspaceById(updated_id)?.title ?? '');
                }
                for(const deleted_id of changes.workspaceDeletedIds){
                    workspaceUpdatedIdsMap.delete(deleted_id);
                    workspaceDeletedIdsMap.set(deleted_id, this.db.workspace.getWorkspaceById(deleted_id)?.title ?? '');
                }
        
                if (
                    !changes.assetDeletedIds.length &&
                    !changes.assetUpdatedIds.length &&
                    !changes.workspaceDeletedIds.length &&
                    !changes.workspaceUpdatedIds.length
                ) {
                    break;
                }
            }

            if (!last_asset_id && !last_workspace_id){

                // вставляю в state старый last time
                await this.db.dataSource.createQueryRunner().query(`
                    UPDATE sync_logs
                    SET sync_state = ?
                    WHERE id = ?
                `, [last_time, sync_log_id]);
                return; // No external changes
            }
            
            const last_time_date = new Date(last_time)
            last_time_date.setTime(last_time_date.getTime() + 1)
            last_time = last_time_date.toISOString()
        }
        else {
            let asset_processed = 0;
            let workspace_processed = 0;
            let asset_has_more = true;
            let workspace_has_more = true;
    
            while (asset_has_more || workspace_has_more) {

                const assets: ApiResultListWithTotal<{id: string, title: string}> = await this.db.api.call(Service.CREATORS, HttpMethods.GET, `assets/view`, {
                    select: JSON.stringify(['id', 'title']),
                    where: JSON.stringify(asset_condition),
                    offset: asset_processed,
                    count: SYNC_CHUNK_SIZE,
                });
                assets.list.forEach((a) => assetUpdatedIdsMap.set(a.id, a.title));
                asset_processed += assets.list.length;
                asset_has_more = asset_processed < assets.total && assets.list.length > 0;

                const workspaces: ApiResultListWithTotal<Workspace> = await this.db.api.call(Service.CREATORS, HttpMethods.GET, `workspaces`, {
                    where: JSON.stringify(workspace_condition),
                    count: SYNC_CHUNK_SIZE,
                });
                    
                workspaces.list.forEach((w) => workspaceUpdatedIdsMap.set(w.id, w.title));
                workspace_processed += workspaces.list.length;
                workspace_has_more = workspace_processed < workspaces.total && workspaces.list.length > 0;
            }
            last_time = new Date().toISOString();
        }
        await this.db.dataSource.createQueryRunner().query(`
            UPDATE sync_logs
            SET sync_state = ?
            WHERE id = ?
        `, [last_time, sync_log_id]);
        if(assetUpdatedIdsMap.size > 0) {
            await this.db.dataSource.createQueryRunner().query(`
                INSERT INTO assets (id, title, need_sync)
                VALUES ` + [...assetUpdatedIdsMap.keys()].map(i => `(?,?,${SQLITE_NOW_STM})`).join(',') +
                ` ON CONFLICT (id) DO UPDATE SET need_sync = ${SQLITE_NOW_STM};
            `, [...assetUpdatedIdsMap].flat());
        }

        if(assetDeletedIdsMap.size > 0) {
            await this.db.dataSource.createQueryRunner().query(`
                INSERT INTO assets (id, title, need_sync, server_deleted)
                VALUES ` + [...assetDeletedIdsMap.keys()].map(i => `(?,?,${SQLITE_NOW_STM}, true)`).join(',') +
                ` ON CONFLICT (id) DO UPDATE SET need_sync = ${SQLITE_NOW_STM}, server_deleted = true;
            `, [...assetDeletedIdsMap].flat());
        }

        if(workspaceUpdatedIdsMap.size > 0) {
            await this.db.dataSource.createQueryRunner().query(`
                INSERT INTO workspaces (id, title, need_sync)
                VALUES ` + [...workspaceUpdatedIdsMap.keys()].map(i => `(?,?,${SQLITE_NOW_STM})`).join(',') +
                ` ON CONFLICT (id) DO UPDATE SET need_sync = ${SQLITE_NOW_STM};
            `, [...workspaceUpdatedIdsMap].flat());
        }

        if(workspaceDeletedIdsMap.size > 0) {
            await this.db.dataSource.createQueryRunner().query(`
                INSERT INTO workspaces (id, title, need_sync, server_deleted)
                VALUES ` + [...workspaceDeletedIdsMap.keys()].map(i => `(?,?,${SQLITE_NOW_STM}, true)`).join(',') +
                ` ON CONFLICT (id) DO UPDATE SET need_sync = ${SQLITE_NOW_STM}, server_deleted = true;
            `, [...workspaceDeletedIdsMap].flat());
        }
    }

    async syncAssetsAndWorkspaces() {
        const db_workspaces: SyncTableRow[] = await this.db.dataSource.createQueryRunner().query(`
            SELECT id,server_state,server_deleted
            FROM workspaces
            WHERE need_sync > synced_at OR (need_sync IS NOT NULL AND synced_at IS NULL);
        `);
        await this._syncWorkspaces(db_workspaces);
        
        const db_assets: SyncTableRow[] = await this.db.dataSource.createQueryRunner().query(`
            SELECT id,server_state,server_deleted
            FROM assets
            WHERE need_sync > synced_at OR (need_sync IS NOT NULL AND synced_at IS NULL);
        `);
        await this._syncAssets(db_assets);
    }

    private async _syncAsset(db_asset: SyncTableRow){
        await syncEntity<ProjectFileDbAsset, AssetFull, AssetSetDTO, AssetSetDTO>(db_asset, {
            db: this.db, 
            entityTable: 'assets',
            serverLoad: (id) => this._loadFromServerAsset(id),
            serverPut: async (id, change, create) => {
                const server_asset_full: AssetsFullResult = create ? 
                    await this.db.api.call(Service.CREATORS, HttpMethods.POST, `assets/create`, {
                        id,
                        set: change
                    }) :  
                    await this.db.api.call(Service.CREATORS, HttpMethods.POST, `assets/change`, {
                        where: {
                            id: [id],
                        },
                        set: change
                    });
                if (!server_asset_full.objects.assetFulls[id]){
                    return null;
                }
                return server_asset_full.objects.assetFulls[id]
            },
            serverDelete: async (id) => {
                await this.db.api.call(Service.CREATORS, HttpMethods.POST, `assets/delete`, {
                    where: {
                        id: [id],
                    }
                });
            },
            serverGetChanges: (source, target) => this._getAssetsChangesServer(source, target),
            serverToLocal: (state) => this.convertServerAssetToLocal(state),
            localLoad: async (id) => {
                return this.db.asset.assets.byId.get(id) ?? null;
            },
            localPut: async (id, change, create) => {
                let res: AssetsFullResult;
                if (create){
                    res = await this.db.asset.assetsCreate({
                        id: id,
                        set: change
                    });
                }
                else {  
                    res = await this.db.asset.assetsChange({
                        where: {
                            id
                        },
                        set: change
                    });
                }
            },
            localDelete: async (id) => {
                await this.db.asset.assetsDelete({
                    id: [id],
                })
            },
            localGetChanges: (source, target) => this._getAssetsChangesLocal(source, target),
            localToServer: (state) => this.convertLocalAssetToServer(state)
        })
    }

    private async _checkParentAssetNeedSyncAndSync(need_sync_assets_map: Map<string, SyncTableRow>, asset_id: string){
        const db_asset = need_sync_assets_map.get(asset_id)
        if(!db_asset) return;
        
        const local_asset = this.db.asset.assets.byId.get(db_asset.id);
        if(local_asset?.parentIds) {
            for(const parent_id of local_asset.parentIds) {
                await this._checkParentAssetNeedSyncAndSync(need_sync_assets_map, parent_id)
            }
        }
        else {
            const server_asset_full: AssetsFullResult = await this.db.api.call(Service.CREATORS, HttpMethods.GET, `assets/full`, {
                where: JSON.stringify({
                    id: [db_asset.id],
                })
            });
            const server_asset = server_asset_full.objects.assetFulls[db_asset.id];
            if(server_asset?.parentIds) {
                for(const parent_id of server_asset.parentIds) {
                    await this._checkParentAssetNeedSyncAndSync(need_sync_assets_map, parent_id)
                }
            }
        }
        await this._syncAsset(db_asset);
        need_sync_assets_map.delete(db_asset.id);
    }

    private async _syncAssets(db_assets: SyncTableRow[]){
        const need_sync_assets_map = new Map(db_assets.map(a => [a.id, a]));
        for(const db_asset of db_assets){
            await this._checkParentAssetNeedSyncAndSync(need_sync_assets_map, db_asset.id);
        }
    }

    private async _syncWorkspace(db_workspace: SyncTableRow){
        await syncEntity<ProjectFileDbWorkspace, Workspace, ChangeWorkspaceDTO, ChangeWorkspaceDTO>(db_workspace, {
            db: this.db, 
            entityTable: 'workspaces',
            serverLoad: (id) => this._loadFromServerWorkspace(id),
            serverPut: async (id, change, create) => {
                const server_workspace_full: Workspace =  create ? 
                    await this.db.api.call(Service.CREATORS, HttpMethods.POST, `workspaces`, {
                        id,
                        ...change
                    }) : 
                    await this.db.api.call(Service.CREATORS, HttpMethods.PATCH, `workspaces/${id}`, change);
                if (!server_workspace_full){
                    return null;
                }
                return server_workspace_full
            },
            serverToLocal: (state) => this.convertServerWorkspaceToLocal(state),
            serverDelete: async (id) => {
                await this.db.api.call(Service.CREATORS, HttpMethods.DELETE, `workspaces/${id}`);
            },
            serverGetChanges: (source, target) => this.getWorkspacesChangesServer(source, target),
            localLoad: async (id) => {
                let workspace = this.db.workspace.workspaces.byId.get(id) ?? null;
                if(workspace) {
                    return await this.convertLocalWorkspaceToServer(workspace);
                }
                return null;
            },
            localPut: async (id, change, create) => {
                if (create){
                    await this.db.workspace.workspacesCreate({
                        ...change,
                        id,
                        props: assignPlainValueToAssetProps({}, change.props ?? {}),
                    });
                }
                else {  
                    await this.db.workspace.workspacesChange(id, change);
                }
            },
            localDelete: async (id) => {
                await this.db.workspace.workspacesDelete(id)
            },
            localToServer: state => this.convertLocalWorkspaceToServer(state),
            localGetChanges: (source, target) => this.getWorkspacesChangesLocal(source, target),
        });
    }

    private async _syncWorkspaces(db_workspaces: SyncTableRow[]){
        const need_sync_workspaces_map = new Map(db_workspaces.map(w => [w.id, w]));
        for(const db_workspace of db_workspaces){
            await this._checkParentWorkspaceNeedSyncAndSync(need_sync_workspaces_map, db_workspace.id);
        }
    }

    
    private async _loadFromServerAsset(db_asset_id: string): Promise<AssetFull | null>{
        const server_asset_full: AssetsFullResult = await this.db.api.call(Service.CREATORS, HttpMethods.GET, `assets/full`, {
            where: JSON.stringify({
                id: [db_asset_id],
            })
        });
        return server_asset_full.objects.assetFulls[db_asset_id]
    }

    private async _loadFromServerWorkspace(db_workspace_id: string): Promise<Workspace | null>{
        const server_workspaces: ApiResultListWithTotal<Workspace> = await this.db.api.call(Service.CREATORS, HttpMethods.GET, `workspaces`, {
            where: JSON.stringify({
                ids: [db_workspace_id],
            })
        });
        return server_workspaces.list[0] ?? null
    }
    private _getAssetsChangesLocal(source_asset: ProjectFileDbAsset, target_asset: ProjectFileDbAsset | null): AssetSetDTO {
        return this._getAssetsChangesServer(
            {
                ...source_asset,
                blocks: source_asset.blocks.map(b => {
                    return {
                        ...b,
                        props: assignPlainValueToAssetProps({}, b.props),
                    }
                })
            },
            target_asset ? {
                ...target_asset,
                blocks: target_asset.blocks.map(b => {
                    return {
                        ...b,
                        props: assignPlainValueToAssetProps({}, b.props),
                    }
                })
            } : null
        )
    }

    private _getAssetsChangesServer(source_asset: ServerAssetToCheckChange, target_asset: ServerAssetToCheckChange | null): AssetSetDTO {
        const changes: AssetSetDTO = {};
        if(!target_asset || source_asset.title !== target_asset.title) {
            changes.title = source_asset.title;
        }
        if(!target_asset || source_asset.name !== target_asset.name) {
            changes.name = source_asset.name;
        }
        if(!target_asset || source_asset.index !== target_asset.index) {
            changes.index = source_asset.index;
        }
        if(!target_asset || source_asset.ownIcon !== target_asset.ownIcon) {
            changes.icon = source_asset.ownIcon;
        }
        if(!target_asset || source_asset.isAbstract !== target_asset.isAbstract) {
            changes.isAbstract = source_asset.isAbstract;
        }
        if(!target_asset || source_asset.parentIds.length !== target_asset.parentIds.length ||
            source_asset.parentIds.some((val: any, ind: number) => target_asset.parentIds[ind] !== val)
        ) {
            changes.parentIds = source_asset.parentIds;
        }
        if(!target_asset || source_asset.workspaceId !== target_asset.workspaceId) {
            changes.workspaceId = source_asset.workspaceId;
        }

        for(const source_block of source_asset.blocks){
            const target_block = target_asset ? target_asset.blocks.find((x: { id: any; }) => x.id === source_block.id) : null;
            const block_change: AssetBlockParamsDTO = {}
            let any_block_change = false;
            if(!target_block || source_block.title !== target_block.title) {
                block_change.title = source_block.title;
                any_block_change = true;
            }
            if(!target_block || source_block.name !== target_block.name) {
                block_change.name = source_block.name;
                any_block_change = true;
            }
            if(!target_block || source_block.index !== target_block.index) {
                block_change.index = source_block.index;
                any_block_change = true;
            }
            if(!target_block) {
                block_change.type = source_block.type;
                any_block_change = true;
            }
            const change_asset_props: AssetProps[] = target_block ? 
                diffAssetPropObjects(source_block.props ?? {}, target_block.props ?? {}) :
                [{}, source_block.props ?? {}]
            if(change_asset_props.length > 0){
                block_change.props = change_asset_props
                any_block_change = true;
            }
            if (any_block_change){
                if (!changes.blocks){
                    changes.blocks = {}
                }
                const block_key = stringifyAssetNewBlockRef(source_block.name,source_block.id)
                changes.blocks[block_key] = block_change
            }

        }
        if (target_asset){
            for(const server_block of target_asset.blocks){
                const local_block = source_asset.blocks.find((x: { id: any; }) => x.id === server_block.id);
                if(!local_block){  
                    if (!changes.blocks){
                        changes.blocks = {}
                    }
                    const block_key = stringifyAssetNewBlockRef(server_block.name,server_block.id)
                    changes.blocks[block_key] = {
                        delete: true
                    }
                }
            }
        }
        return changes;
    }

    getWorkspacesChangesLocal(source_workspace: ProjectFileDbWorkspace, target_workspace: ProjectFileDbWorkspace | null): ChangeWorkspaceDTO {
        return this.getWorkspacesChangesServer({
            ...source_workspace,
            props: assignPlainValueToAssetProps({}, source_workspace.props)
        },
        target_workspace ? {
            ...target_workspace,
            props: assignPlainValueToAssetProps({}, target_workspace.props)
        } : null)
    }

    getWorkspacesChangesServer(source_workspace: ServerWorkspaceToCheckChange, target_workspace: ServerWorkspaceToCheckChange | null): ChangeWorkspaceDTO {
        const changes: ChangeWorkspaceDTO = {};
        if(!target_workspace || source_workspace.title !== target_workspace.title) {
            changes.title = source_workspace.title;
        }
        if(!target_workspace || source_workspace.name !== target_workspace.name) {
            changes.name = source_workspace.name;
        }
        if(!target_workspace || source_workspace.index !== target_workspace.index) {
            changes.index = source_workspace.index;
        }
        if(!target_workspace || source_workspace.parentId !== target_workspace.parentId) {
            changes.parentId = source_workspace.parentId ?? undefined;
        }
        const source_props = source_workspace.props ?? {}
        const change_props: AssetProps[] = target_workspace ? diffAssetPropObjects(
                    source_props,
                    target_workspace.props
                ) :
                    [source_props]
        if(change_props.length > 0){
            changes.props = source_props
        }
        return changes;
    }

    prepareAssetToServer(full: ProjectFileDbAsset) {
        let blocks:
            | {
                [blockKey: string]: AssetBlockParamsDTO;
            }
            | undefined = undefined;
        for (const r of full.blocks) {
            const key = stringifyAssetNewBlockRef(null, r.id);
            if (!blocks) blocks = {};
            blocks[key] = {
                index: r.index,
                name: r.name,
                title: r.title,
                props: assignPlainValueToAssetProps({}, r.props),
                type: r.type,
            };
        }
        return {
            icon: full.ownIcon ?? undefined,
            title: full.title,
            isAbstract: full.isAbstract,
            parentIds: full.parentIds,
            workspaceId: full.workspaceId ?? undefined,
            blocks,
        }
    }
    
    async copyAssetToServer(localAssetId: string): Promise<AssetsFullResult> {
        const full = this.db.asset.assets.byId.get(localAssetId);
        if (!full) throw new Error('Asset not found');
        const asset = this.prepareAssetToServer(full);
        return await this.db.api.call(Service.CREATORS, HttpMethods.POST, `assets/create`, {
            id: localAssetId,
            set: {
                ...asset,
            },
        });
    }

    private async _checkParentWorkspaceNeedSyncAndSync(need_sync_workspaces_map: Map<string, SyncTableRow>, workspace_id: string){
        const db_workspace = need_sync_workspaces_map.get(workspace_id)
        if(!db_workspace) return;
        
        const local_workspace = this.db.workspace.workspaces.byId.get(db_workspace.id);
        if(local_workspace?.parentId) {
            await this._checkParentWorkspaceNeedSyncAndSync(need_sync_workspaces_map, local_workspace.parentId)
        }
        else {
            const server_workspaces: ApiResultListWithTotal<Workspace> = await this.db.api.call(Service.CREATORS, HttpMethods.GET, `workspaces`, {
                where: JSON.stringify({
                    ids: [db_workspace.id],
                })
            });
            const server_workspace = server_workspaces.list[0];
            if(server_workspace?.parentId){
                await this._checkParentWorkspaceNeedSyncAndSync(need_sync_workspaces_map, server_workspace.parentId);
            }
        }
        await this._syncWorkspace(db_workspace);
        need_sync_workspaces_map.delete(db_workspace.id);
    }
    
    async convertServerPropsToLocal(block: AssetBlockEntity): Promise<AssetBlockEntity> {
        const new_block = {...block};
        new_block.props = await this.convertServerFileToLocal(new_block.props);
        new_block.inherited = new_block.inherited ? await this.convertServerFileToLocal(new_block.inherited) : null;
        new_block.computed = await this.convertServerFileToLocal(new_block.computed);
        return new_block;
    }

    private async convertServerFileToLocal(props: AssetProps): Promise<AssetProps>{
        let new_props: AssetProps = structuredClone(props);
        for(const [key, prop] of Object.entries(props)){
            const prop_type = getAssetPropType(prop);
            if(prop_type === AssetPropType.TEXT) {
                for (const [ind, sub_prop] of (prop as AssetPropValueText).Ops.entries()) {
                    if(sub_prop.insert?.file?.value && 
                        getAssetPropType(sub_prop.insert?.file?.value) === AssetPropType.FILE){
                        const new_prop = await this._loadServerAttachment(sub_prop.insert.file.value);
                        (new_props[key] as any).Ops[ind].insert.file.value = new_prop;
                    }
                }
            }
            else if(prop_type === AssetPropType.FILE){
                const new_prop = await this._loadServerAttachment(prop as AssetPropValueFile);
                new_props[key] = new_prop;
            }
        }
        return new_props;
    }

    private async _getSyncedFile(file_id: string): Promise<ProjectDbFile | null>{
        const synced_files: ProjectDbFile[] = await this.db.dataSource.createQueryRunner().query(`
            SELECT server_file_id,local_path,server_store
            FROM files
            WHERE server_file_id = ?
            LIMIT 1
        `, [file_id]);
        return synced_files.length > 0 ? synced_files[0] : null;
    }

    private async _loadServerAttachment(asset_prop: AssetPropValueFile): Promise<AssetPropValueFile>{
        if(asset_prop.Store === 'loc-project'){
            return asset_prop;
        }
        const synced_file: ProjectDbFile[] = await this.db.dataSource.createQueryRunner().query(`
            SELECT server_file_id,local_path,server_store
            FROM files
            WHERE server_file_id = ? AND server_store = ?
            LIMIT 1
        `, [asset_prop.FileId, asset_prop.Store]);
        if(synced_file.length > 0){
            //TODO: Проверить файлы из корня проекта (dir = null || '')
            return {
                ...asset_prop,
                Dir: node_path.dirname(synced_file[0].local_path),
                Store: "loc-project",
            }
        }
        else {
            const file: any = await this.db.api.download(
                Service.FILE_STORAGE,
                HttpMethods.GET, 
                `file/${asset_prop.Store}/${asset_prop.FileId}`, {}
            )
            const relative_path = await this._saveAttachmentReturnRelativePath(file, asset_prop.Title);
            
            await this.db.dataSource.createQueryRunner().query(`
            INSERT INTO files (server_file_id,local_path,server_store, created_at)
            VALUES (?,?,?, ${SQLITE_NOW_STM}) ON CONFLICT (local_path) 
                DO UPDATE SET server_file_id = excluded.server_file_id, server_store = excluded.server_store;
            `, [asset_prop.FileId, relative_path, asset_prop.Store]);
            
            const local_asset_prop: AssetPropValueFile = {
                ...asset_prop,
                Title: node_path.basename(relative_path),
                Dir: node_path.dirname(relative_path).replaceAll('\\', '//'),
                Store: "loc-project",
            };
            return local_asset_prop;
        }
    }

    private async _saveAttachmentReturnRelativePath(file_buffer: Uint8Array, fileName: string){
        const file_hash = crypto.createHash('md5').update(file_buffer).digest('hex');
        const ext = node_path.extname(fileName);
        const base_name = node_path.basename(fileName, ext);
    
        let counter = 0;
        while (true) {
            const current_name = counter === 0 ? fileName : `${base_name} (${counter})${ext}`;
            const project_root = this.db.localPath;
            const attachment_path = node_path.join(project_root ?? '', ATTACHMENTS_DIR, current_name);
    
            try {
                const file_info = await fs.promises.stat(attachment_path);
                const file2 = await fs.promises.readFile(attachment_path);
                const existing_hash = crypto.createHash('md5').update(file2).digest('hex');
    
                if (file_info.size === file_buffer.length && existing_hash === file_hash) {
                    return node_path.join(ATTACHMENTS_DIR, current_name);
                }
            } catch (error: any) {
                if(/^ENOENT: no such file or directory.*/.test(error.message) ||
                    /^Files has different$/.test(error.message)
                ){
                    // Файл не существует - сохраняем
                    const dir = node_path.dirname(attachment_path);
                    await fs.promises.mkdir(dir, { recursive: true});
                    await fs.promises.writeFile(attachment_path, file_buffer, {});
                    return node_path.join(ATTACHMENTS_DIR, current_name);
                }
                else {
                    throw new Error(error.message);
                }
            }
    
            counter++;
        }
    }
    
    async convertLocalAssetToServer(asset: ProjectFileDbAsset): Promise<AssetFull>{
        let new_asset: AssetFull = {...asset, blocks: []};
        new_asset.blocks = [];
        for(const block of asset.blocks){
            const new_block: AssetBlockEntity = {
                ...block,
                props: await this.convertLocalPropsToServer(block.props),
                computed: await this.convertLocalPropsToServer(block.computed),
                inherited: block.inherited ? await this.convertLocalPropsToServer(block.inherited) : null,
                rights: 5
            };
            new_asset.blocks.push(new_block);
        }
        return new_asset;
    }

    async convertLocalWorkspaceToServer(workspace: ProjectFileDbWorkspace): Promise<Workspace>{
        const new_workspace: Workspace = {
            ...workspace,
            props: await this.convertLocalPropsToServer(workspace.props)
        };
        return new_workspace;
    }

    async convertLocalPropsToServer(local_block_props: AssetPropsPlainObjectValue): Promise<AssetProps>{
        let props = assignPlainValueToAssetProps({}, local_block_props);
        for(const [key, prop] of Object.entries(props)) {
            const prop_type = getAssetPropType(prop);
            if(prop_type === AssetPropType.TEXT) {
                for (const [ind, sub_prop] of (prop as AssetPropValueText).Ops.entries()) {
                    if(sub_prop.insert?.file?.value && 
                        getAssetPropType(sub_prop.insert?.file?.value) === AssetPropType.FILE){
                        const new_prop = await this.convertLocalFileToServer(sub_prop.insert.file.value);
                        (props[key] as any).Ops[ind].insert.file.value = new_prop;
                    }
                }
            }
            else if(prop_type === AssetPropType.FILE){
                const new_prop = await this.convertLocalFileToServer(prop as AssetPropValueFile);
                props[key] = new_prop;
            }
        }
        return props;
    }

    async convertLocalFileToServer(file: AssetPropValueFile): Promise<AssetPropValueFile>{
        const formData = new FormData();
        const project_root = this.db.localPath;
        const attachment_path = node_path.join(project_root ?? '', ATTACHMENTS_DIR, file.Title);
        const file_blob = await fs.promises.readFile(attachment_path);
        formData.append('file', new Blob([new Uint8Array(file_blob)]), file.Title);
        formData.append('id', file.FileId);

        const token: { token: string } = await this.db.api.call(
            Service.CREATORS,
            HttpMethods.GET,
            `file/p-${this.db.info.id}/token`,
            {},
        );
        
        const response = await axios(`${process.env.FILE_STORAGE_API_HOST}file/p-${this.db.info.id}/upload`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token.token}`,
            },
            data: formData,
        })

        const res: {
            fileId: string;
            title: string;
            size: number;
            dir: string | null;
            store: string;
        } = response.data;
        
        await this.db.dataSource.createQueryRunner().query(`
            INSERT INTO files (server_file_id,local_path,server_store, created_at)
            VALUES (?,?,?, ${SQLITE_NOW_STM}) ON CONFLICT (local_path) 
                DO UPDATE SET server_file_id = excluded.server_file_id, server_store = excluded.server_store;
        `, [res.fileId, node_path.join(file.Dir ?? '', file.Title), res.store]);

        return {
            FileId: res.fileId,
            Title: res.title,
            Size: res.size,
            Dir: res.dir,
            Store: res.store
        };
    }

    async convertServerAssetToLocal (server_asset: AssetFull): Promise<ProjectFileDbAsset>{
        const local_asset: ProjectFileDbAsset = {
            id: server_asset.id,   
            typeIds: [...server_asset.typeIds],
            parentIds: [...server_asset.parentIds],
            ownTitle: server_asset.ownTitle,
            ownIcon: server_asset.ownIcon,
            blocks: [],
            comments: server_asset.comments,
            references: server_asset.references,
            projectId: server_asset.projectId,
            workspaceId: server_asset.workspaceId,
            name: server_asset.name,
            title: server_asset.title,
            icon: server_asset.icon,
            isAbstract: server_asset.isAbstract,
            createdAt: server_asset.createdAt,
            updatedAt: server_asset.updatedAt,
            deletedAt: server_asset.deletedAt,
            rights: server_asset.rights,
            index: server_asset.index,
            creatorUserId: server_asset.creatorUserId,
            unread: server_asset.unread,
            hasImage: server_asset.hasImage,
        }
        for(const block of server_asset.blocks){
            const local_block = await this.convertServerPropsToLocal(block);
            local_asset.blocks.push({
                ...local_block,
                props: convertAssetPropsToPlainObject(local_block.props),
                computed: convertAssetPropsToPlainObject(local_block.computed),
                inherited: local_block.inherited ? convertAssetPropsToPlainObject(local_block.inherited) : null,
            })
        }
        return local_asset; 
    }
    
    async convertServerWorkspaceToLocal (server_workspace: Workspace): Promise<ProjectFileDbWorkspace> {
        const local_block = await this.convertServerFileToLocal(server_workspace.props ?? {});
        const local_workspace: ProjectFileDbWorkspace = {
            ...server_workspace,
            rights: 5,
            props: convertAssetPropsToPlainObject(local_block),
        }
        return local_workspace; 
    }
    
    async markNotSyncedEntities(type: 'workspace' | 'asset', entries: {id: string, title?: string | null}[]){
        if (entries.length === 0){
            return;
        }
        await this.db.dataSource.createQueryRunner().query(`
            INSERT INTO ${type === 'workspace' ? 'workspaces' : 'assets'} (id, title, need_sync)
            VALUES ` + entries.map(i => `(?,?, ${SQLITE_NOW_STM})`).join(',') +
            ` ON CONFLICT (id) DO UPDATE SET need_sync = ${SQLITE_NOW_STM}, title = COALESCE(EXCLUDED.title, title);
        `, entries.map(ent => 
            [ent.id, ent.title ?? null]).flat());
        this.changeCurrentState({
            hasChanges: true
        })
    }

}