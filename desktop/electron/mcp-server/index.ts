import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { requestProjectDb } from '../project-file-db/project-registry';
import { registerTools } from './tools';
import { registerResources } from './resources';
import log from 'electron-log/main';

export const DEFAULT_MCP_PORT = 4300;

const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const SESSION_IDLE_SWEEP_INTERVAL_MS = 60 * 1000;

type McpSession = {
  transport: StreamableHTTPServerTransport;
  mcp: McpServer;
  projectPath: string;
  lastActivity: number;
};

const sessions = new Map<string, McpSession>();
const sessionsByProject = new Map<string, Set<string>>();

let httpServer: Server | null = null;
let currentPort: number | null = null;
let idleTimer: NodeJS.Timeout | null = null;

function touchSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.lastActivity = Date.now();
  }
}

function removeSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  sessions.delete(sessionId);
  const byProject = sessionsByProject.get(session.projectPath);
  if (byProject) {
    byProject.delete(sessionId);
    if (byProject.size === 0) {
      sessionsByProject.delete(session.projectPath);
    }
  }
}

async function closeMcpSession(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) return;
  sessions.delete(sessionId);
  const byProject = sessionsByProject.get(session.projectPath);
  if (byProject) {
    byProject.delete(sessionId);
    if (byProject.size === 0) {
      sessionsByProject.delete(session.projectPath);
    }
  }
  try {
    await session.transport.close();
  } catch (e) {
    log.error(`MCP: failed to close session ${sessionId}:`, e);
  }
}

export async function closeMcpSessionsForProject(projectPath: string): Promise<void> {
  const sessionIds = sessionsByProject.get(projectPath);
  if (!sessionIds || sessionIds.size === 0) return;
  log.info(`MCP: closing ${sessionIds.size} session(s) for project: ${projectPath}`);
  await Promise.all([...sessionIds].map((sessionId) => closeMcpSession(sessionId)));
}

function startIdleSweep(): void {
  if (idleTimer) return;
  idleTimer = setInterval(() => {
    const now = Date.now();
    const expired: string[] = [];
    for (const [sessionId, session] of sessions) {
      if (now - session.lastActivity > SESSION_IDLE_TIMEOUT_MS) {
        expired.push(sessionId);
      }
    }
    if (expired.length > 0) {
      log.info(`MCP: closing ${expired.length} idle session(s)`);
      for (const sessionId of expired) {
        void closeMcpSession(sessionId);
      }
    }
  }, SESSION_IDLE_SWEEP_INTERVAL_MS);
  idleTimer.unref?.();
}

function stopIdleSweep(): void {
  if (idleTimer) {
    clearInterval(idleTimer);
    idleTimer = null;
  }
}

async function handleMcpPost(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', `http://localhost:${DEFAULT_MCP_PORT}`);
  const projectPath = url.searchParams.get('path');

  if (!projectPath) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing ?path= query parameter' }));
    return;
  }

  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!;
    if (session.projectPath !== projectPath) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session is bound to a different project' }));
      return;
    }
    touchSession(sessionId);
    await session.transport.handleRequest(req, res);
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
      log.info(`MCP session initialized: ${newSessionId} (project: ${projectPath})`);
      sessions.set(newSessionId, {
        transport,
        mcp,
        projectPath,
        lastActivity: Date.now(),
      });
      let byProject = sessionsByProject.get(projectPath);
      if (!byProject) {
        byProject = new Set<string>();
        sessionsByProject.set(projectPath, byProject);
      }
      byProject.add(newSessionId);
    },
  });

  transport.onclose = () => {
    const sid = transport.sessionId;
    if (sid) {
      removeSession(sid);
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
  if (!sessionId || !sessions.has(sessionId)) {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'This server only supports Streamable HTTP transport. Use POST.' }));
    return;
  }

  touchSession(sessionId);
  const session = sessions.get(sessionId)!;
  await session.transport.handleRequest(req, res);
}

async function handleMcpDelete(req: IncomingMessage, res: ServerResponse) {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !sessions.has(sessionId)) {
    res.writeHead(400);
    res.end('Invalid or missing session ID');
    return;
  }

  const session = sessions.get(sessionId)!;
  await session.transport.handleRequest(req, res);
}

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
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
    const url = new URL(req.url ?? '/', `http://localhost:${currentPort ?? DEFAULT_MCP_PORT}`);

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
}

export function getMcpStatus(): { running: boolean; port: number | null } {
  return { running: httpServer !== null, port: currentPort };
}

export async function stopMcpServer(): Promise<void> {
  stopIdleSweep();
  await closeMcpSessionsForProjectAll();

  if (!httpServer) {
    currentPort = null;
    return;
  }

  const server = httpServer;
  httpServer = null;
  currentPort = null;

  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
}

async function closeMcpSessionsForProjectAll(): Promise<void> {
  const projectPaths = [...sessionsByProject.keys()];
  await Promise.all(projectPaths.map((projectPath) => closeMcpSessionsForProject(projectPath)));
}

export function startMcpServer(port: number = DEFAULT_MCP_PORT): Promise<void> {
  const targetPort = Math.max(1, Math.round(port));

  return (async () => {
    if (httpServer && currentPort === targetPort) {
      log.info(`MCP server already running on port ${targetPort}`);
      return;
    }

    if (httpServer) {
      await stopMcpServer();
    }

    startIdleSweep();

    await new Promise<void>((resolve, reject) => {
      const server = createServer(handleRequest);

      const onError = (error: Error) => {
        log.error('MCP server failed to listen:', error);
        reject(error);
      };
      server.once('error', onError);

      server.listen(targetPort, '127.0.0.1', () => {
        server.removeListener('error', onError);
        httpServer = server;
        currentPort = targetPort;
        log.info(`MCP server listening on port ${targetPort} (loopback only)`);
        resolve();
      });
    });
  })();
}

process.on('SIGINT', async () => {
  await stopMcpServer();
});
