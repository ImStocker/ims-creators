<template>
  <div class="GraphEditor">
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
    </div>
    <div
      v-if="createNodeContext"
      class="GraphEditor-createNode"
      :style="{
        left: `${createNodeContext.x}px`,
        top: `${createNodeContext.y}px`,
      }"
    >
      <div class="GraphEditor-createNode-dropdown is-dropdown">
        <div class="GraphEditor-createNode-dropdown-item" @click="addCardNode">
          <i class="ri-node-tree GraphEditor-createNode-dropdown-item-icon"></i>
          {{ $t('graphBlock.editor.addCard') }}
        </div>
        <div class="GraphEditor-createNode-dropdown-item" @click="addFileNode">
          <i
            class="ri-attachment-2 GraphEditor-createNode-dropdown-item-icon"
          ></i>
          {{ $t('graphBlock.editor.addFile') }}
        </div>
        <div class="GraphEditor-createNode-dropdown-item" @click="addAssetNode">
          <i class="ri-link-m GraphEditor-createNode-dropdown-item-icon"></i>
          {{ $t('graphBlock.editor.addElement') }}
        </div>
      </div>
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
} from '@vue-flow/core';
import { defineComponent, type PropType, ref } from 'vue';
import GraphMiniMap from '../../flow-common/GraphMiniMap.vue';
import { getNodeDescriptors } from '../nodes/getNodeDescriptors';
import type { ResolvedAssetBlock } from '~ims-app-base/logic/utils/assets';
import type { AssetChanger } from '~ims-app-base/logic/types/AssetChanger';
import type { GraphBlockController } from './GraphBlockController';
import type { AssetPropValueAsset } from '~ims-app-base/logic/types/Props';
import EditorManager from '~ims-app-base/logic/managers/EditorManager';
import DialogManager from '~ims-app-base/logic/managers/DialogManager';
import ProjectManager from '~ims-app-base/logic/managers/ProjectManager';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import CreatorAssetManager from '~ims-app-base/logic/managers/CreatorAssetManager';
import { FlowViewportHelper } from '../../flow-common/FlowViewportHelper';
import { assert } from '~ims-app-base/logic/utils/typeUtils';

export default defineComponent({
  name: 'GraphEditor',
  components: {
    VueFlow,
    GraphMiniMap,
    Background,
    BezierEdge,
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
  },
  mounted() {
    const flow = this.$refs['flow'] as VueFlowStore;
    assert(flow);
    this.viewportHelper.setFlow(flow);
    this._keyDownHandler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
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
        this.blockControllerMut.pasteNodesFromClipboard(flow.getViewport());
      } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyX') {
        const selectedNodeIds = (flow.getSelectedNodes as any).map(
          (n: any) => n.id,
        );
        if (!selectedNodeIds.length) return;
        this.blockControllerMut.cutNodes(selectedNodeIds, flow.getViewport());
      }
    };
    window.addEventListener('keydown', this._keyDownHandler);
  },
  unmounted() {
    if (this._keyDownHandler) {
      window.removeEventListener('keydown', this._keyDownHandler);
      this._keyDownHandler = null;
    }
  },
  methods: {
    onContextMenu(ev: PointerEvent) {
      const target = ev.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('.vue-flow__pane')) {
        return; // Clicked outside pane
      }
      if (target.closest('.vue-flow__node')) {
        return; // Clicked inside the node
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
      this.createNodeContext = null;
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
      const appManager = this.$getAppManager();
      const editorManager = appManager.get(EditorManager);
      const files = await editorManager.pickFiles();
      if (!files || files.length === 0) return;
      const file = files[0];
      const uploadingJob = editorManager.attachFile(file.blob, file.name);
      const result = await uploadingJob.awaitResult();
      if (!result) return;
      await this.blockControllerMut.createNode(
        this.lastCreatePosition,
        this.connectStartParams,
        result,
      );
      this.createNodeContext = null;
      this.connectStartParams = null;
    },
    async addAssetNode() {
      const appManager = this.$getAppManager();
      const dialogManager = appManager.get(DialogManager);
      const gdd_workspace = appManager
        .get(ProjectManager)
        .getWorkspaceByName('gdd');
      if (!gdd_workspace) return;
      const SelectAssetDialog = (
        await import('~ims-app-base/components/Asset/SelectAssetDialog.vue')
      ).default;
      const assetResult = await dialogManager.show(SelectAssetDialog, {
        dialogHeader: this.$t('graphBlock.editor.selectAsset'),
        where: {
          workspaceids: gdd_workspace.id,
        },
      });
      if (!assetResult) return;
      const assetValue: AssetPropValueAsset = {
        AssetId: assetResult.id,
        Title: assetResult.title ?? '',
        Name: assetResult.name,
      };
      await this.blockControllerMut.createNode(
        this.lastCreatePosition,
        this.connectStartParams,
        assetValue,
      );
      this.createNodeContext = null;
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
  },
});
</script>

<style lang="scss">
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';

.GraphEditor {
  --imsde-node-color: #6c8cff;
  --imsde-text-color: #333;
  --imsde-node-content-border-color: transparent;
  --imsde-node-content-inner-border-color: #555;
  --imsde-node-content-bg-color: #444444f6;
  --imsde-node-content-text-color: #eaeaea;
  --imsde-node-selected-color: #999;
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
  border: 1px solid transparent;
  background: var(--imsde-node-content-bg-color);
  &.state-selected {
    border-color: var(--imsde-node-selected-color);
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
  background: var(--imsde-node-content-bg-color);
  color: var(--imsde-node-content-text-color);
  border: var(--imsde-node-content-border-color) 1px solid;
  &:not(:first-child) {
    border-top: none;
  }
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

.GraphEditor-createNode-dropdown {
  background-color: var(--imsde-dropdown-bg-color);
  border-radius: var(--imsde-dropdown-border-radius);
  box-shadow: var(--imsde-dropdown-box-shadow);
  user-select: none;
}
.GraphEditor-createNode-dropdown-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  cursor: pointer;
  color: var(--local-text-color);
  white-space: nowrap;
  &:not(:last-child) {
    border-bottom: 1px solid var(--imsde-dropdown-border-color);
  }
  &:hover {
    --local-text-color: var(--imsde-dropdown-text-color);
    background: var(--imsde-node-color);
    .GraphEditor-createNode-dropdown-item-icon {
      color: var(--local-text-color);
    }
  }
}
.GraphEditor-createNode-dropdown-item-icon {
  color: var(--imsde-node-color);
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
</style>
