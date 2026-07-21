import { AiEditManager } from '~ims-app-base/logic/ai-core';
import type { IProjectDatabase } from '~ims-app-base/logic/types/IProjectDatabase';
import type { ProjectDatabaseViaDesktopApi } from '../types/ProjectDatabaseViaDesktopApi';

export default class DesktopAiEditManager extends AiEditManager {
  private _projectDatabase: ProjectDatabaseViaDesktopApi | null = null;

  setProjectDatabase(db: ProjectDatabaseViaDesktopApi) {
    this._projectDatabase = db;
    this.rebuildCore();
  }

  protected override _getProjectDatabase(): IProjectDatabase | null {
    return this._projectDatabase;
  }
}
