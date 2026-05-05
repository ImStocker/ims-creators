import type { UpdateNewVersion } from '#logic/types/AutoUpdateTypes';
import type { IApiTokenStorage } from '~ims-app-base/logic/managers/ApiWorker';
import type { IImsHostExposed } from './bridge/types/IImsHost';
import type { ProjectContentChangeEventArg } from '~ims-app-base/logic/types/IProjectDatabase';
import type { SyncCurrentState } from '#bridge/types/SyncTypes';

declare global {
  interface Window {
    imshost: IImsHostExposed;
    imshostOnCallbackCall: (id: number, callback: (...args: any[]) => Promise<any>) => (() => void)
    imshostSendEvent: (id: number, args: any) => void,
    loadImshost: () => Promise<void>;
    imsGetPathForFile: (file: File) => Promise<string>;
    requestNewVersionAvailable: (func: (version: UpdateNewVersion | null) => void) => void;
    subscribeContentChange: (callback: (changes: ProjectContentChangeEventArg) => void) => void;
    subscribeSyncState: (callback: (state: SyncCurrentState) => void) => void;
    imsToken: IApiTokenStorage
  }
}
