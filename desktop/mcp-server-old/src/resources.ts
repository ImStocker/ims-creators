import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ImsProject } from './ims-fs.js';

const DOCS_CONTENT = `
# IMS Desktop Data Format Documentation

## Project Structure

A project consists of:
- **Assets** (files) — characters, locations, scripts, etc. Each asset has a unique id, name, title, typeIds (its parent chain), and blocks of data.
- **Workspaces** (folders) — assets are organized into workspaces.
- Some workspaces are **collections** — they only hold assets of a specific type. You can identify a collection workspace by its \`props\` field. If \`props\` contains \`{"type":"collection","asset":{"AssetId":"...","Title":"..."}}\`, the workspace is a collection for the asset type matching that \`AssetId\`.

## Asset Inheritance

Assets can inherit from other assets. If asset A inherits from B (via parentIds), A gets all blocks from B plus its own blocks. The **typeIds** of an asset is the list of all ancestor asset IDs in its inheritance chain.

## Asset Structure

\`\`\`json
{
  "id": "string — unique file identifier",
  "name": "string — short file name (e.g., 'Alex' or 'Tavern')",
  "title": "string — full file title (e.g., 'Character: Alex, protagonist')",
  "typeIds": ["string"] — read-only list of all parent asset IDs in inheritance chain
}
\`\`\`

## Block Structure

\`\`\`json
{
  "id": "string — block identifier",
  "type": "string — block type (see below)",
  "name": "string | null — block key name (e.g., 'description', 'props')",
  "title": "string — block title (e.g., 'Personality', 'Biography', 'Appearance')",
  "index": "number — sort order",
  "own": "boolean — whether this block is own (not inherited)",
  "props": "object — own props (properties directly set on this block)",
  "inherited": "object | null — props inherited from parent assets",
  "computed": "object — resultant props (inherited + props + computed formulas)"
}
\`\`\`

## Props Format (Flat Key-Value)

All props (props, inherited, computed) use a **flat key-value** format. Nested objects are flattened using \`\\\` as path separator:

\`\`\`json
{"a\\\b\\\c": 5}  represents  {a: {b: {c: 5}}}
\`\`\`

So \`description\\\en\` means description.en, and \`stats\\\health\\\max\` means stats.health.max.

## AssetPropValue Types

Each prop value can be one of:

- **null** — no value
- **string** — plain text
- **number** (integer or float)
- **boolean** — true/false
- **number[]** — array of numbers
- **{Str: string, Ops: object[]}** ('AssetPropValueText') — rich text with formatting (text block)
- **{FileId: string, Title: string, Size: number, Store: string}** ('AssetPropValueFile') — file/asset reference
- **{Blob: any, Type: string}** ('AssetPropValueBlob') — binary blob
- **{F: any}** ('AssetPropValueFormula') — formula expression (evaluated at runtime)
- **{AssetId: string, Title: string, Name?: string, BlockId?: string}** ('AssetPropValueAsset') — link to another project asset
- **{AccountId: string, Name: string}** ('AssetPropValueAccount') — link to a user account
- **{Enum: string, Name: string, Title: string}** ('AssetPropValueEnum') — enum value with type name, key, and display title
- **{ProjectId: string, Title: string}** ('AssetPropValueProject') — link to another project
- **{WorkspaceId: string, Title: string, Name?: string}** ('AssetPropValueWorkspace') — workspace reference
- **{Select: any, Group: any, Str: string, Where: object}** ('AssetPropValueSelection') — dynamic selection query
- **{Str: string, Ts: number}** ('AssetPropValueTimestamp') — timestamp with ISO string and Unix seconds
- **{Type: string, Kind?: string, Of?: object}** ('AssetPropValueType') — type descriptor

## Block Type Specifications

### TextBlock (\`"text"\`)
Stores a single rich text or plain text value. Use it for any textual content: descriptions, notes, articles, dialogues, or any formatted text. The block supports all Quill Delta formatting (bold, italic, headers, lists, links, colors, etc.).

The value is stored in the \`value\` prop and can be in two forms:
- A plain string (simple unformatted text)
- An AssetPropValueText object with \`Str\` (plain text rendering) and \`Ops\` (Quill Delta operations for rich formatting)

### PropsBlock (\`"props"\`)
Stores a flexible table of named key-value properties on an asset. Use it to add structured metadata, settings, or any set of named fields — such as dates, numbers, text, links to assets, files, enums, project users, etc.

Each property is stored as:
- \`{propKey}\` — the value itself (type depends on the field controller)
- \`__props\\\{propKey}\\\index\` — sort order (number)
- \`__props\\\{propKey}\\\title\` — display title (string)
- \`__props\\\{propKey}\\\name\` — optional service name (string)
- \`__props\\\{propKey}\\\type\` — field type controller name (string | null). Determines how the value is edited and presented.
- \`__props\\\{propKey}\\\multiple\` — if true, the value is stored as an array (boolean)
- \`__props\\\{propKey}\\\hint\` — optional hint/description (string)
- \`__props\\\{propKey}\\\params\` — controller-specific sub-fields (object)

Example (character config PropsBlock with various field types):
\`\`\`json
{
  "max_health": 100,
  "__props\\\\max_health\\\\type": "integer",
  "__props\\\\max_health\\\\index": 1,
  "__props\\\\max_health\\\\title": "Max Health",
  "description": { "Str": "A seasoned hero forged in battle.\\n", "Ops": [{ "insert": "A seasoned hero forged in battle.\\n" }] },
  "__props\\\\description\\\\type": "text",
  "__props\\\\description\\\\index": 2,
  "__props\\\\description\\\\title": "Description",
  "difficulty": { "Enum": "game_difficulty", "Name": "hard", "Title": "Hard" },
  "__props\\\\difficulty\\\\type": "enum",
  "__props\\\\difficulty\\\\index": 3,
  "__props\\\\difficulty\\\\title": "Difficulty",
  "icon": { "AssetId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890", "Title": "WarriorIcon", "Name": "warrior_icon" },
  "__props\\\\icon\\\\type": "assetSelector",
  "__props\\\\icon\\\\index": 4,
  "__props\\\\icon\\\\title": "Icon",
  "voice_actor": { "AccountId": "42", "Name": "John Smith" },
  "__props\\\\voice_actor\\\\type": "projectUser",
  "__props\\\\voice_actor\\\\index": 5,
  "__props\\\\voice_actor\\\\title": "Voice Actor",
  "__props\\\\voice_actor\\\\hint": "Select the voice actor for this character",
  "unlock_date": { "Ts": 1767225600, "Str": "2025-12-31T20:00:00.000Z" },
  "__props\\\\unlock_date\\\\type": "dateTime",
  "__props\\\\unlock_date\\\\index": 6,
  "__props\\\\unlock_date\\\\title": "Unlock Date"
}
\`\`\`

### ValueTableBlock (\`"table"\`)
Stores a spreadsheet-like data table with columns and rows. Use it for structured tabular data: enemy stats, weapon catalogs, quest reward tables, inventory lists, level progression charts, or any data best represented as a grid with named columns.

Structure:
- \`__columns\\\{colName}\\\title\` — display title (string)
- \`__columns\\\{colName}\\\index\` — column sort order (number)
- \`__columns\\\{colName}\\\type\` — field type controller name (string, optional). Determines how cells in this column are edited and presented.
- \`__columns\\\{colName}\\\multiple\` — if true, cell values are stored as arrays (boolean)
- \`__columns\\\{colName}\\\width\` — column width hint (string | number, optional)
- \`__columns\\\{colName}\\\hint\` — optional hint text (string)
- \`__columns\\\{colName}\\\params\` — controller-specific sub-fields (object)
- \`__primary\` — primary column name (string | null). Identifies the column that serves as the row key.
- \`_{rowNum}\\\values\\\{colName}\` — cell value (AssetPropValue, type matches the column's field type)
- \`_{rowNum}\\\asset\` — linked asset reference (AssetPropValueAsset | null)
- \`_{rowNum}\\\index\` — row sort order (number)

Example (weapon stats table):
\`\`\`json
{
  "__primary": "name",
  "__columns\\\\name\\\\title": "Weapon Name",
  "__columns\\\\name\\\\index": 1,
  "__columns\\\\damage\\\\title": "Damage",
  "__columns\\\\damage\\\\type": "integer",
  "__columns\\\\damage\\\\index": 2,
  "__columns\\\\type\\\\title": "Type",
  "__columns\\\\type\\\\index": 3,
  "__columns\\\\price\\\\title": "Price",
  "__columns\\\\price\\\\type": "integer",
  "__columns\\\\price\\\\index": 4,
  "_1\\\\values\\\\name": "Iron Sword",
  "_1\\\\values\\\\damage": 15,
  "_1\\\\values\\\\type": { "Enum": "weapon_type", "Name": "melee", "Title": "Melee" },
  "_1\\\\values\\\\price": 100,
  "_1\\\\asset": null,
  "_1\\\\index": 1,
  "_2\\\\values\\\\name": "War Bow",
  "_2\\\\values\\\\damage": 22,
  "_2\\\\values\\\\type": { "Enum": "weapon_type", "Name": "ranged", "Title": "Ranged" },
  "_2\\\\values\\\\price": 250,
  "_2\\\\asset": null,
  "_2\\\\index": 2
}
\`\`\`

### GalleryBlock (\`"gallery"\`)
Stores a collection of media items (images, videos) displayed as a gallery. Use for character portraits, concept art, screenshots, environment mockups, reference boards, or any visual media collection. Items support drag-and-drop reordering, file upload, clipboard paste, and external link entry.

Each item is keyed by a UUID and stored as:
- \`{key}\\\type\` — media type string: "file" (uploaded file), "youtube", "extimage", "extvideo", "rutube", "vkvideo"
- \`{key}\\\value\` — the media data. For type "file": AssetPropValueFile with \`FileId\`, \`Title\`, \`Size\`, \`Dir\`, \`Store\`. For external types: a string URL.
- \`{key}\\\index\` — sort order (number)
- \`{key}\\\inherited\` — whether the item is inherited from a parent (boolean, optional)

Example (character concept art gallery):
\`\`\`json
{
  "a1b2c3d4-...\\\\type": "file",
  "a1b2c3d4-...\\\\value": { "FileId": "a1b2c3d4-...", "Title": "hero_concept_front.png", "Size": 124567, "Dir": "concepts", "Store": "p-abc123" },
  "a1b2c3d4-...\\\\index": 1,
  "e5f6g7h8-...\\\\type": "file",
  "e5f6g7h8-...\\\\value": { "FileId": "e5f6g7h8-...", "Title": "hero_concept_back.png", "Size": 112345, "Dir": "concepts", "Store": "p-abc123" },
  "e5f6g7h8-...\\\\index": 2,
  "i9j0k1l2-...\\\\type": "youtube",
  "i9j0k1l2-...\\\\value": "https://www.youtube.com/watch?v=example",
  "i9j0k1l2-...\\\\index": 3
}
\`\`\`

### ChecklistBlock (\`"checklist"\`)
Stores a list of checkable items with optional linked tasks. Use for to-do lists, feature checklists, bug tracking, milestone requirements, or any set of items to track as done/pending. Items support inline rename, drag-and-drop reorder, check/uncheck, and split from clipboard text.

Each item is keyed by a UUID or MD5 hash of its title and stored as:
- \`{key}\\\title\` — item text (string or AssetPropValueText for rich formatting)
- \`{key}\\\checked\` — boolean: whether the item is checked off
- \`{key}\\\task\` — AssetPropValueAsset | null: linked task asset reference \`{AssetId, Title, Name}\`
- \`{key}\\\index\` — sort order (number)

Example (milestone checklist):
\`\`\`json
{
  "a1b2c3d4-...\\\\title": "Implement combat system",
  "a1b2c3d4-...\\\\checked": true,
  "a1b2c3d4-...\\\\index": 1,
  "e5f6g7h8-...\\\\title": "Design boss AI",
  "e5f6g7h8-...\\\\checked": false,
  "e5f6g7h8-...\\\\task": { "AssetId": "task-uuid-123", "Title": "Boss AI Design", "Name": "" },
  "e5f6g7h8-...\\\\index": 2
}
\`\`\`

### EmbedBlock (\`"embed"\`)
Embeds a URL (Figma, Google Docs/Sheets/Slides, YouTube, Miro). Renders an iframe for recognized services or a clickable link otherwise. Prop: \`value\` (string — the URL).

### ChatBlock (\`"chat"\`)
Embeds a discussion/comment thread on an asset. Props: \`lastViewedAt\` (string — ISO timestamp for unread tracking). Messages are CommentReplyDTO objects (stored server-side via CommentManager): \`{ id, commentId, answerToId (parent for replies), user: {AccountId, Name}, content: AssetProps (rich text, file attachments), createdAt, updatedAt, likes: { user, emoji }[] }\`. Supports real-time send, edit, delete, reply, and emoji reactions. System-internal (hideInAdding=true), auto-inserted when a discussion is created.

### BlockMirrorBlock (\`"block-mirror"\`)
Renders a read-only copy of a block from another asset inline. Use when the same content needs to appear in multiple places without duplication — e.g. reusing a character stats table across multiple scenes, or displaying a shared lore entry in different documents. The mirrored block stays in sync with the source automatically.

Structure:
- \`asset\` — AssetPropValueAsset: target asset reference with \`AssetId\` (UUID), \`Title\`, and \`Name\`
- \`block_ref\` — string: target block identifier, either \`{blockName}\` or \`@\` + \`{blockId}\` (e.g. \`"stats"\` or \`"@4cccae9d-..."\`)

Example:
\`\`\`json
{
  "asset": { "AssetId": "0e7c6606-6003-4942-8baf-9e230bc5572c", "Title": "Player Character", "Name": null },
  "block_ref": "@4cccae9d-5b1f-424d-8d58-89e97d8529f8"
}
\`\`\`

### CollectionBlock (\`"collection"\`)
Renders an inline workspace table inside an asset. No block-local props — it reads the parent asset's workspaceId to query assets from that workspace. Uses workspace props' \`views\` (dictionary of UserView objects): each view has filter (AssetPropWhere), sort (AssetPropsSelectionOrder[]), props (AssetPropsSelectionField[]), type (string), title (string), index (number). Displays a sortable/filterable table with user-configurable views. System-internal (hideInAdding=true), auto-created per workspace context.

### ScriptBlock (\`"script"\`)
**CRITICAL: This is the block type for script/dialogue assets. Do NOT use "text" block type for scripts.**

Stores a visual script/graph structure for dialogues, scenes, and interactive narratives. The script is a node-based graph with connections between nodes.

**IMPORTANT: When creating a script asset, you MUST:**
1. Set \`parentIds\` to \`["00000000-0000-0000-0000-000000000033"]\` (the Script type ID)
2. Create a block with \`type: "script"\` (NOT "text")
3. The block name must be "content"

**Structure (ScriptBlockPlain):**
- \`start\` — string: ID of the entry node
- \`nodes\` — object: dictionary of nodes keyed by UUID
- \`variables\` — object: \`{ own: { [name: string]: ScriptBlockPlainVariable } }\`
- \`actions\` — object: \`{ own: { [name: string]: ScriptBlockPlainAction } }\`
- \`__settings\` — object: speech field schemas

**Node Types:**
- \`start\` — entry point (exactly one per script)
- \`end\` — terminal node
- \`speech\` — dialogue line / narration / player choice
- \`trigger\` — scene action (changeLocation, showCharacter, etc.)
- \`branch\` — conditional fork
- \`callScript\` — calls a sub-script
- \`setVar\` / \`getVar\` — variable read/write
- \`constBoolean\`, \`constFloat\`, \`constInteger\`, \`constString\`, \`constText\`, \`constAsset\` — literals
- \`opEqual\`, \`opNotEqual\`, \`opLess\`, \`opLessEqual\`, \`opMore\`, \`opMoreEqual\`, \`opPlus\`, \`opMinus\`, \`opMult\`, \`opDiv\`, \`opMod\`, \`opAnd\`, \`opOr\`, \`opNot\` — operators

**Node Structure (ScriptBlockPlainNode):**
\`\`\`json
{
  "type": "speech",
  "subject": "optional subject for trigger/callScript",
  "values": { "text": { "Str": "...", "Ops": [...] }, "character": "Character Name" },
  "next": "next-node-uuid",
  "options": [{ "values": {...}, "next": "option-target-uuid" }],
  "params": { "in": [...], "out": [...] },
  "pos": { "x": 100, "y": 200 },
  "index": 0
}
\`\`\`

**Variable Structure:**
\`\`\`json
{
  "name": "variable_name",
  "title": "Display Title",
  "type": { "Type": "integer" },
  "kind": "local",
  "description": "Description text",
  "default": 0,
  "index": 1
}
\`\`\`

**Example (simple dialogue script):**
\`\`\`json
{
  "start": "node-start-uuid",
  "nodes": {
    "node-start-uuid": {
      "type": "start",
      "next": "node-greeting-uuid",
      "pos": { "x": -270, "y": 140 },
      "index": 0
    },
    "node-greeting-uuid": {
      "type": "speech",
      "values": {
        "text": { "Str": "Hello, traveler!", "Ops": [{ "insert": "Hello, traveler!" }] },
        "character": "NPC"
      },
      "next": "node-choice-uuid",
      "pos": { "x": 0, "y": 140 },
      "index": 1
    },
    "node-choice-uuid": {
      "type": "speech",
      "values": {
        "text": { "Str": "[Player choice]", "Ops": [{ "insert": "[Player choice]", "attributes": { "bold": true } }] }
      },
      "options": [
        { "values": { "text": { "Str": "Hello!", "Ops": [{ "insert": "Hello!" }] } }, "next": "node-response1-uuid" },
        { "values": { "text": { "Str": "Goodbye.", "Ops": [{ "insert": "Goodbye." }] } }, "next": "node-end-uuid" }
      ],
      "pos": { "x": 270, "y": 140 },
      "index": 2
    },
    "node-response1-uuid": {
      "type": "speech",
      "values": {
        "text": { "Str": "Nice to meet you!", "Ops": [{ "insert": "Nice to meet you!" }] },
        "character": "NPC"
      },
      "next": "node-end-uuid",
      "pos": { "x": 540, "y": 0 },
      "index": 3
    },
    "node-end-uuid": {
      "type": "end",
      "pos": { "x": 540, "y": 280 },
      "index": 4
    }
  },
  "variables": { "own": {} },
  "actions": { "own": {} },
  "__settings": {
    "speech": {
      "main": {
        "text": { "name": "text", "type": { "Type": "text" } },
        "character": { "name": "character", "autoFill": true }
      }
    }
  }
}
\`\`\`

**Example (createAsset call for a script):**
\`\`\`json
{
  "title": "Dialogue: Hero's Return",
  "workspaceId": "your_workspace_id",
  "parentIds": ["00000000-0000-0000-0000-000000000033"],
  "blocks": [
    {
      "name": "__meta",
      "type": "props",
      "props": {
        "complete_set": null,
        "complete_comp": 0,
        "complete_track": true
      }
    },
    {
      "name": "content",
      "type": "script",
      "props": {
        "start": "node-start-uuid",
        "nodes\\\\node-start-uuid\\\\type": "start",
        "nodes\\\\node-start-uuid\\\\next": "node-dialogue-uuid",
        "nodes\\\\node-start-uuid\\\\pos\\\\x": -270,
        "nodes\\\\node-start-uuid\\\\pos\\\\y": 140,
        "nodes\\\\node-start-uuid\\\\index": 0,
        "nodes\\\\node-dialogue-uuid\\\\type": "speech",
        "nodes\\\\node-dialogue-uuid\\\\values\\\\text": { "Str": "Iron Man: Pepper, I'm back!", "Ops": [{ "insert": "Iron Man: Pepper, I'm back!", "attributes": { "bold": true } }] },
        "nodes\\\\node-dialogue-uuid\\\\values\\\\character": "Iron Man",
        "nodes\\\\node-dialogue-uuid\\\\next": "node-end-uuid",
        "nodes\\\\node-dialogue-uuid\\\\pos\\\\x": 0,
        "nodes\\\\node-dialogue-uuid\\\\pos\\\\y": 140,
        "nodes\\\\node-dialogue-uuid\\\\index": 1,
        "nodes\\\\node-end-uuid\\\\type": "end",
        "nodes\\\\node-end-uuid\\\\pos\\\\x": 270,
        "nodes\\\\node-end-uuid\\\\pos\\\\y": 140,
        "nodes\\\\node-end-uuid\\\\index": 2
      }
    },
    {
      "name": "props",
      "type": "props",
      "props": {
        "author": "AI Assistant",
        "characters": "Iron Man, Pepper Potts",
        "location": "Avengers Sea Base"
      }
    }
  ]
}
\`\`\`

## Field Type Controllers Reference

Each field type controller defines how a specific \`AssetPropValue\` shape is edited and presented across all blocks. The controller \`name\` is used as the \`type\` value in prop metadata (e.g. \`__props\\\{key}\\\type\`):

- **text**: Rich text field supporting formatted content (bold, italic, headers, lists, links, etc.). Value is stored as AssetPropValueText with \`Str\` (plain text rendering) and \`Ops\` (Quill Delta operations). Use for multi-line formatted descriptions, notes, or any rich content.
- **string**: Single-line plain text field. Value is stored as a plain string. Use for short text inputs like names, titles, labels, codes, or any unformatted single-line content.
- **number**: Floating-point number field. Value is stored as a JavaScript number (float). Use for decimal values like percentages, measurements, multipliers, coordinates, or any non-integer numeric data.
- **integer**: Whole number (integer) field. Value is stored as a JavaScript number (integer). Use for numeric values that must be whole numbers: counters, quantities, levels, IDs, health points, etc.
- **checkbox**: Boolean toggle (checkbox) field. Value is stored as true/false. Use for yes/no flags, toggles, enable/disable settings, or any binary option. When \`multiple\` is set, each value is stored as 1 (true) or 0 (false) in the array.
- **date**: Date-only picker field (no time component). Value is stored as a plain date string. Use when only the calendar date matters without time (e.g. birth date, release date). For date+time use \`dateTime\` instead.
- **dateTime**: Date and time picker field. Value is stored as AssetPropValueTimestamp with \`Ts\` (Unix timestamp in seconds) and \`Str\` (ISO 8601 string). Use for precise time-based data: event timestamps, deadlines, publish dates, schedules, etc.
- **email**: Email address field with built-in validation. Value is stored as a string. The editor applies \`type="email"\` input mode for proper mobile keyboard and browser validation. Use for contact emails, account emails, notification addresses.
- **phone**: Phone number field with input mode optimization. Value is stored as a string. The editor applies \`type="tel"\` for proper mobile keyboard. Use for contact phone numbers, support lines, or any telephone input.
- **enum**: Single-selection enum field. Value is stored as AssetPropValueEnum with \`Enum\` (enum type name), \`Name\` (key), and \`Title\` (display name). Use when a property must be chosen from a predefined set of options (e.g. difficulty level, character class, item category). Parameters: \`type\` (gddElementSelector -- selects which enum definition to use), \`nullable\` (checkbox -- allows empty/unset value).
- **enumRadio**: Enum field displayed as radio buttons instead of a dropdown. Value is stored as AssetPropValueEnum. Same as \`enum\` but uses a radio button UI for quick visual selection. Best for enums with few options (2-5). Parameters: \`type\` (gddElementSelector -- selects which enum definition to use), \`nullable\` (checkbox).
- **assetSelector**: Asset reference selector. Value is stored as AssetPropValueAsset with \`AssetId\` (UUID), \`Title\`, and \`Name\`. Use to create links between assets -- e.g. assign an icon, reference a character sheet, link a quest to a location. The editor provides a search dialog to find and select any asset in the project.
- **attachment**: File attachment field. Value is stored as AssetPropValueFile with \`FileId\`, \`Title\`, \`Size\`, \`Dir\`, and \`Store\`. Use to attach files: images, documents, audio, or any binary resource. Parameter \`accept\` (string) filters allowed file extensions (e.g. ".jpg,.jpeg,.png"). Files are uploaded to the configured file storage backend.
- **textAttachment**: Rich text field with inline file attachment support. Value is stored as AssetPropValueText, same as \`text\`. Unlike plain \`text\`, this field allows embedding file attachments (images, documents) directly inside the rich text content. Use when formatted text needs embedded media -- e.g. illustrated descriptions, reference documents with screenshots.
- **projectUser**: Project user/account selector. Value is stored as AssetPropValueAccount with \`AccountId\` and \`Name\`. Use to assign a registered project user to a property -- e.g. responsible person, voice actor, reviewer, author. The editor shows a searchable list of project members.
- **struct**: Structured sub-object field. Value is stored as a nested AssetProps object following a structure definition. Use when a property requires multiple related sub-fields (e.g. an address with city/street/zip, or a skill with name/level/cooldown). Parameter \`type\` (gddElementSelector) selects which structure template to use for the sub-fields.
- **textCut**: Rich text field with automatic truncation in presentation mode. Value is stored as AssetPropValueText. Same as \`text\` but the presenter truncates content to 100 characters with "..." for preview/list views. Use for long text that should be summarized in compact UI contexts while keeping full content editable.
- **attributeType**: Attribute type selector field. Value is stored as a string representing an attribute type key. Use for selecting or defining attribute types (e.g. character stats like strength, agility, intelligence) from the project's attribute type registry.
- **nameTitle**: Combined name + title pair field. Stores two related string values as separate flat props: a system \`name\` at \`{propKey}\` (identifier/slug) and a display \`title\` at \`{parentPath}\\\title\`. Use when an entity needs both a technical key and a human-readable label (e.g. item name + display title).
- **gddElementSelector**: GDD element selector -- references an asset filtered by a specific element type. Value is stored as AssetPropValueAsset. Use to link a property to a specific type of GDD element (e.g. a character, item, location, quest). Parameter \`type\` filters which element types are shown in the picker.
- **collectionAssetTitle**: Collection asset title field. Value is stored as a string. Use for displaying and editing the title of an asset within a collection context. Typically bound to the asset's own title property for inline editing in collection views.
- **buttonDateTime**: Button-triggered dateTime stamp field. Value is stored as AssetPropValueTimestamp. Unlike \`dateTime\` which shows a continuous picker, this displays a button that sets the timestamp on click. Use for single-click actions like "Mark as published", "Approve", "Start review". Parameters: \`caption\` (string -- button label), \`confirm\` (checkbox -- require confirmation before setting).

## Usage Examples

### Creating a Character with Props Block
\`\`\`json
{
  "title": "Character: Bob",
  "workspaceId": "workspace_id",
  "parentId": "character_template_id",
  "blocks": [
    {
      "name": "biography",
      "type": "props",
      "props": {
        "age": 25,
        "class": "warrior",
        "description": "A brave adventurer"
      }
    }
  ]
}
\`\`\`

### Editing an Existing Block
\`\`\`json
{
  "id": "asset_id",
  "blocks": [
    {
      "name": "biography",
      "type": "props",
      "props": {
        "age": 26,
        "level": 10
      }
    }
  ]
}
\`\`\`

### Creating a Text Block
\`\`\`json
{
  "id": "asset_id",
  "blocks": [
    {
      "name": "notes",
      "type": "text",
      "props": {
        "value": "This is a simple text note."
      }
    }
  ]
}
\`\`\`
`;

export function registerResources(server: McpServer, project: ImsProject): void {
  // ── Documentation ──────────────────────────────────────────────────────────

  server.registerResource(
    'docs',
    'ims://docs',
    {
      description:
        'IMS Desktop data format documentation: block types, AssetPropValue types, props format, and usage examples.',
      mimeType: 'text/markdown',
    },
    () => {
      return {
        contents: [
          {
            uri: 'ims://docs',
            mimeType: 'text/markdown',
            text: DOCS_CONTENT.trim(),
          },
        ],
      };
    },
  );

  // ── Project info ─────────────────────────────────────────────────────────────

  server.registerResource(
    'project',
    'ims://project',
    {
      description:
        'IMS Desktop project metadata: id, title, rootWorkspaceId, asset/workspace counts.',
      mimeType: 'application/json',
    },
    () => {
      const info = project.info;
      return {
        contents: [
          {
            uri: 'ims://project',
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                id: info.id,
                title: info.title,
                rootPath: project.rootPath,
                rootWorkspaceId: info.rootWorkspaceId,
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

  // ── All workspaces ───────────────────────────────────────────────────────────

  server.registerResource(
    'workspaces',
    'ims://project/workspaces',
    {
      description:
        'All project workspaces (folders). Each has id, title, name, parentId, index, props.',
      mimeType: 'application/json',
    },
    () => {
      const wsList = project.listWorkspaces();
      return {
        contents: [
          {
            uri: 'ims://project/workspaces',
            mimeType: 'application/json',
            text: JSON.stringify(
              wsList.map((w) => ({
                id: w.id,
                title: w.title,
                name: w.name,
                parentId: w.parentId,
                index: w.index,
                props: w.props,
              })),
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ── All assets (summaries) ───────────────────────────────────────────────────

  server.registerResource(
    'assets',
    'ims://project/assets',
    {
      description:
        'All project assets. Each has id, title, name, typeIds, workspaceId, localName. ' +
        'Use ims://project/assets/{id} to read full content of a specific asset.',
      mimeType: 'application/json',
    },
    () => {
      const assets = project.listAssets();
      return {
        contents: [
          {
            uri: 'ims://project/assets',
            mimeType: 'application/json',
            text: JSON.stringify(
              assets.map((a) => ({
                id: a.id,
                title: a.title,
                name: a.name,
                typeIds: a.typeIds,
                workspaceId: a.workspaceId,
                localName: a.localName,
              })),
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ── Single asset by ID (dynamic) ─────────────────────────────────────────────

  server.registerResource(
    'asset',
    new ResourceTemplate('ims://project/assets/{id}', { list: undefined }),
    {
      description:
        'Full asset content including blocks and values (on-disk .ima.json data).',
      mimeType: 'application/json',
    },
    (uri, { id }) => {
      const asset = project.getAsset(id as string);
      if (!asset) {
        throw new Error(`Asset "${id}" not found`);
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(asset, null, 2),
          },
        ],
      };
    },
  );
}
