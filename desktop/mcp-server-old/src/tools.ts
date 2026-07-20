import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ImsProject } from './ims-fs.js';

// ── Schemas ───────────────────────────────────────────────────────────────────

const parseJsonString = z.string().transform((str, ctx) => {
  try {
    const parsed = JSON.parse(str);
    // Handle double-serialized strings (opencode quirk)
    if (typeof parsed === 'string') {
      try {
        return JSON.parse(parsed);
      } catch {
        return parsed;
      }
    }
    return parsed;
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Invalid JSON string' });
    return z.NEVER;
  }
});

const valuesSchema = z
  .record(z.string(), z.record(z.string(), z.unknown()))
  .optional()
  .or(parseJsonString.pipe(z.record(z.string(), z.record(z.string(), z.unknown()))).optional())
  .describe(
    'Block values: key = block name, value = flat props object. ' +
      'Props use backslash-separated paths for nesting (e.g. "description\\en" → description.en). ' +
      'Pass the existing values when modifying an asset to preserve other blocks.',
  );

const blockSchema = z
  .object({
    id: z.string().optional(),
    type: z.string().describe('Block type: "props", "text", "gallery", "table", "diagram", "checklist", "locale", "embed"'),
    name: z.string().nullable().optional().describe('Block key name (e.g. "description", "props")'),
    title: z.string().nullable().optional().describe('Display title'),
    index: z.number().optional().describe('Sort order'),
    own: z.boolean().optional().describe('Whether this block is own (not inherited)'),
    props: z.record(z.unknown()).optional().describe('Block props'),
    computed: z.record(z.unknown()).optional().describe('Computed props (inherited + own)'),
    inherited: z.record(z.unknown()).nullable().optional().describe('Inherited props from parent type'),
  })
  .passthrough();

const blocksSchema = z
  .array(blockSchema)
  .optional()
  .or(parseJsonString.pipe(z.array(blockSchema)).optional())
  .describe(
    'Full block array. Each block has: id, type, name, title, props, computed, inherited. ' +
      'If both blocks and values are provided, values takes precedence for writing. ' +
      'Blocks are preserved as-is for Electron compatibility.',
  );

// ── Block Specs (shared across tools) ──────────────────────────────────────────

const BLOCK_SPECS = `
BLOCK TYPES — DETAILED FORMAT:

"text" — Rich text or plain text block.
  Props: \`value\` — plain string or {Str: string, Ops: [{insert: string}]} for rich text.

"props" — Flexible key-value metadata table.
  Props: each key is a property. Metadata stored as:
  - \`__props\\{key}\\type\` — field type: "text", "integer", "number", "checkbox", "enum", "assetSelector", "dateTime", "projectUser"
  - \`__props\\{key}\\title\` — display title
  - \`__props\\{key}\\index\` — sort order (number)
  Example: {"health": 100, "__props\\health\\type": "integer", "__props\\health\\title": "HP"}

"table" — Spreadsheet-like data table with columns and rows.
  Props:
  - \`__columns\\{col}\\title\`, \`__columns\\{col}\\type\`, \`__columns\\{col}\\index\`
  - \`__primary\` — primary column name
  - \`_{row}\\values\\{col}\` — cell value
  - \`_{row}\\index\` — row sort order

"gallery" — Media collection (images, videos).
  Props: each key is a UUID item:
  - \`{uuid}\\type\` — "file", "youtube", "extimage"
  - \`{uuid}\\value\` — {FileId, Title, Size, Dir, Store} for files, or URL string
  - \`{uuid}\\index\` — sort order

"checklist" — Checkable item list.
  Props: each key is a UUID item:
  - \`{uuid}\\title\` — item text
  - \`{uuid}\\checked\` — boolean
  - \`{uuid}\\index\` — sort order

"script" — Visual node-graph for dialogues and interactive narratives.
  Props:
  - \`start\` — entry node ID (string)
  - \`nodes\\{uuid}\\type\` — "start", "end", "speech", "trigger", "branch", "callScript", "setVar", "getVar"
  - \`nodes\\{uuid}\\next\` — next node ID or null
  - \`nodes\\{uuid}\\pos\\x\`, \`nodes\\{uuid}\\pos\\y\` — position (number)
  - \`nodes\\{uuid}\\values\\text\` — dialogue text (string or {Str, Ops})
  - \`nodes\\{uuid}\\values\\character\` — character name or {AssetId, Title}
  - \`nodes\\{uuid}\\options\` — array of {values: {text: string}, next: nodeId} for choices
  - \`variables\\own\\{name}\\name\`, \`type\\Type\`, \`title\` — script variables
  - \`__settings\\speech\\main\\text\\type\` — field schema definition

"embed" — Embedded URL (Figma, YouTube, Google Docs).
  Props: \`value\` — URL string.

"diagram" — Visual diagrams and flowcharts (format defined by DiagramEditor).

"leveleditor" — Level/map editor data (format defined by LevelEditor).

"graph" — Node-tree/graph editor data (format defined by GraphEditor).

"locale" — Localization data (system-managed, do not edit directly).

"chat" — Discussion/comment thread (system-managed, do not edit directly).
`;

// ── Registration ──────────────────────────────────────────────────────────────

export function registerTools(server: McpServer, project: ImsProject): void {
  // ── create_asset ───────────────────────────────────────────────────────────

  server.registerTool(
    'create_asset',
    {
      description:
        'Create a new asset file (.ima.json) in the project. ' +
        'The file will be placed in the correct workspace folder.\n\n' +
        'HOW ASSET CREATION WORKS:\n' +
        '- Typed assets inherit ALL blocks from the parent type automatically.\n' +
        '- Do NOT pass blocks when creating a typed asset — they are created by the system.\n' +
        '- To add content, create the asset first, then use change_asset.\n\n' +
        'TYPED ASSETS (set parentIds to inherit blocks from type):\n' +
        '- TextElement: ["00000000-0000-0000-0000-000000000030"] — rich text document\n' +
        '- DiagramElement: ["00000000-0000-0000-0000-000000000032"] — visual diagrams/flowcharts\n' +
        '- ScriptElement: ["00000000-0000-0000-0000-000000000033"] — visual scripts/dialogues\n' +
        '- GameObject: ["00000000-0000-0000-0000-000000000035"] — game object definitions\n' +
        '- LevelMapElement: ["00000000-0000-0000-0000-000000000036"] — level/map editor\n' +
        '- GameMechanics: ["00000000-0000-0000-0000-000000000037"] — game mechanics docs\n' +
        '- Markdown: ["00000000-0000-0000-0000-000000000039"] — markdown documents\n' +
        '- GraphElement: ["00000000-0000-0000-0000-000000000041"] — node-tree/graph editor\n' +
        '- Task: ["00000000-0000-0000-0000-000000000010"] — task/kanban card\n' +
        '- Chat: ["00000000-0000-0000-0000-000000000040"] — discussion/chat\n\n' +
        'PROPS FORMAT (flat key-value with backslash separators for nesting):\n' +
        '{"key1\\subkey": "value"} represents {key1: {subkey: "value"}}\n\n' +
        'ASSETPROPVALUE TYPES:\n' +
        '- null, string, number, boolean\n' +
        '- {Str: string, Ops: object[]}: rich text\n' +
        '- {FileId: string, Title: string, Size: number, Store: string}: file reference\n' +
        '- {AssetId: string, Title: string, Name?: string}: asset link\n' +
        '- {Enum: string, Name: string, Title: string}: enum value\n\n' +
        'EXAMPLE (create typed asset — NO blocks, they are inherited):\n' +
        '{"title": "My Script", "workspaceId": "...", "parentIds": ["00000000-0000-0000-0000-000000000033"]}\n\n' +
        'EXAMPLE (create untyped asset with custom blocks):\n' +
        '{"title": "My Notes", "workspaceId": "...", "blocks": [{"name": "notes", "type": "text", "props": {"value": "Hello world"}}]}\n\n' +
        BLOCK_SPECS,
      inputSchema: {
        title: z.string().describe('Display title for the asset (used as filename base)'),
        workspaceId: z
          .string()
          .optional()
          .describe(
            'Workspace ID where the asset will be created. ' +
              'Omit to place in the project root.',
          ),
        parentIds: z
          .array(z.string())
          .optional()
          .or(parseJsonString.pipe(z.array(z.string())).optional())
          .describe(
            'Inheritance chain. Set to [typeId] to make the asset inherit from a type. ' +
              'Blocks are inherited automatically — do not pass blocks when using this.',
          ),
        typeIds: z
          .array(z.string())
          .optional()
          .or(parseJsonString.pipe(z.array(z.string())).optional())
          .describe('Type IDs. Usually auto-derived from parentIds; set only if you know what you are doing.'),
        name: z
          .string()
          .nullable()
          .optional()
          .describe('Short machine name (e.g. "Alex"). Null = auto from title.'),
        values: valuesSchema,
        blocks: blocksSchema,
      },
    },
    ({ title, workspaceId, parentIds, typeIds, name, values, blocks }) => {
      try {
        const asset = project.createAsset({
          title,
          workspaceId: workspaceId ?? null,
          parentIds: parentIds ?? [],
          typeIds: typeIds ?? parentIds ?? [],
          name: name ?? null,
          values: values ?? {},
          blocks: blocks as any ?? undefined,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  success: true,
                  asset: {
                    id: asset.id,
                    title: asset.title,
                    name: asset.name,
                    filePath: asset.localName,
                  },
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Error creating asset: ${msg}` }],
          isError: true,
        };
      }
    },
  );

  // ── change_asset ───────────────────────────────────────────────────────────

  server.registerTool(
    'change_asset',
    {
      description:
        'Modify an existing asset. You can change title, name, typeIds, parentIds, workspaceId, values, or blocks. ' +
        'Only provide the fields you want to change — omitted fields stay unchanged. ' +
        'IMPORTANT: When updating values, pass the COMPLETE values object (read the asset first via the asset resource). ' +
        'The values field replaces all block data entirely. ' +
        'Blocks can be provided for full structural changes (preserves Electron compatibility).\n\n' +
        'CHANGE FORMAT:\n' +
        '1. Rename: {"id": "asset_123", "title": "New Title"}\n' +
        '2. Edit block props: {"id": "asset_123", "blocks": [{"name": "biography", "type": "props", "props": {"key": "value"}}]}\n' +
        '3. Delete block: {"id": "asset_123", "blocks": [{"name": "unusedBlock", "delete": true}]}\n\n' +
        'PROPS FORMAT (flat key-value with backslash separators for nesting):\n' +
        '{"key1\\subkey": "value"} represents {key1: {subkey: "value"}}\n\n' +
        'ASSETPROPVALUE TYPES:\n' +
        '- null, string, number, boolean\n' +
        '- {Str: string, Ops: object[]}: rich text\n' +
        '- {FileId: string, Title: string, Size: number, Store: string}: file reference\n' +
        '- {AssetId: string, Title: string, Name?: string}: asset link\n' +
        '- {Enum: string, Name: string, Title: string}: enum value\n\n' +
        BLOCK_SPECS,
      inputSchema: {
        id: z.string().describe('Asset ID to modify'),
        title: z.string().optional().describe('New display title'),
        name: z.string().nullable().optional().describe('New machine name'),
        typeIds: z.array(z.string()).optional().or(parseJsonString.pipe(z.array(z.string())).optional()).describe('New type IDs'),
        parentIds: z.array(z.string()).optional().or(parseJsonString.pipe(z.array(z.string())).optional()).describe('New parent IDs (inheritance chain)'),
        workspaceId: z
          .string()
          .nullable()
          .optional()
          .describe('Move the asset to a different workspace'),
        values: valuesSchema,
        blocks: blocksSchema,
      },
    },
    ({ id, title, name, typeIds, parentIds, workspaceId, values, blocks }) => {
      try {
        const patch: Record<string, unknown> = {};
        if (title !== undefined) patch.title = title;
        if (name !== undefined) patch.name = name;
        if (typeIds !== undefined) patch.typeIds = typeIds;
        if (parentIds !== undefined) patch.parentIds = parentIds;
        if (workspaceId !== undefined) patch.workspaceId = workspaceId;
        if (values !== undefined) patch.values = values;
        if (blocks !== undefined) patch.blocks = blocks;

        const asset = project.changeAsset(id, patch);
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  success: true,
                  asset: {
                    id: asset.id,
                    title: asset.title,
                    name: asset.name,
                    localName: asset.localName,
                  },
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Error changing asset: ${msg}` }],
          isError: true,
        };
      }
    },
  );

  // ── delete_asset ───────────────────────────────────────────────────────────

  server.registerTool(
    'delete_asset',
    {
      description:
        'Permanently delete an asset file from the project. This removes the .ima.json file from disk.',
      inputSchema: {
        id: z.string().describe('Asset ID to delete'),
      },
    },
    ({ id }) => {
      try {
        const deleted = project.deleteAsset(id);
        return {
          content: [
            {
              type: 'text' as const,
              text: deleted
                ? `Asset "${id}" deleted successfully.`
                : `Asset "${id}" not found.`,
            },
          ],
          isError: !deleted,
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Error deleting asset: ${msg}` }],
          isError: true,
        };
      }
    },
  );

  // ── create_workspace ───────────────────────────────────────────────────────

  server.registerTool(
    'create_workspace',
    {
      description:
        'Create a new workspace (folder) in the project. A workspace is a directory with a .imw.json metadata file. ' +
        'Use this to organize assets into folders (e.g., "Scripts", "Scenes").\n\n' +
        'COLLECTION WORKSPACES:\n' +
        'To create a collection workspace (for specific asset types), set props:\n' +
        '{"type":"collection","asset":{"AssetId":"<typeAssetId>","Title":"<typeName>"}}\n\n' +
        'EXAMPLE:\n' +
        '{"title": "Scripts", "parentId": "root_workspace_id", "props": {"type":"collection","asset":{"AssetId":"00000000-0000-0000-0000-000000000033","Title":"Script"}}}',
      inputSchema: {
        title: z.string().describe('Workspace display title (used as folder name)'),
        parentId: z
          .string()
          .optional()
          .describe('Parent workspace ID. Omit to create at project root.'),
        index: z
          .number()
          .nullable()
          .optional()
          .describe('Sort order index'),
        props: z
          .record(z.unknown())
          .optional()
          .describe(
            'Workspace properties. To create a collection workspace (for specific asset types), ' +
              'set: {"type":"collection","asset":{"AssetId":"<typeAssetId>","Title":"<typeName>"}}',
          ),
      },
    },
    ({ title, parentId, index, props }) => {
      try {
        const ws = project.createWorkspace({
          title,
          parentId: parentId ?? null,
          index: index ?? null,
          props: props ?? {},
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  success: true,
                  workspace: {
                    id: ws.id,
                    title: ws.title,
                    parentId: ws.parentId,
                  },
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Error creating workspace: ${msg}` }],
          isError: true,
        };
      }
    },
  );

  // ── reload_project ─────────────────────────────────────────────────────────

  server.registerTool(
    'reload_project',
    {
      description:
        'Re-scan the project folder from disk. Use this if files were modified outside of this session ' +
        '(e.g., by IMS Desktop or another editor).',
    },
    () => {
      project.load();
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                success: true,
                totalAssets: project.assets.size,
                totalWorkspaces: project.workspaces.size,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
