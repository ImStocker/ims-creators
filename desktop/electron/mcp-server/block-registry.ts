import type { AiSpecEntry } from '~ims-app-base/logic/types/AiSpec';
import { textBlockAiSpec } from '~ims-plugin-base/blocks/TextBlock/TextBlockAiSpec';
import { propsBlockAiSpec } from '~ims-plugin-base/blocks/PropsBlock/PropsBlockAiSpec';
import { embedBlockAiSpec } from '~ims-plugin-base/blocks/EmbedBlock/EmbedBlockAiSpec';
import { valueTableBlockAiSpec } from '~ims-plugin-base/blocks/ValueTableBlock/ValueTableBlockAiSpec';
import { galleryAiSpec } from '~ims-plugin-base/blocks/GalleryBlock/GalleryAiSpec';
import { collectionBlockAiSpec } from '~ims-plugin-base/blocks/CollectionBlock/CollectionBlockAiSpec';
import { checklistBlockAiSpec } from '~ims-plugin-base/blocks/ChecklistBlock/ChecklistBlockAiSpec';
import { chatBlockAiSpec } from '~ims-plugin-base/blocks/ChatBlock/ChatBlockAiSpec';
import { blockMirrorBlockAiSpec } from '~ims-plugin-base/blocks/BlockMirrorBlock/BlockMirrorBlockAiSpec';
import { textGridBlockAiSpec } from '~ims-plugin-creators/blocks/TextGridBlock/TextGridBlockAiSpec';
import { markdownBlockAiSpec } from '~ims-plugin-creators/blocks/MarkdownBlock/MarkdownBlockAiSpec';
import { localeBlockAiSpec } from '~ims-plugin-creators/blocks/LocaleBlock/LocaleBlockAiSpec';
import { levelEditorBlockAiSpec } from '~ims-plugin-creators/blocks/LevelEditorBlock/LevelEditorBlockAiSpec';
import { graphBlockAiSpec } from '~ims-plugin-creators/blocks/GraphBlock/GraphBlockAiSpec';
import { dialogBlockAiSpec } from '~ims-plugin-creators/blocks/DialogBlock/DialogBlockAiSpec';
import { diagramBlockAiSpec } from '~ims-plugin-creators/blocks/DiagramBlock/DiagramBlockAiSpec';

export const blockRegistry: AiSpecEntry[] = [
  textBlockAiSpec,
  propsBlockAiSpec,
  embedBlockAiSpec,
  valueTableBlockAiSpec,
  galleryAiSpec,
  collectionBlockAiSpec,
  checklistBlockAiSpec,
  chatBlockAiSpec,
  blockMirrorBlockAiSpec,
  textGridBlockAiSpec,
  markdownBlockAiSpec,
  localeBlockAiSpec,
  levelEditorBlockAiSpec,
  graphBlockAiSpec,
  dialogBlockAiSpec,
  diagramBlockAiSpec,
];
