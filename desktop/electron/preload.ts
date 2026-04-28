import type { ImsHostIpcCallbackCall, ImsHostIpcCallbackResult, ImsHostIpcListenerEvent } from '#bridge/types/IImsHost';
import type { SyncCurrentState } from '#bridge/types/SyncTypes';
import type { UpdateNewVersion } from '#logic/types/AutoUpdateTypes';
import type { ContextBridge, IpcRenderer, IpcRendererEvent, WebUtils } from 'electron';
import type { IApiTokenStorage, TokenMainSavedData } from '~ims-app-base/logic/managers/ApiWorker';
import type { ProjectContentChangeEventArg } from '~ims-app-base/logic/types/IProjectDatabase';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ipcRenderer, contextBridge, webUtils } :
      { ipcRenderer: IpcRenderer, contextBridge: ContextBridge, webUtils: WebUtils} = require('electron');

let inited = false;
let initPromiseResolve!: () => void;
let initPromiseReject!: (err: Error) => void
const initPromise = new Promise<void>((res, rej) =>{ 
  initPromiseResolve = res;
  initPromiseReject = rej;
})

ipcRenderer.on('init', async (_ev: IpcRendererEvent) => {
  if (!inited) {
    try {
      inited = true;
      const imshost = {} as any;

      const imshostIndex = (await ipcRenderer.invoke('imshost-index')) as {
        [api: string]: string[];
      };

      for (const [api, methods] of Object.entries(imshostIndex)) {
        imshost[api] = Object.fromEntries(
          methods.map((method) => {
            return [
              method,
              async (...args: unknown[]) => {
                const answer = await ipcRenderer.invoke('imshost-call', api, method, args);
                if (answer.error) throw new Error(answer.error);
                return answer.result;
              },
            ];
          }),
        );
      }

      const callbacksMap = new Map<number, (...args: any[]) => any>();
      ipcRenderer.on('imshost-callback-call', async (event: IpcRendererEvent, eventData: ImsHostIpcCallbackCall) => {
        const callback = callbacksMap.get(eventData.callbackId);
        let callbackResult: ImsHostIpcCallbackResult = {
            callbackId: eventData.callbackId,
            invokeId: eventData.invokeId,
            result: null,
            error: null
        }
        try {
          if (!callback) throw new Error('ImsHost callback id ' + eventData.callbackId + ' is not registered')
          const result = await callback(...eventData.args);
          callbackResult.result = result;
        }
        catch (err: any){
          callbackResult.error = err.message;
        }
        ipcRenderer.send('imshost-callback-result', callbackResult)
      })


      contextBridge.exposeInMainWorld('imshostRaw', imshost);
      contextBridge.exposeInMainWorld('imshostOnCallbackCall', (id: number, callback: (...args: any[]) => any): (() => void) => {
        callbacksMap.set(id, callback);
        return () => callbacksMap.delete(id);
      });
      contextBridge.exposeInMainWorld('imshostSendEvent', (listenerId: number, args: any[]) => {
        ipcRenderer.send('imshost-listener-event', {
          listenerId,
          args
        } as ImsHostIpcListenerEvent)
      });
      initPromiseResolve();
    }
    catch (err: any){
      initPromiseReject(err);
    }
  }

  ipcRenderer.send('init-done');
});

contextBridge.exposeInMainWorld('loadImshost', () => initPromise);
contextBridge.exposeInMainWorld('imsGetPathForFile',
  async (file: File) => {
    return webUtils.getPathForFile(file);
  }
);

contextBridge.exposeInMainWorld('requestNewVersionAvailable',
  (func: (version: UpdateNewVersion | null) => void) => {
    ipcRenderer.on('new-version-available', 
      async (event: IpcRendererEvent, new_version: UpdateNewVersion | null) =>
        await func(new_version)
    );
  }
);


contextBridge.exposeInMainWorld('imsToken',{
    getMain(){
      return ipcRenderer.sendSync('imsTokenGetMain')
    },
    async clear(){
      await ipcRenderer.invoke('imsTokenClear')
    },
    async getRefreshToken(){
      return await ipcRenderer.invoke('imsTokenGetRefreshToken')
    },
    async save(main: TokenMainSavedData, token: string | undefined){
      await ipcRenderer.invoke('imsTokenSave', {
        main,
        token
      })
    }
  } as IApiTokenStorage
);

contextBridge.exposeInMainWorld('subscribeContentChange', (callback: (changes: ProjectContentChangeEventArg) => void) => {
    ipcRenderer.on('contentChange', (event, changes) => {
      callback(changes)
    });
  }
)

contextBridge.exposeInMainWorld('subscribeSyncState', (callback: (state: SyncCurrentState) => void) => {
    ipcRenderer.on('syncState', (event, state: SyncCurrentState) => {
      callback(state)
    });
  }
)