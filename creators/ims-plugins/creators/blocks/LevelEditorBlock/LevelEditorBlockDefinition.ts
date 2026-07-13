import type { IAppManager } from '~ims-app-base/logic/managers/IAppManager';
import type { BlockEditorController } from '~ims-app-base/logic/types/BlockEditorController';
import { BlockTypeDefinition } from '~ims-app-base/logic/types/BlockTypeDefinition';
import type { ResolvedAssetBlock } from '~ims-app-base/logic/utils/assets';
import LevelEditorBlockController from './LevelEditorBlockController';

export class LevelEditorBlockDefinition extends BlockTypeDefinition {
  name = 'leveleditor';
  component = async () => (await import('./LevelEditorBlock.vue')).default;
  icon = 'map-2-line';
  override resizableBlockHeight = true;
  override aiSpec =
    'LevelEditorBlock stores a 2D canvas scene (Fabric.js) with positioned, styled shapes. ' +
    'Use it for level layouts, encounter maps, dungeon blueprints, or any spatial game content that needs visual editing — room boundaries, spawn points, obstacles, NPC markers, etc.\n\n' +
    'Each shape is stored as flat key-value props under `objects\\{shapeId}\\`:\n' +
    '- `id` — unique shape identifier (string, UUID)\n' +
    '- `type` — shape type: "rect" | "ellipse" | "polygon" | "image" | "pointer" | "textbox" | "group"\n' +
    '- `x`, `y` — position on canvas (number)\n' +
    '- `scaleX`, `scaleY` — scale factor (number, default 1)\n' +
    '- `angle` — rotation in degrees (number, default 0)\n' +
    '- `index` — z-order (number)\n' +
    '- `value` — linked asset {AssetId, Title, Name} or label text (string)\n' +
    '- `locked` — whether the shape is locked from editing (boolean)\n' +
    '- `parentId` — parent group id if grouped (string | null)\n' +
    '- `params\\{paramName}` — type-specific fields (see below)\n\n' +
    'Type-specific params:\n' +
    '- rect: `params\\width`, `params\\height`, `params\\fill?`, `params\\stroke?`\n' +
    '- ellipse: `params\\rx`, `params\\ry`, `params\\fill?`, `params\\stroke?`\n' +
    '- polygon: `params\\points\\{i}\\x`, `params\\points\\{i}\\y`, `params\\fill?`, `params\\stroke?`\n' +
    '- image: `params\\file` (AssetPropValueFile), `params\\width?`, `params\\height?`\n' +
    '- pointer: `params\\width`, `params\\height`\n' +
    '- textbox: `params\\width?`, `params\\fill?`, `params\\stroke?`, `params\\textAlign?`\n' +
    '- group: no extra params\n\n' +
    'Example (dungeon room layout with spawn points and obstacles):\n' +
    '{\n' +
    '  "objects\\\\room_wall\\\\id": "room_wall",\n' +
    '  "objects\\\\room_wall\\\\type": "rect",\n' +
    '  "objects\\\\room_wall\\\\x": 50,\n' +
    '  "objects\\\\room_wall\\\\y": 50,\n' +
    '  "objects\\\\room_wall\\\\params\\\\width": 700,\n' +
    '  "objects\\\\room_wall\\\\params\\\\height": 500,\n' +
    '  "objects\\\\room_wall\\\\params\\\\fill": "#2a2a2a33",\n' +
    '  "objects\\\\room_wall\\\\params\\\\stroke": "#ff4444",\n' +
    '  "objects\\\\room_wall\\\\index": 0,\n' +
    '  "objects\\\\chest_01\\\\id": "chest_01",\n' +
    '  "objects\\\\chest_01\\\\type": "rect",\n' +
    '  "objects\\\\chest_01\\\\x": 200,\n' +
    '  "objects\\\\chest_01\\\\y": 300,\n' +
    '  "objects\\\\chest_01\\\\params\\\\width": 40,\n' +
    '  "objects\\\\chest_01\\\\params\\\\height": 40,\n' +
    '  "objects\\\\chest_01\\\\params\\\\fill": "#d4a017",\n' +
    '  "objects\\\\chest_01\\\\value": { "AssetId": "treasure_chest_01", "Title": "Iron Chest", "Name": "iron_chest" },\n' +
    '  "objects\\\\chest_01\\\\index": 1,\n' +
    '  "objects\\\\spike_trap\\\\id": "spike_trap",\n' +
    '  "objects\\\\spike_trap\\\\type": "polygon",\n' +
    '  "objects\\\\spike_trap\\\\x": 500,\n' +
    '  "objects\\\\spike_trap\\\\y": 400,\n' +
    '  "objects\\\\spike_trap\\\\params\\\\points\\\\0\\\\x": 0,\n' +
    '  "objects\\\\spike_trap\\\\params\\\\points\\\\0\\\\y": 0,\n' +
    '  "objects\\\\spike_trap\\\\params\\\\points\\\\1\\\\x": 30,\n' +
    '  "objects\\\\spike_trap\\\\params\\\\points\\\\1\\\\y": 60,\n' +
    '  "objects\\\\spike_trap\\\\params\\\\points\\\\2\\\\x": -30,\n' +
    '  "objects\\\\spike_trap\\\\params\\\\points\\\\2\\\\y": 60,\n' +
    '  "objects\\\\spike_trap\\\\params\\\\fill": "#cc3333",\n' +
    '  "objects\\\\spike_trap\\\\index": 2,\n' +
    '  "objects\\\\npc_spawn\\\\id": "npc_spawn",\n' +
    '  "objects\\\\npc_spawn\\\\type": "pointer",\n' +
    '  "objects\\\\npc_spawn\\\\x": 400,\n' +
    '  "objects\\\\npc_spawn\\\\y": 200,\n' +
    '  "objects\\\\npc_spawn\\\\params\\\\width": 100,\n' +
    '  "objects\\\\npc_spawn\\\\params\\\\height": 100,\n' +
    '  "objects\\\\npc_spawn\\\\value": { "AssetId": "evelyn_merrow", "Title": "Evelyn Merrow", "Name": "evelyn_merrow" },\n' +
    '  "objects\\\\npc_spawn\\\\index": 3,\n' +
    '  "objects\\\\floor_label\\\\id": "floor_label",\n' +
    '  "objects\\\\floor_label\\\\type": "textbox",\n' +
    '  "objects\\\\floor_label\\\\x": 100,\n' +
    '  "objects\\\\floor_label\\\\y": 80,\n' +
    '  "objects\\\\floor_label\\\\value": "Boss Arena",\n' +
    '  "objects\\\\floor_label\\\\params\\\\width": 200,\n' +
    '  "objects\\\\floor_label\\\\params\\\\fill": "#ffffff",\n' +
    '  "objects\\\\floor_label\\\\params\\\\textAlign": "center",\n' +
    '  "objects\\\\floor_label\\\\index": 4,\n' +
    '  "objects\\\\doorway\\\\id": "doorway",\n' +
    '  "objects\\\\doorway\\\\type": "ellipse",\n' +
    '  "objects\\\\doorway\\\\x": 350,\n' +
    '  "objects\\\\doorway\\\\y": 50,\n' +
    '  "objects\\\\doorway\\\\params\\\\rx": 30,\n' +
    '  "objects\\\\doorway\\\\params\\\\ry": 15,\n' +
    '  "objects\\\\doorway\\\\params\\\\fill": "#44aaff44",\n' +
    '  "objects\\\\doorway\\\\index": 5\n' +
    '}';
  override createController(
    appManager: IAppManager,
    getResolvedBlock: () => ResolvedAssetBlock | null,
  ): BlockEditorController {
    return new LevelEditorBlockController(appManager, getResolvedBlock);
  }
}
