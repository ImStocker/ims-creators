import { ImsHostBase } from './ImsHostBase';
import { app } from 'electron';
import { storageGetKey, storageSetKey } from '../../electron/storage';
import log from 'electron-log/main';
import {
  MainAppControllerInstance,
  type MainSupportedLang,
} from '../../electron/main-app-controller';
import { DEFAULT_MCP_PORT } from '../../electron/mcp-server/index';

export const MCP_PORT_SETTING_KEY = 'mcpPort';
export const MCP_AUTO_START_SETTING_KEY = 'mcpAutoStart';

export class ImsHostApp extends ImsHostBase {
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

  async exit() {
    app.exit();
  }

  async getMcpPort(): Promise<number> {
    return (
      (await storageGetKey<number>(MCP_PORT_SETTING_KEY)) ?? DEFAULT_MCP_PORT
    );
  }

  async setMcpPort(port: number): Promise<void> {
    await storageSetKey(MCP_PORT_SETTING_KEY, port);
  }

  async getMcpAutoStart(): Promise<boolean> {
    return (await storageGetKey<boolean>(MCP_AUTO_START_SETTING_KEY)) ?? true;
  }

  async setMcpAutoStart(value: boolean): Promise<void> {
    await storageSetKey(MCP_AUTO_START_SETTING_KEY, value);
  }
}
