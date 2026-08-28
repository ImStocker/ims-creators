import { keymap, type EditorView } from '@codemirror/view';
import { Prec, type Extension } from '@codemirror/state';
import { applyFormat, type FormatType } from '../format-commands';
import type { SelectionInfo } from './selection-toolbar';
import { viewToInkLike } from '../editor-adapter';

export function shortcuts(isReadOnly: () => boolean): Extension {
  const run =
    (type: FormatType) =>
    (view: EditorView): boolean => {
      if (isReadOnly()) return false;

      const sel = view.state.selection.main;
      const info: SelectionInfo = {
        from: sel.from,
        to: sel.to,
        text: view.state.doc.sliceString(sel.from, sel.to),
        rect: { left: 0, top: 0, right: 0, bottom: 0 },
      };

      applyFormat(viewToInkLike(view), info, type);
      return true;
    };

  return Prec.highest(
    keymap.of([
      { key: 'Mod-b', run: run('bold') },
      { key: 'Mod-i', run: run('italic') },
    ]),
  );
}
