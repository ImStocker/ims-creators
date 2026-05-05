import LocalFsSyncManager from '../../../../ims-app-base/app/logic/managers/LocalFsSyncManager';
import { ImsHostSyncTarget } from '../local-fs-sync/targets/ImsHostSyncTarget';
import ProjectManager from '../../../../ims-app-base/app/logic/managers/ProjectManager';

export default class DesktopLocalFsSyncManager extends LocalFsSyncManager {
  get projectPath() {
    return this.appManager.get(ProjectManager).getProjectInfo()?.localPath
  }
    
  override createFsSyncTarget(rootDirPath: string) {
    return new ImsHostSyncTarget(rootDirPath)
  }

  override async requestDirHandle(): Promise<any | null> {
    const res = await window.imshost.fs.showSelectDirectoryDialog();
    if (res.canceled) return null
    return res.filePaths[0];
  }

  override async getDirHandle(key: string): Promise<FileSystemDirectoryHandle | undefined> {
    if (!this.projectPath) return;
    return await window.imshost.settings.getKey(this.projectPath, key);
  }

  override async saveDirHandle(key: string, rootDirHandle: any): Promise<void> {
    if (!this.projectPath) return;
    await window.imshost.settings.setKey(this.projectPath, key, rootDirHandle);
  }
}