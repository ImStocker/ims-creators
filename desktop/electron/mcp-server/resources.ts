import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ProjectFileDb } from '../project-file-db/ProjectFileDb';

import { blockRegistry } from './block-registry';
import { fieldRegistry } from './field-registry';

function buildDocsContent(): string {
  const lines: string[] = [
    '# IMS Desktop — Project Data Reference',
    '',
    'This document describes the project data model, available block types, field type controllers, ' +
    'and how to work with assets and workspaces. Read this before creating or modifying any complex block.',
    '',
    '## Project Structure',
    '',
    'A project consists of:',
    '- **Assets** (files) — the main data units. Each asset has a unique id, name, title, typeIds (inheritance chain), and blocks of data.',
    '- **Workspaces** (folders) — assets are organized into workspaces. The root workspace is "gdd".',
    '- Some workspaces are **collections** — they only hold assets of a specific type. ' +
      'Identified by props: `{"type":"collection","asset":{"AssetId":"<typeId>","Title":"<name>"}}`.',
    '',
    '## Asset Inheritance',
    '',
    'Assets can inherit from other assets. If asset A inherits from B (via parentIds), A gets all blocks from B plus its own blocks. ' +
    'The **typeIds** field is the list of all ancestor asset IDs in the inheritance chain (read-only). ' +
    'To SET the parent when creating/changing, use **parentId** (stored internally as `parentIds: [parentId]`).',
    '',
    '## Props Storage Format',
    '',
    'All props use a **flat key-value** format with `\\` as path separator for nesting:',
    '```',
    '{"a\\\\b\\\\c": 5}  represents  {a: {b: {c: 5}}}',
    '```',
    'So `description\\\\en` means `description.en`, and `stats\\\\health\\\\max` means `stats.health.max`.',
    '',
    '## AssetPropValue Types',
    '',
    'Each prop value can be one of:',
    '- **null** — no value',
    '- **string** — plain text',
    '- **number** (integer or float)',
    '- **boolean** — true/false',
    '- **number[]** — array of numbers',
    '- **{Str: string, Ops: object[]}** — rich text with Quill Delta formatting',
    '- **{FileId: string, Title: string, Size: number, Store: string}** — file/asset reference',
    '- **{Blob: any, Type: string}** — binary blob',
    '- **{F: any}** — formula expression (evaluated at runtime)',
    '- **{AssetId: string, Title: string, Name?: string, BlockId?: string}** — link to another project asset',
    '- **{AccountId: string, Name: string}** — link to a user account',
    '- **{Enum: string, Name: string, Title: string}** — enum value with type name, key, and display title',
    '- **{ProjectId: string, Title: string}** — link to another project',
    '- **{WorkspaceId: string, Title: string, Name?: string}** — workspace reference',
    '- **{Select: any, Group: any, Str: string, Where: object}** — dynamic selection query',
    '- **{Str: string, Ts: number}** — timestamp with ISO string and Unix seconds',
    '- **{Type: string, Kind?: string, Of?: object}** — type descriptor',
    '',
    '## Block Types',
    '',
  ];

  for (const block of blockRegistry) {
    lines.push(`### ${block.name}`);
    lines.push('');
    lines.push(`**Brief:** ${block.aiSpec.brief}`);
    if (block.aiSpec.needSpec && block.aiSpec.spec) {
      lines.push('');
      lines.push('**Full description (required for this block):**');
      lines.push('');
      lines.push(block.aiSpec.spec);
    }
    lines.push('');
  }

  lines.push('## Field Type Controllers');
  lines.push('');
  lines.push('Each field type controller defines how a specific AssetPropValue shape is edited and presented. ' +
    'The controller `name` is used as the `type` value in prop metadata (e.g. `__props\\\\{key}\\\\type`).');
  lines.push('');

  for (const ft of fieldRegistry) {
    lines.push(`### ${ft.name}`);
    lines.push('');
    lines.push(`**Title:** ${ft.title}`);
    lines.push('');
    lines.push(`**Brief:** ${ft.aiSpec.brief}`);
    if (ft.aiSpec.needSpec && ft.aiSpec.spec) {
      lines.push('');
      lines.push('**Full description (required for this field type):**');
      lines.push('');
      lines.push(ft.aiSpec.spec);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function registerResources(server: McpServer, projectDb: ProjectFileDb): void {
  server.registerResource(
    'docs',
    'ims://docs',
    {
      description:
        'COMPLETE PROJECT DATA REFERENCE — project structure, asset inheritance, props format, all 16 AssetPropValue types, ' +
        'all block types with full specifications, and all field type controllers. ' +
        'READ THIS before creating or modifying any block to understand the correct data format.',
      mimeType: 'text/markdown',
    },
    async () => ({
      contents: [
        {
          uri: 'ims://docs',
          mimeType: 'text/markdown',
          text: buildDocsContent(),
        },
      ],
    }),
  );

  server.registerResource(
    'project',
    'ims://project',
    {
      description: 'Project metadata: id, title, rootWorkspaceId. Use to understand the current project context.',
      mimeType: 'application/json',
    },
    async () => {
      const info = projectDb.info;
      return {
        contents: [
          {
            uri: 'ims://project',
            mimeType: 'application/json',
            text: JSON.stringify(info, null, 2),
          },
        ],
      };
    },
  );

  server.registerResource(
    'workspaces',
    'ims://project/workspaces',
    {
      description:
        'All workspaces (folders) in the project with hierarchy. Shows id, title, name, parentId, and collection props. ' +
        'Use to find workspace IDs for creating assets.',
      mimeType: 'application/json',
    },
    async () => {
      const result = await projectDb.workspace.workspacesGet({
        where: {},
      });
      return {
        contents: [
          {
            uri: 'ims://project/workspaces',
            mimeType: 'application/json',
            text: JSON.stringify(result.list, null, 2),
          },
        ],
      };
    },
  );

  server.registerResource(
    'assets',
    'ims://project/assets',
    {
      description:
        'All assets in the project with full details including blocks, props, and inheritance data. ' +
        'For a lighter list, use the list_assets or search_assets tools instead.',
      mimeType: 'application/json',
    },
    async () => {
      const result = await projectDb.asset.getAssetFulls({
        where: {},
      });
      return {
        contents: [
          {
            uri: 'ims://project/assets',
            mimeType: 'application/json',
            text: JSON.stringify(result.list, null, 2),
          },
        ],
      };
    },
  );

  server.registerResource(
    'blocks',
    'ims://blocks',
    {
      description: 'All available block types from the registry with their AI specifications. Use to understand what block types exist and their purposes.',
      mimeType: 'application/json',
    },
    async () => {
      return {
        contents: [
          {
            uri: 'ims://blocks',
            mimeType: 'application/json',
            text: JSON.stringify(blockRegistry, null, 2),
          },
        ],
      };
    },
  );

  server.registerResource(
    'field-types',
    'ims://field-types',
    {
      description: 'All available field type controllers that define how prop values are edited and presented (e.g. string, text, enum, assetSelector).',
      mimeType: 'application/json',
    },
    async () => {
      return {
        contents: [
          {
            uri: 'ims://field-types',
            mimeType: 'application/json',
            text: JSON.stringify(fieldRegistry, null, 2),
          },
        ],
      };
    },
  );
}
