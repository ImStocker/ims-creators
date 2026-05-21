import { ImsHostBase } from './ImsHostBase';
import type { WindowArgs } from '../types/WindowArgs';
import { assert } from '~ims-app-base/logic/utils/typeUtils';
import { createWindow } from '../../electron/window';

export class ImsHostWindow extends ImsHostBase{

  private _args: WindowArgs | null = null
  
  async getArgs(): Promise<WindowArgs>{
    assert(this._args, 'Window args are not passed');
    return this._args;
  }

  $setArgs(args: WindowArgs){
    this._args = args;
  }

  async show(){
    this._window.show();
  }

  async hide(){
    this._window.hide();
  }
  
  async maximizeWindow() {
    this._window.maximize();
  }

  async close(){
    this._window.close();
  }

  async forceClose(){
    (this._window as any).__forceClosing = true;
    this._window.close();
  }

  async openNew(args: WindowArgs){
    await createWindow(args);
  }
}
