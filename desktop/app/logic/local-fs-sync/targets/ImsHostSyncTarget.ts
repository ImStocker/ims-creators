import { SyncTargetFileNotFound, type ISyncTarget } from '~ims-app-base/logic/local-fs-sync/ISyncTarget';
import { validateTargetEntryName } from '~ims-app-base/logic/local-fs-sync/targets/validateTargetEntryName';
import path from 'node:path';

export class ImsHostSyncTarget implements ISyncTarget {
  constructor(private _basePath: string) {}

  async putFile(name: string, content: Blob): Promise<void> {
      validateTargetEntryName(name);
      const content_buffer = await content.arrayBuffer();
      const content_array = new Uint8Array(content_buffer)
      window.imshost.fs.writeFile(path.join(this._basePath, name), content_array)
    }
    async putFolder(name: string): Promise<ISyncTarget> {
      validateTargetEntryName(name);
      return new ImsHostSyncTarget(path.join(this._basePath, name));
    }
    async deleteFile(name: string): Promise<void> {
      validateTargetEntryName(name);
      try {
        await window.imshost.fs.deleteFile(path.join(this._basePath, name));
      } catch (err: any) {
        if (err.name !== 'NotFoundError') {
          throw err;
        }
      }
    }
    async deleteFolder(name: string): Promise<void> {
      validateTargetEntryName(name);
      try {
        await window.imshost.fs.deleteFolder(path.join(this._basePath, name));
      } catch (err: any) {
        if (err.name !== 'NotFoundError') {
          throw err;
        }
      }
    }
    async readTextFile(name: string): Promise<string> {
      validateTargetEntryName(name);
      let data: string;

      try {
        data = await window.imshost.fs.readTextFile(path.join(this._basePath, name));
      } catch {
        throw new SyncTargetFileNotFound(name);
      }

      return data;
    }
  
    async isEmpty() {
      debugger;
      const files = await window.imshost.fs.readDir(this._basePath);
      for (const _filePath of files) {
        return false;
      }
      return true;
    }
}