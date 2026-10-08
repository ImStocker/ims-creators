import AuthManager from '~ims-app-base/logic/managers/AuthManager';
import CommentManager from '~ims-app-base/logic/managers/CommentManager';
import DialogManager from '~ims-app-base/logic/managers/DialogManager';
import ProjectManager from '~ims-app-base/logic/managers/ProjectManager';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import BuyLicenseDialog from '../../components/Sync/BuyLicenseDialog.vue';
import SyncWithCloudDialog from '../../components/Sync/SyncWithCloudDialog.vue';
import type DesktopAuthManager from '#logic/managers/DesktopAuthManager';

export default class DesktopCommentManager extends CommentManager {
  async checkChatAccess(): Promise<boolean> {
    const project_info = this.appManager.get(ProjectManager).getProjectInfo();
    if (!project_info?.id) {
      return false;
    }
    if (project_info.license?.features.desktopSync) {
      return true;
    }
    return await this._hasDesktopSyncLicense();
  }

  async requestChatSetup(): Promise<void> {
    try {
      const logged_in = await this.appManager
        .get(AuthManager)
        .ensureLoggedInDialog(
          this.appManager.$t('desktop.fsSync.menu.loginToSync'),
        );
      if (!logged_in) {
        return;
      }

      const project_info = this.appManager.get(ProjectManager).getProjectInfo();
      if (
        project_info?.license?.features.desktopSync ||
        (await this._hasDesktopSyncLicense())
      ) {
        const res = await this.appManager
          .get(DialogManager)
          .show(SyncWithCloudDialog, {});
        if (res) {
          this.appManager
            .get(UiManager)
            .showSuccess(
              this.appManager.$t(
                'desktop.fsSync.menu.syncWithCloudConnectSuccess',
              ),
            );
        }
      } else {
        await this.appManager.get(DialogManager).show(BuyLicenseDialog, {});
      }
    } catch (err: any) {
      this.appManager.get(UiManager).showError(err.message);
    }
  }

  private async _hasDesktopSyncLicense(): Promise<boolean> {
    const user_licenses = await this.appManager
      .get<DesktopAuthManager>(AuthManager)
      .getUserLicense();
    return !!user_licenses.list.find((license) => license.features.desktopSync);
  }
}
