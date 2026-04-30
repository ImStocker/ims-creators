import LocalFsSyncManager from '../../../../ims-app-base/app/logic/managers/LocalFsSyncManager';
import SyncStoreCore from '~ims-app-base/logic/types/SyncStoreCore';
import { ImsHostSyncTarget } from '../local-fs-sync/targets/ImsHostSyncTarget';
import type { IAppManager } from '../../../../ims-app-base/app/logic/managers/IAppManager';

export default class DesktopLocalFsSyncManager extends LocalFsSyncManager {
  protected _core: SyncStoreCore;

  constructor(appManager: IAppManager) {
    super(appManager);
    this._core = new SyncStoreCore({
      storageGetter: async () =>
        window.imshost.storage.getItem('fsSync-' + 0),
      storageSetter: async (val) =>
        window.imshost.storage.setItem('fsSync-' + 0, val),
    });
  }

  override async init(): Promise<void> {
    super.init();
    await this._core.init();
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
    if (!this._core.inited) return;
    return this._core.getKey(key);
  }

  override async saveDirHandle(key: string, rootDirHandle: any): Promise<void> {
    if (!this._core.inited) return;
    this._core.setKey(key, rootDirHandle);
  }
}