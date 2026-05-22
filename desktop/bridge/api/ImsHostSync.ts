import { requestProjectDb } from "../../electron/project-file-db/project-registry";
import { ImsHostBase } from "./ImsHostBase";

export class ImsHostSync extends ImsHostBase {
    async syncProject(
        projectPath: string,
    ): Promise<void> {
        const project_db = requestProjectDb(projectPath, this._window);
        return await project_db.sync.syncProject();
    }
    
    async getCurrentSyncState(projectPath: string){
        const project_db = requestProjectDb(projectPath, this._window);
        return await project_db.sync.getCurrentSyncState();
    }

    async getSyncErrors(projectPath: string){
        const project_db = requestProjectDb(projectPath, this._window);
        return await project_db.sync.getSyncErrors();
    }

    async resyncAssetsAndWorkspaces(projectPath: string, asset_ids: string[], workspace_ids: string[]){
        const project_db = requestProjectDb(projectPath, this._window);
        return await project_db.sync.resyncAssetsAndWorkspaces(asset_ids,workspace_ids);
    }

    async resyncAll(projectPath: string){
        const project_db = requestProjectDb(projectPath, this._window);
        return await project_db.sync.resyncAll();
    }

    async pauseSyncProject(projectPath: string){
        const project_db = requestProjectDb(projectPath, this._window);
        return await project_db.sync.pauseSyncProject();
    }

    async resumeSyncProject(projectPath: string){
        const project_db = requestProjectDb(projectPath, this._window);
        return await project_db.sync.resumeSyncProject();
    }

    async changeAutoSynchronization(projectPath: string, new_val: number){
        const project_db = requestProjectDb(projectPath, this._window);
        return await project_db.sync.changeAutoSynchronization(new_val);
    }
}