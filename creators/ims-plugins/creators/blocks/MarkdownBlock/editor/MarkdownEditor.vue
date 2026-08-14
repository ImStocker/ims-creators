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

export default defineComponent({
  name: 'MarkdownBlockEditor',
  components: {
    InkMde,
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
    };
  },
  computed: {
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
                    let path = `@${img.Store}/${img.Dir}/${img.Title}`;
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
