import type { AssetHistoryDTO } from "~ims-app-base/logic/types/AssetHistory";
import type { AssetQueryWhere, AssetsShortResult, AssetsFullResult, AssetsGraph, AssetCreateDTO, AssetWhereParams, AssetDeleteResultDTO, CreateRefDTO, AssetReferencesResult, AssetChangeDTO, AssetsChangeResult, AssetMoveParams, AssetMoveResult, AssetChangeBatchOpDTO, AssetsBatchChangeResultDTO } from "~ims-app-base/logic/types/AssetsType";
import type { IProjectDatabase, IProjectDatabaseEventHandler, ProjectContentChangeEventArg } from "~ims-app-base/logic/types/IProjectDatabase";
import type { ApiRequestList, ApiResultListWithTotal, ApiResultListWithMore } from "~ims-app-base/logic/types/ProjectTypes";
import type { AssetProps, AssetPropsPlainObject } from "~ims-app-base/logic/types/Props";
import type { AssetPropsSelection } from "~ims-app-base/logic/types/PropsSelection";
import type { WorkspaceQueryDTOWhere, Workspace, ChangeWorkspaceRequest, WorkspaceMoveParams, WorkspaceMoveResult } from "~ims-app-base/logic/types/Workspaces";
import { assert } from "~ims-app-base/logic/utils/typeUtils";
import type DesktopProjectManager from "../managers/DesktopProjectManager";

export class ProjectDatabaseViaDesktopApi implements IProjectDatabase {
  constructor(private _projectManager: DesktopProjectManager) {
    
  }
  assetsChangeUndo(params: { changeId: string; }, options?: { pid?: string; }): Promise<AssetsChangeResult> {

    const info = this._projectManager.getProjectInfo();
    assert(info?.localPath, 'Project is not selected');
    return window.imshost.project.assetsChangeUndo(info.localPath, params, options); 
   }
   
  assetsChangeBatch(params: { ops: AssetChangeBatchOpDTO[]; }, options?: { pid?: string; }): Promise<AssetsBatchChangeResultDTO> {

    const info = this._projectManager.getProjectInfo();
    assert(info?.localPath, 'Project is not selected');
    return window.imshost.project.assetsChangeBatch(info.localPath, params, options);
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
    if (options?.folded){
      return window.imshost.project.assetsGetView(info.localPath, query, options);
    }
    else {
      return window.imshost.project.assetsGetView<AssetProps>(info.localPath, query) as Promise<ApiResultListWithTotal<T>>
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
    return window.imshost.project.getWorkspaceLocalPath(info.localPath, workspace_id); 
  }

  workspacesChange(
    workspace_id: string,
    params: ChangeWorkspaceRequest,
  ): Promise<Workspace> {
    const info = this._projectManager.getProjectInfo();
    assert(info?.localPath, 'Project is not selected');
    return window.imshost.project.workspacesChange(info.localPath, workspace_id, params);
  }

  workspacesDelete(workspace_id: string): Promise<void> {
    const info = this._projectManager.getProjectInfo();
    assert(info?.localPath, 'Project is not selected');
    return window.imshost.project.workspacesDelete(info.localPath, workspace_id);
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

    return {
      cancel: () => {},
      isConnected() {
        return false;
      },
      listenContent: (asset_ids: string[], workspace_ids: string[]) => {},
      listenComment: () => ({
        cancel: () => {}
      })
    }
  }
}
