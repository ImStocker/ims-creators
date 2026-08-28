<template>
  <ContextMenuZone
    class="TableWidget-context"
    :get-menu-list="getContextMenu"
  >
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
            @contextmenu="onCellContextMenu(ri, ci)"
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
            @contextmenu="onCellContextMenu(headerRowCount + ri, ci)"
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
  </ContextMenuZone>
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
import { marked, type TokenizerAndRendererExtension } from 'marked';
import { useI18n } from 'vue-i18n';
import ContextMenuZone from '~ims-app-base/components/Common/ContextMenuZone.vue';
import type { MenuListItem } from '~ims-app-base/logic/types/MenuList';

// Teach `marked` to render Obsidian-style `==highlight==` as `<mark>`. This is
// the same highlight syntax the editor decorates, so the read-only / cell
// preview matches the live editor.
const highlightExtension: TokenizerAndRendererExtension = {
  name: 'highlight',
  level: 'inline',
  start(src: string) {
    return src.indexOf('==');
  },
  tokenizer(src: string) {
    const match = /^==([^=\n]+)==/.exec(src);
    if (match) {
      return {
        type: 'highlight',
        raw: match[0],
        text: match[1],
      };
    }
  },
  renderer(token) {
    return `<mark>${token.text}</mark>`;
  },
};
marked.use({ extensions: [highlightExtension] });

// Shared across widget instances. When a cell commit changes the row count the
// whole widget is re-created by CodeMirror (its `eq` is false), so the "next
// cell to keep editing" has to be handed over to the new widget instance
// through this reactive object.
const pendingEditTarget = reactive({
  tableFrom: -1,
  row: -1,
  col: -1,
});

// Fallback labels used when `useI18n` can't resolve (widget rendered outside
// the Nuxt app tree without the i18n composer injected).
const TABLE_CONTEXT_MENU_EN: Record<string, string> = {
  tableAddRowBefore: 'Add row before',
  tableAddRowAfter: 'Add row after',
  tableRemoveRow: 'Remove row',
  tableAddColumnBefore: 'Add column before',
  tableAddColumnAfter: 'Add column after',
  tableRemoveColumn: 'Remove column',
};

export default defineComponent({
  name: 'TableWidget',
  components: {
    ContextMenuZone,
  },
  setup() {
    let t = (key: string) => TABLE_CONTEXT_MENU_EN[key] ?? key;
    try {
      const { t: translate } = useI18n();
      t = translate as (key: string) => string;
    } catch {
      // i18n is not available in this render context — use the fallback labels.
    }
    return { t };
  },
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
      _contextCell: null as { row: number; col: number } | null,
      _nestedEditor: null as EditorView | null,
      _committing: false,
      _commitDispatchPending: false,
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

    onCellContextMenu(row: number, col: number) {
      // Remember the cell under the pointer; `getContextMenu` is read by
      // `ContextMenuZone` right after this handler runs (during bubbling).
      this._contextCell = { row, col };
    },

    getContextMenu(): MenuListItem[] {
      const target = this._contextCell;
      if (!target) return [];
      const row = target.row;
      const col = target.col;
      const t = this.t as (key: string) => string;
      return [
        {
          title: t('markdownBlock.tableRemoveRow'),
          icon: 'ri-delete-row',
          danger: true,
          action: () => this.removeRow(row),
        },
        {
          title: t('markdownBlock.tableRemoveColumn'),
          icon: 'ri-delete-column',
          danger: true,
          action: () => this.removeColumn(col),
        },
        { type: 'separator' },
        {
          title: t('markdownBlock.tableAddRowBefore'),
          icon: 'ri-insert-row-top',
          action: () => this.addRow(row, true),
        },
        {
          title: t('markdownBlock.tableAddRowAfter'),
          icon: 'ri-insert-row-bottom',
          action: () => this.addRow(row, false),
        },
        {
          title: t('markdownBlock.tableAddColumnBefore'),
          icon: 'ri-insert-column-left',
          action: () => this.addColumn(col, true),
        },
        {
          title: t('markdownBlock.tableAddColumnAfter'),
          icon: 'ri-insert-column-right',
          action: () => this.addColumn(col, false),
        },
      ];
    },

    addRow(index: number, before: boolean) {
      const colCount = this.rows[0]?.length ?? 1;
      const target = before ? index : index + 1;
      this.applyStructuralChange((rows) => {
        rows.splice(target, 0, Array(colCount).fill(''));
        return rows;
      });
    },

    removeRow(index: number) {
      this.applyStructuralChange((rows) => {
        if (index >= 0 && index < rows.length) rows.splice(index, 1);
        return rows;
      });
    },

    addColumn(index: number, before: boolean) {
      const target = before ? index : index + 1;
      this.applyStructuralChange((rows) => {
        for (const row of rows) row.splice(target, 0, '');
        return rows;
      });
    },

    removeColumn(index: number) {
      this.applyStructuralChange((rows) => {
        for (const row of rows) {
          if (index >= 0 && index < row.length) row.splice(index, 1);
        }
        return rows;
      });
    },

    applyStructuralChange(transform: (rows: string[][]) => string[][]) {
      if (this._committing) return;
      // A blur-triggered `commitEdit` may have already queued a dispatch that
      // hasn't been applied to the parent state yet; wait for it so the range
      // lookup below works against the committed document.
      if (this._commitDispatchPending) {
        requestAnimationFrame(() => this.applyStructuralChange(transform));
        return;
      }
      const rows = this.rows.map((r) => [...r]);

      // Fold any in-progress cell edit into the working copy first.
      if (this._nestedEditor && this._activeCell) {
        const { row, col } = this._activeCell;
        rows[row][col] = this._nestedEditor.state.doc
          .toString()
          .replace(/\n/g, '<br>');
        this._cleanupNestedEditor();
        this._activeCell = null;
      }

      const newRows = transform(rows);
      const range = this.findCurrentTableRange();
      this.rows = newRows;
      if (!range) return;

      const fullMarkdown = this.reconstructTable(newRows);
      queueMicrotask(() => {
        this.parentView.dispatch({
          changes: { from: range.from, to: range.to, insert: fullMarkdown },
        });
      });
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
          keymap.of([
            { key: 'Enter', run: enterNext },
            { key: 'Shift-Enter', run: insertNewlineAndIndent },
            ...defaultKeymap,
            ...historyKeymap,
            { key: 'Escape', run: commit },
            { key: 'Tab', run: tabNext },
            { key: 'Shift-Tab', run: tabPrev },
          ] as KeyBinding[]),
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
        this._commitDispatchPending = true;
        queueMicrotask(() => {
          this.parentView.dispatch({
            changes: { from: range.from, to: range.to, insert: fullMarkdown },
          });
          this._commitDispatchPending = false;
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
      // Keep the grid rectangular: empty markdown cells re-parse as zero
      // cells, so pad short rows to the header's column count.
      const colCount = newRows[0]?.length ?? 0;
      const rows = newRows.map((r) => {
        const row = [...r];
        while (row.length < colCount) row.push('');
        return row;
      });

      const lines: string[] = [];
      if (this.hasHeader) {
        lines.push(`| ${rows[0].join(' | ')} |`);
        lines.push(this.delimiterFor(colCount));
        for (let r = 1; r < rows.length; r++) {
          lines.push(`| ${rows[r].join(' | ')} |`);
        }
      } else {
        for (const row of rows) {
          lines.push(`| ${row.join(' | ')} |`);
        }
      }
      return lines.join('\n');
    },

    delimiterFor(colCount: number): string {
      // Reuse the original delimiter when its column count still matches,
      // otherwise regenerate a plain one so the table keeps parsing as a table.
      const dt = this.delimiterText;
      if (dt) {
        const inner = dt.trim().replace(/^\|/, '').replace(/\|$/, '');
        const cellCount = inner
          ? inner.split('|').filter((s) => s.trim().length > 0).length
          : 0;
        if (cellCount === colCount) return dt;
      }
      return `|${Array(colCount).fill('---').join('|')}|`;
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
.TableWidget-context {
  width: 100%;
}

.cm-table-cell {
  border: 1px solid var(--local-border-color, #ccc);
  padding: 0 4px;
  vertical-align: top;
  font-weight: 400;
  min-width: 3em;
}
/* `min-height` on a table-cell is ignored by browsers, so the cell collapses
   to zero height when its markdown is empty and becomes unclickable. Keep a
   minimum height on the inner block elements instead. */
.TableWidget-cell-presenter,
.TableWidget-cell-editor {
  min-height: 1.5em;
}
.cm-table-header {
  font-weight: 600;
  background: var(--local-hl-bg-color, #f5f5f5);
}
</style>
