import ProjectManager from "~ims-app-base/logic/managers/ProjectManager"
import type { AssetShort } from '~ims-app-base/logic/types/AssetsType';
import type { LocalProjectInitInfo } from "#bridge/api/ImsHostProject";
import type { Workspace } from '~ims-app-base/logic/types/Workspaces';
import { convertTranslatedTitle } from "~ims-app-base/logic/utils/assets";
import axios from "axios";
import AuthManager from "~ims-app-base/logic/managers/AuthManager";
import ApiManager from "~ims-app-base/logic/managers/ApiManager";
import { HttpMethods, Service } from "~ims-app-base/logic/managers/ApiWorker";
import type { ProjectFullInfo, ProjectShortInfo, ApiResultListWithTotal } from "~ims-app-base/logic/types/ProjectTypes";
import type { ProjectFileDbInitParams } from "~~/electron/project-file-db/ProjectFileDb";
import { isValidBigNumberKey } from "~ims-app-base/logic/utils/big-number-key";
import { LOCAL_ROOT_WORKSPACE_ID, resolveCloudRootWorkspaceId } from "#bridge/utils/cloud-root";

export const availableFilenameRegexp = new RegExp("[^- А-Яа-яa-zA-Z,@.;'`!)(]+", 'g');
function prepareFileBasenameByEntityTitle(title: string){
  return title.replace(availableFilenameRegexp, '_').trim()
}

export default class DesktopProjectManager extends ProjectManager{
    private _projectLocalPath: string | null = null;
    private _projectRootWorkspaceId: string | null = null

    override getCurrentAccountValueInProject() {
        const user_info = this.appManager.get(AuthManager).getUserInfo();
        if (!user_info) return null;
        return {
            AccountId: user_info.id.toString(),
            Name: user_info.name,
        };
    }

    async createCloudProject(project_title: string){
        return await this.createProject({
                title: project_title,
                menu_settings: {
                  'menu-about': false,
                  'menu-gamedesign': true,
                  'menu-team': true,
                },
              })
    }

    async createProject({
        title,
        menu_settings,
        isPublicTasks,
    }: {
        title: string;
        menu_settings?: {
        'menu-gamedesign': boolean;
        'menu-team': boolean;
        'menu-about': boolean;
        };
        isPublicTasks?: boolean;
    }): Promise<ProjectFullInfo> {
        const timezone_shift = -new Date().getTimezoneOffset();
        const isPublicAbout = !!(menu_settings && menu_settings['menu-about']);
        const userInfo = this.appManager.get(AuthManager).getUserInfo();
        const params: any = {
            title,
            timezoneShift: timezone_shift,
            lang: userInfo?.language ? userInfo.language : 'en',
            isPublicGdd: false,
            isPublicTasks: !!isPublicTasks,
            isPublicAbout: isPublicAbout,
            isPublicPulse: isPublicAbout,
        };
        const project_info = await this.appManager
        .get(ApiManager)
        .call<ProjectFullInfo>(Service.CREATORS, HttpMethods.POST, 'app/projects', {
            ...params
        });
        //change settings of menu
        await this.appManager
        .get(ApiManager)
        .call(Service.CREATORS, HttpMethods.POST, 'assets/change', 
        {
            "where": {
                "id": project_info.settings?.id
            },
            "set": {
                "blocks": {
                    "menu-settings": {
                        "props": {
                            "menu-gamedesign": true,
                            "menu-team": true,
                            "menu-about": false,
                            "is-public-planning": false
                        }
                    }
                }
            }
        },
        {
            pid: project_info.id,
        });
        return project_info;
    }

    async initializeLocalProject(localPath: string, initParams?: ProjectFileDbInitParams): Promise<LocalProjectInitInfo> {
        const res = await window.imshost.project.initProject(localPath, initParams);
        this._projectLocalPath = localPath;
        // Every open path (first open, reload, recent list) lands here, so this
        // is where a bound-but-unresolved root gets healed — see the method
        // below. It must run before the fire-and-forget sync below, so the sync
        // never races the repair's recreate.
        const info = await this._repairUnresolvedRootWorkspace(localPath, res);
        this._projectRootWorkspaceId = info.rootWorkspaceId;
        // Recreate (cloud bind/unlink) is followed by an explicit resyncAll()
        // from the caller — skip the fire-and-forget sync so it doesn't race it.
        if(initParams?.id && !initParams?.recreate){
            window.imshost.sync.syncProject(this._projectLocalPath);
        }
        return info;
    }

    /**
     * A cloud-bound project must know the server id of its gdd root workspace:
     * entities are positioned from it at load, and while it's missing sync
     * refuses to upload the local placeholder root id (SyncService guard, see
     * bridge/utils/cloud-root.ts). Legacy projects were bound with
     * `rootWorkspaceId: null` (or the bind lookup missed) — re-resolve the root
     * from the server and recreate; on any failure keep the project as-is, the
     * sync state surfaces the paused-sync error.
     *
     * Deliberately NOT recursive: the recreate goes straight through
     * window.imshost.project.initProject, so repair runs at most once per
     * initializeLocalProject call — even if the server keeps returning nothing
     * resolvable, this cannot loop.
     */
    private async _repairUnresolvedRootWorkspace(localPath: string, info: LocalProjectInitInfo): Promise<LocalProjectInitInfo> {
        if (!info.id || !isValidBigNumberKey(info.id)) return info;
        if (info.rootWorkspaceId && info.rootWorkspaceId !== LOCAL_ROOT_WORKSPACE_ID) return info;
        try {
            const project_info = await this.appManager
                .get(ApiManager)
                .call<ProjectFullInfo>(Service.CREATORS, HttpMethods.GET, 'project/info', { pid: info.id });
            const root_workspace_id = resolveCloudRootWorkspaceId(project_info?.rootWorkspaces ?? []);
            if (!root_workspace_id) {
                console.error('Cloud project has no resolvable gdd root workspace', info.id);
                return info;
            }
            return await window.imshost.project.initProject(localPath, {
                id: info.id,
                title: info.title,
                rootWorkspaceId: root_workspace_id,
                recreate: true,
            });
        }
        catch (err: any) {
            console.error('Failed to resolve cloud root workspace:', err?.message ?? err);
            return info;
        }
    }
    
    override getAllowAnonymUsers() {
        return true;
    }

    override async exportAsset(asset: AssetShort, params?: Record<string, any>) {
        if (!this._projectLocalPath){
            throw new Error('Project is not inited')
        }
        const file_title = `${prepareFileBasenameByEntityTitle(
            convertTranslatedTitle(asset.title ?? 'untitled',(...args) => this.appManager.$t(...args))
        )}.ima.json`
        const save_dialog_res = await window.imshost.fs.showSaveFileDialog({
            defaultPath: file_title
        })
        if (save_dialog_res.canceled){
            return;
        }
    
        await window.imshost.project.exportAssetToFile(
                this._projectLocalPath,
                asset.id,
                save_dialog_res.filePath)
    }

    override async exportWorkspace(workspace: Workspace, params?: Record<string, any>): Promise<void> {
        if (!this._projectLocalPath){
            throw new Error('Project is not inited')
        }
        const file_title = `${prepareFileBasenameByEntityTitle(
            convertTranslatedTitle(workspace.title ?? 'untitled',(...args) => this.appManager.$t(...args))
        )}.zip`
        const save_dialog_res = await window.imshost.fs.showSaveFileDialog({
            defaultPath: file_title
        })
    
        if (save_dialog_res.canceled){
            return;
        }
        await window.imshost.project.exportWorkspaceToFile(
                this._projectLocalPath,
                workspace.id,
                save_dialog_res.filePath)
    }
    async importTemplateProject(template_id: string){
        if (!this._projectLocalPath){
            throw new Error('Project is not inited')
        }
        await window.imshost.project.importTemplateProject(this._projectLocalPath,template_id);
    }

    async renameCloudProject(project_id: string, title: string): Promise<void> {
        const api = this.appManager.get(ApiManager);
        const user_info = this.appManager.get(AuthManager).getUserInfo();

        const projects_res = await api.call<ApiResultListWithTotal<ProjectShortInfo>>(
            Service.CREATORS,
            HttpMethods.GET,
            'app/projects',
            {},
        );
        const found = projects_res.list.find(p => p.id === project_id);
        if (!found) {
            throw new Error(this.appManager.$t('desktop.settings.project.cloudNotFound'));
        }

        const is_admin = !!found.role?.isAdmin;
        if (!is_admin) {
            const cloud_info = await api.call<ProjectFullInfo>(
                Service.CREATORS,
                HttpMethods.GET,
                'project/info',
                { pid: project_id },
            );
            const is_owner =
                cloud_info?.projectOwnerId != null &&
                cloud_info.projectOwnerId === user_info?.id;
            if (!is_owner) {
                throw new Error(this.appManager.$t('desktop.settings.project.noPermission'));
            }
        }

        try {
            await api.call(
                Service.CREATORS,
                HttpMethods.PATCH,
                `app/projects/${project_id}`,
                { title },
            );
        } catch (err: any) {
            throw new Error(
                `${this.appManager.$t('desktop.settings.project.renameCloudFailed')}: ${err?.message ?? err}`,
            );
        }
    }

    getProjectRootWorkpaceId(){
        return this._projectRootWorkspaceId;
    }
}