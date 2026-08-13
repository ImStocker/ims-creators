import type { AiSpecEntry } from '~ims-app-base/logic/types/AiSpec';

export const dialogBlockAiSpec: AiSpecEntry = {
  name: 'script',
  icon: 'file-paper-2-fill',
  aiSpec: {
    brief:
      'Visual script/dialogue graph with nodes, variables, and actions. Use in scene assets for branching dialogue; use in master assets for scene orchestration.',
    spec:
      'CRITICAL: The block MUST be named "content" (not "dialogue" or other names).\n\n' +
      '## Storage structure\n\n' +
      '- start: string — UUID of the entry node (or null)\n' +
      '- nodes: { [uuid: string]: ScriptBlockPlainNode } — each node keyed by UUID\n' +
      '- variables: { own: { [varName: string]: DialogVariable } } — variable declarations\n' +
      '- actions: { own: { [actionName: string]: DialogAction } } — action declarations\n' +
      '- __settings: { speech: { main: {...}, option: {...} } } — field schemas for speech nodes\n\n' +
      'Node structure: { type, pos: { x, y }, index, next?, values?, options?, subject?, params?, __params? }\n\n' +
      '## Node categories\n\n' +
      'The graph has two kinds of nodes:\n\n' +
      '- **Exec nodes** — carry execution flow. The `next` field always points to another exec node (never to a data node). ' +
      'Exec node types: `start`, `speech`, `trigger`, `setVar`, `branch`, `end`. ' +
      'The `end` node has no `next` and terminates the flow.\n\n' +
      '- **Data nodes** — used only for data evaluation. They never have a `next` field and are never reached by a `next` pointer from an exec node. ' +
      'Data node types: `getVar`, all `op*` nodes (`opPlus`, `opMinus`, `opEqual`, `opMore`, `opLess`, `opAnd`, `opOr`, `opMod`, `opDiv`, `opMult`, `opMoreEqual`, `opLessEqual`, `opNotEqual`), ' +
      'and all `const*` nodes (`constInteger`, `constFloat`, `constString`, `constBoolean`, `constText`, `constAsset`). ' +
      'Data nodes are referenced by ID from the `values` of exec nodes (e.g., `{ "get": "10", "param": "result" }`). They are not part of the execution flow.\n\n' +
      '## Node types and their JSON shapes\n\n' +
      '**Start node** (exec):\n' +
      '{ "next": "next_id", "type": "start", "pos": { "x": 0, "y": 0 } }\n\n' +
      '**Speech node** (exec) — dialogue or narration.\n' +
      'With a character:\n' +
      '{ "next": "next_id", "type": "speech", "pos": { "x": 600, "y": 0 }, "values": { "text": "Hello!", "character": { "Title": "Alice", "AssetId": "AliceId" } } }\n\n' +
      'Without a character (narration):\n' +
      '{ "next": "next_id", "type": "speech", "pos": { "x": 600, "y": 0 }, "values": { "text": "The door creaks open." } }\n\n' +
      'With stage direction:\n' +
      '{ "next": "next_id", "type": "speech", "pos": { "x": 600, "y": 0 }, "values": { "text": "Hello!", "character": { "Title": "Alice", "AssetId": "AliceId" }, "описание": "She waves cheerfully." } }\n\n' +
      '**Choice node** (exec speech with options — `next` is null):\n' +
      '{ "next": null, "type": "speech", "pos": { "x": 1200, "y": 0 }, "values": { "text": "What do you do?" }, "options": [ { "next": "id1", "values": { "text": "Open the chest" } }, { "next": "id2", "values": { "text": "Walk away" } } ] }\n\n' +
      '**Trigger node** (exec) — emit a game event (see "Actions" below):\n' +
      '{ "next": "next_id", "type": "trigger", "pos": { "x": 1800, "y": 0 }, "subject": "ActionName", "values": { "param1": "value1" } }\n\n' +
      '**Data nodes** — never linked via `next`, referenced from exec nodes.\n\n' +
      'Getting a variable:\n' +
      '{ "type": "getVar", "pos": { "x": 3600, "y": 0 }, "values": { "variable": "trust" } }\n\n' +
      'Operations (data). Available: opAnd, opOr, opMod, opDiv, opMult, opMinus, opPlus, opMoreEqual, opMore, opLessEqual, opLess, opNotEqual, opEqual.\n' +
      '{ "type": "opPlus", "pos": { "x": 4200, "y": 0 }, "values": { "arg1": { "get": "source_id", "param": "result" }, "arg2": 1 } }\n\n' +
      'Constants: constInteger, constFloat, constBoolean, constString, constText, constAsset.\n' +
      '{ "type": "constInteger", "pos": { "x": 3900, "y": 0 }, "values": { "value": 5 } }\n\n' +
      '**SetVar node** (exec) — assigns a value to a variable:\n' +
      '{ "next": "next_id", "type": "setVar", "pos": { "x": 4800, "y": 0 }, "values": { "variable": "trust", "value": { "get": "source_id", "param": "result" } } }\n\n' +
      '**Branch node** (exec) — conditional execution. `next` is null; options contain `next` pointing to exec nodes:\n' +
      '{ "next": null, "type": "branch", "pos": { "x": 6000, "y": 0 }, "values": { "condition": { "get": "source_id", "param": "result" } }, "options": [ { "next": "id1", "values": { "value": true } }, { "next": "id2", "values": { "value": false } } ] }\n\n' +
      'Note: branch options use `values.value`, speech options use `values.text`.\n\n' +
      '**End node** (exec, no next):\n' +
      '{ "type": "end", "pos": { "x": 10000, "y": 0 } }\n\n' +
      '## Actions\n\n' +
      'Actions are reusable game events declared in `actions.own` and emitted by trigger nodes. ' +
      'Each action must have a unique name referenced from the trigger node `subject`.\n\n' +
      'DialogAction structure:\n' +
      '{ "name": "showCharacter", "type": "trigger", "params": { "in": [ ... ], "out": [ ... ] }, "index": 0 }\n\n' +
      '- name: string — unique action name. Referenced by trigger node `subject`.\n' +
      '- type: "trigger" | "function". "trigger" emits a game event (used by trigger nodes); "function" is a callable routine (used by function/call-script nodes).\n' +
      '- params.in: input parameters — values that the trigger node must supply via its `values`.\n' +
      '- params.out: output parameters — values the action returns (usually empty `[]`).\n' +
      '- index: optional ordering number.\n\n' +
      'Parameter structure (same shape as variables):\n' +
      '{ "kind": "global", "name": "character", "type": { "Type": "asset", "Kind": "93752c93-..." }, "title": "Character", "autoFill": null, "description": null }\n\n' +
      '- kind: "global" | "local" | "in" | "out" | "in-out". Trigger actions in practice use "global".\n' +
      '- type: { "Type": "asset", "Kind": "<assetTypeUuid>" } — asset reference. Include `Kind` (the UUID of the asset type the selector is limited to, e.g. the Character type) for a typed selector; ' +
      'use a bare { "Type": "asset" } for a generic asset. `Type` may also be "text", "string", "integer", "float", "boolean", etc.\n' +
      '- title: display label.\n' +
      '- autoFill: true/false or null. description: optional text or null.\n\n' +
      'Actions may be declared but never used by any trigger node (this is allowed).\n\n' +
      'Example (action declarations):\n' +
      '{ "own": { "hideCharacter": { "name": "hideCharacter", "type": "trigger", "params": { "in": [], "out": [] } }, "showCharacter": { "name": "showCharacter", "type": "trigger", "params": { "in": [ { "kind": "global", "name": "character", "type": { "Type": "asset", "Kind": "93752c93-..." }, "title": "Character", "autoFill": null, "description": null } ], "out": [] } }, "changeLocation": { "name": "changeLocation", "type": "trigger", "params": { "in": [ { "kind": "global", "name": "location", "type": { "Type": "asset", "Kind": "a51c2e8f-..." }, "title": "Location", "autoFill": null, "description": null } ], "out": [] } } } }\n\n' +
      '## Trigger nodes and action binding\n\n' +
      'A trigger node emits a declared action:\n' +
      '{ "next": "next_id", "type": "trigger", "pos": { "x": 1800, "y": 0 }, "subject": "ActionName", "values": { "param1": "value1" } }\n\n' +
      '- `subject` MUST equal an action `name` declared in `actions.own`.\n' +
      "- Each key in `values` supplies one input parameter declared in that action's `params.in`, matched by name. " +
      'Example: `showCharacter` declares the `character` param, so its trigger passes `values.character = { "Title": "Donut", "AssetId": "..." }`.\n' +
      '- Param values are stored as plain asset refs `{ "Title": "...", "AssetId": "..." }` (NOT `{ get, param }` bindings).\n' +
      "- A trigger may pass EXTRA keys not declared in the action's `params.in`. " +
      'Example: `changeLocation` declares only `location`, but its trigger nodes also pass `scene`:\n' +
      '{ "next": "840724bf-...", "type": "trigger", "index": 3.5, "subject": "changeLocation", "pos": { "x": 210, "y": -500 }, "values": { "scene": { "Title": "Main Hall", "AssetId": "d7c4b724-..." }, "location": { "Title": "Main Hall", "AssetId": "d7c4b724-..." } } }\n\n' +
      '## Speech text format (plain vs rich text)\n\n' +
      '`values.text` may be a plain string or a rich-text Delta object `{ Str, Ops }`.\n' +
      'Plain string: "values": { "text": "Hello!" }\n\n' +
      'Rich text (narration with italic/bold formatting):\n' +
      '{ "Str": "The cat runs away, but a piece of mousse is found. + clue\\n", "Ops": [ { "insert": "The cat runs away, but a piece of mousse is found. + clue", "attributes": { "italic": true } }, { "insert": "\\n" } ] }\n\n' +
      '- Str: the canonical plain-text rendering of the line (including the trailing newline).\n' +
      '- Ops: an array of Quill Delta ops. Each op: { "insert": "text", "attributes": { "italic": true } | { "bold": true } }. ' +
      'A final newline op `{ "insert": "\\n" }` closes the block (required).\n\n' +
      '## Narrator speech\n\n' +
      'Speech nodes without a character are narration. Set `character: null` (or omit it) and optionally add `spokenPhraseFeatures`, one of: "Narrator\'s words", "inner voice".\n' +
      '{ "next": "id", "type": "speech", "values": { "text": { "Str": "...\\n", "Ops": [ { "insert": "...", "attributes": { "italic": true } }, { "insert": "\\n" } ] }, "spokenPhraseFeatures": "Narrator\'s words" } }\n\n' +
      '## Logic rules (CRITICAL: exec nodes NEVER point to data nodes via `next`)\n\n' +
      '**Variable change (e.g., "trust +1"):**\n' +
      '1. Create a `getVar` data node (no `next`) that reads the current variable.\n' +
      '2. Create an operation data node (e.g., `opPlus`) that references the `getVar` via `{ "get": "id", "param": "result" }` and the constant value.\n' +
      '3. Create a `setVar` exec node. Its `values.value` references the operation node. Its `next` points to the next exec node.\n' +
      "4. The previous exec node's `next` points directly to this `setVar` exec node.\n" +
      '→ Execution flow: exec → setVar → next exec. Data nodes are never in the `next` chain.\n\n' +
      '**Condition (e.g., "if trust == 1"):**\n' +
      '1. Create a `getVar` data node (trust).\n' +
      '2. Create a comparison op data node (e.g., `opEqual`) with `arg1` referencing the `getVar` and `arg2` = 1.\n' +
      '3. Create a `branch` exec node. Its `condition` references the comparison node.\n' +
      "4. The branch's `options[0].next` points to the exec node for the true path, `options[1].next` for the false path.\n\n" +
      '**Choices that affect variables:**\n' +
      "The choice option's `next` must point to the first exec node of the variable-change chain (usually a `setVar`). " +
      'The `getVar` and operation data nodes are created separately and referenced, not linked via `next`.\n\n' +
      "**Data nodes never have a `next` field, and no exec node's `next` may point to a data node.**\n" +
      'If you accidentally add a `next` to a getVar, op*, or const* node, remove it. ' +
      "If an exec node's `next` points to a data node, change it to point to an exec node instead.\n\n" +
      '## Variable references\n\n' +
      'To reference a value from another node (e.g. getVar result):\n' +
      '{ "get": "sourceNodeUUID", "param": "result" }\n' +
      'Do NOT reference by variable name — always by node UUID + param name.\n\n' +
      '## Variables format\n\n' +
      'variables.own.varName = {\n' +
      '  name: "varName",\n' +
      '  type: { Type: "boolean" | "integer" | "float" | "string" | "text" | "enum" | ... },\n' +
      '  title: "Display Title",\n' +
      '  default: 0,\n' +
      '  autoFill: null,\n' +
      '  description: null\n' +
      '}\n\n' +
      '## __settings format (required for speech blocks)\n\n' +
      'Stored field schema. NOTE: `type` is a NESTED object — this is the actual storage format, do NOT flatten `Type` to the top level:\n' +
      '__settings.speech.main = {\n' +
      '  "text": { "name": "text", "type": { "Type": "text" }, "index": 2, "title": "[[t:Text]]", "description": null },\n' +
      '  "character": { "name": "character", "type": { "Type": "asset", "Kind": "<assetTypeUuid>" }, "index": 0, "title": "[[t:Character]]", "autoFill": true, "description": null }\n' +
      '}\n' +
      '__settings.speech.option = {\n' +
      '  "text": { "name": "text", "type": { "Type": "text" }, "title": "[[t:Text]]", "default": null, "description": null }\n' +
      '}\n\n' +
      '- name: must equal the prop key (e.g. "text").\n' +
      '- type: { Type: "text" | "string" | "asset" | ...; Kind?: "<assetTypeUuid>" } — for a character field use Type "asset" with Kind = the Character asset type UUID.\n' +
      '- index: sort order (optional for option fields).\n' +
      '- title: display title. Locale keys like "[[t:Text]]" are allowed.\n' +
      '- autoFill: true for the character field (auto-fills the current scene character), otherwise null/absent.\n' +
      '- default: null for option fields.\n\n' +
      'IMPORTANT: The keys inside a speech node\'s `values` (text, character, описание) MUST match the keys defined in `__settings.speech.main` exactly — including the Russian key "описание".\n\n' +
      '## Positioning rules\n\n' +
      '- Start node always at (0, 0).\n' +
      '- Increase x by 600 for each sequential exec node in a linear path.\n' +
      '- For branches: offset the y coordinates (e.g., true path +150, false path –150) to avoid overlap. Keep x increments consistent.\n' +
      '- Data nodes can be placed nearby but are not part of the main exec flow.\n' +
      '- Do not reuse a const* or getVar node across exec nodes that are far apart. Create a dedicated node near each group of exec nodes that needs it.\n\n' +
      '## EXAMPLE (branching dialogue with action)\n\n' +
      '{\n' +
      '  "start": "a1b2c3d4-...",\n' +
      '  "nodes": {\n' +
      '    "a1b2c3d4-...": { "type": "start", "next": "e5f6g7h8-...", "index": 0, "pos": { "x": 0, "y": 0 } },\n' +
      '    "e5f6g7h8-...": {\n' +
      '      "type": "trigger", "next": "i9j0k1l2-...", "index": 1, "pos": { "x": 600, "y": 0 },\n' +
      '      "subject": "showCharacter",\n' +
      '      "values": { "character": { "Title": "Alice", "AssetId": "char-uuid-..." } }\n' +
      '    },\n' +
      '    "i9j0k1l2-...": {\n' +
      '      "type": "speech", "next": "m3n4o5p6-...", "index": 2, "pos": { "x": 1200, "y": 0 },\n' +
      '      "values": {\n' +
      '        "text": "Hello, traveler!",\n' +
      '        "character": { "AssetId": "char-uuid-...", "Title": "Alice" },\n' +
      '        "описание": "The merchant waves cheerfully."\n' +
      '      }\n' +
      '    },\n' +
      '    "m3n4o5p6-...": {\n' +
      '      "type": "speech", "next": null, "index": 3, "pos": { "x": 1800, "y": 0 },\n' +
      '      "values": { "text": "What brings you here?" },\n' +
      '      "options": [\n' +
      '        { "next": "q7r8s9t0-...", "values": { "text": "I seek the ancient relic." } },\n' +
      '        { "next": "u1v2w3x4-...", "values": { "text": "Just passing through." } }\n' +
      '      ]\n' +
      '    }\n' +
      '  },\n' +
      '  "variables": { "own": {\n' +
      '    "hasRelic": { "name": "hasRelic", "type": { "Type": "boolean" }, "title": "Has Relic", "default": false, "autoFill": null, "description": null }\n' +
      '  }},\n' +
      '  "actions": { "own": {\n' +
      '    "showCharacter": { "name": "showCharacter", "type": "trigger", "params": { "in": [ { "kind": "global", "name": "character", "type": { "Type": "asset", "Kind": "char-type-uuid-..." }, "title": "Character", "autoFill": null, "description": null } ], "out": [] } }\n' +
      '  }},\n' +
      '  "__settings": { "speech": {\n' +
      '    "main": {\n' +
      '      "text": { "name": "text", "type": { "Type": "text" }, "index": 2, "title": "[[t:Text]]", "description": null },\n' +
      '      "character": { "name": "character", "type": { "Type": "asset", "Kind": "char-type-uuid-..." }, "index": 0, "title": "[[t:Character]]", "autoFill": true, "description": null },\n' +
      '      "описание": { "name": "описание", "type": { "Type": "text" }, "index": 1, "title": "Description", "description": null }\n' +
      '    },\n' +
      '    "option": { "text": { "name": "text", "type": { "Type": "text" }, "title": "[[t:Text]]", "default": null, "description": null } }\n' +
      '  }}\n' +
      '}',
    needSpec: true,
  },
};
