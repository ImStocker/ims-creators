import { FileSystemService } from "./services/FileSystemService";
import { AssetService } from "./services/AssetService";
import { WorkspaceService } from "./services/WorkspaceService";
import { ProjectService } from "./services/ProjectService";
import { assert } from "~ims-app-base/logic/utils/typeUtils";
import fs from 'node:fs';
import path from 'node:path';
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
import type { AssetReferenceEntity, AssetShort } from "~ims-app-base/logic/types/AssetsType";
import type { AssetProps, AssetPropsPlainObject } from "~ims-app-base/logic/types/Props";
import type { AssetCommentDTO } from "~ims-app-base/logic/types/CommentTypes";
import type { SyncCurrentState } from "#bridge/types/SyncTypes";
import { LOCAL_ROOT_WORKSPACE_ID } from "#bridge/utils/cloud-root";
import { isValidBigNumberKey } from "~ims-app-base/logic/utils/big-number-key";

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
  props: AssetProps,
  computed: AssetProps,
  inherited: AssetProps | null,
  /**
   * Transient cache-validity marker: when this block's `computed` was last
   * (re)computed. Kept only in memory on full-computed assets — never
   * serialized to file or sent to consumers.
   */
  computedAt?: string,
  delete?: true,
}

export type ProjectFileDbAsset = AssetShort & {
  localName?: string;
  typeIds: string[];
  parentIds: string[];
  ownTitle: string | null;
  ownIcon: string | null;
  blocks: ProjectFileDbAssetBlock[]
  comments: AssetCommentDTO[];
  references: AssetReferenceEntity[];
  lastViewedAt?: string | null;
  /**
   * When this file's claim on its id was asserted (entity creation or
   * conflict-resolution stamp). Content-carried so it travels with copies —
   * see meta/devdocs/desktop-id-claim.md. Stored under `__meta` on disk.
   */
  idClaimedAt?: number | null;
  /**
   * Transient cache-validity marker: when this asset's full form (blocks +
   * inheritance) was last recomputed. Only kept in memory on full-computed
   * assets — never serialized to file or sent to consumers.
   */
  computedAt?: string;
};

export type ProjectFileDbWorkspace = {
  id: string;
  title: string;
  name: string | null;
  parentId: string | null;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  rights: number;
  index: number | null;
  props: AssetPropsPlainObject;
  unread?: number;
  localName?: string;
  /**
   * When this file's claim on its id was asserted (entity creation or
   * conflict-resolution stamp). Content-carried so it travels with copies —
   * see meta/devdocs/desktop-id-claim.md. Stored top-level on disk.
   */
  idClaimedAt?: number | null;
};

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

const RootGddFolder: ProjectFileDbWorkspace = {
  "id": LOCAL_ROOT_WORKSPACE_ID,
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

export class ProjectFileDb {
  private _info: ProjectFileDbInfo | null = null;
  private _initing: Promise<void> | null = null;
  private _initQueue: Promise<void> = Promise.resolve();
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

  public RootGddFolder = { ...RootGddFolder }

  constructor(localPath: string) {
    this.localPath = path.normalize(localPath);
    if (this.localPath[this.localPath.length - 1] === '/' || this.localPath[this.localPath.length - 1] === '\\') {
      this.localPath = this.localPath.substring(0, this.localPath.length - 1);
    }
  }

  get isDestroying() {
    return !!this._destroying;
  }

  private async _initImpl(initParams?: ProjectFileDbInitParams) {
    await fs.promises.mkdir(path.join(this.localPath, PROJECT_META_FOLDER), {
      recursive: true
    });

    let need_recreate = !!initParams?.recreate;
    if (!need_recreate) {
      try {
        const projectInfoText = await fs.promises.readFile(path.join(this.localPath, PROJECT_META_INDEX), 'utf-8')
        const projectInfo = JSON.parse(projectInfoText);
        this._info = {
          id: projectInfo.id && isValidBigNumberKey(projectInfo.id) ? projectInfo.id : '',
          title: projectInfo.title,
          inited: projectInfo.inited,
          rootWorkspaceId: projectInfo.rootWorkspaceId
        }
      } catch (err: any) {
        if (!/^ENOENT:/.test(err.message)) {
          throw err;
        }
        need_recreate = true;
      }
    }

    if (need_recreate) {
      const title = initParams?.title ?? this.localPath.split(/[\\/]/).pop() ?? '';
      this._info = {
        id: initParams?.id ?? '',
        title,
        inited: true,
        rootWorkspaceId: initParams?.rootWorkspaceId ?? null
      }
      await this._writeProjectIndex()
    }
    assert(this._info);

    this.api.init(getMainTokenStorage())
    if (this._info.id) {
      this.api.setCurrentProjectId(this._info.id);
      this.RootGddFolder.projectId = this._info.id;
    }
    this.RootGddFolder.localName = '';
    // Bound projects run on the server root id persisted in index.json;
    // local-only ones always fall back to the placeholder — never inherit a
    // previously bound instance's server id (unlink re-init must reset it).
    this.RootGddFolder.id = this._info.rootWorkspaceId ?? LOCAL_ROOT_WORKSPACE_ID;

    // DataSource first: migrations must run before the filesystem load so the
    // id-claim registry exists while conflicts are being resolved.
    this._dataSource = getProjectDataSource(this.localPath);
    await this._dataSource.initialize();

    await this._dataSource.runMigrations({
      transaction: 'all',
    });

    await this.fileSystem.init()
    await this.fileSystem.registerIdClaims();

    await this.sync.init();
    this.settings.init();
    if (this._info.id && isValidBigNumberKey(this._info.id)) {
      // Entities loaded from disk never pass through ProjectFileDbTransaction,
      // so register them for sync here — this is what makes binding a local
      // folder to a cloud project (and opening an already-bound one) work.
      await this.sync.ensureEntitiesRegistered();
    }
  }

  async init(initParams?: ProjectFileDbInitParams) {
    // Serialize init calls through a queue:
    //  - an init that arrives while a destroy is in flight (e.g. a project
    //    reload racing a cloud-bind recreate) waits it out instead of throwing
    //    "Cannot init destroying ProjectFileDb" — that error pushed callers to
    //    request a second ProjectFileDb for the same path, which kept a stale
    //    RootGddFolder id alive and made sync upload the placeholder root id;
    //  - a queued init joins the result of an already-running init (params and
    //    all) rather than racing a second _initImpl over the same files.
    const run = async (): Promise<void> => {
      while (this._destroying) {
        await this._destroying.catch(() => {});
      }
      if (initParams?.recreate) {
        await this.destroy();
        this._destroying = null;
        this._initing = null;
      }
      if (!this._initing) {
        this._initing = this._initImpl(initParams).catch(err => {
          this._initing = null;
          throw err;
        })
      }
      return this._initing;
    };
    const result = this._initQueue.then(run, run);
    this._initQueue = result.then(() => {}, () => {});
    return result;
  }


  private async _destroyImpl() {
    if (!this._info) {
      return;
    }
    await this.fileSystem.destroy();
    this.sync.destroy();
    this.settings.destroy();
    if (this._dataSource) {
      await this._dataSource.destroy();
      this._dataSource = null;
    }
    this._info = null;
    // An init waiting on this destroy must start a fresh _initImpl instead of
    // joining the now-destroyed one.
    this._initing = null;
  }

  async destroy() {
    if (!this._destroying) {
      // Clear the flag as soon as the destroy settles (success or failure) so
      // isDestroying only ever reflects an in-flight destroy — init() waits on
      // this promise and would loop forever otherwise.
      const destroying = this._destroyImpl().finally(() => {
        if (this._destroying === destroying) {
          this._destroying = null;
        }
      });
      this._destroying = destroying;
    }
    return this._destroying;
  }

  async renameTitle(title: string): Promise<void> {
    assert(this._info, 'ProjectFileDb is not inited');
    this._info.title = title;
    await this._writeProjectIndex();
  }

  /**
   * Persist `_info` (id / title / rootWorkspaceId) atomically: a concurrent
   * load must never read a half-written index.json — a torn read throws on
   * JSON.parse and the project fails to open.
   */
  private async _writeProjectIndex(): Promise<void> {
    assert(this._info, 'ProjectFileDb is not inited');
    const target = path.join(this.localPath, PROJECT_META_INDEX);
    const tmp = target + '.tmp';
    await fs.promises.writeFile(tmp, JSON.stringify(this._info), 'utf-8');
    await fs.promises.rename(tmp, target);
  }

  get info() {
    assert(this._info, 'ProjectFileDb is not inited');
    return this._info;
  }

  get dataSource(): DataSource {
    assert(this._dataSource, 'ProjectDb is not inited');
    return this._dataSource;
  }

  export(workspaceId: string, targetPath: string) {

  }

  sendProjectChange(changes: ProjectContentChangeEventArg) {
    sendEventToProjectDbWindows(this.localPath, 'contentChange', [changes])
  }

  sendSyncState(changes: SyncCurrentState) {
    sendEventToProjectDbWindows(this.localPath, 'syncState', [changes])
  }
}