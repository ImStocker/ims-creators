<template>
  <div class="MarkdownBlockEditor" :class="{ 'cm-live-preview': livePreview }">
    <ContextMenuZone
      class="MarkdownBlockEditor-container"
      :get-menu-list="getContextMenu"
      :disabled="readonly"
    >
      <ink-mde
        ref="editor"
        v-model="ownModelValue"
        class="MarkdownBlockEditor-editor"
        :options="options"
        @focus="$emit('focus')"
        @contextmenu="onEditorContextMenu"
      ></ink-mde>
    </ContextMenuZone>
    <div
      v-if="toolbarVisible && toolbarRect"
      class="MarkdownBlockEditor-toolbar-target"
      :style="toolbarTargetStyle"
    >
      <dropdown-container
        attach-position="top"
        align-position="center"
        class="MarkdownBlockEditor-toolbar-container"
      >
        <SelectionToolbar
          :rect="toolbarRect"
          :active="toolbarActive"
          :inline-only="toolbarInCell"
          :text="toolbarSelection ? toolbarSelection.text : ''"
          @format="onToolbarFormat"
        ></SelectionToolbar>
      </dropdown-container>
    </div>
    <button
      type="button"
      class="MarkdownBlockEditor-mode-toggle"
      :title="livePreview ? 'Switch to source mode' : 'Switch to live preview'"
      @click="toggleLivePreview"
    >
      <i :class="livePreview ? 'ri-eye-line' : 'ri-code-line'"></i>
    </button>
  </div>
</template>
<script lang="ts">
import { defineComponent, toRaw } from 'vue';
import type { Options as InkOptions, Instance as InkInstance } from 'ink-mde';
import type { EditorView } from '@codemirror/view';
import InkMde from 'ink-mde/vue';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import { assert } from '~ims-app-base/logic/utils/typeUtils';
import {
  wikiLinks,
  wikiLinkCellExtensions,
  wikiLinkGrammar,
} from './plugins/wiki-links';
import { imcImages } from './plugins/imc-images';
import EditorManager from '~ims-app-base/logic/managers/EditorManager';
import { blurHandler } from './plugins/blur-handler';
import { headingId } from './plugins/heading-id';
import { tables } from './plugins/tables';
import { selectionToolbar } from './plugins/selection-toolbar';
import type { SelectionInfo } from './plugins/selection-toolbar';
import { shortcuts } from './plugins/shortcuts';
import {
  applyFormat,
  detectActive,
  insertTable,
  insertHorizontalRule,
  type ActiveFormats,
  type FormatType,
  type FormatPayload,
} from './format-commands';
import { markStyles } from './plugins/mark-styles';
import { livePreview } from './plugins/live-preview';
import { viewToInkLike } from './editor-adapter';
import SelectionToolbar from './SelectionToolbar.vue';
import DropdownContainer from '~ims-app-base/components/Common/DropdownContainer.vue';
import ContextMenuZone from '~ims-app-base/components/Common/ContextMenuZone.vue';
import type { MenuListItem } from '~ims-app-base/logic/types/MenuList';
import DialogManager from '~ims-app-base/logic/managers/DialogManager';
import SelectAssetDialog from '~ims-app-base/components/Asset/SelectAssetDialog.vue';

export default defineComponent({
  name: 'MarkdownBlockEditor',
  components: {
    InkMde,
    SelectionToolbar,
    DropdownContainer,
    ContextMenuZone,
  },
  props: {
    readonly: {
      type: Boolean,
      default: false,
    },
    modelValue: {
      type: String,
      default: '',
    },
  },
  emits: ['focus', 'update:model-value', 'blur'],

  data() {
    return {
      editor: null as InkInstance | null,
      livePreview: true,
      toolbarSelection: null as SelectionInfo | null,
      toolbarRect: null as SelectionInfo['rect'] | null,
      toolbarVisible: false,
      toolbarActive: null as ActiveFormats | null,
      toolbarInCell: false,
      toolbarTargetView: null as EditorView | null,
      contextSelection: null as SelectionInfo | null,
    };
  },
  computed: {
    toolbarTargetStyle(): Record<string, string> {
      const r = this.toolbarRect;
      if (!r) return {};
      const gap = 8;
      return {
        left: `${r.left}px`,
        top: `${r.top - gap}px`,
        width: `${Math.max(r.right - r.left, 1)}px`,
        height: `${Math.max(r.bottom - r.top, 1)}px`,
      };
    },
    ownModelValue: {
      get() {
        return this.modelValue;
      },
      set(val: string) {
        this.$emit('update:model-value', val);
      },
    },
    colorTheme() {
      return this.$getAppManager().get(UiManager).getColorTheme();
    },
    options(): InkOptions {
      return {
        interface: {
          appearance: this.colorTheme === 'ims-dark' ? 'dark' : 'light',
          attribution: false,
          autocomplete: true,
          images: false,
          lists: true,
          readonly: false,
          spellcheck: true,
          toolbar: false,
        },
        files: {
          clipboard: true,
          dragAndDrop: true,
          handler: (files: FileList) => {
            for (const file of files) {
              const upload_job = this.$getAppManager()
                .get(EditorManager)
                .attachFile(file, file.name);
              upload_job.awaitResult().then(
                (img) => {
                  if (img) {
                    const need_brackets = (
                      img.Store +
                      img.Dir +
                      img.Title
                    ).includes(' ');
                    let path = `@${img.Store}/${img.Dir ? img.Dir + '/' : ''}${img.Title}`;
                    if (img.Store.startsWith('p-')) {
                      path += '#' + img.FileId;
                    }
                    if (need_brackets) {
                      path = `<${path}>`;
                    }

                    const markup = `![](${path})`;

                    this.editor?.insert(markup);
                  }
                },
                (err) => this.$getAppManager().get(UiManager).showError(err),
              );
            }
          },
          types: ['image/*'],
        },
        plugins: [...toRaw(this.plugins)] as any,
      };
    },
    plugins() {
      return [
        ...wikiLinks({ appManager: this.$getAppManager() }),
        ...imcImages({ appManager: this.$getAppManager() }),
        ...blurHandler(() => {
          this.$emit('blur');
        }),
        ...headingId(),
        ...tables(this.$.appContext, {
          grammar: wikiLinkGrammar,
          extensions: [
            ...wikiLinkCellExtensions({
              appManager: this.$getAppManager(),
            }),
            // Inline-markup decorations (highlight, code, math, bold, italic,
            // strikethrough, hr) so a table cell's nested editor renders text
            // formatting the same way the main editor does. Also the
            // Live Preview marker-hiding extension. Both are dropped in Source
            // mode so the cell editor shows raw markdown.
            ...(this.livePreview ? markStyles() : []),
            ...(this.livePreview ? [livePreview()] : []),
            // Inside table cells the nested editor is a raw CodeMirror view, so
            // it needs its own selection toolbar + shortcuts. These route back
            // into the same Vue toolbar, but flag the context as a cell so only
            // inline (text) formatting tools are offered.
            selectionToolbar({
              onSelection: (info: SelectionInfo | null, view: EditorView) => {
                this.toolbarInCell = true;
                this.toolbarTargetView = view;
                if (info && !this.readonly) {
                  this.toolbarSelection = info;
                  this.toolbarRect = info.rect;
                  this.toolbarVisible = true;
                  this.toolbarActive = detectActive(viewToInkLike(view), info);
                } else {
                  this.toolbarVisible = false;
                  this.toolbarSelection = null;
                  this.toolbarActive = null;
                  this.toolbarInCell = false;
                  this.toolbarTargetView = null;
                }
              },
            }),
            shortcuts(() => this.readonly),
          ],
        }),
        {
          type: 'default',
          value: selectionToolbar({
            onSelection: (info: SelectionInfo | null, view: EditorView) => {
              this.toolbarInCell = false;
              this.toolbarTargetView = view;
              if (info && !this.readonly) {
                this.toolbarSelection = info;
                this.toolbarRect = info.rect;
                this.toolbarVisible = true;
                this.toolbarActive = this.editor
                  ? detectActive(this.editor, info)
                  : null;
              } else {
                this.toolbarVisible = false;
                this.toolbarSelection = null;
                this.toolbarActive = null;
              }
            },
          }),
        },
        ...(this.livePreview
          ? [{ type: 'default' as const, value: markStyles() }]
          : []),
        ...(this.livePreview
          ? [{ type: 'default' as const, value: livePreview() }]
          : []),
        {
          type: 'default',
          value: shortcuts(() => this.readonly),
        },
      ];
    },
  },
  mounted() {
    const editor = this.$refs['editor'] as InstanceType<typeof InkMde> | null;
    assert(editor?.instance);
    this.editor = editor.instance;
  },
  methods: {
    focus() {
      if (!this.editor) return;
      this.editor.focus();
    },
    toggleLivePreview() {
      this.livePreview = !this.livePreview;
      this.editor?.reconfigure({ plugins: toRaw(this.plugins) });
      this.editor?.focus();
    },
    onToolbarFormat(payload: { type: FormatType; payload?: FormatPayload }) {
      if (!this.toolbarSelection) return;
      const target =
        this.toolbarInCell && this.toolbarTargetView
          ? viewToInkLike(this.toolbarTargetView)
          : this.editor;
      if (!target) return;
      applyFormat(
        target,
        this.toolbarSelection,
        payload.type,
        payload.payload ?? {},
      );
      target.focus();
    },
    onEditorContextMenu() {
      this.contextSelection = this.currentSelectionInfo();
    },
    currentSelectionInfo(): SelectionInfo {
      const ed = this.editor;
      if (!ed) {
        return {
          from: 0,
          to: 0,
          text: '',
          rect: { left: 0, top: 0, right: 0, bottom: 0 },
        };
      }
      const sels = ed.selections();
      const s = sels[0] ?? { start: 0, end: 0 };
      const doc = ed.getDoc();
      return {
        from: s.start,
        to: s.end,
        text: doc.slice(s.start, s.end),
        rect: { left: 0, top: 0, right: 0, bottom: 0 },
      };
    },
    getContextMenu(): MenuListItem[] {
      const sel = this.contextSelection;
      const ed = this.editor;
      if (!ed || !sel) return [];
      const fmt = (type: FormatType) => () => {
        if (this.editor) {
          applyFormat(this.editor, sel, type);
          this.editor.focus();
        }
      };
      const block =
        (type: FormatType, payload: FormatPayload = {}) =>
        () => {
          if (this.editor) {
            applyFormat(this.editor, sel, type, payload);
            this.editor.focus();
          }
        };
      return [
        {
          title: 'Insert link',
          name: 'ctx-insert-link',
          icon: 'ri-link',
          action: () => this.insertAssetLink(sel),
        },
        {
          title: 'Insert external link',
          name: 'ctx-insert-ext-link',
          icon: 'ri-external-link-line',
          action: () => this.insertExternalLink(sel),
        },
        { type: 'separator', name: 'ctx-sep-1' },
        {
          title: 'Format',
          name: 'ctx-format',
          icon: 'ri-text',
          children: [
            {
              title: 'Bold',
              name: 'ctx-bold',
              icon: 'ri-bold',
              action: fmt('bold'),
            },
            {
              title: 'Italic',
              name: 'ctx-italic',
              icon: 'ri-italic',
              action: fmt('italic'),
            },
            {
              title: 'Strikethrough',
              name: 'ctx-strike',
              icon: 'ri-strikethrough',
              action: fmt('strike'),
            },
            {
              title: 'Highlight',
              name: 'ctx-highlight',
              icon: 'ri-mark-pen-fill',
              action: fmt('highlight'),
            },
            {
              title: 'Inline code',
              name: 'ctx-code',
              icon: 'ri-code-s-slash-fill',
              action: fmt('code'),
            },
            {
              title: 'Superscript',
              name: 'ctx-sup',
              icon: 'ri-superscript',
              action: fmt('superscript'),
            },
            {
              title: 'Subscript',
              name: 'ctx-sub',
              icon: 'ri-subscript',
              action: fmt('subscript'),
            },
            {
              title: 'Formula',
              name: 'ctx-formula',
              icon: 'ri-formula',
              action: fmt('formula'),
            },
          ],
        },
        {
          title: 'Paragraph',
          name: 'ctx-paragraph',
          icon: 'ri-paragraph',
          children: [
            {
              title: 'Heading 1',
              name: 'ctx-h1',
              icon: 'ri-h-1',
              action: block('h1'),
            },
            {
              title: 'Heading 2',
              name: 'ctx-h2',
              icon: 'ri-h-2',
              action: block('h2'),
            },
            {
              title: 'Heading 3',
              name: 'ctx-h3',
              icon: 'ri-h-3',
              action: block('h3'),
            },
            {
              title: 'Heading 4',
              name: 'ctx-h4',
              icon: 'ri-h-4',
              action: block('h4'),
            },
            { type: 'separator', name: 'ctx-sep-p1' },
            {
              title: 'Bullet list',
              name: 'ctx-bullet',
              icon: 'ri-list-unordered',
              action: block('bullet_list'),
            },
            {
              title: 'Numbered list',
              name: 'ctx-ordered',
              icon: 'ri-list-ordered',
              action: block('ordered_list'),
            },
            {
              title: 'Task list',
              name: 'ctx-task',
              icon: 'ri-list-check-2',
              action: block('task_list'),
            },
            {
              title: 'Quote',
              name: 'ctx-quote',
              icon: 'ri-double-quotes-r',
              action: block('quote'),
            },
            { type: 'separator', name: 'ctx-sep-p2' },
            {
              title: 'Notice block',
              name: 'ctx-notice',
              icon: 'ri-text-block',
              children: [
                {
                  title: 'Info',
                  name: 'ctx-note-info',
                  icon: 'ri-information-2-line',
                  action: block('callout', { calloutType: 'info' }),
                },
                {
                  title: 'Warning',
                  name: 'ctx-note-warning',
                  icon: 'ri-alert-line',
                  action: block('callout', { calloutType: 'warning' }),
                },
                {
                  title: 'Solution',
                  name: 'ctx-note-solution',
                  icon: 'ri-checkbox-circle-line',
                  action: block('callout', { calloutType: 'solution' }),
                },
                {
                  title: 'Error',
                  name: 'ctx-note-error',
                  icon: 'ri-error-warning-line',
                  action: block('callout', { calloutType: 'error' }),
                },
              ],
            },
          ],
        },
        {
          title: 'Insert',
          name: 'ctx-insert',
          icon: 'ri-add-line',
          children: [
            {
              title: 'Table',
              name: 'ctx-table',
              icon: 'ri-table-2',
              action: () => {
                if (this.editor) insertTable(this.editor, sel);
              },
            },
            {
              title: 'Horizontal rule',
              name: 'ctx-hr',
              icon: 'ri-separator',
              action: () => {
                if (this.editor) insertHorizontalRule(this.editor, sel);
              },
            },
            {
              title: 'Code block',
              name: 'ctx-codeblock',
              icon: 'ri-code-box-fill',
              action: block('code_block'),
            },
          ],
        },
        { type: 'separator', name: 'ctx-sep-2' },
        {
          title: 'Cut',
          name: 'ctx-cut',
          icon: 'ri-scissors-cut-line',
          disabled: sel.text.length === 0,
          action: () => this.cutText(sel),
        },
        {
          title: 'Copy',
          name: 'ctx-copy',
          icon: 'ri-file-copy-line',
          disabled: sel.text.length === 0,
          action: () => this.copyText(sel),
        },
        {
          title: 'Paste',
          name: 'ctx-paste',
          icon: 'ri-clipboard-line',
          action: () => this.pasteText(sel),
        },
        {
          title: 'Select all',
          name: 'ctx-select-all',
          icon: 'ri-checkbox-multiple-line',
          action: () => this.selectAllText(),
        },
      ];
    },
    insertAssetLink(sel: SelectionInfo) {
      const ed = this.editor;
      if (!ed) return;
      const dialog = this.$getAppManager()
        .get(DialogManager)
        .show(SelectAssetDialog, {}, this);
      dialog.then((res) => {
        if (res && (res as { id?: string }).id) {
          const id = (res as { id: string }).id;
          const name = (res as { name?: string }).name ?? '';
          applyFormat(ed, sel, 'link', { internal: id, internalName: name });
          ed.focus();
        }
      });
    },
    insertExternalLink(sel: SelectionInfo) {
      const ed = this.editor;
      if (!ed) return;
      const from = sel.from;
      ed.insert('[]()', { start: sel.from, end: sel.to });
      ed.select({ selection: { start: from + 1, end: from + 1 } });
      ed.focus();
    },
    async copyText(sel: SelectionInfo) {
      const text = sel.text;
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        /* ignore */
      }
    },
    async cutText(sel: SelectionInfo) {
      const ed = this.editor;
      const text = sel.text;
      if (!ed || !text) return;
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        /* ignore */
      }
      ed.focus();
      ed.insert('', { start: sel.from, end: sel.to });
      ed.select({ selection: { start: sel.from, end: sel.from } });
    },
    async pasteText(sel: SelectionInfo) {
      const ed = this.editor;
      if (!ed) return;
      let text = '';
      try {
        text = await navigator.clipboard.readText();
      } catch {
        return;
      }
      if (text) {
        ed.focus();
        ed.insert(text, { start: sel.from, end: sel.to });
      }
    },
    selectAllText() {
      const ed = this.editor;
      if (!ed) return;
      ed.focus();
      const len = ed.getDoc().length;
      ed.select({ selection: { start: 0, end: len } });
    },
  },
});
</script>
<style lang="scss">
.MarkdownBlockEditor-container {
  .ink-mde {
    --ink-syntax-heading1-font-size: 20px;
    --ink-syntax-heading2-font-size: 18px;
    --ink-syntax-heading3-font-size: 17px;
    --ink-syntax-heading4-font-size: 16px;
    --ink-syntax-heading5-font-size: 1.02em;
    --ink-syntax-heading6-font-size: 1em;
    border: none;

    .ink-mde-editor {
      padding: 0;
    }
  }
  .cm-focused {
    outline: none;
  }

  .cm-md-highlight {
    background-color: rgba(255, 221, 0, 0.35);
    border-radius: 2px;
  }

  .cm-md-math {
    color: var(--color-accent, #2f80ed);
    font-style: italic;
  }

  .cm-md-bold {
    font-weight: 700;
  }

  .cm-md-italic {
    font-style: italic;
  }

  .cm-md-strike {
    text-decoration: line-through;
  }

  .cm-code {
    background-color: rgba(135, 131, 120, 0.18);
    font-family: var(--ink-internal-code-font-family, monospace);
    border-radius: 3px;
    padding: 0.1em 0.3em;
  }

  .cm-md-hr {
    border: none;
    border-top: 1px solid var(--ink-internal-color, currentColor);
    width: 100%;
    margin: 0.5em 0;
  }

  .ink-mde .cm-line.cm-md-callout {
    --callout-color: 204, 204, 204;
    border-left: 4px solid rgb(var(--callout-color)) !important;
    color: rgb(var(--callout-color)) !important;
    padding-left: 16px !important;
    background-color: rgba(var(--callout-color), 0.2) !important;

    &.cm-md-callout-info {
      --callout-color: 29, 153, 255;
    }
    &.cm-md-callout-error {
      --callout-color: 255, 83, 83;
    }
    &.cm-md-callout-warning {
      --callout-color: 255, 182, 26;
    }
    &.cm-md-callout-solution {
      --callout-color: 85, 203, 81;
    }
  }
}

body[data-theme='ims-light'] {
  .cm-md-callout-error {
    --callout-color: 233, 49, 71 !important;
  }
  .cm-md-callout-warning {
    --callout-color: 236, 117, 0 !important;
  }
  .cm-md-callout-solution {
    --callout-color: 8, 185, 78 !important;
  }

  .MarkdownBlockEditor-container .ink-mde {
    --ink-syntax-keyword-color: #d73a49;
    --ink-syntax-string-color: #032f62;
    --ink-syntax-string-special-color: #032f62;
    --ink-syntax-number-color: #005cc5;
    --ink-syntax-atom-color: #005cc5;
    --ink-syntax-meta-color: #005cc5;
    --ink-syntax-operator-color: #005cc5;
    --ink-syntax-name-variable-color: #005cc5;
    --ink-syntax-name-property-color: #005cc5;
    --ink-syntax-name-label-color: #6f42c1;
    --ink-syntax-name-variable-definition-color: #6f42c1;
    --ink-syntax-name-property-definition-color: #6f42c1;
    --ink-syntax-name-variable-special-color: #e36209;
    --ink-syntax-name-color: #22863a;
    --ink-syntax-comment-color: #6a737d;
    --ink-syntax-comment-font-style: italic;
    --ink-syntax-processing-instruction-color: #6a737d;
    --ink-syntax-punctuation-color: #24292e;
    --ink-syntax-link-color: #24292e;
    --ink-syntax-url-color: #24292e;
  }
}

body[data-theme='ims-dark'] {
  .MarkdownBlockEditor-container .ink-mde {
    --ink-syntax-keyword-color: #ff7b72;
    --ink-syntax-string-color: #a5d6ff;
    --ink-syntax-string-special-color: #a5d6ff;
    --ink-syntax-number-color: #79c0ff;
    --ink-syntax-atom-color: #79c0ff;
    --ink-syntax-meta-color: #79c0ff;
    --ink-syntax-operator-color: #79c0ff;
    --ink-syntax-name-variable-color: #79c0ff;
    --ink-syntax-name-property-color: #79c0ff;
    --ink-syntax-name-label-color: #d2a8ff;
    --ink-syntax-name-variable-definition-color: #d2a8ff;
    --ink-syntax-name-property-definition-color: #d2a8ff;
    --ink-syntax-name-variable-special-color: #ffa657;
    --ink-syntax-name-color: #7ee787;
    --ink-syntax-comment-color: #8b949e;
    --ink-syntax-comment-font-style: italic;
    --ink-syntax-processing-instruction-color: #8b949e;
    --ink-syntax-punctuation-color: #c9d1d9;
    --ink-syntax-link-color: #c9d1d9;
    --ink-syntax-url-color: #c9d1d9;
  }
}

.MarkdownBlockEditor.cm-live-preview {
  .cm-md-mark-hidden {
    display: none;
  }
  .cm-line.cm-codeblock {
    background-color: var(--ink-internal-block-background-color);
  }
  .cm-md-line-blockquote {
    border-left: 2px solid var(--ink-internal-syntax-comment-color, #8b949e);
    padding-left: 0.75em;
  }
  .cm-md-line-list {
    padding-left: 1.25em;
  }
  .cm-md-line-hr {
    border-top: 1px solid var(--ink-internal-color, #cfcfcf);
    padding-top: 0.4em;
    margin-top: 0.2em;
  }
}
</style>

<style lang="scss" scoped>
@use '~ims-app-base/style/imc-text-format.scss';
@use '~ims-app-base/style/scrollbars-mixins.scss';

.MarkdownBlockEditor-container,
.MarkdownBlockEditor-editor,
:deep(.ink-mde),
:deep(.ink-mde-editor),
:deep(.cm-editor) {
  min-height: 100%;
}

:deep(.cm-scroller) {
  @include scrollbars-mixins.tiny-scrollbars;
}

.MarkdownBlockEditor {
  @include imc-text-format.imc-text-format;
  position: relative;

  .MarkdownBlockEditor-toolbar-target {
    position: fixed;
    pointer-events: none;
  }

  &:deep(.ink-mde) {
    --ink-internal-block-background-color: var(--local-box-color);
    .cm-line.cm-codeblock {
      font-size: 0.9em;
    }
    .cm-line .cm-code {
      font-size: 0.9em;
    }

    .MarkdownBlockEditor-mode-toggle {
      position: absolute;
      top: 4px;
      right: 4px;
      z-index: 5;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      color: var(--local-sub-text-color, #888);
      background: var(--local-box-color, rgba(0, 0, 0, 0.05));

      &:hover {
        color: var(--color-accent, #2f80ed);
      }
    }
  }
}
</style>
