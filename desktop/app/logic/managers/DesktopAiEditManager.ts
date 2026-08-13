import { AiEditManager } from '~ims-app-base/logic/ai-core';
import type { IProjectDatabase } from '~ims-app-base/logic/types/IProjectDatabase';
import DesktopAiSessionStorage from './DesktopAiSessionStorage';

export default class DesktopAiEditManager extends AiEditManager {
  override async init(project_database: IProjectDatabase): Promise<void> {
    await super.init(project_database);
    this.setSessionStorage(new DesktopAiSessionStorage(this.appManager));
  }
}
