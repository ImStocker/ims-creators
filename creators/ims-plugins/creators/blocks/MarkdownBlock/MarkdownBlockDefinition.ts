import type { IAppManager } from '~ims-app-base/logic/managers/IAppManager';
import type { BlockEditorController } from '~ims-app-base/logic/types/BlockEditorController';
import { BlockTypeDefinition } from '~ims-app-base/logic/types/BlockTypeDefinition';
import type { ResolvedAssetBlock } from '~ims-app-base/logic/utils/assets';
import { MarkdownBlockController } from './MarkdownBlockController';

export class MarkdownBlockDefinition extends BlockTypeDefinition {
  name = 'markdown';
  component = async () => (await import('./MarkdownBlock.vue')).default;
  icon = 'markdown-line';

  override hideInAdding = true;
  override focusOnAdded = true;
  override aiSpec =
    'This block stores Markdown text in the `value` prop (string — raw Markdown content). Uses ink-mde editor (CodeMirror-based) with wiki links and image upload via drag-and-drop. The controller extracts headers from Markdown (via @lezer/markdown parser) as BlockContentItem[] with itemId, title, level, and anchor for in-document navigation. System-internal (hideInAdding=true).';

  override createController(
    appManager: IAppManager,
    getResolvedBlock: () => ResolvedAssetBlock | null,
  ): BlockEditorController {
    return new MarkdownBlockController(appManager, getResolvedBlock);
  }
}
