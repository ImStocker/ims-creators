<template>
  <div class="GraphEditor">
    <div
      class="GraphEditor-wrapper"
      @pointerdown.capture="onMouseDown"
      @pointerup.capture="onMouseUp"
      @contextmenu.capture="onContextMenu"
      @dragover.prevent
      @drop.prevent
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
        <MiniMap zoomable pannable class="GraphEditor-minimap" />
        <svg class="GraphEditor-defs">
          <defs>
            <marker
              id="graph-arrow"
              viewBox="0 0 10 10"
              refX="10"
              refY="5"
              markerWidth="8"
              markerHeight="8"
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
        <button class="is-button is-button-action" @click="addNode">
          <i class="ri-node-tree"></i> {{ $t('graphBlock.editor.addNode') }}
        </button>
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
} from '@vue-flow/core';
import { MiniMap } from '@vue-flow/minimap';
import { defineComponent, type PropType, ref } from 'vue';
import { getNodeDescriptors } from '../nodes/getNodeDescriptors';
import type { ResolvedAssetBlock } from '~ims-app-base/logic/utils/assets';
import type { AssetChanger } from '~ims-app-base/logic/types/AssetChanger';
import type { GraphBlockController } from './GraphBlockController';

export default defineComponent({
  name: 'GraphEditor',
  components: {
    VueFlow,
    MiniMap,
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
    return {
      createNodeContext: null as { x: number; y: number } | null,
      connectStartParams: null as { nodeId: string; handleId: string; handleType: string } | null,
      mouseDownTime: 0,
      lastCreatePosition: { x: 0, y: 0 },
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
    async addNode() {
      const nodeId = await this.blockControllerMut.createNode(
        this.lastCreatePosition,
        this.connectStartParams,
      );
      this.createNodeContext = null;
      this.connectStartParams = null;
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
@import '@vue-flow/minimap/dist/style.css';

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
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
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

.GraphEditor-minimap {
  background-color: transparent;

  :deep(svg) {
    background-color: var(--imsde-minimap-bg-color);
  }
  :deep(.vue-flow__minimap-node) {
    fill: var(--imsde-minimap-node-color);
  }
  :deep(.vue-flow__minimap-mask) {
    fill: var(--imsde-minimap-mask-color);
  }
}
</style>
