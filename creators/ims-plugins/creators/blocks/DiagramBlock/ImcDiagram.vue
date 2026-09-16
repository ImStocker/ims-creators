<template>
  <div class="ImcDiagram" :data-theme="theme">
    <div
      v-if="editorComponentLoading"
      class="ImcDiagram-loading loaderSpinner"
    ></div>
    <div
      v-else-if="editorComponentError"
      class="ImcDiagram-error error-message-block"
    >
      {{ editorComponentError }}
    </div>
    <template v-else>
      <imc-diagram-toolbar
        v-if="mx && graph && editor"
        class="ImcDiagram-toolbar"
        :mx="mx"
        :graph="graph"
        :editor="editor"
        :selected-cells="selectedCells"
        @tool-reset="onToolReset"
        @group-created="onGroupCreated"
      ></imc-diagram-toolbar>
      <div
        ref="container"
        class="ImcDiagram-container tiny-scrollbars"
        tabindex="-1"
        @dragover="onDragOver"
        @drop="onDrop"
      >
        <div ref="cellEditor" class="ImcDiagram-cellEditor">
          <imc-format-text-editor
            v-if="editingCell"
            ref="cellEditorComp"
            v-model="editingCell.value"
            :multiline="true"
            toolbar="inline"
            :style="{
              width: editingCell.state
                ? editingCell.state.width + 'px'
                : undefined,
            }"
          ></imc-format-text-editor>
        </div>
      </div>
      <Teleport
        v-for="lab of displayingLabelsList"
        :key="lab.id"
        :to="lab.element"
      >
        <imc-presenter
          :value="lab.value"
          :click-to-open="!isEditor"
          :style="{
            width: lab.state ? lab.state.width + 'px' : undefined,
          }"
        ></imc-presenter>
      </Teleport>
    </template>
  </div>
</template>

<script lang="ts">
import { type PropType, defineComponent, shallowRef } from 'vue';
import type {
  mxGraphExportObject,
  mxCellState,
  mxEditor,
  mxGraph,
  mxCell,
} from 'mxgraph';

import {
  createEditor,
  createMxCellByFigure,
  getGraphValue,
  initGraph,
  setGraphValue,
  updateGraphStyle,
  type ImcDiagramFigure,
} from './editor';
import type { ImcDiagramInterface } from './ImcDiagramInterface';
import { initMxGraphClientSide } from './initMxGraph';
import ImcDiagramToolbar from './ImcDiagramToolbar.vue';
import { useImcHTMLRenderer } from '~ims-app-base/components/ImcText/useImcHTMLRenderer';
import { debounceForThis } from '~ims-app-base/components/utils/ComponentUtils';
import CreatorAssetManager from '~ims-app-base/logic/managers/CreatorAssetManager';
import UiManager, { ScreenSize } from '~ims-app-base/logic/managers/UiManager';
import {
  type AssetProps,
  type AssetPropValue,
  sameAssetPropObjects,
  type AssetPropValueAsset,
} from '~ims-app-base/logic/types/Props';
import ImcFormatTextEditor from '~ims-app-base/components/Common/ImcFormatTextEditor.vue';
import ImcPresenter from '~ims-app-base/components/ImcText/ImcPresenter.vue';

export default defineComponent({
  name: 'ImcDiagram',
  components: {
    ImcFormatTextEditor,
    ImcPresenter,
    ImcDiagramToolbar,
  },
  props: {
    isEditor: {
      type: Boolean,
      default: false,
    },
    value: { type: Object as PropType<AssetProps>, default: () => {} },
    valueSelfUpdating: { type: Boolean, default: false },
    theme: { type: String, required: true },
  },
  emits: ['click', 'ready', 'change'],
  data() {
    return {
      editorComponentLoading: true,
      editorComponentError: null as null | string,
      mx: shallowRef<mxGraphExportObject | null>(null),
      editor: shallowRef<mxEditor | null>(null),
      graph: shallowRef<mxGraph | null>(null),
      editingCell: null as null | {
        value: AssetPropValue;
        state: mxCellState | null;
      },
      displayingLabelsMap: new Map<
        string,
        {
          id: string;
          value: AssetPropValue;
          element: HTMLElement | null;
          state: mxCellState | null;
        }
      >(),
      emitChangeDelayed: () => {},
      selectedCells: [] as mxCell[],
    };
  },
  computed: {
    displayingLabelsList() {
      return [...this.displayingLabelsMap.values()].filter((x) => x.element);
    },
    isMobile() {
      return this.$getAppManager()
        .get(UiManager)
        .isScreenSize(ScreenSize.NOT_PC);
    },
  },
  watch: {
    value() {
      if (this.valueSelfUpdating) return;
      const cur_val = this.getValue();
      if (!cur_val) return;
      if (!sameAssetPropObjects(this.value, cur_val)) {
        this.recreateGraph(true);
      }
    },
    isEditor() {
      const scrolly = this.$refs.container
        ? (this.$refs.container as HTMLElement).scrollTop
        : 0;
      this.$nextTick(() => {
        this.recreateGraph(true);
        if (this.$refs.container) {
          (this.$refs.container as HTMLElement).scrollTop = scrolly;
        }
      });
    },
    theme() {
      setTimeout(() => {
        if (!this.mx) return;
        if (!this.graph) return;
        updateGraphStyle(
          this.mx,
          this.graph,
          this as unknown as ImcDiagramInterface,
        );
      }, 1);
    },
  },
  created() {
    this.emitChangeDelayed = debounceForThis(async function (this: any) {
      await this.$emit('change');
    }, 10);
  },
  async mounted() {
    try {
      this.editorComponentLoading = true;
      const { mx } = await initMxGraphClientSide();
      this.editorComponentLoading = false;
      this.mx = mx;
      await this.$nextTick();
      this.recreateGraph(true);
      await new Promise((res) => setTimeout(res, 1));
      this.$emit('ready');
    } catch (err: any) {
      this.editorComponentError = err.message;
      this.editorComponentLoading = false;
    }
  },
  unmounted() {
    this.recreateGraph(false);
  },
  methods: {
    focus() {
      if (this.$refs.container) {
        (this.$refs.container as HTMLElement).focus();
      }
    },
    updateLabel(
      id: string,
      element: HTMLElement | null,
      value: AssetPropValue,
      state: mxCellState | null,
    ) {
      this.displayingLabelsMap.set(id, {
        id,
        element,
        value,
        state,
      });
    },
    stopEditing(cancel: boolean) {
      if (!this.graph) return;
      this.graph.stopEditing(cancel);
    },
    getValue(): AssetProps | null {
      if (!this.graph) return null;
      if (!this.mx) return null;
      return getGraphValue(this.mx, this.graph);
    },
    recreateGraph(restart: boolean) {
      if (!this.mx) return;

      const selected_ids = this.selectedCells.map((cell) => cell.id);

      if (this.editor) {
        this.editor.destroy();
        this.editor = null;
        this.graph = null;
      } else if (this.graph) {
        this.graph.destroy();
        this.graph = null;
      }
      this.displayingLabelsMap.clear();
      if (restart && this.$refs.container) {
        if (this.isEditor) {
          this.editor = createEditor(
            this.mx,
            this as unknown as ImcDiagramInterface,
          );
          this.graph = this.editor.graph;
        } else {
          this.graph = new this.mx.mxGraph(this.$refs.container as any);
          this.graph.setEnabled(false);
          this.graph.addListener(this.mx.mxEvent.CLICK, (_sender, evt) => {
            const e = evt.getProperty('event');
            this.$emit('click', e);
            evt.consume();
          });
        }

        if (this.isEditor) {
          this.graph.addListener(this.mx.mxEvent.EDITING_STOPPED, () => {
            this.emitChangeDelayed();
          });
          this.graph.addListener(this.mx.mxEvent.CELLS_ADDED, () => {
            this.emitChangeDelayed();
          });
          this.graph.addListener(this.mx.mxEvent.CELLS_FOLDED, () => {
            this.emitChangeDelayed();
          });
          this.graph.addListener(this.mx.mxEvent.CELLS_MOVED, () => {
            this.emitChangeDelayed();
          });
          this.graph.addListener(this.mx.mxEvent.CELLS_ORDERED, () => {
            this.emitChangeDelayed();
          });
          this.graph.addListener(this.mx.mxEvent.CELLS_REMOVED, () => {
            this.emitChangeDelayed();
          });
          this.graph.addListener(this.mx.mxEvent.CELLS_RESIZED, () => {
            this.emitChangeDelayed();
          });
          this.graph.addListener(this.mx.mxEvent.CELLS_TOGGLED, () => {
            this.emitChangeDelayed();
          });
          this.graph.addListener(this.mx.mxEvent.CELL_CONNECTED, () => {
            this.emitChangeDelayed();
          });
        }

        const htmlRenderer = useImcHTMLRenderer();
        initGraph(
          this.mx,
          this.graph,
          this as unknown as ImcDiagramInterface,
          htmlRenderer,
        );

        if (this.value) {
          setGraphValue(this.mx, this.graph, this.value);
          if (this.editor) {
            this.editor.undoManager.clear();
          }
        }
      }

      const graph = this.graph;
      if (graph) {
        if (selected_ids.length > 0) {
          const selected_cells = selected_ids
            .map((cell_id) => graph.model.getCell(cell_id))
            .filter((c) => c);
          if (selected_cells.length > 0) {
            graph.setSelectionCells(selected_cells);
          }
        }
        const def_parent = graph.getDefaultParent();
        if (
          !def_parent ||
          !def_parent.children ||
          def_parent.children.length === 0
        ) {
          setTimeout(() => {
            graph.refresh(); // Fix partial display bug when graph is empty
          }, 1);
        }
      }
    },
    onSelectionChange() {
      this.selectedCells = this.graph ? this.graph.getSelectionCells() : [];
    },
    onToolReset() {
      const container = this.$refs['container'] as HTMLElement | null;
      if (!container) return;
      container.focus();
    },

    onDragOver(event: DragEvent) {
      const event_dt = event.dataTransfer;
      if (!event_dt) return;
      const allow =
        event_dt.types.includes('asset') ||
        event_dt.types.includes('imc-diagram-figure');
      if (!allow) return;
      event_dt.dropEffect = 'copy';
      event.preventDefault();
    },
    async onDrop(event: DragEvent) {
      event.preventDefault();
      const event_dt = event.dataTransfer;
      if (!event_dt) return;
      if (!this.mx) return;
      if (!this.editor) return;
      const event_dt_figure = event_dt.getData('imc-diagram-figure');
      if (event_dt_figure) {
        const figure = JSON.parse(event_dt_figure) as ImcDiagramFigure;
        const vertex = createMxCellByFigure(this.mx, figure);
        this.editor.toolbar.drop(vertex, event, null);
      }
      const event_dt_asset = event_dt.getData('asset');
      if (event_dt_asset) {
        const event_dt_asset_parsed = JSON.parse(event_dt_asset) as {
          id: string;
        };
        if (!event_dt_asset_parsed.id) return;
        const drop_asset_short = await this.$getAppManager()
          .get(CreatorAssetManager)
          .getAssetShortViaCache(event_dt_asset_parsed.id);
        if (!drop_asset_short) {
          throw new Error(this.$t('asset.assetNotFound'));
        }
        const drop_asset_value: AssetPropValueAsset = {
          AssetId: drop_asset_short.id,
          Name: drop_asset_short.name,
          Title: drop_asset_short.title ?? '',
        };
        const vertex = new this.mx.mxCell(
          drop_asset_value,
          new this.mx.mxGeometry(0, 0, 100, 40),
          '',
        );
        vertex.setVertex(true);
        this.editor.toolbar.drop(vertex, event, null);
      }
    },
    async onGroupCreated() {
      this.$emit('change');
      await this.$nextTick();
      this.recreateGraph(true);
    },
  },
});
</script>

<style lang="scss" rel="stylesheet/scss" scoped>
.ImcDiagram[data-theme='ims-dark'] {
  --Diagram-fillColor: #444;
  --Diagram-strokeColor: #ccc;
}
.ImcDiagram {
  height: 100%;
  position: relative;

  --Diagram-textColor: var(--local-text-color);
  --Diagram-fillColor: #f9fafe;
  --Diagram-strokeColor: #6482b9;

  &:deep(.ImcPresenter-content) {
    word-break: normal;
  }
}

.ImcDiagram-container {
  height: 100%;

  --ImcDiagram-background: transparent;
  background: var(--ImcDiagram-background);
  border-radius: 4px;

  overflow: auto;
  outline: none;
}

.ImcDiagram:deep(.ImcDiagram-arrowLabel) {
  background: var(--ImcDiagram-background);
}

.ImcDiagram-cellEditor {
  position: absolute;

  &:deep(.ql-editor) {
    overflow-y: visible;
  }
}

.ImcDiagram-toolbar {
  position: absolute;
  top: 0px;
  left: 0;
  z-index: 10;
}
</style>

<style lang="scss" rel="stylesheet/scss">
div.mxTooltip.ImcDiagramTooltip {
  background-color: var(--dropdown-bg-color);
  backdrop-filter: var(--dropdown-bg-filter);
  box-shadow: var(--dropdown-box-shadow);
  border: none;
  border-radius: var(--dropdown-border-radius);
  color: var(--local-text-color);
  font-family: var(--local-font-family);
  padding: 5px 10px;
  p {
    margin: 0;
  }
}
.ImcDiagram-background {
  image {
    height: 100%;
    width: 100%;
    pointer-events: none;
  }
}
.ImcDiagram .ImcPresenter .AssetLink {
  display: inline-flex;
}
</style>
