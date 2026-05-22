import type { RouteLocationNamedRaw } from 'vue-router';
import type { AppManagerContext } from '~ims-app-base/logic/managers/IAppManager';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import DialogManager from '~ims-app-base/logic/managers/DialogManager';
import type { LangStr } from '~ims-app-base/logic/types/ProjectTypes';
import { DesktopTabController } from '../types/DesktopTabController';
import ConfirmDialog from '~ims-app-base/components/Common/ConfirmDialog.vue';

export default class DesktopUiManager extends UiManager {
  public tabController = new DesktopTabController(this.appManager);

  private _closeRequestedHandler: (() => void) | null = null;

  override async init(context: AppManagerContext) {
    await super.init(context);
    this._setupCloseRequestedListener();
  }

  private _setupCloseRequestedListener() {
    const handler = async () => {
      const can_close = await this.passNavigationGuards();
      if (can_close) {
        await window.imshost.window.forceClose();
      } else {
        const answer = await this.appManager
          .get(DialogManager)
          .show(
            ConfirmDialog,
            {
              header: this.appManager.$t('desktop.confirmCloseUnsavedTitle'),
              message: this.appManager.$t('desktop.confirmCloseUnsaved'),
              yesCaption: this.appManager.$t('common.dialogs.yes'),
              danger: true,
            },
          );
        if (answer) {
          await window.imshost.window.forceClose();
        }
      }
    };
    this._closeRequestedHandler = handler;
    window.subscribeCloseRequested(handler);
  }

  protected override _createBeforeUnloadHandler(): ((event: Event) => void) | null {
    return null;
  }

  async loadLanguage(){
    const saved_lang = await window.imshost.app.getLanguage();
    if (saved_lang && this.getLanguage() !== saved_lang) {
      this.setLanguage(saved_lang as LangStr);
    }
  }
  
  protected override async setLanguageSave(lang: string): Promise<void> {
    await window.imshost.app.setLanguage(lang);
  }

  override async openLink(to: RouteLocationNamedRaw, new_tab = false){
    if(new_tab){
      this.tabController.openNewTab(to);
    }
    else {
      await super.openLink(to, new_tab);
    }
  }

  override closePage() {
    const current_tab = this.tabController.currentTab;
    if (current_tab) this.tabController.removeTab(current_tab);
  }

  public async forceCloseApplication(){
      try {
          await this.appManager.destroy();
      }
      catch (err){
          console.log('UiManager::forceCloseApplication', err)
      }
      await window.imshost.app.exit();
  }
}
