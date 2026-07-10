import { Table } from '@lezer/markdown';
import { syntaxTree } from '@codemirror/language';
import { Facet, RangeSet, StateField } from '@codemirror/state';
import type { EditorState } from '@codemirror/state';
import { Decoration, EditorView, WidgetType, keymap } from '@codemirror/view';
import type { DecorationSet, KeyBinding } from '@codemirror/view';
import { h, render } from 'vue';
import type { AppContext, VNode } from 'vue';
import TableComponent from './TableWidget.vue';

const AppContextFacet = Facet.define<
  (vnode: VNode) => void,
  (vnode: VNode) => void
>({
  combine: (values) => values[0] || (() => {}),
});

class TableWidgetType extends WidgetType {
  constructor(
    private rows: string[][],
    private tableFrom: number,
    private delimiterText: string,
    private hasHeader: boolean,
  ) {
    super();
  }

  override eq(other: TableWidgetType) {
    return this.rows.length === other.rows.length;
  }

  toDOM(view: EditorView) {
    const container = document.createElement('div');
    container.className = 'cm-table-container';

    const vnode = h(TableComponent, {
      parentView: view,
      tableFrom: this.tableFrom,
      initialRows: this.rows,
      hasHeader: this.hasHeader,
      delimiterText: this.delimiterText,
    });
    view.state.facet(AppContextFacet)(vnode);
    render(vnode, container);

    return container;
  }

  override ignoreEvent(event: Event) {
    return event.type === 'mousedown';
  }

  override destroy(dom: HTMLElement) {
    render(null, dom);
  }
}

function decorate(state: EditorState): DecorationSet {
  const widgets: any[] = [];

  syntaxTree(state).iterate({
    enter: ({ type, from, to, node }) => {
      if (type.name !== 'Table') return;

      const rows: string[][] = [];
      let delimiterText = '';
      let hasHeader = false;
      let child = node?.firstChild;

      while (child) {
        if (child.type.name === 'TableHeader') {
          hasHeader = true;
          const row: string[] = [];
          let cell = child.firstChild;
          while (cell) {
            if (cell.type.name === 'TableCell') {
              row.push(state.doc.sliceString(cell.from, cell.to));
            }
            cell = cell.nextSibling;
          }
          rows.push(row);
        } else if (child.type.name === 'TableDelimiter') {
          const text = state.doc.sliceString(child.from, child.to);
          if (text.includes('---')) {
            delimiterText = text;
          }
        } else if (child.type.name === 'TableRow') {
          const row: string[] = [];
          let cell = child.firstChild;
          while (cell) {
            if (cell.type.name === 'TableCell') {
              row.push(state.doc.sliceString(cell.from, cell.to));
            }
            cell = cell.nextSibling;
          }
          rows.push(row);
        }
        child = child.nextSibling;
      }

      if (rows.length > 0) {
        widgets.push(
          Decoration.replace({
            widget: new TableWidgetType(rows, from, delimiterText, hasHeader),
          }).range(from, to),
        );
      }
    },
  });

  return widgets.length
    ? RangeSet.of(widgets.sort((a: any, b: any) => a.from - b.from))
    : Decoration.none;
}

const tableDecorations = StateField.define<DecorationSet>({
  create(state) {
    return decorate(state);
  },
  update(decos, tr) {
    if (tr.docChanged) {
      return decorate(tr.state);
    }
    return decos.map(tr.changes);
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});

const tableKeyBinding: KeyBinding = {
  key: 'Mod-Shift-t',
  run(target) {
    const tableText = [
      '| Column 1 | Column 2 | Column 3 |',
      '|----------|----------|----------|',
      '| Cell 1   | Cell 2   | Cell 3   |',
    ].join('\n');

    target.dispatch({
      changes: {
        from: target.state.selection.main.head,
        insert: tableText + '\n',
      },
      selection: {
        anchor: target.state.selection.main.head + tableText.length + 1,
      },
    });
    return true;
  },
};

export function tables(appContext?: AppContext) {
  return [
    { type: 'grammar' as const, value: Table },
    {
      type: 'default' as const,
      value: AppContextFacet.of((vnode) => {
        vnode.appContext = appContext ?? null;
      }),
    },
    { type: 'default' as const, value: tableDecorations },
    { type: 'default' as const, value: keymap.of([tableKeyBinding]) },
  ];
}
