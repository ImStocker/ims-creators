import { BrowserWindow, ipcMain, type WebUtils } from 'electron';
import { ImsHostFs } from '#bridge/api/ImsHostFs';
import type { IImsHostApi, ImsHostIpcCallbackCall, ImsHostIpcCallbackResult, ImsHostIpcListenerEvent, ImsHostWrapAbortSignal, ImsHostWrapCallback, ImsHostWrapObject } from '#bridge/types/IImsHost';
import { ImsHostShell } from '#bridge/api/ImsHostShell';
import { ImsHostWindow } from '#bridge/api/ImsHostWindow';
import { ImsHostStorage } from '#bridge/api/ImsHostStorage';
import { ImsHostProject } from '#bridge/api/ImsHostProject';
import { ImsHostApp } from '#bridge/api/ImsHostApp';
import log from 'electron-log/main';
import { ImsHostAutoUpdate } from '#bridge/api/ImsHostAutoUpdate';
import { ImsHostSync } from '#bridge/api/ImsHostSync';
import ImsHostPlugin from '../bridge/api/ImsHostPlugin';
import { ImsHostSettings } from '#bridge/api/ImsHostSettings';
import { ImsHostMcp } from '#bridge/api/ImsHostMcp';

const registeredWindows = new Map<BrowserWindow, IImsHostApi>();

function isEntryExposed(api: Record<string, unknown>, name: string){
  if (name === 'contructor') return false;
  if (name.startsWith('_') || name.startsWith('$')) return false;
  if (typeof(api[name]) !== 'function') return false;
  return true;
}

export function initImsHostApi() {

  let CallbackInvokeIdGenerator = 0;
  const registeredCallbackInvokes = new Map<number, { resolve: (res: any) => void, reject: (err: Error) => void}>();
  const registeredEventListeners = new Map<number, (...args: any[]) => void>();

  ipcMain.on('imshost-callback-result', (event, eventData: ImsHostIpcCallbackResult) => {
    const invokeData = registeredCallbackInvokes.get(eventData.invokeId);
    if (!invokeData) return;
    if (eventData.error){
      invokeData.reject(new Error(eventData.error))
    }
    else {
      invokeData.resolve(eventData.result);
    }
  })

  ipcMain.on('imshost-listener-event', (event, eventData: ImsHostIpcListenerEvent) => {
    const listener = registeredEventListeners.get(eventData.listenerId);
    if (!listener) return;
    listener(eventData.args);
  })

  function registerListener(listenerId: number, listener: (...args: any[]) => void){
    registeredEventListeners.set(listenerId, listener);
    return () => registeredEventListeners.delete(listenerId);
  }

  function prepareArg(arg: unknown, window: BrowserWindow, cancels: (() => void)[]): any{
    if (arg && typeof arg === 'object'){
      if (Array.isArray(arg)){
        return arg.map(a => prepareArg(a, window, cancels));
      }
      if (arg instanceof Uint8Array){
        return arg;
      }
      if ((arg as ImsHostWrapObject)['imshost@type'] === 'object'){
        return (arg as ImsHostWrapObject).content;
      }
      else if ((arg as ImsHostWrapCallback)['imshost@type'] === 'callback'){
        const callback_arg = (arg as ImsHostWrapCallback)
        return async function(...args: any[]){
          let resolve!: (res: any) => void;
          let reject!: (err: Error) => void;
          const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
          })
          const invokeId = ++CallbackInvokeIdGenerator;
          registeredCallbackInvokes.set(invokeId, {
            resolve,
            reject
          })
          window.webContents.send("imshost-callback-call", {
            callbackId: callback_arg.id,
            invokeId,
            args
          } as ImsHostIpcCallbackCall);
          try {
            return await promise;
          }
          finally {
            registeredCallbackInvokes.delete(invokeId);
          }
        }
      }
      else if ((arg as ImsHostWrapAbortSignal)['imshost@type'] === 'AbortSignal'){
        const source_abort = (arg as ImsHostWrapAbortSignal);
        const abortController = new AbortController();
        if (source_abort.aborted){
          abortController.abort(source_abort.reason)
        }
        const cancel = registerListener(source_abort.id, (e: { reason: any }) => {
          abortController.abort(e?.reason);
        })
        cancels.push(cancel);       

        return abortController.signal;
      }
      const transform: (entry: [string, unknown]) => [string, any] = entry =>  {
        return [entry[0], prepareArg(entry[1], window, cancels)];
      }
      return Object.fromEntries(Object.entries(arg).map(transform))
    }
    return arg;
  }

  ipcMain.handle(
    'imshost-call',
    async (event, api: string, method: string, args: any[]) => {
      const cancels:(() => void)[] = []
      try {
        const event_win = BrowserWindow.fromWebContents(event.sender);
        if (!event_win) throw new Error('Cannot retrieve window from event');
        const apiObj = registeredWindows.get(event_win) as
          | {
              [api: string]: {
                [method: string]: any;
              };
            }
          | undefined;
        if (!apiObj) throw new Error('Window is not registered');
        if (!apiObj[api]) throw new Error('Wrong api name');
        if (!isEntryExposed(apiObj[api], method)){
          throw new Error('Wrong api function name');
        }
        const prepared_args = (args ?? []).map(arg => prepareArg(arg, event_win, cancels));
        const result = await apiObj[api][method].apply(apiObj[api], prepared_args)
        return {
          result: result ?? null,
          error: null
        }
      }
      catch (err: any){
        log.error(err);
        return {
          result: null,
          error: err.message.toString(),
        }
      }
      finally{
        for (const cancel of cancels){
          cancel();
        }
      }
    },
  );
  ipcMain.handle('imshost-index', (event) => {
    const event_win = BrowserWindow.fromWebContents(event.sender);
    if (!event_win) throw new Error('Cannot retrieve window from event');
    const apiObj = registeredWindows.get(event_win) as
      | {
          [api: string]: { [method: string]: any };
        }
      | undefined;
    if (!apiObj) throw new Error('Window is not registered');

    return Object.fromEntries(
      [...Object.entries(apiObj)].map((entry) => {
        const methods = Object.getOwnPropertyNames(
          Object.getPrototypeOf(entry[1]),
        ).filter(
          (name) => isEntryExposed(entry[1], name)
        );

        return [entry[0], methods];
      }),
    );
  });
}

export function registerImsHostWindow(win: BrowserWindow): IImsHostApi {
  const api: IImsHostApi =  {
    fs: new ImsHostFs(win),
    shell: new ImsHostShell(win),
    window: new ImsHostWindow(win),
    storage: new ImsHostStorage(win),
    project: new ImsHostProject(win),
    sync: new ImsHostSync(win),
    autoUpdate: new ImsHostAutoUpdate(win),
    app: new ImsHostApp(win),
    plugin: new ImsHostPlugin(win),
    settings: new ImsHostSettings(win),
    mcp: new ImsHostMcp(win),
  }
  registeredWindows.set(win, api);
  return api;
}

export function getImsHostWindow(win: BrowserWindow): IImsHostApi | null {
  return registeredWindows.get(win) ?? null;
}

export function unregisterImsHostWindow(win: BrowserWindow) {
  registeredWindows.delete(win);
}
