import { keymap, type EditorView } from '@codemirror/view';
import { Prec, type Extension } from '@codemirror/state';
import type { Instance as InkInstance } from 'ink-mde';
import { applyFormat, type FormatType } from '../format-commands';
import type { SelectionInfo } from './selection-toolbar';

export function shortcuts(
  getEditor: () => InkInstance | null,
  isReadOnly: () => boolean,
): Extension {
  const run =
    (type: FormatType) =>
    (view: EditorView): boolean => {
      if (isReadOnly()) return false;
      const editor = getEditor();
      if (!editor) return false;

      const sel = view.state.selection.main;
      const info: SelectionInfo = {
        from: sel.from,
        to: sel.to,
        text: view.state.doc.sliceString(sel.from, sel.to),
        rect: { left: 0, top: 0, right: 0, bottom: 0 },
      };

      applyFormat(editor, info, type);
      return true;
    };

  return Prec.highest(
    keymap.of([
      { key: 'Mod-b', run: run('bold') },
      { key: 'Mod-i', run: run('italic') },
    ]),
  );
}
