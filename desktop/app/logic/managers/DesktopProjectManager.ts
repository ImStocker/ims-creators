import ProjectManager from "~ims-app-base/logic/managers/ProjectManager"
import type { AssetShort } from '~ims-app-base/logic/types/AssetsType';
import type { LocalProjectInitInfo } from "#bridge/api/ImsHostProject";
import type { Workspace } from '~ims-app-base/logic/types/Workspaces';
import { convertTranslatedTitle } from "~ims-app-base/logic/utils/assets";
import axios from "axios";
import AuthManager from "~ims-app-base/logic/managers/AuthManager";
import ApiManager from "~ims-app-base/logic/managers/ApiManager";
import { HttpMethods, Service } from "~ims-app-base/logic/managers/ApiWorker";
import type { ProjectFullInfo } from "~ims-app-base/logic/types/ProjectTypes";
import type { ProjectFileDbInitParams } from "~~/electron/project-file-db/ProjectFileDb";

export const availableFilenameRegexp = new RegExp("[^- А-Яа-яa-zA-Z,@.;'`!)(]+", 'g');
function prepareFileBasenameByEntityTitle(title: string){
  return title.replace(availableFilenameRegexp, '_').trim()
}

export default class DesktopProjectManager extends ProjectManager{
    private _projectLocalPath: string | null = null;

    override getCurrentAccountValueInProject() {
        const user_info = this.appManager.get(AuthManager).getUserInfo();
        if (!user_info) return null;
        return {
            AccountId: user_info.id.toString(),
            Name: user_info.name,
        };
    }

    async createProject({
        title,
        template_ids,
        menu_settings,
        init_script,
        isPublicTasks,
    }: {
        title: string;
        template_ids?: string[];
        menu_settings?: {
        'menu-gamedesign': boolean;
        'menu-team': boolean;
        'menu-about': boolean;
        };
        init_script?: string;
        isPublicTasks?: boolean;
    }): Promise<ProjectFullInfo> {
        const timezone_shift = -new Date().getTimezoneOffset();
        const isPublicAbout = !!(menu_settings && menu_settings['menu-about']);
        const userInfo = this.appManager.get(AuthManager).getUserInfo();
        const params: any = {
            title,
            timezoneShift: timezone_shift,
            templateIds: template_ids ?? [],
            lang: userInfo?.language ? userInfo.language : 'en',
            initScript: init_script,
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
        if(initParams?.id){
            await window.imshost.sync.syncProject(this._projectLocalPath);
        }
        return res;
    }

    async connectLocalProject(localProject: LocalProjectInitInfo, pid: string){

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
}