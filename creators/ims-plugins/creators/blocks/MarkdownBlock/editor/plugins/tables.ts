import { Table } from '@lezer/markdown';
import type {
  BlockContext,
  Element,
  LeafBlock,
  LeafBlockParser,
  Line,
  MarkdownConfig,
} from '@lezer/markdown';
import { syntaxTree } from '@codemirror/language';
import { Facet, RangeSet, StateField } from '@codemirror/state';
import type { EditorState, Extension } from '@codemirror/state';
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

export type TableCellExtensions = {
  grammar?: MarkdownConfig;
  extensions?: Extension[];
};

const CellExtensionsFacet = Facet.define<
  TableCellExtensions,
  TableCellExtensions
>({
  combine: (values) => ({
    grammar: values.find((v) => v.grammar)?.grammar,
    extensions: values.flatMap((v) => v.extensions ?? []),
  }),
});

// ---------------------------------------------------------------------------
// Custom GFM table grammar. Unlike the built-in `Table` extension from
// `@lezer/markdown`, a line without an unescaped `|` ends the table and is
// re-parsed as a normal paragraph, so typing right after a table doesn't turn
// your text into (broken) table rows.
// ---------------------------------------------------------------------------

function hasPipe(str: string, start: number): boolean {
  for (let i = start; i < str.length; i++) {
    const next = str.charCodeAt(i);
    if (next == 124 /* | */) return true;
    if (next == 92 /* \ */) i++;
  }
  return false;
}

const delimiterLine = /^[>\s]*\|?(\s*:?-+:?\s*\|)+(\s*:?-+:?\s*)?$/;

function parseRow(
  cx: BlockContext,
  line: string,
  startI = 0,
  elts?: Element[],
  offset = 0,
): number {
  let count = 0,
    first = true,
    cellStart = -1,
    cellEnd = -1,
    esc = false;
  const parseCell = () => {
    elts?.push(
      cx.elt(
        'TableCell',
        offset + cellStart,
        offset + cellEnd,
        cx.parser.parseInline(
          line.slice(cellStart, cellEnd),
          offset + cellStart,
        ),
      ),
    );
  };
  for (let i = startI; i < line.length; i++) {
    const next = line.charCodeAt(i);
    if (next == 124 /* | */ && !esc) {
      if (!first || cellStart > -1) count++;
      first = false;
      if (elts) {
        if (cellStart > -1) parseCell();
        elts.push(cx.elt('TableDelimiter', i + offset, i + offset + 1));
      }
      cellStart = cellEnd = -1;
    } else if (esc || (next != 32 && next != 9)) {
      if (cellStart < 0) cellStart = i;
      cellEnd = i + 1;
    }
    esc = !esc && next == 92;
  }
  if (cellStart > -1) {
    count++;
    if (elts) parseCell();
  }
  return count;
}

class CustomTableParser implements LeafBlockParser {
  // null: second line not seen yet, false: not a table, array: rows so far.
  rows: Element[] | null | false = null;
  private end = 0;

  nextLine(cx: BlockContext, line: Line, leaf: LeafBlock): boolean {
    if (this.rows == null) {
      // Second line: check whether it is a valid delimiter row.
      this.rows = false;
      let lineText: string;
      if (
        (line.next == 45 || line.next == 58 || line.next == 124) &&
        delimiterLine.test((lineText = line.text.slice(line.pos)))
      ) {
        const firstRow: Element[] = [];
        const firstCount = parseRow(cx, leaf.content, 0, firstRow, leaf.start);
        if (firstCount == parseRow(cx, lineText, 0)) {
          this.rows = [
            cx.elt(
              'TableHeader',
              leaf.start,
              leaf.start + leaf.content.length,
              firstRow,
            ),
            cx.elt(
              'TableDelimiter',
              cx.lineStart + line.pos,
              cx.lineStart + line.text.length,
            ),
          ];
          this.end = cx.lineStart + line.text.length;
        }
      }
    } else if (this.rows) {
      // Line after the second: a line without an unescaped pipe ends the
      // table. The line is left in place, so it gets re-parsed as a normal
      // paragraph on the next parsing step.
      if (!hasPipe(line.text, line.pos)) {
        cx.addLeafElement(
          leaf,
          cx.elt('Table', leaf.start, this.end, this.rows),
        );
        return true;
      }
      const content: Element[] = [];
      parseRow(cx, line.text, line.pos, content, cx.lineStart);
      this.rows.push(
        cx.elt(
          'TableRow',
          cx.lineStart + line.pos,
          cx.lineStart + line.text.length,
          content,
        ),
      );
      this.end = cx.lineStart + line.text.length;
    }
    return false;
  }

  finish(cx: BlockContext, leaf: LeafBlock): boolean {
    if (!this.rows) return false;
    cx.addLeafElement(
      leaf,
      cx.elt('Table', leaf.start, leaf.start + leaf.content.length, this.rows),
    );
    return true;
  }
}

const CustomTable: MarkdownConfig = {
  defineNodes: [...Table.defineNodes],
  parseBlock: [
    {
      name: 'Table',
      leaf(_cx, leaf) {
        return hasPipe(leaf.content, 0) ? new CustomTableParser() : null;
      },
      endLeaf(cx, line, leaf) {
        if (
          leaf.parsers.some((p) => p instanceof CustomTableParser) ||
          !hasPipe(line.text, line.basePos)
        ) {
          return false;
        }
        const next = cx.peekLine();
        return (
          delimiterLine.test(next) &&
          parseRow(cx, line.text, line.basePos) ==
            parseRow(cx, next, line.basePos)
        );
      },
      before: 'SetextHeading',
    },
  ],
};

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
    return (
      this.tableFrom === other.tableFrom &&
      this.hasHeader === other.hasHeader &&
      this.delimiterText === other.delimiterText &&
      this.rows.length === other.rows.length
    );
  }

  toDOM(view: EditorView) {
    const container = document.createElement('div');
    container.className = 'cm-table-container';

    const cellExtensions = view.state.facet(CellExtensionsFacet);

    const vnode = h(TableComponent, {
      parentView: view,
      tableFrom: this.tableFrom,
      initialRows: this.rows,
      hasHeader: this.hasHeader,
      delimiterText: this.delimiterText,
      cellGrammar: cellExtensions.grammar,
      cellExtensions: cellExtensions.extensions,
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
    if (tr.docChanged || syntaxTree(tr.state) !== syntaxTree(tr.startState)) {
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

export function tables(
  appContext?: AppContext,
  cellExtensions: TableCellExtensions = {},
) {
  return [
    { type: 'grammar' as const, value: CustomTable },
    {
      type: 'default' as const,
      value: AppContextFacet.of((vnode) => {
        vnode.appContext = appContext ?? null;
      }),
    },
    {
      type: 'default' as const,
      value: CellExtensionsFacet.of(cellExtensions),
    },
    { type: 'default' as const, value: tableDecorations },
    { type: 'default' as const, value: keymap.of([tableKeyBinding]) },
  ];
}
