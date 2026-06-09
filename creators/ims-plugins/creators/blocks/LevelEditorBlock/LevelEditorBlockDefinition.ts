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
    'This block stores 2D canvas shapes (Fabric.js) for level/environment layouts. Shapes stored under `objects\\{shapeId}\\` keys. Each shape: `type` (string: "rect"|"textbox"|"ellipse"|"polygon"|"image"|"pointer"|"group"), `x`, `y` (number — position), `scaleX`, `scaleY` (number — scale), `angle` (number — rotation in degrees), `value` (AssetPropValueAsset {AssetId, Title, Name} for linked assets, or string for label text), `index` (number — z-order), `locked` (boolean), `parentId` (string | null — group parent). Type-specific params: rect: {width, height, fill?, stroke?}; textbox: {width?, fill?, stroke?, textAlign?}; ellipse: {rx, ry, fill?, stroke?}; polygon: {points: {x, y}[], fill?, stroke?}; image: {file: AssetPropValueFile, width?, height?}; pointer: {width, height}; group: {}.';

  override createController(
    appManager: IAppManager,
    getResolvedBlock: () => ResolvedAssetBlock | null,
  ): BlockEditorController {
    return new LevelEditorBlockController(appManager, getResolvedBlock);
  }
}
