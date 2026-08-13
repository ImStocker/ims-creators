import { ImsHostBase } from './ImsHostBase';
import {
  startMcpServer,
  stopMcpServer,
  getMcpStatus,
} from '../../electron/mcp-server/index';
import { storageGetKey } from '../../electron/storage';
import { MCP_PORT_SETTING_KEY } from './ImsHostApp';

export type McpStatus = {
  running: boolean;
  port: number | null;
};

export class ImsHostMcp extends ImsHostBase {
  async getStatus(): Promise<McpStatus> {
    return getMcpStatus();
  }

  async start(): Promise<void> {
    const port = (await storageGetKey<number>(MCP_PORT_SETTING_KEY)) ?? null;
    await startMcpServer(port ?? undefined);
  }

  async stop(): Promise<void> {
    await stopMcpServer();
  }

  async restart(): Promise<void> {
    await stopMcpServer();
    const port = (await storageGetKey<number>(MCP_PORT_SETTING_KEY)) ?? null;
    await startMcpServer(port ?? undefined);
  }
}
