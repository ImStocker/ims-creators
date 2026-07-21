import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ProjectFileDb } from '../project-file-db/ProjectFileDb';
import type { IProjectDatabase } from '~ims-app-base/logic/types/IProjectDatabase';
import { AiProjectTools } from '~ims-app-base/logic/ai-core/AiProjectTools';

import { blockRegistry } from './block-registry';

function buildBlockSpecs(): string {
  const lines: string[] = ['BLOCK TYPES:'];
  for (const block of blockRegistry) {
    lines.push(`"${block.name}" — ${block.aiSpec.brief}`);
  }
  return lines.join('\n');
}

function adaptProjectDb(projectDb: ProjectFileDb): IProjectDatabase {
  return {
    assetsGetShort: (q) => projectDb.asset.assetsGetShort(q),
    assetsGetFull: (q) => projectDb.asset.assetsGetFull(q),
    assetsGetView: (q: any, opts?: any) => projectDb.asset.assetsGetView(q as any, opts as any) as any,
    assetsGraph: (q) => projectDb.asset.assetsGraph(q),
    assetsCreate: (p) => projectDb.asset.assetsCreate(p),
    assetsChange: (p, opts?) => projectDb.asset.assetsChange(p, opts),
    assetsChangeUndo: (p, opts?) => projectDb.asset.assetsChangeUndo(p, opts),
    assetsChangeBatch: (p, opts?) => projectDb.asset.assetsChangeBatch(p, opts),
    assetsDelete: (w) => projectDb.asset.assetsDelete(w),
    assetsRestore: (w) => projectDb.asset.assetsRestore(w),
    assetsCreateRef: (p) => projectDb.asset.assetsCreateRef(p),
    assetsDeleteRef: (p) => projectDb.asset.assetsDeleteRef(p),
    assetsMove: (p) => projectDb.asset.assetsMove(p),
    assetsGetHistory: (id) => projectDb.asset.assetsGetHistory(id),
    getAssetLocalPath: (id) => projectDb.asset.getAssetLocalPath(id),
    workspacesGet: (q) => projectDb.workspace.workspacesGet(q),
    workspacesCreate: (p) => projectDb.workspace.workspacesCreate(p),
    workspacesChange: (id, p) => projectDb.workspace.workspacesChange(id, p),
    workspacesDelete: (id) => projectDb.workspace.workspacesDelete(id),
    workspacesMove: (p) => projectDb.workspace.workspacesMove(p),
    getWorkspaceLocalPathFolder: (id) => projectDb.workspace.getWorkspaceLocalPathFolder(id),
    subscribeEvents: () => ({
      cancel: () => { },
      isConnected: () => false,
      listenContent: () => { },
      listenComment: () => ({ cancel: () => { } }),
    }),
  };
}

const BLOCK_SPECS_SUFFIX = '\n\n' + buildBlockSpecs();

export function registerTools(server: McpServer, projectDb: ProjectFileDb): void {
  const db = adaptProjectDb(projectDb);
  const core = new AiProjectTools(db);

  for (const tool of core.tools) {
    server.registerTool(tool.name, {
      description: tool.description + BLOCK_SPECS_SUFFIX,
      inputSchema: tool.inputSchema,
    }, async (args) => {
      try {
        const result = await tool.handler(args);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Error: ${msg}` }],
          isError: true,
        };
      }
    });
  }
}
