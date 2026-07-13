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
    'MarkdownBlock stores formatted rich text as raw Markdown content. ' +
    'Use it for design documents, lore entries, technical specs, or any free-form notes that need headings, links, images, and formatting — all within the asset editor.\n\n' +
    'Stored as:\n' +
    '- `value` — the raw Markdown string content\n\n' +
    'The editor (ink-mde, CodeMirror-based) supports wiki links (`[[AssetTitle]]`) for cross-asset references and image upload via drag-and-drop. Headers are automatically extracted into a navigation outline (BlockContentItem[]).\n\n' +
    'Example (lore entry for the Merrow Cartel faction):\n' +
    '{\n' +
    '  "value": "# The Merrow Cartel\\n\\n## Overview\\nThe Merrow Cartel controls all smuggling routes through the **Sunken Coast**. Founded by [[Evelyn Merrow]] after the Crimson War, they deal in relic trading, information brokering, and — allegedly — soul contracts.\\n\\n## Key Figures\\n| Name | Role | Status |\\n|------|------|--------|\\n| Evelyn Merrow | Cartel Leader | Active |\\n| Silas Vane | Harbor Master | Deceased |\\n| Lira Blacktide | Enforcer | Active |\\n\\n> \\"The tide takes everything eventually. We just help it along.\\"\\n> — Evelyn Merrow"\n' +
    '}';

  override createController(
    appManager: IAppManager,
    getResolvedBlock: () => ResolvedAssetBlock | null,
  ): BlockEditorController {
    return new MarkdownBlockController(appManager, getResolvedBlock);
  }
}
