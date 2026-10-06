import { AiEditManager } from '~ims-app-base/logic/ai-core';
import type { IProjectDatabase } from '~ims-app-base/logic/types/IProjectDatabase';
import DesktopAiSessionStorage from './DesktopAiSessionStorage';

export default class DesktopAiEditManager extends AiEditManager {
  private _sessionChangeIds = new Set<string>();

  override async init(project_database: IProjectDatabase): Promise<void> {
    this._sessionChangeIds = new Set();
    await super.init(project_database);
    this.setSessionStorage(new DesktopAiSessionStorage(this.appManager));
  }

  protected override _trackChangeId(changeId: string): void {
    this._sessionChangeIds.add(changeId);
  }

  protected override _isChangeIdActive(changeId: string): boolean {
    return this._sessionChangeIds.has(changeId);
  }
}
