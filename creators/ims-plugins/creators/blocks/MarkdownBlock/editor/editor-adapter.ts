import type { EditorView } from '@codemirror/view';

// A minimal subset of `ink-mde`'s `Instance` surface that `applyFormat` and
// `detectActive` rely on. Table cells are edited with a raw CodeMirror
// `EditorView` (not an `ink-mde` instance), so this adapter lets the same
// formatting code operate on either one.
export interface InkLike {
  getDoc(): string;
  update(text: string): void;
  select(sel: { selection: { start: number; end: number } }): void;
  wrap(opts: {
    before: string;
    after: string;
    selection: { start: number; end: number };
  }): void;
  insert(text: string, range: { start: number; end: number }): void;
  format(
    type: string,
    opts: { selection: { start: number; end: number } },
  ): void;
  focus(): void;
}

export function viewToInkLike(view: EditorView): InkLike {
  return {
    getDoc() {
      return view.state.doc.toString();
    },
    update(text: string) {
      const len = view.state.doc.length;
      view.dispatch({ changes: { from: 0, to: len, insert: text } });
    },
    select(sel) {
      view.dispatch({
        selection: { anchor: sel.selection.start, head: sel.selection.end },
      });
    },
    wrap(opts) {
      const { start, end } = opts.selection;
      const text = view.state.doc.sliceString(start, end);
      view.dispatch({
        changes: {
          from: start,
          to: end,
          insert: opts.before + text + opts.after,
        },
        selection: {
          anchor: start + opts.before.length,
          head: start + opts.before.length + text.length,
        },
      });
    },
    insert(text, range) {
      view.dispatch({
        changes: { from: range.start, to: range.end, insert: text },
      });
    },
    format(type, opts) {
      if (type === 'code_block') {
        const { start, end } = opts.selection;
        const text = view.state.doc.sliceString(start, end);
        view.dispatch({
          changes: {
            from: start,
            to: end,
            insert: '```\n' + text + '\n```',
          },
          selection: {
            anchor: start + 3,
            head: start + 3 + text.length,
          },
        });
      }
    },
    focus() {
      view.focus();
    },
  };
}
