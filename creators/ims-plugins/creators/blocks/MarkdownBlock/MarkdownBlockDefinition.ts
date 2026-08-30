import type { IAppManager } from '~ims-app-base/logic/managers/IAppManager';
import type { BlockEditorController } from '~ims-app-base/logic/types/BlockEditorController';
import { BlockTypeDefinition } from '~ims-app-base/logic/types/BlockTypeDefinition';
import type { ResolvedAssetBlock } from '~ims-app-base/logic/utils/assets';
import { MarkdownBlockController } from './MarkdownBlockController';
import { markdownBlockAiSpec } from './MarkdownBlockAiSpec';

export class MarkdownBlockDefinition extends BlockTypeDefinition {
  name = 'markdown';
  component = async () => (await import('./MarkdownBlock.vue')).default;
  icon = 'markdown-line';

  override focusOnAdded = true;
  override aiSpec = markdownBlockAiSpec.aiSpec;

  override createController(
    appManager: IAppManager,
    getResolvedBlock: () => ResolvedAssetBlock | null,
  ): BlockEditorController {
    return new MarkdownBlockController(appManager, getResolvedBlock);
  }
}
