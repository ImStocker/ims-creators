<template>
  <div class="AssetEditorDialogBlock">
    <template v-if="displayMode !== 'print'">
      <div
        v-if="dialogEditorComponentLoading"
        class="AssetEditorDialogBlock-loading loaderSpinner"
      ></div>
      <div
        v-else-if="dialogEditorComponentError"
        class="AssetEditorDialogBlock-error error-message-block"
      >
        {{ dialogEditorComponentError }}
      </div>
      <component
        :is="dialogEditorComponent"
        v-else-if="dialogEditorComponent"
        ref="editor"
        :readonly="readonly"
        :resolved-block="resolvedBlock"
        :asset-changer="assetChanger"
        :toolbar-target="toolbarTarget"
        :block-controller="blockController"
        class="AssetEditorDialogBlock-editor"
        @focus="enterEditMode()"
      >
        <template #play-toolbar="{ dialogPlayer }">
          <slot name="play-toolbar" :dialog-player="dialogPlayer"></slot>
        </template>
      </component>
    </template>

    <dialog-print v-else :resolved-block="resolvedBlock"></dialog-print>
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
import DialogPrint from './print/DialogPrint.vue';
import {
  type SetClickOutsideCancel,
  setImsClickOutside,
} from '~ims-app-base/components/utils/ui';
import type DialogEditor from './editor/DialogEditor.vue';
import type { DialogBlockController } from './editor/DialogBlockController';

export default defineComponent({
  name: 'DialogBlock',
  components: {
    DialogPrint,
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
      dialogEditorComponent: shallowRef(null as null | Component),
      dialogEditorComponentLoading: true,
      dialogEditorComponentError: null as null | string,
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
    const component_loaded = await this.reloadComponent();
    await new Promise((res) => setTimeout(res, 100));
    this.mountResolve(component_loaded);
  },
  unmounted() {
    this.mountResolve(false);
  },
  methods: {
    async reloadComponent() {
      this.dialogEditorComponentLoading = true;
      this.dialogEditorComponentError = null;
      try {
        this.dialogEditorComponent = (
          await import('./editor/DialogEditor.vue')
        ).default;
        return true;
      } catch (err: any) {
        this.dialogEditorComponentError = err.message;
        return false;
      } finally {
        this.dialogEditorComponentLoading = false;
      }
    },
    async enterEditMode(ev?: MouseEvent) {
      if (this.readonly) return;
      if (this.editMode) return;
      if (ev && isElementInteractive(ev.target as HTMLElement)) return;

      this.assetBlockEditor.enterEditMode(this.resolvedBlock.id);
      this.resetGlobalClickOutside(true);
    },
    async save() {
      if (this.readonly) return;

      const editor = this.$refs['editor'] as InstanceType<
        typeof DialogEditor
      > | null;
      if (!editor) return;

      editor.saveProps();
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
    async revealBlockAnchor(block_anchor: string): Promise<boolean> {
      if (!block_anchor.startsWith('node-')) {
        return false;
      }
      const node_id = block_anchor.slice('node-'.length);
      const mounted = await this.mountPromise;
      if (!mounted) {
        return false;
      }
      const editor = this.$refs['editor'] as InstanceType<
        typeof DialogEditor
      > | null;
      if (!editor) {
        return false;
      }

      return await editor.showNode(node_id);
    },
  },
});
</script>

<style lang="scss" rel="stylesheet/scss" scoped>
.AssetEditorDialogBlock-editor {
  width: 100%;
  height: 100%;
}
</style>
