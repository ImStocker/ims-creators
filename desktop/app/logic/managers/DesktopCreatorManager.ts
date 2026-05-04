import PromptDialog from "~ims-app-base/components/Common/PromptDialog.vue";
import AuthManager from "~ims-app-base/logic/managers/AuthManager";
import DialogManager from "~ims-app-base/logic/managers/DialogManager";
import { AppSubManagerBase, type IAppManager } from "~ims-app-base/logic/managers/IAppManager";
import { ProjectRolePulseRights, type AppLoadResult, type ProjectFullInfo } from "~ims-app-base/logic/types/ProjectTypes";
import { assert } from "~ims-app-base/logic/utils/typeUtils";
import type { LocalProjectInitInfo } from "#bridge/api/ImsHostProject";
import DesktopProjectManager from "./DesktopProjectManager";
import * as node_path from 'path';
import SyncStoreCore from "~ims-app-base/logic/types/SyncStoreCore";
import ApiManager from "~ims-app-base/logic/managers/ApiManager";
import CreatorAssetManager from "~ims-app-base/logic/managers/CreatorAssetManager";
import ProjectManager from "~ims-app-base/logic/managers/ProjectManager";
import ProjectSettingsManager from '~ims-app-base/logic/managers/ProjectSettingsManager';
import type { Workspace } from "~ims-app-base/logic/types/Workspaces";
import { DesktopCreatorAssetManager } from "./DesktopCreatorAssetManager";
import DesktopUiManager from "./DesktopUiManager";
import UiManager from "~ims-app-base/logic/managers/UiManager";

const PROJECT_META_INDEX = '.imsc/index.json';

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

    async renameInProjectList(local_path: string){
        const changing_project = this.recentProjects.find(p => p.localPath === local_path);
        if(!changing_project) return;

        const new_title = await this.appManager
            .get(DialogManager)
            .show(PromptDialog, {
                header: this.appManager.$t('desktop.menu.renameProject'),
                message: this.appManager.$t('desktop.welcome.projectName'),
                yesCaption: this.appManager.$t('common.dialogs.rename'),
                value: changing_project.title ?? '',
        });
        if (new_title) {
            this.addToProjectListIfNotAdded({...changing_project, title: new_title});
            await window.imshost.fs.writeFile(node_path.join(local_path, PROJECT_META_INDEX), Buffer.from(JSON.stringify({
                id: changing_project.id,
                title: new_title,
                inited: null
            }), 'utf-8'))  
        }
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
}

    