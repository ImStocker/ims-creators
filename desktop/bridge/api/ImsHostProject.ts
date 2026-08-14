import type { AssetHistoryDTO } from '~ims-app-base/logic/types/AssetHistory';
import type {
  AssetQueryWhere,
  AssetsShortResult,
  AssetsFullResult,
  AssetsGraph,
  AssetCreateDTO,
  AssetsChangeResult,
  AssetWhereParams,
  AssetSetDTO,
  AssetDeleteResultDTO,
  CreateRefDTO,
  AssetReferencesResult,
  AssetMoveParams,
  AssetMoveResult,
  AssetChangeBatchOpDTO,
  AssetsBatchChangeResultDTO,
} from '~ims-app-base/logic/types/AssetsType';
import type {
  ApiRequestList,
  ApiResultListWithTotal,
  ApiResultListWithMore,
  ProjectFullInfo,
  ProjectSettingsValue,
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
import type { AiSession, AiTurn } from '~ims-app-base/logic/ai-core/AiTypes';
import {
  closeProjectDb,
  requestProjectDb,
} from '../../electron/project-file-db/project-registry';
import { ImsHostBase } from './ImsHostBase';
import type { ProjectFileDbInitParams } from '~~/electron/project-file-db/ProjectFileDb';
import {
  startMcpServer,
  closeMcpSessionsForProject,
} from '../../electron/mcp-server/index';
import { storageGetKey } from '../../electron/storage';
import { MCP_PORT_SETTING_KEY, MCP_AUTO_START_SETTING_KEY } from './ImsHostApp';
import log from 'electron-log/main';

export type LocalProjectInitInfo = {
  id: string | null;
  title: string;
  localPath: string;
};

export class ImsHostProject extends ImsHostBase {
  async initProject(
    projectPath: string,
    initParams?: ProjectFileDbInitParams,
  ): Promise<LocalProjectInitInfo> {
    const project_db = requestProjectDb(projectPath, this._window);
    await project_db.init(initParams);

    try {
      const mcp_auto_start =
        (await storageGetKey<boolean>(MCP_AUTO_START_SETTING_KEY)) ?? false;
      if (mcp_auto_start) {
        const mcp_port =
          (await storageGetKey<number>(MCP_PORT_SETTING_KEY)) ?? undefined;
        await startMcpServer(mcp_port);
      }
    } catch (e) {
      log.error('MCP: auto-start failed:', e);
    }

    return {
      ...project_db.info,
      localPath: project_db.localPath,
    };
  }

  async closeProject(projectPath: string): Promise<void> {
    await closeMcpSessionsForProject(projectPath);
    await closeProjectDb(projectPath, this._window);
  }

  async assetsGetShort(
    projectPath: string,
    query: ApiRequestList<AssetQueryWhere>,
  ): Promise<AssetsShortResult> {
    const project_db = requestProjectDb(projectPath, this._window);
    return project_db.asset.assetsGetShort(query);
  }

  async assetsGetFull(
    projectPath: string,
    query: ApiRequestList<AssetQueryWhere>,
  ): Promise<AssetsFullResult> {
    const project_db = requestProjectDb(projectPath, this._window);
    return project_db.asset.assetsGetFull(query);
  }

  async assetsGraph(
    projectPath: string,
    query: ApiRequestList<AssetQueryWhere>,
  ): Promise<AssetsGraph> {
    const project_db = requestProjectDb(projectPath, this._window);
    return project_db.asset.assetsGraph(query);
  }

  assetsGetView<T extends AssetProps>(
    projectPath: string,
    query: AssetPropsSelection,
    options?: { folded: false },
  ): Promise<ApiResultListWithTotal<T>>;
  assetsGetView<T extends AssetPropsPlainObject>(
    projectPath: string,
    query: AssetPropsSelection,
    options: { folded: true } | { folded: boolean },
  ): Promise<ApiResultListWithTotal<T>>;
  async assetsGetView<T extends AssetPropsPlainObject>(
    projectPath: string,
    query: AssetPropsSelection,
    options?: { folded: boolean },
  ): Promise<ApiResultListWithTotal<T>> {
    const project_db = requestProjectDb(projectPath, this._window);
    if (options?.folded) {
      return project_db.asset.assetsGetView<T>(query, options);
    } else {
      return project_db.asset.assetsGetView<AssetProps>(query) as Promise<
        ApiResultListWithTotal<T>
      >;
    }
  }

  async assetsCreate(
    projectPath: string,
    params: AssetCreateDTO,
  ): Promise<AssetsChangeResult> {
    const project_db = requestProjectDb(projectPath, this._window);
    return project_db.asset.assetsCreate(params);
  }

  async assetsChange(
    projectPath: string,
    params: {
      where: AssetWhereParams;
      set: AssetSetDTO;
    },
    options?: { pid?: string },
  ): Promise<AssetsChangeResult> {
    const project_db = requestProjectDb(projectPath, this._window);
    return project_db.asset.assetsChange(params, options);
  }

  async assetsDelete(
    projectPath: string,
    where: AssetWhereParams,
    options?: { pid?: string },
  ): Promise<AssetDeleteResultDTO> {
    const project_db = requestProjectDb(projectPath, this._window);
    return project_db.asset.assetsDelete(where, options);
  }

  async assetsRestore(
    projectPath: string,
    where: AssetWhereParams,
    options?: { pid?: string },
  ): Promise<AssetsChangeResult> {
    const project_db = requestProjectDb(projectPath, this._window);
    return project_db.asset.assetsRestore(where, options);
  }

  async assetsCreateRef(
    projectPath: string,
    params: CreateRefDTO,
  ): Promise<AssetReferencesResult> {
    const project_db = requestProjectDb(projectPath, this._window);
    return project_db.asset.assetsCreateRef(params);
  }

  async assetsDeleteRef(
    projectPath: string,
    params: CreateRefDTO,
  ): Promise<{ ids: string[] }> {
    const project_db = requestProjectDb(projectPath, this._window);
    return project_db.asset.assetsDeleteRef(params);
  }

  async assetsGetHistory(
    projectPath: string,
    assetId: string,
  ): Promise<ApiResultListWithMore<AssetHistoryDTO>> {
    const project_db = requestProjectDb(projectPath, this._window);
    return project_db.asset.assetsGetHistory(assetId);
  }

  async workspacesGet(
    projectPath: string,
    query: ApiRequestList<WorkspaceQueryDTOWhere>,
  ): Promise<ApiResultListWithTotal<Workspace>> {
    const project_db = requestProjectDb(projectPath, this._window);
    return project_db.workspace.workspacesGet(query);
  }

  async workspacesCreate(
    projectPath: string,
    params: ChangeWorkspaceRequest,
  ): Promise<Workspace> {
    const project_db = requestProjectDb(projectPath, this._window);
    return project_db.workspace.workspacesCreate(params);
  }

  async getAssetLocalPath(
    projectPath: string,
    asset_id: string,
  ): Promise<string> {
    const project_db = requestProjectDb(projectPath, this._window);
    return project_db.asset.getAssetLocalPath(asset_id);
  }

  async getWorkspaceLocalPath(
    projectPath: string,
    workspace_id: string,
  ): Promise<string> {
    const project_db = requestProjectDb(projectPath, this._window);
    return project_db.workspace.getWorkspaceLocalPathFolder(workspace_id);
  }

  async workspacesChange(
    projectPath: string,
    workspace_id: string,
    params: ChangeWorkspaceRequest,
  ): Promise<Workspace> {
    const project_db = requestProjectDb(projectPath, this._window);
    return project_db.workspace.workspacesChange(workspace_id, params);
  }

  async workspacesMove(
    projectPath: string,
    params: WorkspaceMoveParams,
  ): Promise<WorkspaceMoveResult> {
    const project_db = requestProjectDb(projectPath, this._window);
    return project_db.workspace.workspacesMove(params);
  }

  async workspacesDelete(
    projectPath: string,
    workspace_id: string,
  ): Promise<void> {
    const project_db = requestProjectDb(projectPath, this._window);
    return project_db.workspace.workspacesDelete(workspace_id);
  }

  async loadProjectInfo(projectPath: string): Promise<ProjectFullInfo> {
    const project_db = requestProjectDb(projectPath, this._window);
    return project_db.project.loadProjectInfo();
  }

  async loadProjectSettings(
    projectPath: string,
  ): Promise<ProjectSettingsValue> {
    const project_db = requestProjectDb(projectPath, this._window);
    return project_db.project.loadProjectSettings();
  }

  async saveProjectSettings(
    projectPath: string,
    projectSettings: ProjectSettingsValue,
  ) {
    const project_db = requestProjectDb(projectPath, this._window);
    return project_db.project.saveProjectSettings(projectSettings);
  }

  async loadAiChat(
    projectPath: string,
  ): Promise<{ sessions: AiSession[]; turns: AiTurn[] }> {
    const project_db = requestProjectDb(projectPath, this._window);
    return project_db.project.loadAiChat();
  }

  async saveAiChat(
    projectPath: string,
    data: { sessions: AiSession[]; turns: AiTurn[] },
  ): Promise<void> {
    const project_db = requestProjectDb(projectPath, this._window);
    return project_db.project.saveAiChat(data);
  }

  assetsMove(
    projectPath: string,
    params: AssetMoveParams,
  ): Promise<AssetMoveResult> {
    const project_db = requestProjectDb(projectPath, this._window);
    return project_db.asset.assetsMove(params);
  }

  assetsChangeBatch(
    projectPath: string,
    params: { ops: AssetChangeBatchOpDTO[] },
    options: { pid?: string } | undefined,
  ): Promise<AssetsBatchChangeResultDTO> {
    const project_db = requestProjectDb(projectPath, this._window);
    return project_db.asset.assetsChangeBatch(params, options);
  }

  assetsChangeUndo(
    projectPath: string,
    params: { changeId: string },
    options: { pid?: string } | undefined,
  ): Promise<AssetsChangeResult> {
    const project_db = requestProjectDb(projectPath, this._window);
    return project_db.asset.assetsChangeUndo(params, options);
  }

  exportAssetToFile(projectPath: string, assetId: string, targetPath: string) {
    const project_db = requestProjectDb(projectPath, this._window);
    return project_db.asset.exportToFile(assetId, targetPath);
  }

  exportWorkspaceToFile(
    projectPath: string,
    workspaceId: string,
    targetPath: string,
  ) {
    const project_db = requestProjectDb(projectPath, this._window);
    return project_db.workspace.exportToFile(workspaceId, targetPath);
  }

  importWorkspaceToFile(
    projectPath: string,
    workspaceId: string,
    targetPath: string,
  ) {
    const project_db = requestProjectDb(projectPath, this._window);
    return project_db.workspace.exportToFile(workspaceId, targetPath);
  }

  async importTemplateProject(projectPath: string, templateId: string) {
    const project_db = requestProjectDb(projectPath, this._window);
    return project_db.project.importTemplateProject(templateId);
  }
}
