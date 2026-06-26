<template>
  <div
    class="GraphEditor"
    :style="{
      '--imsde-node-selected-outline-width': selectedOutlineWidth + 'px',
    }"
  >
    <div
      class="GraphEditor-wrapper"
      @pointerdown.capture="onMouseDown"
      @pointerup.capture="onMouseUp"
      @contextmenu.capture="onContextMenu"
      @dragover="onDragOver"
      @drop="onDrop"
    >
      <VueFlow
        ref="flow"
        v-model:nodes="blockControllerMut.state.nodes"
        v-model:edges="blockControllerMut.state.edges"
        :selection-key-code="true"
        :multi-selection-key-code="['Meta', 'Shift', 'Control']"
        :pan-on-drag="[2]"
        :connection-mode="ConnectionMode.Loose"
        :delete-key-code="['Delete', 'Backspace']"
        :edges-updatable="!readonlyComp"
        :nodes-draggable="!readonlyComp"
        :nodes-connectable="!readonlyComp"
        :snap-to-grid="true"
        :snap-grid="[10, 10]"
        :min-zoom="0.1"
        @viewport-change="onViewportChange"
        @viewport-change-end="onViewportChangeEnd"
        @connect="onConnect"
        @connect-start="onConnectStart"
        @connect-end="onConnectEnd"
        @edges-change="onEdgesChange"
        @nodes-change="onNodesChange"
        @edge-click="onEdgeClick"
        @node-click="onNodeClick"
      >
        <template
          v-for="node_desc of nodeDescriptors"
          :key="node_desc.name"
          #[`node-${node_desc.name}`]="params"
        >
          <component
            :is="node_desc.node"
            v-bind="{
              ...params,
              ...(node_desc.params ? node_desc.params : {}),
            }"
            :style="{ '--imsde-node-color': node_desc.color }"
            :node-descriptor="node_desc"
            :dialog-controller="blockControllerMut"
            :readonly="readonlyComp"
            :editing-node-id="editingNodeId"
            :viewport-transform="viewportTransform"
            @request-edit="onRequestEdit"
            @request-view="onRequestView"
          ></component>
        </template>
        <template #edge-graph-edge="params">
          <BezierEdge
            v-bind="params"
            class="GraphEditor-edge"
            :marker-end="arrowMarker"
          ></BezierEdge>
        </template>
        <Background :offset="19" />
        <GraphMiniMap :viewport-helper="viewportHelper" />
        <svg class="GraphEditor-defs">
          <defs>
            <marker
              id="graph-arrow"
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="12"
              markerHeight="12"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#888" />
            </marker>
          </defs>
        </svg>
      </VueFlow>
      <div v-if="hasHint" class="GraphEditor-hint">
        <div class="GraphEditor-hint-inner">
          {{ $t('graphBlock.editor.emptyHint') }}
        </div>
      </div>
    </div>
    <div
      v-if="createNodeContext"
      class="GraphEditor-createNode"
      :style="{
        left: `${createNodeContext.x}px`,
        top: `${createNodeContext.y}px`,
      }"
    >
      <menu-list :menu-list="createNodeMenuList" />
    </div>
    <div
      v-if="selectionContextMenu"
      class="GraphEditor-selectionContext"
      :style="{
        left: `${selectionContextMenu.x}px`,
        top: `${selectionContextMenu.y}px`,
      }"
    >
      <menu-list :menu-list="selectionMenuList" />
    </div>
    <div
      v-if="selectedNodes.length > 0 && !readonlyComp"
      class="GraphEditor-colorBar"
      @mousedown.stop
    >
      <button
        v-for="swatch in colorSwatches"
        :key="swatch.value || '__none'"
        class="GraphEditor-colorSwatch"
        :class="{ active: selectedColor === swatch.value }"
        @click.stop="setColorForSelected(swatch.value)"
      >
        <span
          v-if="swatch.hex"
          class="GraphEditor-colorSwatch-inner"
          :style="{ background: swatch.hex }"
        ></span>
        <i v-else class="ri-close-line"></i>
      </button>
      <div class="GraphEditor-colorBar-sep"></div>
      <button
        class="GraphEditor-colorSwatch GraphEditor-customColorBtn"
        :class="{ active: selectedColorIsCustom }"
        @click.stop="openColorPicker"
      >
        <span
          v-if="selectedColorIsCustom"
          class="GraphEditor-colorSwatch-inner"
          :style="{ background: selectedColor }"
        ></span>
        <i v-else class="ri-palette-line"></i>
      </button>
      <input
        ref="colorPickerInput"
        type="color"
        class="GraphEditor-colorPicker"
        :value="selectedColor || '#ffffff'"
        @input.stop="
          setColorForSelected(($event.target as HTMLInputElement).value)
        "
      />
    </div>
  </div>
</template>

<script lang="ts">
import { Background } from '@vue-flow/background';
import {
  ConnectionMode,
  type VueFlowStore,
  VueFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
  BezierEdge,
  type EdgeMouseEvent,
  type NodeMouseEvent,
  type OnConnectStartParams,
  type ViewportTransform,
  type GraphNode,
} from '@vue-flow/core';
import { defineComponent, type PropType } from 'vue';
import GraphMiniMap from '../../flow-common/GraphMiniMap.vue';
import { getNodeDescriptors } from '../nodes/getNodeDescriptors';
import type { ResolvedAssetBlock } from '~ims-app-base/logic/utils/assets';
import type { AssetChanger } from '~ims-app-base/logic/types/AssetChanger';
import type { GraphBlockController } from './GraphBlockController';
import type { AssetPropValueAsset } from '~ims-app-base/logic/types/Props';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import CreatorAssetManager from '~ims-app-base/logic/managers/CreatorAssetManager';
import { FlowViewportHelper } from '../../flow-common/FlowViewportHelper';
import { COLOR_SWATCHES } from './GraphEditor';
import { assert } from '~ims-app-base/logic/utils/typeUtils';
import { getPreferenceKeyForBlock } from '~ims-app-base/logic/utils/assets';
import UiPreferenceManager from '~ims-app-base/logic/managers/UiPreferenceManager';
import MenuList from '~ims-app-base/components/Common/MenuList.vue';
import type { MenuListItem } from '~ims-app-base/logic/types/MenuList';
import {
  setImsClickOutside,
  type SetClickOutsideCancel,
} from '~ims-app-base/components/utils/ui';

export default defineComponent({
  name: 'GraphEditor',
  components: {
    VueFlow,
    GraphMiniMap,
    Background,
    BezierEdge,
    MenuList,
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
    resolvedBlock: {
      type: Object as PropType<ResolvedAssetBlock>,
      required: true,
    },
    toolbarTarget: {
      type: [Object, null] as PropType<HTMLElement | null>,
      default: null,
    },
    blockController: {
      type: Object as PropType<GraphBlockController>,
      required: true,
    },
  },
  emits: ['focus', 'blur'],
  data() {
    const viewportHelper = new FlowViewportHelper();
    return {
      createNodeContext: null as { x: number; y: number } | null,
      selectionContextMenu: null as { x: number; y: number } | null,
      connectStartParams: null as {
        nodeId: string;
        handleId: string;
        handleType: string;
      } | null,
      editingNodeId: null as string | null,
      viewportTransform: { x: 0, y: 0, zoom: 1 } as ViewportTransform,
      mouseDownTime: 0,
      lastCreatePosition: { x: 0, y: 0 },
      viewportHelper,
      _keyDownHandler: null as ((e: KeyboardEvent) => void) | null,
      isFocused: false,
      clickOutsideCancel: null as SetClickOutsideCancel | null,
    };
  },
  computed: {
    ConnectionMode() {
      return ConnectionMode;
    },
    readonlyComp() {
      return this.readonly;
    },
    blockControllerMut() {
      return this.blockController;
    },
    nodeDescriptors() {
      return getNodeDescriptors();
    },
    arrowMarker() {
      return 'url(#graph-arrow)';
    },
    selectedNodes() {
      return this.blockControllerMut.state.nodes.filter((n: any) => n.selected);
    },
    hasHint() {
      return (
        !this.readonlyComp && this.blockControllerMut.state.nodes.length === 0
      );
    },
    selectedColor() {
      const nodes = this.selectedNodes;
      if (nodes.length === 0) return '';
      const colors = nodes.map((n: any) => (n.data as any)?.color ?? '');
      return colors.every((c: string) => c === colors[0]) ? colors[0] : '';
    },
    selectedColorIsCustom() {
      return (
        this.selectedColor &&
        this.colorSwatches.every((c) => c.value !== this.selectedColor)
      );
    },
    selectionMenuList(): MenuListItem[] {
      const ids = this.selectedNodes.map((n: any) => n.id);
      return this.blockControllerMut.getNodeContextMenu(
        ids,
        this.viewportTransform,
      );
    },
    createNodeMenuList(): MenuListItem[] {
      return [
        {
          name: 'addCard',
          title: this.$t('graphBlock.editor.addCard'),
          icon: 'ri-info-card-line',
          action: () => this.addCardNode(),
        },
        {
          name: 'addAsset',
          title: this.$t('graphBlock.editor.addElement'),
          icon: 'ri-link-m',
          action: () => this.addAssetNode(),
        },
        {
          name: 'addFile',
          title: this.$t('graphBlock.editor.addFile'),
          icon: 'ri-attachment-2',
          action: () => this.addFileNode(),
        },
        { type: 'separator', name: 'sep1' },
        {
          name: 'paste',
          title: this.$t('graphBlock.editor.pasteNode'),
          icon: 'ri-clipboard-line',
          action: () => this.pasteFromClipboard(),
        },
      ];
    },
    colorSwatches() {
      return COLOR_SWATCHES;
    },
    selectedOutlineWidth() {
      return Math.max(
        Math.round(-1.5 * Math.log2(this.viewportHelper.zoom)),
        0,
      );
    },
    flowViewportTransformPreferenceKey() {
      const preference_id = this.resolvedBlock
        ? getPreferenceKeyForBlock(this.resolvedBlock)
        : '';
      return `GraphBlock.viewportTransform.` + preference_id;
    },
    flowViewportTransform: {
      get(): ViewportTransform | null {
        return (this as any)
          .$getAppManager()
          .get(UiPreferenceManager)
          .getPreference(this.flowViewportTransformPreferenceKey, null);
      },
      set(value: ViewportTransform) {
        (this as any)
          .$getAppManager()
          .get(UiPreferenceManager)
          .setPreference(this.flowViewportTransformPreferenceKey, value);
      },
    },
  },
  watch: {
    isFocused() {
      if (this.isFocused) {
        this.$emit('focus');
      } else {
        this.$emit('blur');
      }
      this.resetFocusedListeners(this.isFocused);
    },
  },
  mounted() {
    const flow = this.$refs['flow'] as VueFlowStore;
    assert(flow);
    this.viewportHelper.setFlow(flow);
    if (this.flowViewportTransform) {
      flow.setViewport(this.flowViewportTransform);
    }
  },
  unmounted() {
    this.resetFocusedListeners(false);
  },
  methods: {
    resetFocusedListeners(init: boolean) {
      if (this._keyDownHandler) {
        window.removeEventListener('keydown', this._keyDownHandler);
        this._keyDownHandler = null;
      }
      if (this.clickOutsideCancel) {
        this.clickOutsideCancel();
        this.clickOutsideCancel = null;
      }
      if (init) {
        this.clickOutsideCancel = setImsClickOutside(this.$el, () => {
          this.isFocused = false;
        });
        this._keyDownHandler = (e: KeyboardEvent) => {
          if (!this.isFocused) return;
          const target = e.target as HTMLElement;
          if (!target) return;
          if (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable
          ) {
            return;
          }
          const flow = this.$refs['flow'] as VueFlowStore | undefined;
          if (!flow) return;
          if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC') {
            const selectedNodeIds = (flow.getSelectedNodes as any).map(
              (n: any) => n.id,
            );
            if (!selectedNodeIds.length) return;
            this.blockControllerMut.copyNodesToClipboard(
              selectedNodeIds,
              flow.getViewport(),
            );
          } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV') {
            this.blockControllerMut.pasteNodesFromClipboard(
              flow.getViewport(),
            );
          } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyX') {
            const selectedNodeIds = (flow.getSelectedNodes as any).map(
              (n: any) => n.id,
            );
            if (!selectedNodeIds.length) return;
            this.blockControllerMut.cutNodes(
              selectedNodeIds,
              flow.getViewport(),
            );
          }
        };
        window.addEventListener('keydown', this._keyDownHandler);
      }
    },
    onContextMenu(ev: MouseEvent) {
      const target = ev.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('.vue-flow__pane')) {
        return; // Clicked outside pane
      }
      if (target.closest('.vue-flow__node')) {
        return; // Clicked inside the node
      }
      if (target.closest('.vue-flow__nodesselection-rect')) {
        if (this.selectedNodes.length === 0) return;
        this.selectionContextMenu = {
          x:
            ev.clientX - (this.$el as HTMLElement).getBoundingClientRect().left,
          y: ev.clientY - (this.$el as HTMLElement).getBoundingClientRect().top,
        };
        ev.preventDefault();
        return;
      }
      ev.preventDefault();
    },
    onConnect(ev: Connection) {
      if (!ev.source || !ev.target) return;
      this.blockControllerMut.addEdge(
        ev.source,
        ev.target,
        ev.sourceHandle ?? undefined,
        ev.targetHandle ?? undefined,
      );
      this.createNodeContext = null;
      this.connectStartParams = null;
    },
    onEdgesChange(events: EdgeChange[]) {
      let needSave = false;
      for (const ev of events) {
        if (ev.type === 'remove') {
          this.blockControllerMut.deleteEdgeById(ev.id);
          needSave = true;
        }
      }
      if (needSave) {
        this.blockControllerMut.savePropsDelayed();
      }
    },
    onNodesChange(events: NodeChange[]) {
      let needSave = false;
      for (const ev of events) {
        switch (ev.type) {
          case 'add':
          case 'position':
          case 'dimensions':
            needSave = true;
            break;
          case 'remove':
            this.blockControllerMut.deleteNodeById(ev.id);
            needSave = true;
            break;
        }
      }
      if (needSave) {
        this.blockControllerMut.savePropsDelayed();
      }
    },
    onConnectStart(ev: OnConnectStartParams) {
      if (this.readonlyComp) return;
      if (!ev.nodeId || !ev.handleType || !ev.handleId) return;
      this.connectStartParams = {
        nodeId: ev.nodeId,
        handleId: ev.handleId,
        handleType: ev.handleType,
      };
    },
    onConnectEnd(ev: any) {
      if (this.readonlyComp) return;
      if (!this.connectStartParams) return;
      if (!this.$el) return;
      const editorBBox = (this.$el as HTMLElement).getBoundingClientRect();
      const flow = this.$refs['flow'] as VueFlowStore;
      const flowCoord = flow.screenToFlowCoordinate({
        x: ev.clientX,
        y: ev.clientY,
      });
      this.lastCreatePosition = { x: flowCoord.x, y: flowCoord.y };
      this.createNodeContext = {
        x: ev.clientX - editorBBox.x,
        y: ev.clientY - editorBBox.y,
      };
    },
    onMouseDown() {
      if (this.readonlyComp) return;
      this.isFocused = true;
      this.createNodeContext = null;
      this.selectionContextMenu = null;
      this.connectStartParams = null;
      this.mouseDownTime = Date.now();
    },
    async onMouseUp(ev: PointerEvent) {
      if (this.readonlyComp) return;
      if (ev.button !== 2) return;

      const target = ev.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('.vue-flow__pane')) return;
      if (target.closest('.vue-flow__node')) return;
      if (target.closest('.vue-flow__nodesselection-rect')) return;

      ev.preventDefault();
      const elapsed = Date.now() - this.mouseDownTime;
      if (elapsed > 200) return;

      const editorBBox = (this.$el as HTMLElement).getBoundingClientRect();
      const flow = this.$refs['flow'] as VueFlowStore;
      const flowCoord = flow.screenToFlowCoordinate({
        x: ev.clientX,
        y: ev.clientY,
      });

      await new Promise((r) => setTimeout(r, 1));
      this.lastCreatePosition = { x: flowCoord.x, y: flowCoord.y };
      this.createNodeContext = {
        x: ev.clientX - editorBBox.x,
        y: ev.clientY - editorBBox.y,
      };
    },
    onViewportChange(transform: ViewportTransform) {
      this.viewportTransform = transform;
    },
    onViewportChangeEnd(transform: ViewportTransform) {
      this.flowViewportTransform = transform;
    },
    onRequestEdit(nodeId: string) {
      this.editingNodeId = nodeId;
    },
    onRequestView() {
      this.editingNodeId = null;
    },
    async addCardNode() {
      const nodeId = await this.blockControllerMut.createNode(
        this.lastCreatePosition,
        this.connectStartParams,
        null,
      );
      this.createNodeContext = null;
      this.connectStartParams = null;
      if (nodeId) {
        this.editingNodeId = nodeId;
      }
    },
    async addFileNode() {
      const result = await this.blockControllerMut.pickAndAttachFile();
      this.createNodeContext = null;
      if (!result) return;
      await this.blockControllerMut.createNode(
        this.lastCreatePosition,
        this.connectStartParams,
        result,
      );
      this.connectStartParams = null;
    },
    async addAssetNode() {
      const assetValue = await this.blockControllerMut.pickAsset();
      this.createNodeContext = null;
      if (!assetValue) return;
      await this.blockControllerMut.createNode(
        this.lastCreatePosition,
        this.connectStartParams,
        assetValue,
      );
      this.connectStartParams = null;
    },
    onDragOver(event: DragEvent) {
      const eventDt = event.dataTransfer;
      if (!eventDt) return;
      if (!eventDt.types.includes('asset')) return;
      eventDt.dropEffect = 'link';
      event.preventDefault();
    },
    async onDrop(event: DragEvent) {
      if (this.readonlyComp) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('.vue-flow__pane')) return;
      if (target.closest('.vue-flow__node')) return;
      if (target.closest('.vue-flow__nodesselection-rect')) return;
      event.preventDefault();
      const eventDt = event.dataTransfer;
      if (!eventDt) return;
      const rawAsset = eventDt.getData('asset');
      if (!rawAsset) return;
      await this.$getAppManager()
        .get(UiManager)
        .doTask(async () => {
          const parsed = JSON.parse(rawAsset) as { id: string };
          if (!parsed.id) return;
          const assetShort = await this.$getAppManager()
            .get(CreatorAssetManager)
            .getAssetShortViaCache(parsed.id);
          if (!assetShort) {
            throw new Error(this.$t('asset.assetNotFound'));
          }
          const flow = this.$refs['flow'] as VueFlowStore;
          const flowCoord = flow.screenToFlowCoordinate({
            x: event.clientX,
            y: event.clientY,
          });
          await this.blockControllerMut.createNode(flowCoord, null, {
            AssetId: assetShort.id,
            Title: assetShort.title ?? '',
            Name: assetShort.name,
          } as AssetPropValueAsset);
        });
    },
    onEdgeClick({ event }: EdgeMouseEvent) {
      if (event.ctrlKey || event.metaKey || event.button === 2) {
        return;
      }
    },
    onNodeClick({ node }: NodeMouseEvent) {
      this.blockControllerMut.revealBlockContentItem('node-' + node.id);
    },
    setColorForSelected(color: string) {
      for (const node of this.blockControllerMut.state.nodes) {
        if ((node as any).selected) {
          (node.data as any).color = color || undefined;
        }
      }
      this.blockControllerMut.savePropsDelayed();
    },
    openColorPicker() {
      (this.$refs['colorPickerInput'] as HTMLInputElement)?.click();
    },
    pasteFromClipboard() {
      this.createNodeContext = null;
      const flow = this.$refs['flow'] as VueFlowStore;
      if (!flow) return;
      this.blockControllerMut.pasteNodesFromClipboard(
        flow.getViewport(),
        this.lastCreatePosition,
      );
    },
    async showNode(node_id: string): Promise<boolean> {
      const node = this.blockControllerMut.state.nodes.find(
        (n: any) => n.id === node_id,
      ) as GraphNode | undefined;
      if (!node) return false;

      const is_visible = this.viewportHelper.checkNodesAreVisible([node]);
      if (is_visible) return true;

      return await this.viewportHelper.moveToNodes([node], {
        duration: 1000,
        interpolate: 'linear' as any,
        maxZoom: Math.min(
          this.viewportHelper.zoom,
          this.viewportHelper.maxZoom,
        ),
      });
    },
  },
});
</script>

<style lang="scss">
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';

.GraphEditor {
  --imsde-node-color: #6c8cff;
  --imsde-text-color: #333;
  --imsde-node-content-border-color: #999;
  --imsde-node-content-inner-border-color: #555;
  --imsde-node-content-bg-color: #444444f6;
  --imsde-node-content-text-color: #eaeaea;
  --imsde-node-selected-color: #999;
  --imsde-node-selected-outline-width: 0;
}

[data-theme='ims-light'] {
  .GraphEditor {
    --imsde-node-content-bg-color: #f9fafee9;
    --imsde-node-content-border-color: #ddd;
    --imsde-node-content-text-color: var(--local-text-color);
    --imsde-node-selected-color: #000;
  }
}

.GraphEditorNode {
  border-radius: 4px;
  border: 1px solid
    var(--imsgr-node-color, var(--imsde-node-content-border-color));
  background: var(--imsgr-node-bg, var(--imsde-node-content-bg-color));
  &.state-selected {
    outline: calc(1px + var(--imsde-node-selected-outline-width)) solid
      var(--imsgr-node-color, var(--imsde-node-content-border-color));
  }
  & > div:first-child {
    border-top-left-radius: 4px;
    border-top-right-radius: 4px;
  }
  & > div:last-child {
    border-bottom-left-radius: 4px;
    border-bottom-right-radius: 4px;
  }
}

.GraphEditorNode-header {
  background: var(--imsde-node-color);
  position: relative;
}

.GraphEditorNode-body {
}
</style>

<style lang="scss" scoped>
.GraphEditor {
  position: relative;
  width: 100%;
  height: 100%;
}

.GraphEditor-wrapper {
  width: 100%;
  height: 100%;
}

.GraphEditor-createNode {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 100;
}

.GraphEditor-selectionContext {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 100;
}

.GraphEditor-hint {
  position: absolute;
  top: 10px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  pointer-events: none;
}
.GraphEditor-hint-inner {
  padding: 10px 20px;
  border-radius: 4px;
  background: var(--dropdown-bg-color);
  pointer-events: all;
}

.GraphEditor-edge {
  stroke: #888;
  stroke-width: 2;
}

.GraphEditor-defs {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}

.GraphEditor-colorBar {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 4px;
  background-color: var(--dropdown-bg-color);
  backdrop-filter: var(--dropdown-bg-filter);
  box-shadow: var(--dropdown-box-shadow);
  border-radius: var(--dropdown-border-radius);
}

.GraphEditor-colorSwatch {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  background: transparent;
  color: var(--local-text-color);
  &:hover {
    background-color: var(--dropdown-hl-bg-color);
  }
  &.active {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }
  i {
    font-size: 14px;
    opacity: 0.5;
  }
}
.GraphEditor-colorSwatch-inner {
  display: block;
  width: 16px;
  height: 16px;
  border-radius: 3px;
}

.GraphEditor-colorBar-sep {
  width: 1px;
  height: 18px;
  background: var(--local-border-color);
  margin: 0 3px;
}
.GraphEditor-colorPicker {
  position: absolute;
  opacity: 0;
  pointer-events: none;
  width: 0;
  height: 0;
}
</style>
