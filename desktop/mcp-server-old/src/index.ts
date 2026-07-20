#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ImsProject } from './ims-fs.js';
import { registerResources } from './resources.js';
import { registerTools } from './tools.js';
import path from 'node:path';

const PROJECT_PATH =
  process.env.IMS_PROJECT_PATH ?? process.argv[2] ?? process.cwd();

function main(): void {
  const resolved = path.resolve(PROJECT_PATH);

  const project = new ImsProject(resolved);
  project.load();

  const server = new McpServer({
    name: 'ims-desktop-mcp',
    version: '1.0.0',
  });

  registerResources(server, project);
  registerTools(server, project);

  const transport = new StdioServerTransport();
  server.connect(transport).catch((err) => {
    process.stderr.write(`MCP server error: ${err}\n`);
    process.exit(1);
  });
}

main();
