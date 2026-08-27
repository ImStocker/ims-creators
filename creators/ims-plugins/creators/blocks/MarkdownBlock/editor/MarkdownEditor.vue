<template>
  <div class="MarkdownBlockEditor">
    <div class="MarkdownBlockEditor-container">
      <ink-mde
        ref="editor"
        v-model="ownModelValue"
        class="MarkdownBlockEditor-editor"
        :options="options"
        @focus="$emit('focus')"
      ></ink-mde>
    </div>
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
          @format="onToolbarFormat"
        ></SelectionToolbar>
      </dropdown-container>
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent, toRaw } from 'vue';
import type { Options as InkOptions, Instance as InkInstance } from 'ink-mde';
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
  type ActiveFormats,
  type FormatType,
  type FormatPayload,
} from './format-commands';
import { markStyles } from './plugins/mark-styles';
import SelectionToolbar from './SelectionToolbar.vue';
import DropdownContainer from '~ims-app-base/components/Common/DropdownContainer.vue';

export default defineComponent({
  name: 'MarkdownBlockEditor',
  components: {
    InkMde,
    SelectionToolbar,
    DropdownContainer,
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
      toolbarSelection: null as SelectionInfo | null,
      toolbarRect: null as SelectionInfo['rect'] | null,
      toolbarVisible: false,
      toolbarActive: null as ActiveFormats | null,
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
          extensions: wikiLinkCellExtensions({
            appManager: this.$getAppManager(),
          }),
        }),
        {
          type: 'default',
          value: selectionToolbar({
            onSelection: (info: SelectionInfo | null) => {
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
        {
          type: 'default',
          value: markStyles(),
        },
        {
          type: 'default',
          value: shortcuts(
            () => this.editor,
            () => this.readonly,
          ),
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
    onToolbarFormat(payload: { type: FormatType; payload?: FormatPayload }) {
      if (!this.editor || !this.toolbarSelection) return;
      applyFormat(
        this.editor,
        this.toolbarSelection,
        payload.type,
        payload.payload ?? {},
      );
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
  }
}
</style>
