import AuthManager from "~ims-app-base/logic/managers/AuthManager";
import { AppSubManagerBase, type IAppManager } from "~ims-app-base/logic/managers/IAppManager";
import { ProjectRolePulseRights, type AppLoadResult, type ProjectFullInfo } from "~ims-app-base/logic/types/ProjectTypes";
import { assert } from "~ims-app-base/logic/utils/typeUtils";
import type { LocalProjectInitInfo } from "#bridge/api/ImsHostProject";
import DesktopProjectManager from "./DesktopProjectManager";
import SyncStoreCore from "~ims-app-base/logic/types/SyncStoreCore";
import ApiManager from "~ims-app-base/logic/managers/ApiManager";
import CreatorAssetManager from "~ims-app-base/logic/managers/CreatorAssetManager";
import ProjectManager from "~ims-app-base/logic/managers/ProjectManager";
import ProjectSettingsManager from '~ims-app-base/logic/managers/ProjectSettingsManager';
import type { Workspace } from '~ims-app-base/logic/types/Workspaces';
import { DesktopCreatorAssetManager } from "./DesktopCreatorAssetManager";
import DesktopUiManager from "./DesktopUiManager";
import UiManager from "~ims-app-base/logic/managers/UiManager";
import DesktopSyncManager from "./DesktopSyncManager";

export const PENDING_PROJECT_RENAMED_TOAST_KEY =
  'pending-project-renamed-toast';

export default class DesktopCreatorManager extends AppSubManagerBase{
    isLoaded = false;
    protected _loadedForProjectId: string | null = null;
    protected _loadedForProjectShortLink: string | null = null;
    protected _loadedData: AppLoadResult | null = null;

    protected _recentProjectsStore: SyncStoreCore;
    protected _loadedForProjectPath: string | null = null;

    private recentProjects: LocalProjectInitInfo[] = [];

     constructor(appManager: IAppManager) {
       super(appManager);
   
       this._recentProjectsStore = new SyncStoreCore({
         storageGetter: async () =>
           window.imshost.storage.getItem('recent'),
         storageSetter: async (val: any) =>
           window.imshost.storage.setItem('recent', val),
       });
     }

     async init(): Promise<void> {
        await this._recentProjectsStore.init()
        this.recentProjects = this._recentProjectsStore.getKey<LocalProjectInitInfo[]>('projects', []);
     }
     
    async appLoadData(project: { id?: string; shortLink?: string; } | null): Promise<AppLoadResult> {
        let is_loaded = this.isLoaded;
        const norm_local_path = project?.id ? project?.id.replaceAll("\\", "/") : null;0
        if (is_loaded) {
            is_loaded =
                (project && norm_local_path === this._loadedForProjectPath) ||
                (!project && !this._loadedForProjectPath);
        }
        if (is_loaded && this._loadedData) return this._loadedData;

        let local_project_info: LocalProjectInitInfo | null = null;
        const user_info = this.appManager.get(AuthManager).getUserInfo();

        const app_data: AppLoadResult = {
            invitations: [],
            newsPopupId: null,
            project: null,
            projects:[],
            role: null,
            subscribers: {
                isSubscribed: false,
                total: 0
            },
            unreadNotificationsCount: 0
        }

        if (project){
            assert(norm_local_path);
            local_project_info = await this.appManager.get(DesktopProjectManager).initializeLocalProject(norm_local_path);
            this.addToProjectListIfNotAdded(local_project_info);
        }   

        if (local_project_info){
            if (!app_data.project){ 
                app_data.project = await window.imshost.project.loadProjectInfo(local_project_info.localPath);
            }
            else {
                app_data.project.localPath = local_project_info.localPath;
            }
            if (!app_data.role){
                app_data.role = {
                    isAdmin: true,
                    num: 1,
                    pulseRights: ProjectRolePulseRights.ADMIN,
                    title: 'Admin',
                    rolesAssign: []
                }
            }
        }

        return app_data;
    }

    appActivate(appInfo: AppLoadResult, localPath: string): void {
        const norm_local_path = localPath.replaceAll("\\", "/");

        if (this.isLoaded && (this._loadedForProjectPath === norm_local_path)) {
            return;
        }

        // NOTE: Все операции происходят синхронно, чтобы во время
        // смены проекта не ломался рендер страниц, зависящих от projectInfo

        this.isLoaded = false;
        if (appInfo.project) {
            this.appManager.get(ApiManager).setCurrentProjectId(appInfo.project.id);
        } else {
            this.appManager.get(ApiManager).setCurrentProjectId(null);
        }
        this.appManager.get(CreatorAssetManager).currentProjectUnload();
        this.appManager
            .get(ProjectManager)
            .setCurrentProjectInfo(appInfo.project ?? null, appInfo.role ?? null);
        if (appInfo.project) {
            this.appManager
            .get(CreatorAssetManager)
            .updateWorkspacesCache(appInfo.project.rootWorkspaces);
        }
        this.appManager.get(CreatorAssetManager).initForProject(appInfo.project);
        this.appManager.get(DesktopSyncManager).initForProject(appInfo.project);
        this.appManager
          .get(ProjectSettingsManager)
          .setCurrentProjectSettings(appInfo.project?.settings ?? null);

        this._loadedForProjectId = appInfo.project ? appInfo.project.id : null;
        this._loadedForProjectShortLink = appInfo.project
            ? appInfo.project.shortLink
            : null;
        this._loadedData = appInfo;
        this.isLoaded = true;
        this._loadedForProjectPath = norm_local_path;
    }


   async openProjectWindow(localPath: string, closeCurrent = true){
        await window.imshost.window.openNew({
            localPath: localPath
        })
        
        if (closeCurrent){
            await window.imshost.window.close();
        }
    }

    getRecentProjectList(){
        return this.recentProjects.filter(project => project.localPath);
    }

    addToProjectListIfNotAdded(project: LocalProjectInitInfo){
        const index = this.recentProjects.findIndex(p => p.localPath === project.localPath);
        if(index === -1){
            this.recentProjects.unshift(project);
        }
        else {
            this.recentProjects.splice(index, 1);
            this.recentProjects.unshift(project);
        }
        this._addProjectToRecent('projects', this.recentProjects);
    }

    async renameCurrentProject(title: string, renameFolder: boolean): Promise<void> {
        const old_path_norm = this._loadedForProjectPath;
        assert(old_path_norm, 'Project is not loaded');

        const project_info = this.appManager.get(ProjectManager).getProjectInfo();
        const old_local_path = project_info?.localPath ?? old_path_norm;

        if (project_info?.id) {
            await this.appManager
                .get(DesktopProjectManager)
                .renameCloudProject(project_info.id, title);
        }

        const res = await window.imshost.project.renameProject(
            old_path_norm,
            title,
            renameFolder,
        );

        this.removeFromProjectList(old_local_path);

        await this._recentProjectsStore.awaitSave();

        await window.imshost.storage.setItem('last-project', res.localPath);
        await window.imshost.storage.setItem(
            PENDING_PROJECT_RENAMED_TOAST_KEY,
            true,
        );

        await this.openProjectWindow(res.localPath, true);
    }

    async moveCurrentProject(targetPath: string): Promise<void> {
        const old_path_norm = this._loadedForProjectPath;
        assert(old_path_norm, 'Project is not loaded');

        const project_info = this.appManager.get(ProjectManager).getProjectInfo();
        const old_local_path = project_info?.localPath ?? old_path_norm;

        const res = await window.imshost.project.moveProject(
            old_path_norm,
            targetPath,
        );

        this.removeFromProjectList(old_local_path);
        this.addToProjectListIfNotAdded({
            id: res.id,
            title: res.title,
            localPath: res.localPath,
        });

        await this._recentProjectsStore.awaitSave();

        await window.imshost.storage.setItem('last-project', res.localPath);

        await this.openProjectWindow(res.localPath, true);
    }

    async renameProjectInList(
        local_path: string,
        title: string,
        renameFolder: boolean,
    ): Promise<void> {
        if (await window.imshost.project.isProjectOpened(local_path)) {
            throw new Error(
                this.appManager.$t('desktop.settings.project.projectOpened'),
            );
        }

        const res = await window.imshost.project.renameProject(
            local_path,
            title,
            renameFolder,
        );

        await window.imshost.project.closeProject(res.localPath);

        this.removeFromProjectList(local_path);
        this.addToProjectListIfNotAdded({
            id: res.id,
            title: res.title,
            localPath: res.localPath,
        });

        await this._recentProjectsStore.awaitSave();
    }

    async moveProjectInList(
        local_path: string,
        targetPath: string,
    ): Promise<void> {
        if (await window.imshost.project.isProjectOpened(local_path)) {
            throw new Error(
                this.appManager.$t('desktop.settings.project.projectOpened'),
            );
        }

        const res = await window.imshost.project.moveProject(
            local_path,
            targetPath,
        );

        await window.imshost.project.closeProject(res.localPath);

        this.removeFromProjectList(local_path);
        this.addToProjectListIfNotAdded({
            id: res.id,
            title: res.title,
            localPath: res.localPath,
        });

        await this._recentProjectsStore.awaitSave();
    }

    removeFromProjectList(path: string){
        const index = this.recentProjects.findIndex(project => project.localPath === path);
        if(index > -1){
            this.recentProjects.splice(index, 1);
        }
        this._addProjectToRecent('projects', this.recentProjects);
    }

    private _getProjectFromRecent<T>(name: string, def: T): T {
        if (!this._recentProjectsStore.inited) return def;
        return this._recentProjectsStore.getKey(name, def);
    }

    private _addProjectToRecent<T>(name: string, val: T): void {
        if (!this._recentProjectsStore.inited) return;
        this._recentProjectsStore.setKey(name, val);
    }

    async appReload() {
        const local_path = this._loadedForProjectPath
        if (!local_path){
            throw new Error('App was not loaded')
        }
        this.isLoaded = false;
        const project_ref =
            this._loadedForProjectId || this._loadedForProjectShortLink
            ? {
                id: this._loadedForProjectId ?? undefined,
                shortLink: this._loadedForProjectShortLink ?? undefined,
                }
            : null;
        this._loadedForProjectPath = null;
        this._loadedForProjectId = null;
        this._loadedForProjectShortLink = null;
        this._loadedData = null;
        const appInfo = await this.appLoadData(project_ref);
        this.appActivate(appInfo, local_path);
    }

    async connectToCloudProject(new_project_info: ProjectFullInfo){
        let rootWorkspaceId = null
        if (new_project_info){
            rootWorkspaceId = new_project_info.rootWorkspaces.find((w: Workspace) => w.name === 'gdd')?.id;
        }
        assert(this._loadedForProjectPath)
        await this.appManager.get(DesktopSyncManager).resyncAll(); // Mark all object to be synced
        await this.appManager.get(DesktopProjectManager).initializeLocalProject(this._loadedForProjectPath, {
            id: new_project_info.id ?? null,
            title: new_project_info.title,
            rootWorkspaceId: rootWorkspaceId ?? null,
            recreate: true,
        });
        const project_info = this.appManager.get(DesktopProjectManager).getProjectInfo()
        assert(project_info)
        Object.assign(project_info, new_project_info, {
            localPath: project_info.localPath
        })      
        this.appManager.get<DesktopCreatorAssetManager>(CreatorAssetManager).setProjectIdToFiles(project_info.id);
        await this.appManager.get(UiManager).reloadPage();
    }

    async unlinkCloudProject(){
        const project_info = this.appManager.get(DesktopProjectManager).getProjectInfo()
        assert(project_info)
        assert(this._loadedForProjectPath)

        await this.appManager.get(DesktopSyncManager).changeAutoSynchronization(-1);

        await this.appManager.get(DesktopProjectManager).initializeLocalProject(
            this._loadedForProjectPath,
            {
                id: null,
                title: project_info.title,
                rootWorkspaceId: null,
                recreate: true,
            }
        );

        await this.appManager.get(UiManager).reloadPage();
    }
}

    