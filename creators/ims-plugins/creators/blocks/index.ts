import { DiagramBlockDefinition } from './DiagramBlock/DiagramBlockDefinition';
import { DialogBlockDefinition } from './DialogBlock/DialogBlockDefinition';
import { GraphBlockDefinition } from './GraphBlock/GraphBlockDefinition';
import { LevelEditorBlockDefinition } from './LevelEditorBlock/LevelEditorBlockDefinition';
import { LocaleBlockDefinition } from './LocaleBlock/LocaleBlockDefinition';
import { MarkdownBlockDefinition } from './MarkdownBlock/MarkdownBlockDefinition';
import { TextGridBlockDefinition } from './TextGridBlock/TextGridBlockDefinition';

const list = [
  new MarkdownBlockDefinition(),
  new DiagramBlockDefinition(),
  new DialogBlockDefinition(),
  new GraphBlockDefinition(),
  new LevelEditorBlockDefinition(),
  new TextGridBlockDefinition(),
  new LocaleBlockDefinition(),
];

export default function () {
  return list.map((el) => {
    return {
      type: 'block',
      content: {
        definition: el,
      },
    };
  });
}
