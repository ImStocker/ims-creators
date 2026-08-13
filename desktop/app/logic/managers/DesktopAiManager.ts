import AiManager from '~ims-app-base/logic/ai-core/AiManager';
import type { AiSettings } from '~ims-app-base/logic/ai-core/AiSettings';

const AI_SETTINGS_STORAGE_KEY = 'aiSettings';

export default class DesktopAiManager extends AiManager {
  protected override async loadSettings(): Promise<AiSettings | null> {
    return window.imshost.storage.getItem<AiSettings>(AI_SETTINGS_STORAGE_KEY);
  }

  protected override async saveSettings(settings: AiSettings): Promise<void> {
    await window.imshost.storage.setItem(AI_SETTINGS_STORAGE_KEY, settings);
  }
}
