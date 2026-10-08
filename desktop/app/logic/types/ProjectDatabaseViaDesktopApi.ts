import type { AssetHistoryDTO } from '~ims-app-base/logic/types/AssetHistory';
import type {
  AssetQueryWhere,
  AssetsShortResult,
  AssetsFullResult,
  AssetsGraph,
  AssetCreateDTO,
  AssetWhereParams,
  AssetDeleteResultDTO,
  CreateRefDTO,
  AssetReferencesResult,
  AssetChangeDTO,
  AssetsChangeResult,
  AssetMoveParams,
  AssetMoveResult,
  AssetsBatchChangeResultDTO,
} from '~ims-app-base/logic/types/AssetsType';
import type {
  IProjectDatabase,
  IProjectDatabaseEventHandler,
  IProjectDatabaseCommentEventArgs,
  IProjectDatabaseCommentEventHandler,
  ProjectContentChangeEventArg,
} from '~ims-app-base/logic/types/IProjectDatabase';
import type {
  ApiRequestList,
  ApiResultListWithTotal,
  ApiResultListWithMore,
} from '~ims-app-base/logic/types/ProjectTypes';
import type {
  AssetProps,
  AssetPropsPlainObject,
} from '~ims-app-base/logic/types/Props';
import type { AssetPropsSelection } from '~ims-app-base/logic/types/PropsSelection';
import type {
  WorkspaceQueryDTOWhere,
  Workspace,
  ChangeWorkspaceRequest,
  WorkspaceMoveParams,
  WorkspaceMoveResult,
} from '~ims-app-base/logic/types/Workspaces';
import { assert } from '~ims-app-base/logic/utils/typeUtils';
import type ApiManager from '~ims-app-base/logic/managers/ApiManager';
import type DesktopProjectManager from '../managers/DesktopProjectManager';
import { io } from 'socket.io-client';

export class ProjectDatabaseViaDesktopApi implements IProjectDatabase {
  constructor(
    private _projectManager: DesktopProjectManager,
    private _apiManager: ApiManager,
    private _changesWsLink: string,
  ) {}
  assetsChangeUndo(
    params: { changeId: string },
    options?: { pid?: string },
  ): Promise<AssetsChangeResult> {
    const info = this._projectManager.getProjectInfo();
    assert(info?.localPath, 'Project is not selected');
    return window.imshost.project.assetsChangeUndo(
      info.localPath,
      params,
      options,
    );
  }

  assetsChangeBatch(
    params: { ops: AssetChangeBatchOpDTO[] },
    options?: { pid?: string },
  ): Promise<AssetsBatchChangeResultDTO> {
    const info = this._projectManager.getProjectInfo();
    assert(info?.localPath, 'Project is not selected');
    return window.imshost.project.assetsChangeBatch(
      info.localPath,
      params,
      options,
    );
  }

  assetsGetShort(
    query: ApiRequestList<AssetQueryWhere>,
  ): Promise<AssetsShortResult> {
    const info = this._projectManager.getProjectInfo();
    assert(info?.localPath, 'Project is not selected');
    return window.imshost.project.assetsGetShort(info.localPath, query);
  }

  assetsGetFull(
    query: ApiRequestList<AssetQueryWhere>,
  ): Promise<AssetsFullResult> {
    const info = this._projectManager.getProjectInfo();
    assert(info?.localPath, 'Project is not selected');
    return window.imshost.project.assetsGetFull(info.localPath, query);
  }

  assetsGraph(query: ApiRequestList<AssetQueryWhere>): Promise<AssetsGraph> {
    const info = this._projectManager.getProjectInfo();
    assert(info?.localPath, 'Project is not selected');
    return window.imshost.project.assetsGraph(info.localPath, query);
  }

  assetsGetView<T extends AssetProps>(
    query: AssetPropsSelection,
    options?: { folded: false },
  ): Promise<ApiResultListWithTotal<T>>;
  assetsGetView<T extends AssetPropsPlainObject>(
    query: AssetPropsSelection,
    options: { folded: true } | { folded: boolean },
  ): Promise<ApiResultListWithTotal<T>>;
  assetsGetView<T extends AssetPropsPlainObject>(
    query: AssetPropsSelection,
    options?: { folded: boolean },
  ): Promise<ApiResultListWithTotal<T>> {
    const info = this._projectManager.getProjectInfo();
    assert(info?.localPath, 'Project is not selected');
    if (options?.folded) {
      return window.imshost.project.assetsGetView(
        info.localPath,
        query,
        options,
      );
    } else {
      return window.imshost.project.assetsGetView<AssetProps>(
        info.localPath,
        query,
      ) as Promise<ApiResultListWithTotal<T>>;
    }
  }

  assetsCreate(params: AssetCreateDTO): Promise<AssetsChangeResult> {
    const info = this._projectManager.getProjectInfo();
    assert(info?.localPath, 'Project is not selected');
    return window.imshost.project.assetsCreate(info.localPath, params);
  }

  assetsChange(
    params: AssetChangeDTO,
    options?: { pid?: string },
  ): Promise<AssetsChangeResult> {
    const info = this._projectManager.getProjectInfo();
    assert(info?.localPath, 'Project is not selected');
    return window.imshost.project.assetsChange(info.localPath, params, options);
  }

  assetsMove(params: AssetMoveParams): Promise<AssetMoveResult> {
    const info = this._projectManager.getProjectInfo();
    assert(info?.localPath, 'Project is not selected');
    return window.imshost.project.assetsMove(info.localPath, params);
  }

  assetsDelete(
    where: AssetWhereParams,
    options?: { pid?: string },
  ): Promise<AssetDeleteResultDTO> {
    const info = this._projectManager.getProjectInfo();
    assert(info?.localPath, 'Project is not selected');
    return window.imshost.project.assetsDelete(info.localPath, where, options);
  }

  assetsRestore(
    where: AssetWhereParams,
    options?: { pid?: string },
  ): Promise<AssetsChangeResult> {
    const info = this._projectManager.getProjectInfo();
    assert(info?.localPath, 'Project is not selected');
    return window.imshost.project.assetsRestore(info.localPath, where, options);
  }

  assetsCreateRef(params: CreateRefDTO): Promise<AssetReferencesResult> {
    const info = this._projectManager.getProjectInfo();
    assert(info?.localPath, 'Project is not selected');
    return window.imshost.project.assetsCreateRef(info.localPath, params);
  }

  assetsDeleteRef(params: CreateRefDTO): Promise<{ ids: string[] }> {
    const info = this._projectManager.getProjectInfo();
    assert(info?.localPath, 'Project is not selected');
    return window.imshost.project.assetsDeleteRef(info.localPath, params);
  }

  assetsGetHistory(
    assetId: string,
  ): Promise<ApiResultListWithMore<AssetHistoryDTO>> {
    const info = this._projectManager.getProjectInfo();
    assert(info?.localPath, 'Project is not selected');
    return window.imshost.project.assetsGetHistory(info.localPath, assetId);
  }

  workspacesGet(
    query: ApiRequestList<WorkspaceQueryDTOWhere>,
  ): Promise<ApiResultListWithTotal<Workspace>> {
    const info = this._projectManager.getProjectInfo();
    assert(info?.localPath, 'Project is not selected');
    return window.imshost.project.workspacesGet(info.localPath, query);
  }

  workspacesCreate(params: ChangeWorkspaceRequest): Promise<Workspace> {
    const info = this._projectManager.getProjectInfo();
    assert(info?.localPath, 'Project is not selected');
    return window.imshost.project.workspacesCreate(info.localPath, params);
  }

  getAssetLocalPath(asset_id: string): Promise<string | null> {
    const info = this._projectManager.getProjectInfo();
    assert(info?.localPath, 'Project is not selected');
    return window.imshost.project.getAssetLocalPath(info.localPath, asset_id);
  }

  getWorkspaceLocalPathFolder(workspace_id: string): Promise<string | null> {
    const info = this._projectManager.getProjectInfo();
    assert(info?.localPath, 'Project is not selected');
    return window.imshost.project.getWorkspaceLocalPath(
      info.localPath,
      workspace_id,
    );
  }

  workspacesChange(
    workspace_id: string,
    params: ChangeWorkspaceRequest,
  ): Promise<Workspace> {
    const info = this._projectManager.getProjectInfo();
    assert(info?.localPath, 'Project is not selected');
    return window.imshost.project.workspacesChange(
      info.localPath,
      workspace_id,
      params,
    );
  }

  workspacesDelete(workspace_id: string): Promise<void> {
    const info = this._projectManager.getProjectInfo();
    assert(info?.localPath, 'Project is not selected');
    return window.imshost.project.workspacesDelete(
      info.localPath,
      workspace_id,
    );
  }

  workspacesMove(params: WorkspaceMoveParams): Promise<WorkspaceMoveResult> {
    const info = this._projectManager.getProjectInfo();
    assert(info?.localPath, 'Project is not selected');
    return window.imshost.project.workspacesMove(info.localPath, params);
  }

  subscribeEvents(
    pid: string,
    callback: (changes: ProjectContentChangeEventArg) => void,
  ): IProjectDatabaseEventHandler {
    window.subscribeContentChange(
      async (payload: ProjectContentChangeEventArg) => {
        callback(payload);
      },
    );

    const listening_comments = new Map<
      string,
      {
        callback: (ev: IProjectDatabaseCommentEventArgs) => void;
        handler: IProjectDatabaseCommentEventHandler;
      }[]
    >();
    let is_connected = false;

    const socket =
      pid && this._changesWsLink
        ? io(this._changesWsLink, {
            query: {
              projectId: pid,
            },
            auth: (cb) => {
              this._apiManager.getTokenOrRefresh().then(
                (res) => {
                  cb({
                    token: res,
                  });
                },
                (err) => {
                  console.error(err);
                  cb({});
                },
              );
            },
          })
        : null;

    socket?.on('connect', () => {
      is_connected = true;
      listenContentImpl([...listening_comments.keys()]);
    });

    socket?.on('disconnect', () => {
      is_connected = false;
    });

    socket?.on(
      'commentChange',
      async (payload: IProjectDatabaseCommentEventArgs) => {
        const listeners = listening_comments.get(payload.cId);
        if (listeners) {
          for (const listener of listeners) {
            listener.callback(payload);
          }
        }
      },
    );

    function listenContentImpl(comment_ids: string[]) {
      if (comment_ids.length === 0) {
        return;
      }
      if (is_connected) {
        socket?.emit('listenContent', {
          aIds: [],
          wIds: [],
          cIds: comment_ids,
        });
      }
    }

    return {
      cancel: () => {
        socket?.disconnect();
      },
      isConnected() {
        return is_connected;
      },
      listenContent: (_asset_ids: string[], _workspace_ids: string[]) => {},
      listenComment: (
        comment_id: string,
        callback: (ev: IProjectDatabaseCommentEventArgs) => void,
      ): IProjectDatabaseCommentEventHandler => {
        const exists = listening_comments.get(comment_id);
        const record = {
          handler: {
            cancel: () => {
              const exists = listening_comments.get(comment_id);
              if (!exists) {
                return;
              }
              const ind = exists.indexOf(record);
              if (ind >= 0) exists.splice(ind, 1);
            },
          },
          callback,
        };
        if (!exists) {
          listenContentImpl([comment_id]);
          listening_comments.set(comment_id, [record]);
        } else {
          exists.push(record);
        }
        return record.handler;
      },
    };
  }
}
