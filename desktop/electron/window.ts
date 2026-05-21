import { BrowserWindow, type IpcMainEvent, ipcMain, shell } from 'electron';
import type { WindowArgs } from '#bridge/types/WindowArgs';

import path from 'node:path';
import { registerImsHostWindow, unregisterImsHostWindow } from './imshost-api';
import { launch } from './shell-utils';

const preload = path.join(import.meta.dirname, 'preload.js');
const distPath = path.join(import.meta.dirname, '../dist-client/public');

async function initWindow(
  win: BrowserWindow
) {
  await new Promise<void>((resolve) => {
    const callback = (ev: IpcMainEvent) => {
      const event_win = BrowserWindow.fromWebContents(ev.sender);
      if (win !== event_win) return;
      ipcMain.off('init-done', callback);
      resolve();
    };
    ipcMain.on('init-done', callback);
    win.webContents.send('init');
  });
}

export async function createWindow(args: WindowArgs) {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 700,
    height: 720,
    show: false,
    webPreferences: {
      preload: preload
    },
  });
  if(args.localPath) {
    win.maximize();
  }
  win.removeMenu();
  
  // and load the index.html of the app.
  if (process.env.VITE_DEV_SERVER_URL) {
    await win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    await win.loadFile(path.join(distPath, 'index.html'));
  }
  
  win.webContents.on('before-input-event', (event, input) => {
      if (input.control && input.shift && input.key.toLowerCase() === 'i') {
          win.webContents.openDevTools()
          event.preventDefault()
      }
  })

  const api = registerImsHostWindow(win);
  api.window.$setArgs(args);
  if(args.localPath) {
    win.maximize();
  }

  function openUrl(url: string){
     if(url.match(/^open:\/\/folder\/(.*)/gi)){
        const folder_path = decodeURIComponent(url.substring(14)).replace(/\\/g, '/');
        launch(folder_path)
      }
      else if(url.match(/^show:\/\/file\/(.*)/gi)){
          let file_path = decodeURIComponent(url.substring(12));
          if (process.platform === 'darwin'){
              file_path = file_path.replace(/\\/g, '/');
          }
          else {
              file_path = file_path.replace(/\//g, '\\');
          }
          api.shell.showItemInFolder(file_path);
      }
      else if (url.match(/.*localhost.*/gi) === null && (url.startsWith('http:') || url.startsWith('https:'))) {
          
          shell.openExternal(url);
      }
  }

  // win.webContents.on('did-create-window');
  win.webContents.on('will-navigate', (event, url) => {
     if (url.startsWith('file://') || process.env.VITE_DEV_SERVER_URL && url.startsWith(process.env.VITE_DEV_SERVER_URL)){
       // Reload dev server page
       return;
     }
     event.preventDefault();
     openUrl(url);
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    openUrl(url);
    return { action: 'deny' }
  })

  win.once('closed', () => {
    unregisterImsHostWindow(win);
  });

  win.on('close', (e) => {
    if ((win as any).__forceClosing) {
      (win as any).__forceClosing = false;
      return;
    }
    e.preventDefault();
    win.webContents.send('close-requested');
  });

  await initWindow(win);
  win.webContents.on('did-stop-loading', () => {
    initWindow(win);
  });

  return win;
}
