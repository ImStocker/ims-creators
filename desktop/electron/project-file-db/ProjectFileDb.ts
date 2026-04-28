import type { AssetReferenceEntity, AssetShort } from "~ims-app-base/logic/types/AssetsType";
import type { Workspace } from "~ims-app-base/logic/types/Workspaces";
import { FileSystemService } from "./services/FileSystemService";
import { AssetService } from "./services/AssetService";
import { WorkspaceService } from "./services/WorkspaceService";
import { ProjectService } from "./services/ProjectService";
import { assert } from "~ims-app-base/logic/utils/typeUtils";
import fs from 'node:fs';
import path from 'node:path';
import type { AssetPropsPlainObject } from "~ims-app-base/logic/types/Props";
import type { AssetCommentDTO } from "~ims-app-base/logic/types/CommentTypes";
import { ApiService } from "./services/ApiService";
import { getMainTokenStorage } from "../main-token-storage";
import { PROJECT_META_FOLDER, PROJECT_META_INDEX } from "./project-db-constants";
import { AssetRights } from "~ims-app-base/logic/types/Rights";
import type { DataSource } from "typeorm";
import { getProjectDataSource } from "./project-data-source";
import { SyncService } from "./services/SyncService/SyncService";
import type { ProjectContentChangeEventArg } from "~ims-app-base/logic/types/IProjectDatabase";
import { sendEventToProjectDbWindows } from "./project-registry";
import { SettingsService } from "./services/SettingsService";
import type { SyncCurrentState } from "#bridge/types/SyncTypes";

export type ProjectFileDbAssetBlock = {
    id: string;
    type: string;
    name: string | null;
    title: string | null;
    index: number;
    createdAt: string;
    updatedAt: string;
    ownTitle: string | null;
    own: boolean;
    props: AssetPropsPlainObject,
    computed: AssetPropsPlainObject,
    inherited: AssetPropsPlainObject | null,
    delete?: true,
}

export type ProjectFileDbAsset = AssetShort & {
    localPath?: string;    
    typeIds: string[];   
    parentIds: string[];
    ownTitle: string | null;
    ownIcon: string | null;
    blocks: ProjectFileDbAssetBlock[]
    comments: AssetCommentDTO[];
    references: AssetReferenceEntity[];
    lastViewedAt?: string | null;
};
export type ProjectFileDbWorkspace = Workspace & {
    localName?: string;
};

const RootGddFolder: ProjectFileDbWorkspace = {
    "id": "00000000-0000-0000-0000-200000000002",
    "index": null,
    "title": "[[t:Gdd]]",
    "name": "gdd",
    "parentId": null,
    "projectId": '',
    "props": {},
    createdAt: "",
    updatedAt: "",
    rights: AssetRights.WRITE_VALUES,
    unread: 0
}

export type ProjectFileDbInfo = {
    id: string;
    title: string;   
    inited: boolean;
    rootWorkspaceId: string | null
}


export type ProjectFileDbInitParams = { 
    title: string, 
    id: string | null, 
    rootWorkspaceId: string | null,
    recreate?: true
}

export class ProjectFileDb  {
    private _info: ProjectFileDbInfo | null = null;
    private _initing: Promise<void> | null = null;
    private _dataSource: DataSource | null = null;
    private _destroying: Promise<void> | null = null;

    public fileSystem = new FileSystemService(this)
    public asset = new AssetService(this)
    public workspace = new WorkspaceService(this);
    public project = new ProjectService(this);
    public api = new ApiService(this);
    public sync = new SyncService(this);
    public settings = new SettingsService(this);

    public localPath: string; // Path to root of project. No slash at the end

    public RootGddFolder =  {...RootGddFolder}

    constructor(localPath: string){
        this.localPath = path.normalize(localPath);
        if (this.localPath[this.localPath.length - 1] === '/' || this.localPath[this.localPath.length - 1] === '\\'){
            this.localPath = this.localPath.substring(0, this.localPath.length - 1);
        }
    }

    get isDestroying(){
        return !!this._destroying;
    }

    private async _initImpl(initParams?: ProjectFileDbInitParams){
        await fs.promises.mkdir(path.join(this.localPath, PROJECT_META_FOLDER), {
          recursive: true
        });

        let need_recreate = !!initParams?.recreate;
        if (!need_recreate){
            try {
            const projectInfoText = await fs.promises.readFile(path.join(this.localPath, PROJECT_META_INDEX), 'utf-8')
            const projectInfo = JSON.parse(projectInfoText);
            this._info = {
                id: projectInfo.id ?? '',
                title:projectInfo.title,
                inited: projectInfo.inited,
                rootWorkspaceId: projectInfo.rootWorkspaceId
            }
            } catch (err: any) {
                if (!/^ENOENT:/.test(err.message)){
                    throw err;
                }
                need_recreate = true;
            }
        }

        if (need_recreate){
          const title = initParams?.title ?? this.localPath.split(/[\\/]/).pop() ?? '';
          this._info = {
            id: initParams?.id ?? '',
            title,
            inited: true,
            rootWorkspaceId: initParams?.rootWorkspaceId ?? null
          }
          await fs.promises.writeFile(path.join(this.localPath, PROJECT_META_INDEX), JSON.stringify(this._info), 'utf-8')
        }
        assert(this._info);
        
        this.api.init(getMainTokenStorage())
        if (this._info.id){
            this.api.setCurrentProjectId(this._info.id);
            this.RootGddFolder.projectId = this._info.id;
        }
        this.RootGddFolder.localName ='';
        if (this._info.rootWorkspaceId){
            this.RootGddFolder.id = this._info.rootWorkspaceId
        }
        await this.fileSystem.init()

        this._dataSource = getProjectDataSource(this.localPath);
        await this._dataSource.initialize();

        await this._dataSource.runMigrations({
            transaction: 'all',
        });
        await this.sync.init();
        this.settings.init();
    }

    async init(initParams?: ProjectFileDbInitParams){
        if (this.isDestroying){
            throw new Error('Cannot init destroying ProjectFileDb');
        }
        if(initParams?.recreate) {
            await this.destroy();
            this._destroying = null;
            this._initing = null;
        }
        if (!this._initing){
            this._initing = this._initImpl(initParams).catch(err => {
                this._initing = null;
                throw err;
            })
        }
        return this._initing;
    }      


    private async _destroyImpl(){
        if (!this._info){
            return;
        }
        await this.fileSystem.destroy();
        this.sync.destroy();
        this.settings.destroy();
        this._info = null;
    }

    async destroy(){
        if (!this._destroying){
            this._destroying = this._destroyImpl().catch(err => {
                this._destroying = null;
                throw err;
            })
        }
        return this._destroying;
    }

    get info(){
        assert(this._info, 'ProjectFileDb is not inited');
        return this._info;
    }
  
    get dataSource(): DataSource {
        assert(this._dataSource, 'ProjectDb is not inited');
        return this._dataSource;
    }

    export(workspaceId: string, targetPath: string){
        
    }

    sendProjectChange(changes: ProjectContentChangeEventArg){
        this.sync.changeCurrentState({
            hasChanges: [...changes.aDelIds, ...changes.aUpsIds,...changes.wDelIds, ...changes.wUpsIds, ...changes.wTchIds].length > 0,
        })
        sendEventToProjectDbWindows(this.localPath, 'contentChange', [changes])
    }

    sendSyncState(changes: SyncCurrentState){
        sendEventToProjectDbWindows(this.localPath, 'syncState', [changes])
    }
}