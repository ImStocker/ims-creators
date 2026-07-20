import { BlockTypeDefinition } from '~ims-app-base/logic/types/BlockTypeDefinition';
import type { IAppManager } from '~ims-app-base/logic/managers/IAppManager';
import type { BlockEditorController } from '~ims-app-base/logic/types/BlockEditorController';
import type { ResolvedAssetBlock } from '~ims-app-base/logic/utils/assets';
import { GraphBlockController } from './editor/GraphBlockController';
import { graphBlockAiSpec } from './GraphBlockAiSpec';

export class GraphBlockDefinition extends BlockTypeDefinition {
  name = 'graph';
  component = async () => (await import('./GraphBlock.vue')).default;
  icon = 'node-tree';
  override resizableBlockHeight = true;
  override aiSpec = graphBlockAiSpec.aiSpec;

  override createController(
    appManager: IAppManager,
    getResolvedBlock: () => ResolvedAssetBlock | null,
  ): BlockEditorController {
    return new GraphBlockController(appManager, getResolvedBlock);
  }
}
