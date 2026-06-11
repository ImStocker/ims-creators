<template>
  <div class="GraphBlock">
    <template v-if="displayMode !== 'print'">
      <div
        v-if="editorComponentLoading"
        class="GraphBlock-loading loaderSpinner"
      ></div>
      <div
        v-else-if="editorComponentError"
        class="GraphBlock-error error-message-block"
      >
        {{ editorComponentError }}
      </div>
      <component
        :is="editorComponent"
        v-else-if="editorComponent"
        ref="editor"
        :readonly="readonly"
        :resolved-block="resolvedBlock"
        :asset-changer="assetChanger"
        :toolbar-target="toolbarTarget"
        :block-controller="blockController"
        class="GraphBlock-editor"
        @focus="enterEditMode()"
      ></component>
    </template>
  </div>
</template>

<script lang="ts">
import {
  type PropType,
  defineComponent,
  type Component,
  shallowRef,
} from 'vue';
import type {
  AssetDisplayMode,
  ResolvedAssetBlock,
} from '~ims-app-base/logic/utils/assets';
import type { AssetBlockEditorVM } from '~ims-app-base/logic/vm/AssetBlockEditorVM';
import type { EditorBlockHandler } from '~ims-app-base/components/Asset/Editor/EditorBlock';
import type { AssetChanger } from '~ims-app-base/logic/types/AssetChanger';
import { isElementInteractive } from '~ims-app-base/components/utils/DomElementUtils';
import {
  type SetClickOutsideCancel,
  setImsClickOutside,
} from '~ims-app-base/components/utils/ui';
import type GraphEditor from './editor/GraphEditor.vue';
import type { GraphBlockController } from './editor/GraphBlockController';

export default defineComponent({
  name: 'GraphBlock',
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
      type: Object as PropType<GraphBlockController>,
      required: true,
    },
  },
  data() {
    let mountResolve!: (success: boolean) => void;
    const mountPromise = new Promise<boolean>((res) => (mountResolve = res));
    return {
      editorComponent: shallowRef(null as null | Component),
      editorComponentLoading: true,
      editorComponentError: null as null | string,
      clickOutside: null as SetClickOutsideCancel | null,
      toolbarTarget: null as null | HTMLElement,
      mountPromise,
      mountResolve,
    };
  },
  computed: {
    editMode() {
      return this.assetBlockEditor.isBlockEditing(this.resolvedBlock.id);
    },
  },
  async mounted() {
    this.toolbarTarget = await this.requestToolbarTarget();
    const loaded = await this.reloadComponent();
    await new Promise((res) => setTimeout(res, 100));
    this.mountResolve(loaded);
  },
  unmounted() {
    this.mountResolve(false);
  },
  methods: {
    async reloadComponent() {
      this.editorComponentLoading = true;
      this.editorComponentError = null;
      try {
        this.editorComponent = (await import('./editor/GraphEditor.vue')).default;
        return true;
      } catch (err: any) {
        this.editorComponentError = err.message;
        return false;
      } finally {
        this.editorComponentLoading = false;
      }
    },
    async enterEditMode(ev?: MouseEvent) {
      if (this.readonly) return;
      if (this.editMode) return;
      if (ev && isElementInteractive(ev.target as HTMLElement)) return;

      this.assetBlockEditor.enterEditMode(this.resolvedBlock.id);
      this.resetClickOutside(true);
    },
    async save() {
      if (this.readonly) return;

      const editor = this.$refs['editor'] as InstanceType<typeof GraphEditor> | null;
      if (!editor) return;

      this.blockController.saveProps();
      await this.editorBlockHandler.save();
      this.assetBlockEditor.exitEditMode();
      this.resetClickOutside(false);
    },
    resetClickOutside(restart: boolean) {
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
    async revealBlockAnchor(blockAnchor: string): Promise<boolean> {
      if (!blockAnchor.startsWith('node-')) return false;
      const node_id = blockAnchor.slice('node-'.length);
      const mounted = await this.mountPromise;
      if (!mounted) return false;
      const editor = this.$refs['editor'] as InstanceType<typeof GraphEditor> | null;
      if (!editor) return false;
      return await editor.showNode(node_id);
    },
  },
});
</script>

<style lang="scss" scoped>
.GraphBlock-editor {
  width: 100%;
  height: 100%;
}
</style>
