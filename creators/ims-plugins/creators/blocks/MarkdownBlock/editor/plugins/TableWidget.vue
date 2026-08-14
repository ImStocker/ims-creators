<template>
  <table
    class="TableWidget cm-table-widget"
    style="table-layout:fixed;width:100%;border-collapse:collapse;border:1px solid var(--local-border-color,#ccc)"
    @mousedown.stop
  >
    <thead v-if="headerRows.length">
      <tr v-for="(_row, ri) in headerRows" :key="'hr'+ri">
        <th
          v-for="(_cell, ci) in headerRows[ri]"
          :key="'h'+ci"
          :data-row="ri"
          :data-col="ci"
          class="cm-table-cell cm-table-header TableWidget-cell"
          @mousedown.prevent="onCellMouseDown(ri, ci)"
        >
          <div v-if="_activeCell?.row !== ri || _activeCell?.col !== ci" class="TableWidget-cell-presenter" v-html="cellHtml(headerRows[ri][ci])"></div>
          <div v-else class="TableWidget-cell-editor"></div>
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(_row, ri) in dataRows" :key="'r'+ri">
        <td
          v-for="(_cell, ci) in dataRows[ri]"
          :key="'c'+ri+'-'+ci"
          :data-row="headerRowCount + ri"
          :data-col="ci"
          class="cm-table-cell TableWidget-cell"
          @mousedown.prevent="onCellMouseDown(headerRowCount + ri, ci)"
        >
          <div
            v-if="_activeCell?.row !== headerRowCount + ri || _activeCell?.col !== ci"
            class="TableWidget-cell-presenter"
            v-html="cellHtml(rows[headerRowCount + ri][ci])"
          ></div>
          <div v-else class="TableWidget-cell-editor"></div>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script lang="ts">
import { EditorView, keymap } from '@codemirror/view';
import type { KeyBinding } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import type { MarkdownConfig } from '@lezer/markdown';
import {
  defaultKeymap,
  history,
  historyKeymap,
  insertNewlineAndIndent,
} from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import { defineComponent, markRaw, reactive } from 'vue';
import { marked } from 'marked';

// Shared across widget instances. When a cell commit changes the row count the
// whole widget is re-created by CodeMirror (its `eq` is false), so the "next
// cell to keep editing" has to be handed over to the new widget instance
// through this reactive object.
const pendingEditTarget = reactive({
  tableFrom: -1,
  row: -1,
  col: -1,
});

export default defineComponent({
  name: 'TableWidget',
  props: {
    parentView: { type: Object as () => EditorView, required: true },
    tableFrom: { type: Number, required: true },
    initialRows: { type: Array as () => string[][], required: true },
    hasHeader: { type: Boolean, default: false },
    delimiterText: { type: String, default: '' },
    cellGrammar: { type: Object as () => MarkdownConfig, default: undefined },
    cellExtensions: { type: Array as () => Extension[], default: () => [] },
  },
  data() {
    return {
      rows: (this.initialRows as string[][]).map((row) => [...row]),
      _baseRowCount: (this.initialRows as string[][]).length,
      _activeCell: null as { row: number; col: number } | null,
      _nestedEditor: null as EditorView | null,
      _committing: false,
    };
  },
  computed: {
    headerRows(): string[][] {
      return this.hasHeader ? [this.rows[0]] : [];
    },
    dataRows(): string[][] {
      return this.hasHeader ? this.rows.slice(1) : this.rows;
    },
    headerRowCount(): number {
      return this.hasHeader ? 1 : 0;
    },
  },
  mounted() {
    // Take over an editing session that was started by a previous widget
    // instance before the widget got re-created (row count changed). Deferred
    // one microtask because the committing widget records `pendingEditTarget`
    // after its own `dispatch`, and this mount may happen synchronously inside
    // that dispatch.
    queueMicrotask(() => {
      if (
        pendingEditTarget.tableFrom === this.tableFrom &&
        pendingEditTarget.row >= 0
      ) {
        const { row, col } = pendingEditTarget;
        pendingEditTarget.tableFrom = -1;
        pendingEditTarget.row = -1;
        pendingEditTarget.col = -1;
        this.startEdit(row, col);
      }
    });
  },
  beforeUnmount() {
    this._cleanupNestedEditor();
  },
  methods: {
    cellHtml(text: string): string {
      return marked.parseInline(text) as string;
    },

    _onBlur() {
      this.commitEdit();
    },

    _cleanupNestedEditor() {
      if (!this._nestedEditor) return;
      this._nestedEditor.dom.removeEventListener('blur', this._onBlur);
      this._nestedEditor.destroy();
      this._nestedEditor = null;
    },

    onCellMouseDown(row: number, col: number) {
      if (
        this._activeCell !== null &&
        this._activeCell.row === row &&
        this._activeCell.col === col
      ) return;
      if (this._nestedEditor && this._activeCell) {
        // Commit the current cell and navigate to the clicked one. The commit
        // may re-create the whole widget (row count change); that hand-off is
        // handled inside `commitEdit` via `pendingEditTarget`.
        this.commitEdit({ row, col });
      } else {
        this.startEdit(row, col);
      }
    },

    async startEdit(row: number, col: number) {
      if (this._activeCell) return;
      const cell = this.findCellElement(row, col);
      if (!cell) return;
      if (cell.querySelector('.cm-editor')) return;

      this._activeCell = { row, col };

      await this.$nextTick();

      // Re-look the cell up after the re-render; the element captured above may
      // belong to a widget instance that got destroyed by a commit dispatch.
      const editorHost = this.findCellElement(row, col)?.querySelector(
        '.TableWidget-cell-editor',
      ) as HTMLElement;
      if (!editorHost) {
        return
      };

      const commit = () => { this.commitEdit(); return true; };
      const enterNext = () => {
        if (!this._activeCell) return true;
        let { row, col } = this._activeCell;
        row++;
        if (row >= this.rows.length) {
          const colCount = this.rows[row - 1]?.length ?? 1;
          this.rows = [...this.rows, Array(colCount).fill('')];
        }
        this.commitEdit({ row, col });
        return true;
      };
      const tabNext = () => {
        if (!this._activeCell) return true;
        let { row, col } = this._activeCell;
        col++;
        if (col >= (this.rows[row]?.length ?? 0)) {
          row++;
          if (row >= this.rows.length) return true;
          col = 0;
        }
        this.commitEdit({ row, col });
        return true;
      };
      const tabPrev = () => {
        if (!this._activeCell) return true;
        let { row, col } = this._activeCell;
        col--;
        if (col < 0) {
          row--;
          if (row < 0) return true;
          col = (this.rows[row]?.length ?? 0) - 1;
        }
        this.commitEdit({ row, col });
        return true;
      };

      this._nestedEditor = markRaw(new EditorView({
        doc: this.rows[row][col].replace(/<br>/g, '\n'),
        extensions: [
          markdown(this.cellGrammar),
          ...this.cellExtensions,
          EditorView.lineWrapping,
          EditorView.editable.of(true),
          EditorView.theme({
            '&': {
              backgroundColor: 'transparent',
              height: '100%',
              outline: 'none',
            },
            '&.cm-focused': { outline: 'none' },
            '.cm-scroller': {
              fontFamily: 'inherit',
              fontSize: 'inherit',
              overflow: 'hidden',
            },
            '.cm-content': {
              padding: '2px 4px',
              caretColor: 'currentColor',
              minHeight: '1.2em',
            },
            '.cm-line': { padding: 0 },
          }),
          keymap.of(<KeyBinding[]>[
            { key: 'Enter', run: enterNext },
            { key: 'Shift-Enter', run: insertNewlineAndIndent },
            ...defaultKeymap,
            ...historyKeymap,
            { key: 'Escape', run: commit },
            { key: 'Tab', run: tabNext },
            { key: 'Shift-Tab', run: tabPrev },
          ]),
          history(),
        ],
        parent: editorHost,
      }));

      this._nestedEditor.dom.addEventListener('blur', this._onBlur);

      this._nestedEditor.focus();
    },

    commitEdit(navigateTo?: { row: number; col: number }) {
      if (this._committing || !this._nestedEditor || !this._activeCell) return;
      this._committing = true;

      const { row, col } = this._activeCell;
      const newText = this._nestedEditor.state.doc.toString();

      this._cleanupNestedEditor();

      const range = this.findCurrentTableRange();

      this._activeCell = null;

      const newRows = this.rows.map((r) => [...r]);
      // Raw line breaks can't live inside a GFM table row, so store them as
      // `<br>` (same as Obsidian does).
      newRows[row][col] = newText.replace(/\n/g, '<br>');
      const willRecreate = newRows.length !== this._baseRowCount;
      this.rows = newRows;

      const doNav = () => {
        if (!navigateTo) return;
        if (willRecreate) {
          // The widget will be re-created (row count changed) — hand the
          // editing session over to the new instance via `pendingEditTarget`.
          pendingEditTarget.tableFrom = this.tableFrom;
          pendingEditTarget.row = navigateTo.row;
          pendingEditTarget.col = navigateTo.col;
        } else {
          this.startEdit(navigateTo.row, navigateTo.col);
        }
      };

      if (range) {
        const fullMarkdown = this.reconstructTable(newRows);
        queueMicrotask(() => {
          this.parentView.dispatch({
            changes: { from: range.from, to: range.to, insert: fullMarkdown },
          });
          doNav();
        });
      } else {
        queueMicrotask(doNav);
      }

      this._committing = false;
    },

    findCurrentTableRange(): { from: number; to: number } | null {
      let range: { from: number; to: number } | null = null;
      syntaxTree(this.parentView.state).iterate({
        enter: (ref) => {
          if (
            ref.type.name === 'Table' &&
            ref.from <= this.tableFrom &&
            ref.to >= this.tableFrom
          ) {
            range = { from: ref.from, to: ref.to };
            return false;
          }
          return true;
        },
      });
      return range;
    },

    reconstructTable(newRows: string[][]): string {
      const lines: string[] = [];
      if (this.hasHeader) {
        lines.push(`| ${newRows[0].join(' | ')} |`);
        if (this.delimiterText) {
          lines.push(this.delimiterText);
        } else {
          // The delimiter line must survive or the table won't parse back.
          lines.push(`|${newRows[0].map(() => '---|').join('')}`);
        }
        for (let r = 1; r < newRows.length; r++) {
          lines.push(`| ${newRows[r].join(' | ')} |`);
        }
      } else {
        for (const row of newRows) {
          lines.push(`| ${row.join(' | ')} |`);
        }
      }
      return lines.join('\n');
    },

    findCellElement(row: number, col: number): HTMLTableCellElement | null {
      // Scope to this widget's own table so that tables placed earlier in the
      // document don't steal the lookup.
      return this.$el.querySelector(
        `td[data-row="${row}"][data-col="${col}"],` +
          `th[data-row="${row}"][data-col="${col}"]`,
      );
    },
  },
});
</script>

<style>
.cm-table-cell {
  border: 1px solid var(--local-border-color, #ccc);
  padding: 0 4px;
  vertical-align: top;
  font-weight: 400;
  min-width: 3em;
  min-height: 1.5em;
}
.cm-table-header {
  font-weight: 600;
  background: var(--local-hl-bg-color, #f5f5f5);
}
</style>
