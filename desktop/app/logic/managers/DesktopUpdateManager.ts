import DialogManager from '~ims-app-base/logic/managers/DialogManager';
import { AppSubManagerBase } from '~ims-app-base/logic/managers/IAppManager';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import * as node_path from 'path';
import DesktopUiManager from './DesktopUiManager';
import UiPreferenceManager from '~ims-app-base/logic/managers/UiPreferenceManager';
import { UpdateStatus, type UpdateNewVersion } from '#logic/types/AutoUpdateTypes';
import { assert } from '~ims-app-base/logic/utils/typeUtils';

export default class DesktopUpdateManager extends AppSubManagerBase {
  statusOfUpdate: UpdateStatus = UpdateStatus.NONE;
  statusOfDownload: number = 0;
  newVersion: UpdateNewVersion | null = null;
  pathToUpdateDownload: string | null = null;
  abortDownloadController: AbortController | null = null;
  private _macCheckUpdateInterval: NodeJS.Timeout | null = null;
  private _lastErrorMessage: string | null = null;

  get isAutoCheckingUpdateEnabled(){
    return this.appManager
      .get(UiPreferenceManager)
      .getPreference('settings.autoUpdateCheck', true);
  }

  async checkAndShowNewVersion() {
    this.newVersion = await window.imshost.autoUpdate.getNewVersionAvailable();
    if (this.newVersion) {
      this.statusOfUpdate = UpdateStatus.AVAILABLE;
      this.showDialogNewVersionAvailable(); // No await
    } else {
      window.requestNewVersionAvailable(
        (new_version: UpdateNewVersion | null) => {
          if (new_version) {
            this.newVersion = new_version;
            this.statusOfUpdate = UpdateStatus.AVAILABLE;
            this.showDialogNewVersionAvailable(); // No await
          }
        },
      );
    }
  }

  async startDownloadUpdateFile() {
    if (!this.newVersion) return;
    this._lastErrorMessage = null;
    this.statusOfDownload = 0;
    if (process.platform === 'darwin') {
      window.imshost.autoUpdate.downloadUpdate(); // no wait
      if (this._macCheckUpdateInterval) {
        clearInterval(this._macCheckUpdateInterval);
      }
      this._macCheckUpdateInterval = setInterval(async () => {
        const update_status =
          await window.imshost.autoUpdate.autoUpdateGetStatus();
        this.statusOfDownload = Math.round(update_status.downloadingPercent);
        if (update_status.downloadingDone) {
          this._downloadingDone();
        } else if (update_status.error) {
          this._downloadingError(update_status.error);
        }
      }, 1000);
    } else {
      const download_path = await window.imshost.shell.getDownloadFolder();
      const application_path = node_path.join(
        download_path,
        this.newVersion['path'],
      );
      const select_res = await window.imshost.fs.showSaveFileDialog({
        defaultPath: application_path,
        filters: [{ name: 'EXE', extensions: ['exe'] }],
      });
      if (select_res.canceled) return false;
      if (!select_res.filePath) return false;
      this.pathToUpdateDownload = select_res.filePath;

      this._downloadUpdateFileImplForWin(); // no wait
    }

    this.appManager
      .get(UiManager)
      .showSuccess(this.appManager.$t('desktop.about.newVersionDownload'));
    this.statusOfUpdate = UpdateStatus.DOWNLOADING;
    return true;
  }

  async _downloadUpdateFileImplForWin() {
    try {
      const new_version = this.newVersion;
      if (!new_version) return;

      const new_version_file = new_version.files[0];
      const save_to_temp = this.pathToUpdateDownload + '.tmp';
      this.abortDownloadController = new AbortController();
      const downloaded = await window.imshost.fs.downloadFile(
        `https://imsc.space/desktop/releases/${new_version_file.url}`,
        save_to_temp,
        {
          progressCallback: (progress: number) => {
            this.statusOfDownload = new_version_file.size ? Math.round(
              (progress * 100) / new_version_file.size,
            ) : 0
          },
          abortSignal: this.abortDownloadController.signal,
        },
      );
      if (!downloaded) {
           this.statusOfUpdate = UpdateStatus.AVAILABLE;
           return;
      }
      const downloaded_file_hash = await window.imshost.fs.hashFile(
        save_to_temp,
        'sha512',
        'base64',
      );
      if (downloaded_file_hash === new_version_file.sha512) {
        assert(this.pathToUpdateDownload);
        await window.imshost.fs.renameFile(
          save_to_temp,
          node_path.basename(this.pathToUpdateDownload.replaceAll("\\", "/")),
          true,
        );
        this._downloadingDone();
      } else {
        throw new Error('Downloaded file is corrupted');
      }
    } catch (err: any) {
      await this._downloadingError(err.message);
    }
  }

  private async _downloadingError(err_message: string) {
    if (this._macCheckUpdateInterval) {
      clearInterval(this._macCheckUpdateInterval);
      this._macCheckUpdateInterval = null;
    }
    this.statusOfUpdate = UpdateStatus.DOWNLOAD_ERROR;
    this._lastErrorMessage = err_message;
    await this.showErrorInfoDialog();
  }

  private _downloadingDone() {
    this.statusOfDownload = 100;
    if (this._macCheckUpdateInterval) {
      clearInterval(this._macCheckUpdateInterval);
    }
    this.statusOfUpdate = UpdateStatus.DOWNLOADED;
    this.showPostDownloadDialog(); // no await
  }

  async cancelDownload() {
    if (this.abortDownloadController) {
      this.abortDownloadController.abort();
    }
    if (this._macCheckUpdateInterval) {
      clearInterval(this._macCheckUpdateInterval);
      this._macCheckUpdateInterval = null;
    }
    if (process.platform === 'darwin') {
      await window.imshost.autoUpdate.cancelUpdate();
    }
    this.statusOfUpdate = UpdateStatus.AVAILABLE;
  }

  async showDialogOfUpdateStatus() {
    if (this.statusOfUpdate === UpdateStatus.DOWNLOADED) {
      await this.showPostDownloadDialog();
    } else {
      if (this.statusOfUpdate === UpdateStatus.DOWNLOAD_ERROR) {
        await this.showErrorInfoDialog();
      } else {
        await this.showDialogNewVersionAvailable();
      }
    }
  }

  async showDialogNewVersionAvailable() {
    if (!this.newVersion) return;

    try {
      const NewVersionAvailableDialog = await import(
        '#components/Update/NewVersionAvailableDialog.vue'
      );
      await this.appManager
        .get(DialogManager)
        .show(NewVersionAvailableDialog.default);
    } catch (err) {
      this.appManager
        .get(UiManager)
        .showError(
          this.appManager.$t('desktop.about.newVersionAvailablePopup'),
        );
    }
  }

  async showErrorInfoDialog() {
    const InfoDialog = await import("#components/Update/InfoDialog.vue")
    const link_for_download = 'https://imsc.space/desktop';
    this.appManager
      .get(UiManager)
      .showError(
        this.appManager.$t('desktop.about.errorUpload') + link_for_download,
      );
    await this.appManager.get(DialogManager).show(InfoDialog.default, {
            header: this.appManager.$t('desktop.about.autoUpdateError'),
            message: this.appManager.$t('desktop.about.errorUpload'),
            errorMessage: this._lastErrorMessage,
            link: link_for_download
        })
    this.statusOfUpdate = UpdateStatus.AVAILABLE;
  }

  async showPostDownloadDialog() {
    const PostDownloadDialog = await import('#components/Update/PostDownloadDialog.vue')
        await this.appManager.get(DialogManager).show(PostDownloadDialog.default, {
            header: this.appManager.$t('desktop.about.downloadCompleted'),
            message: this.appManager.$t('desktop.about.newVersionDownloaded'),
            path: this.pathToUpdateDownload
        })
  }

  async doUpdateAfterDownloading() {
    if (process.platform === 'darwin') {
      await window.imshost.autoUpdate.quitAndInstallUpdate();
    } else {
      const new_version = this.newVersion;
      if (!new_version) return;

      const new_version_file = new_version.files[0];
      if (this.pathToUpdateDownload) {
        const downloaded_file_hash = await window.imshost.fs.hashFile(
          this.pathToUpdateDownload,
          'sha512',
          'base64',
        );
        if (downloaded_file_hash === new_version_file.sha512) {
          await window.imshost.shell.launch(this.pathToUpdateDownload);
          await this.appManager.get(DesktopUiManager).forceCloseApplication();
        } else {
          throw new Error('Downloaded file is corrupted');
        }
      }
    }
  }

  getStatus() {
    return this.statusOfUpdate;
  }

  getDownloadPercent() {
    return this.statusOfDownload;
  }
}
