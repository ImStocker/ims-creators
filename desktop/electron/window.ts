import { BrowserWindow, type IpcMainEvent, ipcMain, shell } from 'electron';
import type { WindowArgs } from '#bridge/types/WindowArgs';

import path from 'node:path';
import log from 'electron-log/main';
import { registerImsHostWindow, unregisterImsHostWindow } from './imshost-api';
import { launch } from './shell-utils';
import {
  registerWindowProjectPath,
  unregisterWindowProjectPath,
} from './project-windows';
import { releaseProjectDbForWindow } from './project-file-db/project-registry';
import { closeMcpSessionsForProject } from './mcp-server/index';

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
  registerWindowProjectPath(win, args.localPath);
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
      else if (url.startsWith('localfile://')) {
          // Attachment download (local project files): reveal the real file
          try {
              const parsed = new URL(url);
              const raw = parsed.host ? parsed.host + parsed.pathname : parsed.pathname;
              let file_path = decodeURIComponent(raw);
              if (/^\/[A-Za-z]:/.test(file_path)) file_path = file_path.substring(1);
              api.shell.showItemInFolder(file_path);
          } catch (err) {
              console.error('localfile url failed', err);
          }
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
    unregisterWindowProjectPath(win);
    // Releases this window's hold on its project DBs and its project-path
    // registration: without it the dead window stays in the registry's `for`
    // set, destroy() never runs, and the project folder (SQLite + watcher
    // handles) stays locked for as long as the app is alive. MCP sessions
    // close first, mirroring closeProject().
    releaseProjectDbForWindow(win, closeMcpSessionsForProject).catch((err) =>
      log.error('Failed to release project db for closed window:', err),
    );
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
