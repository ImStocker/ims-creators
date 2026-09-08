<template>
  <div
    ref="container"
    class="LevelEditor"
    @dragover.prevent
    @dragenter.prevent
    @drop.prevent="dragAssetDrop($event)"
  >
    <level-editor-toolbar
      v-if="canvasController"
      :controller="canvasController"
      :readonly="readonly"
      class="LevelEditor-toolbar"
    ></level-editor-toolbar>
    <level-editor-side-properties-panel
      v-if="
        blockController.selectionManager.selectedObjectIds.length &&
        canvasController
      "
      class="LevelEditor-sidePanel-properties"
      :canvas-controller="canvasController"
      :readonly="readonly"
    ></level-editor-side-properties-panel>

    <level-editor-asset-shape-create
      v-if="droppedAssetContext?.shown && canvasController"
      ref="assetShapeCreate"
      :style="{
        top: `${droppedAssetContext.menuY}px`,
        left: `${droppedAssetContext.menuX}px`,
      }"
      :readonly="readonly"
      class="LevelEditor-pointerType-selector"
      @select="createAssetShape($event)"
    ></level-editor-asset-shape-create>

    <canvas ref="canvas"></canvas>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';

import LevelEditorToolbar from './toolbar/LevelEditorToolbar.vue';
import LevelEditorCanvasController from './LevelEditorCanvasController';
import {
  trackElementSize,
  type TrackElementSizeHandler,
} from '~ims-app-base/logic/utils/trackElementSize';
import CreatorAssetManager from '~ims-app-base/logic/managers/CreatorAssetManager';
import { assert } from '~ims-app-base/logic/utils/typeUtils';
import { v4 as uuidv4 } from 'uuid';
import LevelEditorAssetShapeCreate from './LevelEditorAssetShapeCreate.vue';
import {
  setImsClickOutside,
  type SetClickOutsideCancel,
} from '~ims-app-base/components/utils/ui';
import LevelEditorSidePropertiesPanel from './side-panel/LevelEditorSidePropertiesPanel.vue';
import type LevelEditorBlockController from '../LevelEditorBlockController';

type PointerTypeSelectorContext = {
  menuX: number;
  menuY: number;
  shown: boolean;
  event: DragEvent;
  assetId: string;
} | null;

export default defineComponent({
  name: 'LevelEditor',
  components: {
    LevelEditorToolbar,
    LevelEditorSidePropertiesPanel,
    LevelEditorAssetShapeCreate,
  },
  props: {
    readonly: {
      type: Boolean,
      default: false,
    },
    blockController: {
      type: Object as PropType<LevelEditorBlockController>,
      required: true,
    },
  },
  data() {
    return {
      canvasController: null as null | LevelEditorCanvasController,
      containerTracker: null as TrackElementSizeHandler | null,
      droppedAssetContext: null as PointerTypeSelectorContext,
      clickOutside: null as SetClickOutsideCancel | null,
    };
  },
  computed: {
    editorContainer() {
      const element = this.$refs.container as HTMLElement;
      if (!element) return;
      return element.getBoundingClientRect();
    },
  },
  watch: {
    readonly() {
      this.initCanvas();
    },
  },
  mounted() {
    (this as any)._viewportResizeTimer = null;
    this.initCanvas();
    this._updateListeners(true);
  },
  unmounted() {
    if (this.canvasController) {
      this.canvasController.destroy();
      this.canvasController = null;

      this.blockController.selectionManager.destroy();
    }
    this._updateListeners(false);
  },
  methods: {
    async createAssetShape(shape_type: string) {
      if (!this.canvasController) return;
      if (!this.droppedAssetContext) return;

      const asset_preview = await this.$getAppManager()
        .get(CreatorAssetManager)
        .getAssetPreviewViaCache(this.droppedAssetContext.assetId);

      assert(asset_preview);

      const { x, y } = this.canvasController.canvas.getScenePoint(
        this.droppedAssetContext.event,
      );

      const common_properties = {
        id: uuidv4(),
        value: {
          AssetId: asset_preview.id,
          Name: asset_preview.name,
          Title: asset_preview.title ?? '',
        },
        x: x,
        y: y,
      };

      switch (shape_type) {
        case 'pointer':
        case 'rect': {
          this.canvasController.createShape(
            {
              ...common_properties,
              type: shape_type,
              params: {
                width: 100,
                height: 100,
              },
            },
            { expectPropsChange: false },
          );
          break;
        }
        case 'ellipse': {
          this.canvasController.createShape(
            {
              ...common_properties,
              type: shape_type,
              params: {
                rx: 50,
                ry: 50,
              },
            },
            { expectPropsChange: false },
          );
          break;
        }
      }

      this.droppedAssetContext = null;
    },
    async showShape(shape_id: string) {
      if (this.canvasController) {
        this.canvasController.showShapes([shape_id], { zoomToFit: false });
        return true;
      } else {
        return false;
      }
    },
    dragAssetDrop(event: DragEvent) {
      if (!this.canvasController) return;
      if (!this.editorContainer) return;

      try {
        const drop_asset = JSON.parse(
          event.dataTransfer?.getData('asset') ?? '',
        );
        if (!drop_asset) return;

        this.droppedAssetContext = {
          shown: true,
          menuX: event.clientX - this.editorContainer.left,
          menuY: event.clientY - this.editorContainer.top,
          event: event,
          assetId: drop_asset.id,
        };

        this.$nextTick(() => {
          if (this.$refs.assetShapeCreate) {
            const element = (this.$refs.assetShapeCreate as any)
              .$el as HTMLElement;
            if (this.clickOutside) {
              this.clickOutside();
              this.clickOutside = null;
            }
            this.clickOutside = setImsClickOutside(element, () => {
              this.droppedAssetContext = null;
            });
          }
        });
      } catch {
        // Do nothing
      }

      event.preventDefault();
    },
    _updateListeners(reset: boolean) {
      if ((this as any)._viewportResizeTimer) {
        clearTimeout((this as any)._viewportResizeTimer);
        (this as any)._viewportResizeTimer = null;
      }
      if (this.containerTracker) {
        this.containerTracker.cancel();
        this.containerTracker = null;
      }
      if ((this as any)._keyDownHandler) {
        window.removeEventListener('keydown', (this as any)._keyDownHandler);
        (this as any)._keyDownHandler = null;
      }

      if (reset) {
        if (this.$refs['container']) {
          this.containerTracker = trackElementSize(
            this.$refs['container'] as HTMLElement,
            () => {
              if (this.canvasController?.canvas) {
                const container_rect = (
                  this.$refs.container as HTMLElement
                ).getBoundingClientRect();

                this.canvasController.canvas.setDimensions({
                  width: container_rect.width,
                  height: container_rect.height,
                });
                this._scheduleViewportReCenter();
              }
            },
            true,
          );
        }

        (this as any)._keyDownHandler = async (e: KeyboardEvent) => {
          if (e.code === 'Escape') {
            this.droppedAssetContext = null;
          }
        };
        window.addEventListener('keydown', (this as any)._keyDownHandler);
      }
    },
    _scheduleViewportReCenter() {
      if ((this as any)._viewportResizeTimer) {
        clearTimeout((this as any)._viewportResizeTimer);
      }
      (this as any)._viewportResizeTimer = setTimeout(() => {
        (this as any)._viewportResizeTimer = null;
        const c = this.canvasController;
        if (!c) {
          return;
        }
        const { canvas } = c;

        if (!c._needsViewportInit || c.sortedCanvasObjects.length === 0) {
          canvas.renderAll();
          return;
        }

        if (canvas.width <= 0 || canvas.height <= 0) {
          canvas.renderAll();
          return;
        }

        c._needsViewportInit = false;

        const vpt = canvas.viewportTransform;
        const vptInit = c._viewportAtInit;
        if (!vptInit || vpt[4] !== vptInit[4] || vpt[5] !== vptInit[5]) {
          canvas.renderAll();
          return;
        }

        c.showShapes(c.sortedCanvasObjects.map((el) => el.id));
      }, 300);
    },
    initCanvas() {
      const canvasEl = this.$refs.canvas as HTMLCanvasElement;
      const canvasContainerEl = this.$refs.container as HTMLElement;

      if (this.canvasController) {
        this.canvasController.destroy();
      }
      this.canvasController = new LevelEditorCanvasController(
        this.$getAppManager(),
        this.blockController,
        { canvasEl, canvasContainerEl },
        this.readonly,
      );

      this.canvasController.init();

      this.blockController.selectionManager.init(
        this.canvasController as LevelEditorCanvasController,
      );
    },
  },
});
</script>

<style scoped>
.LevelEditor {
  width: 100%;
  height: 100%;
  overflow: hidden;
  cursor: grab;
  position: relative;
}

.LevelEditor-toolbar {
  position: absolute;
  z-index: 1;
  left: 15px;
  top: 15px;
}

.LevelEditor-sidePanel-properties {
  position: absolute;
  z-index: 1;
  right: 15px;
  top: 15px;
  max-height: calc(100% - 15px);
}
.LevelEditor-sidePanel-layers {
  position: absolute;
  z-index: 1;
  left: 15px;
  top: 70px;
  max-height: calc(100% - 15px);
}
.LevelEditor-pointerType-selector {
  position: absolute;
  z-index: 1;
}

canvas {
  display: block;
}
</style>
