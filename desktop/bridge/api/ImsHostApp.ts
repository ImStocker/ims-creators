import { ImsHostBase } from './ImsHostBase';
import { app } from 'electron'
import { storageGetKey, storageSetKey } from "../../electron/storage";
import log from 'electron-log/main';
import { MainAppControllerInstance, type MainSupportedLang } from '../../electron/main-app-controller';

export class ImsHostApp extends ImsHostBase{
  private _currentLanguage: string | undefined;
    
  async getLanguage(): Promise<string> {
    return MainAppControllerInstance.getLanguage();
  }

  async setLanguage(lang: string) {
    await MainAppControllerInstance.setLanguage(lang as MainSupportedLang);
  }

  async getLogFileLocation(): Promise<string | null> {
    return log.transports.file.getFile()?.path ?? null;
  }

  async exit(){
    app.exit();
  }
}
