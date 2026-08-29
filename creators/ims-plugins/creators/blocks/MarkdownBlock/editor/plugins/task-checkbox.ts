import { EditorView } from '@codemirror/view';
import { Prec } from '@codemirror/state';

const TASK_MARKER = /\[[ xX]\]/;

// ink-mde ships a task-list checkbox widget, but its click handler toggles the
// document at the wrong position: it dispatches at `posAtDOM(target) - 4`, which
// lands *before* the list marker instead of on the `[ ]`/`[x]` text. The native
// <input> still flips visually, so the box looks checked while the source never
// changes -> "checked but not saved".
//
// We intercept the mousedown with the highest precedence and perform the correct
// toggle at the real TaskMarker range (located via the line text). Returning
// `true` makes CodeMirror stop propagation to ink-mde's handler, so its broken
// dispatch never runs.
export function taskCheckbox() {
  return Prec.highest(
    EditorView.domEventHandlers({
      mousedown(event, view) {
        const target = event.target as HTMLElement | null;
        const box = target?.closest(
          '.ink-mde-task-marker',
        ) as HTMLElement | null;
        if (!box) return false;

        event.preventDefault();
        try {
          const pos = view.posAtDOM(box);
          const line = view.state.doc.lineAt(pos);
          const match = TASK_MARKER.exec(line.text);
          if (!match) return true;

          const from = line.from + match.index;
          const to = from + 3;
          const before = view.state.sliceDoc(from, to);
          const insert = before === '[x]' || before === '[X]' ? '[ ]' : '[x]';
          view.dispatch({ changes: { from, to, insert } });
        } catch {
          /* ignore */
        }
        return true;
      },
    }),
  );
}
