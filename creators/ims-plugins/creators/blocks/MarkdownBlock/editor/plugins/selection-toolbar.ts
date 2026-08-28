import { ViewPlugin, type ViewUpdate, type EditorView } from '@codemirror/view';

export type SelectionInfo = {
  text: string;
  from: number;
  to: number;
  rect: { left: number; top: number; right: number; bottom: number };
};

export type SelectionToolbarOptions = {
  onSelection: (info: SelectionInfo | null, view: EditorView) => void;
};

class SelectionToolbar {
  private onSelection: (info: SelectionInfo | null, view: EditorView) => void;
  private view: EditorView;

  constructor(view: EditorView, options: SelectionToolbarOptions) {
    this.onSelection = options.onSelection;
    this.view = view;
    this.report(view);
  }

  update(update: ViewUpdate) {
    if (update.selectionSet || update.docChanged || update.focusChanged) {
      this.report(update.view);
    }
  }

  private report(view: EditorView) {
    const sel = view.state.selection.main;

    // Hide immediately when there is no selection; show is deferred to the
    // measure phase so we never read layout during an update.
    if (sel.empty) {
      this.onSelection(null, view);
      return;
    }

    view.requestMeasure({
      read: (v) => {
        const current = v.state.selection.main;
        if (current.empty) {
          return null;
        }
        const start = v.coordsAtPos(current.from);
        const end = v.coordsAtPos(current.to);
        if (!start || !end) {
          return null;
        }
        return {
          text: v.state.doc.sliceString(current.from, current.to),
          from: current.from,
          to: current.to,
          rect: {
            left: start.left,
            top: start.top,
            right: end.right,
            bottom: end.bottom,
          },
        } as SelectionInfo;
      },
      write: (info) => {
        this.onSelection(info, view);
      },
    });
  }

  destroy() {
    this.onSelection(null, this.view);
  }
}

export function selectionToolbar(options: SelectionToolbarOptions) {
  return ViewPlugin.define((view) => new SelectionToolbar(view, options));
}
