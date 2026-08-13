import AppManager from '~ims-app-base/logic/managers/AppManager';
import ApiManager from '~ims-app-base/logic/managers/ApiManager';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import AuthManager from '~ims-app-base/logic/managers/AuthManager';
import DialogManager from '~ims-app-base/logic/managers/DialogManager';
import UiPreferenceManager from '~ims-app-base/logic/managers/UiPreferenceManager';
import DesktopCreatorManager from './DesktopCreatorManager';
import ProjectManager from '~ims-app-base/logic/managers/ProjectManager';
import CreatorAssetManager from '~ims-app-base/logic/managers/CreatorAssetManager';
import type { BaseAppConfiguration } from '~ims-app-base/logic/configurations/base-app-configuration';
import CommentManager from '~ims-app-base/logic/managers/CommentManager';
import type { AppManagerContext } from '~ims-app-base/logic/managers/IAppManager';
import PluginManager from '~ims-app-base/logic/managers/Plugin/PluginManager';
import EditorManager from '~ims-app-base/logic/managers/EditorManager';
import ProjectContentManager from '~ims-app-base/logic/managers/ProjectContentManager';
import GlobalStateManager from '~ims-app-base/logic/managers/GlobalStateManager';
import ExportFormatManager from '~ims-app-base/logic//managers/ExportFormatManager';
import LocalFsSyncManager from '~ims-app-base/logic/managers/LocalFsSyncManager';
import DesktopUiManager from './DesktopUiManager';
import DesktopProjectManager from './DesktopProjectManager';
import { ProjectDatabaseViaDesktopApi } from '../types/ProjectDatabaseViaDesktopApi';
import type { IApiTokenStorage } from '~ims-app-base/logic/managers/ApiWorker';
import { DesktopEditorManager } from './DesktopEditorManager';
import DesktopExportFormatManager from './DesktopExportFormatManager';
import FileManager from '~ims-app-base/logic/managers/FileManager';
import DesktopFileManager from './DesktopFileManager';

import pluginBase from '~ims-plugin-base/index';
import pluginCreators from '~ims-plugin-creators/index';
import TaskManager from '~ims-app-base/logic/managers/TaskManager';
import DesktopTaskManager from './DesktopTaskManager';
import DesktopProjectContentManager from './DesktopProjectContentManager';
import DesktopUpdateManager from './DesktopUpdateManager';
import DesktopPluginManager from './DesktopPluginManager';
import DesktopAuthManager from './DesktopAuthManager';
import ProjectSettingsManager from '~ims-app-base/logic/managers/ProjectSettingsManager';
import DesktopProjectSettingsManager from './DesktopProjectSettingsManager';
import DesktopSyncManager from './DesktopSyncManager';
import DesktopLocalFsSyncManager from './DesktopLocalFsSyncManager';
import { DesktopCreatorAssetManager } from './DesktopCreatorAssetManager';
import AiManager from '~ims-app-base/logic/ai-core/AiManager';
import { AiEditManager } from '~ims-app-base/logic/ai-core';
import DesktopAiEditManager from './DesktopAiEditManager';
import DesktopAiManager from './DesktopAiManager';

export function createApiTokenStorage(
  context: AppManagerContext,
): IApiTokenStorage {
  return window.imsToken;
}

export default function createDesktopAppManager(
  context: AppManagerContext,
  $appConfiguration: BaseAppConfiguration,
): AppManager {
  const app_manager = new AppManager(context, $appConfiguration);
  const apiManager = new ApiManager(app_manager);
  app_manager.register(apiManager);
  app_manager.register(AuthManager, new DesktopAuthManager(app_manager));
  app_manager.register(
    DesktopCreatorManager,
    new DesktopCreatorManager(app_manager),
  );
  app_manager.register(
    CreatorAssetManager,
    new DesktopCreatorAssetManager(app_manager),
  );
  const desktopProjectManager = new DesktopProjectManager(app_manager);
  app_manager.register(ProjectManager, desktopProjectManager);
  app_manager.register(DesktopProjectManager, desktopProjectManager);
  const desktopUiManager = new DesktopUiManager(app_manager);
  app_manager.register(UiManager, desktopUiManager);
  app_manager.register(DesktopUiManager, desktopUiManager);
  app_manager.register(
    UiPreferenceManager,
    new UiPreferenceManager(app_manager),
  );
  app_manager.register(new DialogManager(app_manager));
  app_manager.register(new CommentManager(app_manager));
  app_manager.register(
    LocalFsSyncManager,
    new DesktopLocalFsSyncManager(app_manager),
  );
  app_manager.register(PluginManager, new DesktopPluginManager(app_manager));
  app_manager.register(EditorManager, new DesktopEditorManager(app_manager));
  app_manager.register(new DesktopUpdateManager(app_manager));
  app_manager.register(new DesktopSyncManager(app_manager));
  app_manager.register(
    ExportFormatManager,
    new DesktopExportFormatManager(app_manager),
  );
  const desktopProjectContentManager = new DesktopProjectContentManager(
    app_manager,
  );
  app_manager.register(ProjectContentManager, desktopProjectContentManager);
  app_manager.register(new GlobalStateManager(app_manager));
  app_manager.register(TaskManager, new DesktopTaskManager(app_manager));
  app_manager.register(
    ProjectSettingsManager,
    new DesktopProjectSettingsManager(app_manager),
  );
  app_manager.register(FileManager, new DesktopFileManager(app_manager));

  const aiManager = new DesktopAiManager(app_manager);
  app_manager.register(AiManager, aiManager);

  app_manager.register(AiEditManager, new DesktopAiEditManager(app_manager));

  const project_database = new ProjectDatabaseViaDesktopApi(
    desktopProjectManager,
  );

  app_manager.addInitRoutine(async () => {
    await app_manager.get(ApiManager).init(createApiTokenStorage(context));
    await app_manager.get(LocalFsSyncManager).init();

    await desktopUiManager.init(context);
    await app_manager.get<DesktopAuthManager>(AuthManager).init();
    await app_manager.get(DesktopCreatorManager).init();
    await app_manager.get(ProjectManager).init();
    await app_manager
      .get<DesktopCreatorAssetManager>(CreatorAssetManager)
      .init(project_database, true);
    await app_manager.get(AiEditManager).init(project_database);
    await app_manager.get(ExportFormatManager).init();
    await app_manager.get(DesktopSyncManager).init();
    await app_manager.get(PluginManager).init();
    await aiManager.initClient();
  });

  app_manager.addInitRoutine(async () => {
    await app_manager.get(PluginManager).activateInternalPlugin(pluginBase());
    await app_manager
      .get(PluginManager)
      .activateInternalPlugin(pluginCreators());

    await app_manager.get(PluginManager).activateSavedPlugins();
  });

  app_manager.addStateRoutine({
    key: 'assets',
    load: (state) => app_manager.get(CreatorAssetManager).loadState(state),
    save: () => app_manager.get(CreatorAssetManager).saveState(),
  });

  app_manager.addStateRoutine({
    key: 'globalState',
    load: (state) => app_manager.get(GlobalStateManager).loadState(state),
    save: () => app_manager.get(GlobalStateManager).saveState(),
  });

  return app_manager;
}
