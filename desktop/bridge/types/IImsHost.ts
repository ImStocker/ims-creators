import type { ImsHostAutoUpdate } from '../api/ImsHostAutoUpdate';
import type { ImsHostFs } from '../api/ImsHostFs';
import type { ImsHostProject } from '../api/ImsHostProject';
import type { ImsHostShell } from '../api/ImsHostShell';
import type { ImsHostStorage } from '../api/ImsHostStorage';
import type { ImsHostWindow } from '../api/ImsHostWindow';
import type { ImsHostApp } from '../api/ImsHostApp';
import type { ImsHostSync } from '#bridge/api/ImsHostSync';
import type ImsHostPlugin from '../api/ImsHostPlugin';
import type { ImsHostSettings } from '#bridge/api/ImsHostSettings';

export interface IImsHostApi  {
  fs: ImsHostFs;
  shell: ImsHostShell;
  window: ImsHostWindow;
  storage: ImsHostStorage;
  project: ImsHostProject;
  sync: ImsHostSync;
  autoUpdate: ImsHostAutoUpdate;
  app: ImsHostApp,
  plugin: ImsHostPlugin;
  settings: ImsHostSettings;
}

// Automatically exclude $ or _ prefixed methods in imshost apis
export type IImsHostExposed = {
  [Key in keyof IImsHostApi]: {
    [Method in Exclude<keyof IImsHostApi[Key], `\$${string}` | `_${string}`>]: IImsHostApi[Key][Method]
  }
}

export type ImsHostWrapObject = {
  'imshost@type': 'object'
  content: any
}

export type ImsHostWrapCallback = {
  'imshost@type': 'callback'
  id: number
}

export type ImsHostWrapAbortSignal = {
  'imshost@type': 'AbortSignal'
  id: number,
  aborted: boolean,
  reason: any,
}

export type ImsHostIpcCallbackCall = {
  callbackId: number,
  invokeId: number,
  args: any[]
}

export type ImsHostIpcCallbackResult = {
  callbackId: number,
  invokeId: number,
  result: any,
  error: null | string
}


export type ImsHostIpcListenerEvent = {
  listenerId: number,
  args: any[]
}


