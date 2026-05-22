import { SyncCurrentStateStatus, type SyncCurrentState } from "#bridge/types/SyncTypes";
import type { SyncInfo } from "#logic/types/SyncTypes";
import { AppSubManagerBase } from "~ims-app-base/logic/managers/IAppManager";
import ProjectManager from "~ims-app-base/logic/managers/ProjectManager";
import UiPreferenceManager from "~ims-app-base/logic/managers/UiPreferenceManager";
import type { ProjectFullInfo } from "~ims-app-base/logic/types/ProjectTypes";
import { assert } from '~ims-app-base/logic/utils/typeUtils';

export default class DesktopSyncManager extends AppSubManagerBase {
    private _currentSyncState: SyncCurrentState = {
        status: SyncCurrentStateStatus.FREE,
        hasChanges: false,
        error: null,
    }

    init(){
        window.subscribeSyncState((val: SyncCurrentState) => {
            this._currentSyncState = val;
        });
    }

    destroy(){
    }

    get autoSyncingTime(){
        return this.appManager
            .get(UiPreferenceManager)
            .getPreference('settings.syncWithCloud', 60);
    }

    getCurrentSyncState(): SyncCurrentState  {
        return this._currentSyncState;
    }

    async initForProject(project: ProjectFullInfo | null) {
        if (!project){
            return;
        }
        assert(project?.localPath, 'project local path is not set');
        this._currentSyncState = await window.imshost.sync.getCurrentSyncState(project.localPath);
    }

    async getSyncErrors(): Promise<SyncInfo> {
        const local_path = this.appManager.get(ProjectManager).getProjectInfo()?.localPath;
        assert(local_path, 'local_path is not set');
        return await window.imshost.sync.getSyncErrors(local_path);
    }

    async runSync(){
        const local_path = this.appManager.get(ProjectManager).getProjectInfo()?.localPath; 
        if(local_path){
            await window.imshost.sync.syncProject(local_path);
        }
    }

    async pauseSyncProject(){
        const local_path = this.appManager.get(ProjectManager).getProjectInfo()?.localPath; 
        if(local_path){
            await window.imshost.sync.pauseSyncProject(local_path);
        }
    }

    async resumeSyncProject(){
        const local_path = this.appManager.get(ProjectManager).getProjectInfo()?.localPath; 
        if(local_path){
            await window.imshost.sync.resumeSyncProject(local_path);
        }
    }

    async resyncAssetsAndWorkspaces(asset_ids: string[], workspace_ids: string[]){
        const local_path = this.appManager.get(ProjectManager).getProjectInfo()?.localPath; 
        if(local_path){
            await window.imshost.sync.resyncAssetsAndWorkspaces(local_path, asset_ids,workspace_ids);
        }
    }

    async resyncAll(){
        const local_path = this.appManager.get(ProjectManager).getProjectInfo()?.localPath; 
        if(local_path){
            await window.imshost.sync.resyncAll(local_path);
        }
    }

    async changeAutoSynchronization(new_val: number){
        const local_path = this.appManager.get(ProjectManager).getProjectInfo()?.localPath; 
        if(local_path){
            await window.imshost.sync.changeAutoSynchronization(local_path, new_val);
        }
    }
}