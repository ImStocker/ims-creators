import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { requestProjectDb } from '../project-file-db/project-registry';
import { registerTools } from './tools';
import { registerResources } from './resources';
import log from 'electron-log/main';

const MCP_PORT = 4300;

const transports = new Map<string, StreamableHTTPServerTransport>();
const servers = new Map<string, McpServer>();

async function handleMcpPost(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', `http://localhost:${MCP_PORT}`);
  const projectPath = url.searchParams.get('path');

  if (!projectPath) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing ?path= query parameter' }));
    return;
  }

  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId && transports.has(sessionId)) {
    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req, res);
    return;
  }

  log.info(`MCP: initializing project db for: ${projectPath}`);

  let projectDb;
  try {
    projectDb = requestProjectDb(projectPath);
    await projectDb.init();
  } catch (e) {
    log.error('MCP: projectDb.init failed:', e);
    throw e;
  }

  log.info(`MCP: project db initialized, creating McpServer`);

  const mcp = new McpServer({
    name: 'ims-desktop',
    version: '1.0.0',
  });

  try {
    registerTools(mcp, projectDb);
    registerResources(mcp, projectDb);
  } catch (e) {
    log.error('MCP: registerTools/registerResources failed:', e);
    throw e;
  }

  log.info(`MCP: tools and resources registered`);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (newSessionId) => {
      log.info(`MCP session initialized: ${newSessionId}`);
      transports.set(newSessionId, transport);
      servers.set(newSessionId, mcp);
    },
  });

  transport.onclose = () => {
    const sid = transport.sessionId;
    if (sid) {
      transports.delete(sid);
      servers.delete(sid);
    }
  };

  try {
    await mcp.connect(transport);
  } catch (e) {
    log.error('MCP: mcp.connect failed:', e);
    throw e;
  }

  log.info(`MCP: mcp connected, handling request`);

  await transport.handleRequest(req, res);
}

async function handleMcpGet(req: IncomingMessage, res: ServerResponse) {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !transports.has(sessionId)) {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'This server only supports Streamable HTTP transport. Use POST.' }));
    return;
  }

  const transport = transports.get(sessionId)!;
  await transport.handleRequest(req, res);
}

async function handleMcpDelete(req: IncomingMessage, res: ServerResponse) {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !transports.has(sessionId)) {
    res.writeHead(400);
    res.end('Invalid or missing session ID');
    return;
  }

  const transport = transports.get(sessionId)!;
  await transport.handleRequest(req, res);
}

export function startMcpServer() {
  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id');
    res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      const url = new URL(req.url ?? '/', `http://localhost:${MCP_PORT}`);

      if (url.pathname === '/mcp') {
        switch (req.method) {
          case 'POST':
            await handleMcpPost(req, res);
            break;
          case 'GET':
            await handleMcpGet(req, res);
            break;
          case 'DELETE':
            await handleMcpDelete(req, res);
            break;
          default:
            res.writeHead(405);
            res.end('Method not allowed');
        }
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    } catch (error) {
      log.error('MCP server error:', error);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    }
  });

  server.listen(MCP_PORT, () => {
    log.info(`MCP server listening on port ${MCP_PORT}`);
  });

  process.on('SIGINT', async () => {
    for (const [, transport] of transports) {
      await transport.close();
    }
    server.close();
  });
}
