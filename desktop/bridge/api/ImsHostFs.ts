import type {
  OpenDialogOptions,
  OpenDialogReturnValue,
  SaveDialogOptions,
  SaveDialogReturnValue,
} from 'electron';
import { dialog } from 'electron';
import { ImsHostBase } from './ImsHostBase';
import fs from 'node:fs'
import crypto from 'crypto';
import * as node_path from 'path';
import fsExtra from 'fs-extra';
import axios from 'axios';

export class ImsHostFs extends ImsHostBase {

  async writeFile(path: string, data: Uint8Array): Promise<void>{
    await fs.promises.writeFile(path, data);
  }

  async readFile(path: string): Promise<Uint8Array>{
    return await fs.promises.readFile(path)
  }

  async writeTextFile(path: string, data: string): Promise<void>{
    await fs.promises.writeFile(path, data, 'utf-8');
  }

  async readTextFile(path: string): Promise<string> {
    return await fs.promises.readFile(path, 'utf-8');
  }
  
  async stat(path: string): Promise<fs.Stats> {
    return await fs.promises.stat(path);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await fs.promises.access(path,fs.constants.F_OK);
      return true;
    }
    catch {
      return false;
    }
  }

  async mkDir(path: string, recursive: boolean = false): Promise<void>{
    await fs.promises.mkdir(path, {
      recursive
    })
  }
  
  async deleteFile(path: string): Promise<void>{
    await fs.promises.unlink(path);
  }

  async deleteFolder(path: string): Promise<void>{
    await fsExtra.remove(path)
  }

  showSelectDirectoryDialog(
    options?: OpenDialogOptions,
  ): Promise<OpenDialogReturnValue> {
    return dialog.showOpenDialog(this._window, {
      ...options,
      properties: [
        ...(options?.properties ? options.properties : []),
        'openDirectory',
      ],
    });
  }
  showSelectFileDialog(
    options?: OpenDialogOptions,
  ): Promise<OpenDialogReturnValue> {
    return dialog.showOpenDialog(this._window, {
      ...options,
      properties: [
        ...(options?.properties ? options.properties : []),
        'openFile',
      ],
    });
  }
  showSelectFilesDialog(
    options?: OpenDialogOptions,
  ): Promise<OpenDialogReturnValue> {
    return dialog.showOpenDialog(this._window, {
      ...options,
      properties: [
        ...(options?.properties ? options.properties : []),
        'openFile',
        'multiSelections',
      ],
    });
  }

  showSaveFileDialog(
    options?: SaveDialogOptions,
  ): Promise<SaveDialogReturnValue> {
    return dialog.showSaveDialog(this._window, {
      ...options,
    });
  }

  async hashValue(val: Uint8Array, hash_type?: string): Promise<string> {
    return crypto.createHash(hash_type ?? 'md5').update(val).digest('hex');
  }

  async hashFile(file_path: string, hash: 'md5' | 'sha512'  = 'md5', format: 'hex' | 'base64' = 'hex'): Promise<string> {
    const file = await fs.promises.readFile(file_path);
    return crypto.createHash(hash).update(file).digest(format);
  }

  async renameFile(filepath: string, new_filename: string, rewrite = false){
      const destination_folder = node_path.dirname(filepath);
      const new_filepath = node_path.join(destination_folder, new_filename);
      if (filepath === new_filepath){
          return;
      }
      await fsExtra.move(filepath, new_filepath, {
          overwrite: !!rewrite
      });
  }

  async downloadFile(fileUrl: string, outputLocationPath: string, options?: {
    progressCallback?: (bytes: number) => void,
    abortSignal?: AbortSignal
  }): Promise<boolean> {
      const abortSignal = options?.abortSignal;
      if (abortSignal && abortSignal?.aborted){
          return false;
      }
      const response = await axios({
          method: 'get',
          url: fileUrl,
          responseType: 'stream'
      })
      if (abortSignal && abortSignal?.aborted){
          return false;
      }
      let read_bytes = 0;
      const writer = fs.createWriteStream(outputLocationPath);
      return await new Promise<boolean>((resolve, reject) => {
          response.data.on('data', (chunk: any) => {
              read_bytes += chunk.length;
              writer.write(chunk);
              if (options?.progressCallback) {
                  options?.progressCallback(read_bytes);
              }
          })
          response.data.on('close', () => {
              writer.close();
          })
          response.data.on('error', (err: Error) => {
              if (!error && (!abortSignal || !abortSignal.aborted)) {
                  error = err;
                  writer.close();
                  reject(err);
              }
          })
          if (abortSignal && abortSignal.aborted){
              writer.close();
              resolve(false);
              return;
          }
          if (abortSignal){
            abortSignal.onabort = () => {
                response.data.destroy();
                resolve(false);
            }
          }
          let error: Error | null = null;

          writer.on('error', err => {
              if (!error && (!abortSignal || !abortSignal.aborted)) {
                  error = err;
                  writer.close();
                  reject(err);
              }
          });
          writer.on('close', () => {
              if (!error && (!abortSignal || !abortSignal.aborted)) {
                  resolve(true);
              }
          });
      });
  }
}
