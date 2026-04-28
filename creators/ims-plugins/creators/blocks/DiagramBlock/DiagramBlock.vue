<template>
  <div
    v-logical-focus-out="onBlur"
    class="AssetEditorDiagramBlock"
    :data-theme="displayMode === 'print' ? 'ims-light' : undefined"
  >
    <screenshot-renderer
      :disabled="displayMode !== 'print'"
      class="AssetEditorDiagramBlock-inner"
      :ready="ready"
      @rendering-done="$emit('view-ready', $event)"
    >
      <imc-diagram
        ref="diagram"
        :value="graphValue"
        :is-editor="editMode"
        :value-self-updating="diagramValueSelfUpdating"
        :theme="displayMode === 'print' ? 'ims-light' : currentTheme"
        @change="updateChangerValue"
        @click="enterEditMode($event)"
        @ready="readyAction()"
      ></imc-diagram>
    </screenshot-renderer>
  </div>
</template>

<script lang="ts">
import { type PropType, defineComponent } from 'vue';
import type { EditorBlockHandler } from '~ims-app-base/components/Asset/Editor/EditorBlock';
import { isElementInteractive } from '~ims-app-base/components/utils/DomElementUtils';
import {
  type SetClickOutsideCancel,
  setImsClickOutside,
} from '~ims-app-base/components/utils/ui';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import type { AssetChanger } from '~ims-app-base/logic/types/AssetChanger';
import {
  type AssetProps,
  makeBlockRef,
  diffAssetPropObjects,
} from '~ims-app-base/logic/types/Props';
import type {
  ResolvedAssetBlock,
  AssetDisplayMode,
} from '~ims-app-base/logic/utils/assets';
import type { AssetBlockEditorVM } from '~ims-app-base/logic/vm/AssetBlockEditorVM';
import ImcDiagram from './ImcDiagram.vue';
import ScreenshotRenderer from '~ims-app-base/components/Common/ScreenshotRenderer.vue';

export default defineComponent({
  name: 'DiagramBlock',
  components: {
    ImcDiagram,
    ScreenshotRenderer,
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
  },
  emits: ['save', 'discard', 'view-ready'],
  data() {
    return {
      clickOutside: null as SetClickOutsideCancel | null,
      diagramValueSelfUpdating: false,
      ready: false,
    };
  },
  computed: {
    editMode() {
      return this.assetBlockEditor.isBlockEditing(this.resolvedBlock.id);
    },
    graphValue(): AssetProps {
      return this.resolvedBlock.computed;
    },
    currentTheme() {
      return this.$getAppManager().get(UiManager).getColorTheme();
    },
  },
  unmounted() {
    this.resetGlobalClickOutside(false);
  },
  methods: {
    readyAction() {
      this.ready = true;
    },
    onBlur() {
      if (!this.$refs.diagram) return;
      (this.$refs.diagram as any).stopEditing(false);
      this.updateChangerValue();
    },
    async enterEditMode(ev?: MouseEvent) {
      if (this.$refs.diagram) {
        (this.$refs.diagram as any).focus();
      }

      if (this.readonly) return;
      if (this.editMode) return;
      if (ev && isElementInteractive(ev.target as HTMLElement)) return;

      this.assetBlockEditor.enterEditMode(this.resolvedBlock.id);
      this.resetGlobalClickOutside(true);
    },
    updateChangerValue() {
      if (this.readonly) return;

      if (this.$refs.diagram) {
        const res = (this.$refs.diagram as any).getValue();
        if (!res) return;
        const changes = diffAssetPropObjects(res, this.graphValue);
        if (changes && changes.length) {
          this.assetChanger.registerBlockPropsChanges(
            this.resolvedBlock.assetId,
            makeBlockRef(this.resolvedBlock),
            null,
            changes,
          );
        }
      }
    },
    async save() {
      if (this.readonly) return;

      this.diagramValueSelfUpdating = true;
      try {
        this.updateChangerValue();
        await this.editorBlockHandler.save();
        this.assetBlockEditor.exitEditMode();
        this.resetGlobalClickOutside(false);
      } finally {
        this.diagramValueSelfUpdating = false;
      }
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
  },
});
</script>

<style lang="scss" rel="stylesheet/scss" scoped>
.AssetEditorDiagramBlock {
  position: relative;
  border: 1px solid transparent;
  border-radius: 4px;

  &.state-edit {
    border-color: var(--color-main-yellow);
  }
}

.AssetEditorDiagramBlock-different {
  font-style: italic;
  color: #999;
  background-color: var(--local-bg-color);
  padding: 15px 20px;
  border-radius: 4px;
  box-sizing: border-box;
}
.AssetEditorDiagramBlock-inner {
  height: 100%;
}
</style>
