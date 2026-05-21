import { app, BrowserWindow, net, protocol, dialog } from 'electron';
import type { WindowArgs } from '#bridge/types/WindowArgs';
import { createWindow } from './window';
import { initImsHostApi } from './imshost-api';
import { installExtension } from 'electron-devtools-installer';
import { pathToFileURL } from "node:url"
import autoUpdateManager from './auto-update-manager';

const VUEDEVTOOLS_ID = 'nhdogjmejiglipccpnnnanhbledajbpd';

import log from 'electron-log/main';
import { closeAllProjectDb } from './project-file-db/project-registry';
import { initMainTokenStorage } from './main-token-storage';
import { MainAppControllerInstance } from './main-app-controller';

function getDefaultWindowArgs(): WindowArgs {
  return {
    localPath: '',
  };
}

async function initApp(){

  try{
    log.transports.file.level = 'info';
    log.initialize({
      spyRendererConsole: true
    });

    log.log("Start app")

    process.on('unhandledRejection', (reason, p) => {
      log.error(reason, 'Unhandled Rejection at Promise', p);
      dialog.showErrorBox("Error", 'Unhandled Rejection: ' + reason);
    })
    process.on('uncaughtException',  (error) => {
      log.error(error)
      dialog.showErrorBox("Error", error.message);
    });
    
    protocol.registerSchemesAsPrivileged([
      { 
        scheme: 'localfile', 
        privileges: { 
          stream: true,    
          bypassCSP: true, 
          secure: true,
          supportFetchAPI: true 
        } 
      }
    ]);

    app.on('window-all-closed', async () => {
      await closeAllProjectDb()
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    await app.whenReady().then(async () => {
      log.log("App ready")

      await MainAppControllerInstance.init();

      initImsHostApi();
      await initMainTokenStorage();

      protocol.handle('localfile', async (request) => {
        try {
          let file_path_match = request.url.match(/^localfile:\/\/(.*)$/);
          if(!file_path_match) return new Response(`Error`, { status: 404 });
          const file_path = decodeURIComponent(file_path_match[1]);
          const file_url = pathToFileURL(file_path).toString()
          return net.fetch(file_url);
        } catch (err) {
          log.error(err)
          return new Response(`Error: ${err}`, { status: 404 });
        }
      });

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow(getDefaultWindowArgs());
        }
      });

      if (process.env.VITE_DEV_SERVER_URL) {
        await installExtension({
          id: VUEDEVTOOLS_ID
        })
        .then((ext) => console.log(`Added Extension:  ${ext.name}`))
        .catch((err) => console.log('An error occurred: ', err))
      }

      await createWindow(getDefaultWindowArgs());

      if (!process.env.VITE_DEV_SERVER_URL) {
        autoUpdateManager.checkNewVersion(); // Do not await 
      }
    });

    log.log("App init done")
  }
  catch (err: any){
      console.error(err.message)
      log.error(err);
      dialog.showErrorBox("Error", err.message);
      app.quit();
  }

}

initApp()