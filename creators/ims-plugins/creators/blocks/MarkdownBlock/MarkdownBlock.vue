<template>
  <div class="MarkdownBlock">
    <MarkdownFrontMatter
      v-if="hasFrontMatter && showFrontMatter"
      :entries="frontMatterEntries"
      :readonly="readonly"
      @update:entries="onFrontMatterEntriesUpdate"
    />
    <div
      v-if="markdownEditorComponentLoading"
      class="MarkdownBlock-loading loaderSpinner"
    ></div>
    <div
      v-else-if="markdownEditorComponentError"
      class="MarkdownBlock-error error-message-block"
    >
      {{ markdownEditorComponentError }}
    </div>
    <component
      :is="markdownEditorComponent"
      v-else-if="markdownEditorComponent"
      ref="editor"
      :readonly="readonly"
      :model-value="body"
      class="MarkdownBlock-editor"
      @update:model-value="onBodyChange($event)"
      @focus="enterEditMode()"
      @blur="save()"
    ></component>
  </div>
</template>
<script lang="ts">
import {
  defineComponent,
  shallowRef,
  type Component,
  type PropType,
} from 'vue';
import type { AssetChanger } from '~ims-app-base/logic/types/AssetChanger';
import type { AssetBlockEditorVM } from '~ims-app-base/logic/vm/AssetBlockEditorVM';
import type { EditorBlockHandler } from '~ims-app-base/components/Asset/EditorBlock';
import type {
  AssetDisplayMode,
  ResolvedAssetBlock,
} from '~ims-app-base/logic/utils/assets';
import type { DialogBlockController } from '../DialogBlock/editor/DialogBlockController';
import {
  setImsClickOutside,
  type SetClickOutsideCancel,
} from '~ims-app-base/components/utils/ui';
import { makeBlockRef } from '~ims-app-base/logic/types/Props';
import type MarkdownEditor from './editor/MarkdownEditor.vue';
import MarkdownFrontMatter from './MarkdownFrontMatter.vue';

function parseFrontMatter(input: string): {
  data: Record<string, string>;
  body: string;
} {
  const data: Record<string, string> = {};
  const trimmed = input.trim();
  if (!trimmed.startsWith('---')) return { data, body: input };

  const endIdx = trimmed.indexOf('---', 3);
  if (endIdx === -1) return { data, body: input };

  const raw = trimmed.slice(3, endIdx).trim();
  const body = trimmed.slice(endIdx + 3).trim();

  for (const line of raw.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) data[key] = value;
  }

  return { data, body };
}

interface FrontMatterEntry {
  key: string;
  value: string;
}

export default defineComponent({
  name: 'MarkdownBlock',
  components: {
    MarkdownFrontMatter,
  },
  props: {
    readonly: {
      type: Boolean,
      default: false,
    },
    assetChanger: {
      type: Object as PropType<AssetChanger>,
      required: true,
    },
    assetBlockEditor: {
      type: Object as PropType<AssetBlockEditorVM>,
      required: true,
    },
    editorBlockHandler: {
      type: Object as PropType<EditorBlockHandler>,
      required: true,
    },
    resolvedBlock: {
      type: Object as PropType<ResolvedAssetBlock>,
      required: true,
    },
    displayMode: {
      type: String as PropType<AssetDisplayMode>,
      default: () => 'normal',
    },
    requestToolbarTarget: {
      type: Function as PropType<() => Promise<HTMLElement | null>>,
      required: true,
    },
    blockController: {
      type: Object as PropType<DialogBlockController>,
      required: true,
    },
  },
  data() {
    let mountResolve!: (success: boolean) => void;
    const mountPromise = new Promise<boolean>((res) => (mountResolve = res));

    return {
      markdownEditorComponent: shallowRef(null as null | Component),
      markdownEditorComponentLoading: true,
      markdownEditorComponentError: null as null | string,
      clickOutside: null as SetClickOutsideCancel | null,
      mountPromise,
      mountResolve,
      frontMatterEntries: [] as FrontMatterEntry[],
      body: '',
      showFrontMatter: false,
      _parsing: false,
    };
  },
  computed: {
    hasFrontMatter(): boolean {
      return this.frontMatterEntries.length > 0;
    },
    rawValue(): string {
      return this.resolvedBlock.computed['value'] ?? '';
    },
  },
  watch: {
    rawValue: {
      immediate: true,
      handler(val: string) {
        if (this._parsing) return;
        const parsed = parseFrontMatter(val ?? '');
        this.frontMatterEntries = Object.entries(parsed.data).map(([k, v]) => ({
          key: k,
          value: typeof v === 'object' ? JSON.stringify(v) : String(v ?? ''),
        }));
        this.body = parsed.body;
      },
    },
  },
  async mounted() {
    const component_loaded = await this.reloadComponent();
    await new Promise((res) => setTimeout(res, 100));
    this.mountResolve(component_loaded);
  },
  methods: {
    onFocus() {},
    emitValue(text: string) {
      this.assetChanger.setBlockPropKey(
        this.resolvedBlock.assetId,
        makeBlockRef(this.resolvedBlock),
        null,
        'value',
        text,
      );
    },
    buildFullValue(): string {
      if (this.frontMatterEntries.length === 0) return this.body;
      const lines = ['---'];
      for (const entry of this.frontMatterEntries) {
        if (entry.key) {
          const val = entry.value.includes(' ')
            ? `"${entry.value}"`
            : entry.value;
          lines.push(`${entry.key}: ${val}`);
        }
      }
      lines.push('---');
      if (this.body) lines.push('', this.body);
      return lines.join('\n');
    },
    commitValue() {
      const full = this.buildFullValue();
      if (full === this.rawValue) return;
      this._parsing = true;
      this.emitValue(full);
      this.$nextTick(() => {
        this._parsing = false;
      });
    },
    onBodyChange(newBody: string) {
      if (!this.hasFrontMatter) {
        const parsed = parseFrontMatter(newBody);
        if (Object.keys(parsed.data).length > 0) {
          this.frontMatterEntries = Object.entries(parsed.data).map(([k, v]) => ({
            key: k,
            value: typeof v === 'object' ? JSON.stringify(v) : String(v ?? ''),
          }));
          this.body = parsed.body;
          this.showFrontMatter = true;
          this.commitValue();
          return;
        }
      }
      this.body = newBody;
      this.commitValue();
    },
    onFrontMatterEntriesUpdate(entries: FrontMatterEntry[]) {
      this.frontMatterEntries = entries;
      this.commitValue();
    },
    async enterEditMode() {
      if (this.readonly) return;
      await this.mountPromise;
      this.showFrontMatter = true;

      const editor = this.$refs['editor'] as InstanceType<
        typeof MarkdownEditor
      > | null;
      if (editor) {
        editor.focus();
      }

      this.assetBlockEditor.enterEditMode(this.resolvedBlock.id);
      this.resetGlobalClickOutside(true);
    },
    async save() {
      if (this.readonly) return;

      await this.editorBlockHandler.save();
      this.assetBlockEditor.exitEditMode();
      this.resetGlobalClickOutside(false);
    },
    resetGlobalClickOutside(restart: boolean) {
      if (this.clickOutside) {
        this.clickOutside();
        this.clickOutside = null;
      }
      if (restart) {
        this.clickOutside = setImsClickOutside(this.$el, () => {
          this.save();
        });
      }
    },
    async reloadComponent() {
      this.markdownEditorComponentLoading = true;
      this.markdownEditorComponentError = null;
      try {
        this.markdownEditorComponent = (
          await import('./editor/MarkdownEditor.vue')
        ).default;
        return true;
      } catch (err: any) {
        this.markdownEditorComponentError = err.message;
        return false;
      } finally {
        this.markdownEditorComponentLoading = false;
      }
    },
  },
});
</script>
<style lang="scss" scoped>
.MarkdownBlock-editor {
  width: 100%;
  height: 100%;
}
</style>
