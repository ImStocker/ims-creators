<template>
  <div
    class="DialogEditor"
    :style="{
      '--imsde-node-selected-outline-width': selectedOutlineWidth + 'px',
    }"
  >
    <div
      class="DialogEditor-wrapper"
      @pointerdown.capture="onMouseDown"
      @pointerup.capture="onMouseUp"
      @contextmenu.capture="onContextMenu"
      @dragover="onDragOver"
      @drop="onDrop"
    >
      <teleport v-if="toolbarTarget" :to="toolbarTarget">
        <slot name="play-toolbar" :dialog-player="dialogPlayer">
          <dialog-play-toolbar
            :dialog-player="dialogPlayer"
          ></dialog-play-toolbar>
        </slot>
      </teleport>
      <VueFlow
        ref="flow"
        v-model:nodes="blockControllerMut.state.nodes"
        v-model:edges="blockControllerMut.state.edges"
        :selection-key-code="true"
        :multi-selection-key-code="['Meta', 'Shift', 'Control']"
        :pan-on-drag="[2]"
        :connection-mode="ConnectionMode.Strict"
        :delete-key-code="['Delete', 'Backspace']"
        :edges-updatable="!readonlyComp"
        :nodes-draggable="!readonlyComp"
        :nodes-connectable="!readonlyComp"
        :snap-to-grid="true"
        :snap-grid="[10, 10]"
        :min-zoom="0.1"
        @connect-start="onConnectStart"
        @connect-end="onConnectEnd"
        @connect="onConnect"
        @edges-change="onEdgesChange"
        @nodes-change="onNodesChange"
        @viewport-change-start="viewportHelper.onViewportChangeStart($event)"
        @viewport-change-end="flowViewportTransform = $event"
        @edge-click="onEdgeClick"
        @node-click="onNodeClick"
      >
        <template
          v-for="node_desc of nodeDescriptors"
          :key="node_desc.name"
          #[`node-${node_desc.name}`]="params"
        >
          <component
            v-bind="{
              ...params,
              ...(node_desc.params ? node_desc.params : {}),
            }"
            :is="node_desc.node"
            :ref="'node-' + params.id"
            :style="{
              '--imsde-node-color': node_desc.color,
            }"
            :class="{
              'state-selected': params.selected,
              'state-playing-now':
                params.id === dialogPlayer.currentPlayingNodeId &&
                dialogPlayer.displayingFrameIndex === 0,
              'state-playing':
                params.id === dialogPlayer.displayingFrameCurrentPlayingNodeId,
            }"
            :dialog-controller="blockControllerMut"
            :node-data-controller="
              blockControllerMut.getNodeDataController(params.id)
            "
            :node-descriptor="node_desc"
            :readonly="readonlyComp"
            :playing-node-data="dialogPlayer.getLastPlayNode(params.id)"
            :dialog-player="dialogPlayer"
            @change-type="changeNodeType(params.id, $event)"
          ></component>
        </template>
        <template #edge-flow="params">
          <BezierEdge
            class="DialogEditor-flow-edge"
            :class="getFlowEdgePlayStateClass(params.source, params.target)"
            v-bind="params"
          ></BezierEdge>
        </template>
        <Background :offset="19"></Background>
        <MiniMap zoomable pannable class="DialogEditor-minimap"></MiniMap>
        <div
          v-if="scriptEndedPopup"
          class="DialogEditor-scriptEnded is-dropdown"
          :style="scriptEndedPopupStyle"
        >
          <div class="DialogEditor-scriptEnded-content">
            <div class="DialogEditor-scriptEnded-text">
              {{ $t('imsDialogEditor.play.scriptCompleted') }}
            </div>
            <button
              class="is-button is-button-primary"
              @click="dialogPlayer.stop()"
            >
              {{ $t('imsDialogEditor.play.finishExecution') }}
            </button>
          </div>
        </div>
      </VueFlow>
    </div>
    <div v-if="!hasStart && !readonly" class="DialogEditor-hint">
      <div class="DialogEditor-hint-inner">
        {{ $t('imsDialogEditor.addStartLevelHint') }}
      </div>
    </div>
    <div
      v-if="createNodeContext && createNodeContext.clickedAt"
      class="DialogEditor-createNode"
      :style="{
        left: `${createNodeContext.clickedAt.x}px`,
        top: `${createNodeContext.clickedAt.y}px`,
      }"
    >
      <dropdown-element :shown="!!createNodeContext">
        <CreateNodeDropdown
          :dialog-block-controller="blockController"
          :allowed-types="createNodeContext.allowedTypes"
          :need-data-in="createNodeContext.needDataIn"
          :need-data-out="createNodeContext.needDataOut"
          @choose="createNode($event)"
          @choose-template="createNodeByTemplate($event)"
        ></CreateNodeDropdown>
      </dropdown-element>
    </div>
    <div class="DialogEditor-topButtons">
      <menu-button
        v-if="playingFramesInfos.length > 1"
        class="DialogEdtior-frameSelector"
      >
        <template #button="{ toggle }">
          <button
            class="is-button is-button-action DialogEdtior-frameSelector-button"
            @click="toggle"
          >
            <i class="ri-arrow-down-s-line"></i>
            {{ playingFramesInfos[dialogPlayer.displayingFrameIndex]?.title }}
          </button>
        </template>
        <div class="DialogEdtior-frameSelector-options is-dropdown">
          <div
            v-for="frame of playingFramesInfos"
            :key="frame.id"
            class="DialogEdtior-frameSelector-options-one"
            @click="dialogPlayer.displayingFrameIndex = frame.frameIndex"
          >
            <i
              v-if="frame.frameIndex === dialogPlayer.displayingFrameIndex"
              class="ri-arrow-right-s-fill"
            ></i>
            {{ frame.title }}
          </div>
        </div>
      </menu-button>
    </div>
    <div class="DialogEditor-buttons">
      <menu-button class="DialogEditor-variables">
        <template #button="{ toggle }">
          <button class="is-button is-button-action" @click="toggle">
            <i class="ri-arrow-up-s-line"></i>
            {{ $t('imsDialogEditor.var.variables') }}
          </button>
        </template>
        <manage-variables-dropdown
          :dialog-controller="blockControllerMut"
          :readonly="readonlyComp"
        ></manage-variables-dropdown>
      </menu-button>
      <menu-button class="DialogEditor-actions">
        <template #button="{ toggle }">
          <button class="is-button is-button-action" @click="toggle">
            <i class="ri-arrow-up-s-line"></i>
            {{ $t('imsDialogEditor.actions.actionsTitle') }}
          </button>
        </template>
        <manage-actions-dropdown
          :dialog-controller="blockControllerMut"
          :readonly="readonlyComp"
        ></manage-actions-dropdown>
      </menu-button>
    </div>
  </div>
</template>

<script lang="ts">
import { Background } from '@vue-flow/background';
import {
  ConnectionMode,
  type VueFlowStore,
  type OnConnectStartParams,
  VueFlow,
  type HandleType,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type GraphNode,
  BezierEdge,
  type EdgeMouseEvent,
  type NodeMouseEvent,
  type ViewportTransform,
} from '@vue-flow/core';
import { MiniMap } from '@vue-flow/minimap';
import { defineComponent, type PropType } from 'vue';
import DialogSpeechNode from '../nodes/DialogSpeechNode.vue';
import DialogStartNode from '../nodes/DialogStartNode.vue';
import DialogTriggerNode from '../nodes/DialogTriggerNode.vue';
import DialogTimerNode from '../nodes/DialogTimerNode.vue';
import DialogChanceNode from '../nodes/DialogChanceNode.vue';
import DialogBranchNode from '../nodes/DialogBranchNode.vue';
import CreateNodeDropdown from './CreateNodeDropdown.vue';
import { getNodeDescriptors } from '../nodes/getNodeDescriptiors';
import {
  NodeType,
  type NodeDescriptor,
  type NodeDescriptorTemplate,
} from '../nodes/NodeDescriptor';
import { v4 as uuidv4 } from 'uuid';
import {
  getPreferenceKeyForBlock,
  type ResolvedAssetBlock,
} from '~ims-app-base/logic/utils/assets';
import type { AssetChanger } from '~ims-app-base/logic/types/AssetChanger';
import type { NodeData } from './NodeDataController';
import type { DialogBlockController } from './DialogBlockController';
import type {
  AssetPropValueAsset,
  AssetPropValueType,
} from '~ims-app-base/logic/types/Props';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import CreatorAssetManager from '~ims-app-base/logic/managers/CreatorAssetManager';
import { FlowViewportHelper } from './FlowViewportHelper';
import { assert } from '~ims-app-base/logic/utils/typeUtils';
import { DialogPlayer } from '../play/DialogPlayer';
import DialogPlayToolbar from '../play/DialogPlayToolbar.vue';
import type { IProjectContext } from '~ims-app-base/logic/types/IProjectContext';
import {
  setImsClickOutside,
  type SetClickOutsideCancel,
} from '~ims-app-base/components/utils/ui';
import { getNextIndexWithTimestamp } from '~ims-app-base/components/Asset/Editor/blockUtils';
import DropdownElement from '~ims-app-base/components/Common/DropdownElement.vue';
import MenuButton from '~ims-app-base/components/Common/MenuButton.vue';
import ManageVariablesDropdown from '../parts/ManageVariablesDropdown.vue';
import UiPreferenceManager from '~ims-app-base/logic/managers/UiPreferenceManager';
import ManageActionsDropdown from '../parts/ManageActionsDropdown.vue';
import { SCRIPT_ASSET_ID } from '~ims-app-base/logic/constants';

type CreateNodeContext = {
  clickedAt: { x: number; y: number } | null;
  allowedTypes: NodeType[];
  connectStartDescriptor: NodeDescriptor | null;
  needDataIn: AssetPropValueType[] | null;
  needDataOut: AssetPropValueType[] | null;
  connectStartParams: {
    nodeId: string;
    handleId: string;
    handleType: HandleType;
  } | null;
};

export default defineComponent({
  name: 'DialogEditor',
  components: {
    VueFlow,
    DialogSpeechNode,
    DialogStartNode,
    DialogTriggerNode,
    DialogTimerNode,
    DialogChanceNode,
    DialogBranchNode,
    MiniMap,
    Background,
    CreateNodeDropdown,
    BezierEdge,
    DialogPlayToolbar,
    DropdownElement,
    MenuButton,
    ManageVariablesDropdown,
    ManageActionsDropdown,
  },
  inject: ['projectContext'],
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
      type: Object as PropType<DialogBlockController>,
      required: true,
    },
  },
  emits: ['focus', 'blur'],
  data() {
    const projectContext = this.projectContext as IProjectContext | undefined;
    assert(projectContext, 'Project context is not provided');
    const viewportHelper = new FlowViewportHelper();
    const dialogPlayer = new DialogPlayer(
      this.$getAppManager(),
      this.blockController,
      viewportHelper,
      projectContext,
    );
    return {
      createNodeContext: null as CreateNodeContext | null,
      viewportHelper,
      dialogPlayer,
      isFocused: false,
      clickOutside: null as SetClickOutsideCancel | null,
      mouseDownTime: 0,
    };
  },
  computed: {
    ConnectionMode() {
      return ConnectionMode;
    },
    readonlyComp() {
      return this.readonly || this.dialogPlayer.isPlaying;
    },
    blockControllerMut() {
      const playingBlockController =
        this.dialogPlayer.displayingFrameDialogController;
      if (playingBlockController) return playingBlockController;
      return this.blockController;
    },
    nodeDescriptors() {
      return getNodeDescriptors();
    },
    hasStart() {
      return this.blockControllerMut.hasStart;
    },
    selectedOutlineWidth() {
      return Math.max(
        Math.round(-1.5 * Math.log2(this.viewportHelper.zoom)),
        0,
      );
    },
    flowViewportTransformPreferenceKey() {
      const preference_id = this.blockController.resolvedBlock
        ? getPreferenceKeyForBlock(this.blockController.resolvedBlock)
        : '';
      return `ScriptBlock.viewportTransform.` + preference_id;
    },
    flowViewportTransform: {
      get(): ViewportTransform | null {
        return this.$getAppManager()
          .get(UiPreferenceManager)
          .getPreference(this.flowViewportTransformPreferenceKey, null);
      },
      set(value: ViewportTransform) {
        this.$getAppManager()
          .get(UiPreferenceManager)
          .setPreference(this.flowViewportTransformPreferenceKey, value);
      },
    },
    scriptEndedPopupStyle() {
      if (!this.dialogPlayer.lastVisitedNodeId) return {};
      const nodeId = this.dialogPlayer.lastVisitedNodeId;
      const node = this.blockControllerMut.state.nodes.find(
        (n: any) => n.id === nodeId,
      );
      if (!node) return {};
      const flow = this.$refs['flow'] as VueFlowStore;

      const editor_bbox = this.$el.getBoundingClientRect();

      const coords = flow.flowToScreenCoordinate({
        x: node.position.x - editor_bbox.left,
        y: node.position.y - editor_bbox.top + (node.dimensions.height ?? 0),
      });
      return {
        left: coords.x + 'px',
        top: coords.y + 'px',
      };
    },
    scriptEndedPopup() {
      return this.dialogPlayer.scriptEnded && this.dialogPlayer.isPlayDebug;
    },
    playingFramesInfos() {
      return this.dialogPlayer.playingFramesInfos;
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
    changeNodeType(node_id: string, new_type: string) {
      this.blockControllerMut.changeNodeType(node_id, new_type);
    },
    getFlowEdgePlayStateClass(source_id: string, target_id: string) {
      const state = this.dialogPlayer.getFlowEdgePlayState(
        source_id,
        target_id,
      );
      if (!state) return null;
      return 'state-playing-' + state;
    },
    resetFocusedListeners(init: boolean) {
      if ((this as any)._keyDownHandler) {
        window.removeEventListener('keydown', (this as any)._keyDownHandler);
        (this as any)._keyDownHandler = null;
      }

      if (this.clickOutside) {
        this.clickOutside();
        this.clickOutside = null;
      }
      if (init) {
        this.clickOutside = setImsClickOutside(this.$el, () => {
          this.isFocused = false;
        });
        (this as any)._keyDownHandler = async (e: KeyboardEvent) => {
          if (!this.isFocused) {
            return;
          }
          const target = e.target as HTMLElement;
          if (!target) return;
          if (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable
          ) {
            return;
          }
          const flow = this.$refs.flow as VueFlowStore | undefined;
          if (!flow) return;
          if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC') {
            const selected_node_ids = (flow.getSelectedNodes as any).map(
              (n) => n.id,
            );
            this.blockControllerMut.copyNodesToClipboard(
              selected_node_ids,
              flow.getViewport(),
            );
          } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV') {
            this.blockControllerMut.pasteNodesFromClipboard(flow.getViewport());
          } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyX') {
            const selected_node_ids = (flow.getSelectedNodes as any).map(
              (n) => n.id,
            );
            this.blockControllerMut.cutNodes(
              selected_node_ids,
              flow.getViewport(),
            );
          }
        };
        window.addEventListener('keydown', (this as any)._keyDownHandler);
      }
    },
    async createNodeByTemplate(params: {
      descriptor: NodeDescriptor;
      template: NodeDescriptorTemplate;
    }) {
      const created = await this.createNode(params.descriptor);
      if (!created) return;

      const node_data_controller =
        this.blockControllerMut.getNodeDataController(created.id);
      if (!node_data_controller) return;

      params.template.apply(node_data_controller);
    },
    async createNode(descriptor: NodeDescriptor) {
      if (this.readonlyComp) {
        return null;
      }
      if (!this.createNodeContext) {
        return null;
      }
      if (!this.createNodeContext.clickedAt) {
        return null;
      }
      const created_node_id = uuidv4();
      const flow = this.$refs['flow'] as VueFlowStore;

      const editor_bbox = this.$el.getBoundingClientRect();
      const screen_x = editor_bbox.left + this.createNodeContext.clickedAt.x;
      const screen_y = editor_bbox.top + this.createNodeContext.clickedAt.y;
      const flow_coord = flow.screenToFlowCoordinate({
        x: screen_x,
        y: screen_y,
      });

      const max_index = this.blockController.state.nodes.reduce(
        (acc, n) => Math.max(acc, n.data?.index ?? 0),
        0,
      );
      let node_data: NodeData = {
        subject: '',
        values: {},
        params: {
          in: [],
          out: [],
        },
        options: [],
        index: getNextIndexWithTimestamp(max_index),
      };
      if (descriptor.initData) {
        node_data = descriptor.initData();
      }
      if (descriptor.name === 'speech') {
        if (this.createNodeContext?.connectStartParams?.nodeId) {
          const last_node_obj = this.blockControllerMut.state.nodes.find(
            (n) => n.id === this.createNodeContext?.connectStartParams?.nodeId,
          );
          if (
            last_node_obj &&
            last_node_obj.type === 'speech' &&
            last_node_obj.data?.values
          ) {
            for (const param of Object.keys(last_node_obj.data.values)) {
              if (
                this.blockControllerMut.state.__settings.speech.main[param]
                  ?.autoFill &&
                last_node_obj.data.values[param]
              ) {
                node_data.values[param] = last_node_obj.data.values[param];
              }
            }
          }
        }
      }

      this.blockControllerMut.state.nodes.push({
        id: created_node_id,
        type: descriptor.name,
        position: flow_coord,
        data: node_data,
      });
      await new Promise((r) => setTimeout(r, 1)); // NOTE: wait for handles of new node

      if (this.createNodeContext.connectStartParams) {
        const handle = this.createNodeContext.connectStartParams.handleId;
        const related_node = this.blockControllerMut.state.nodes.find(
          (n) => n.id === this.createNodeContext?.connectStartParams?.nodeId,
        ) as GraphNode | undefined;

        if (related_node) {
          if (
            this.createNodeContext.connectStartParams.handleType === 'source'
          ) {
            const edge_res = this.blockControllerMut.addEdge(
              related_node.id,
              created_node_id,
              handle,
            );
            if (descriptor.type === NodeType.EXEC) {
              for (const edge_rem of edge_res.removed) {
                this.blockControllerMut.addEdge(
                  created_node_id,
                  edge_rem.target,
                  undefined,
                  edge_rem.targetHandle ?? undefined,
                );
              }
            }
          } else {
            const edge_res = this.blockControllerMut.addEdge(
              created_node_id,
              related_node.id,
              undefined,
              handle,
            );
            if (descriptor.type === NodeType.DATA) {
              for (const edge_rem of edge_res.removed) {
                this.blockControllerMut.addEdge(
                  edge_rem.source,
                  created_node_id,
                  edge_rem.sourceHandle ?? undefined,
                  undefined,
                );
              }
            }
          }
        }
      }

      const node_instance: any = this.$refs['node-' + created_node_id];
      if (node_instance) {
        if ((node_instance as any).activate) {
          (node_instance as any).activate();
        }

        if (
          this.createNodeContext?.connectStartParams?.handleType === 'target'
        ) {
          const new_flow_coord = flow.screenToFlowCoordinate({
            x: screen_x - node_instance.$el.clientWidth,
            y: screen_y,
          });
          const node_index = this.blockControllerMut.state.nodes.findIndex(
            (node) => node.id === created_node_id,
          );
          if (node_index > -1) {
            this.blockControllerMut.state.nodes[node_index].position =
              new_flow_coord;
          }
        }
      }
      this.createNodeContext = null;
      this.savePropsDelayed();

      return {
        id: created_node_id,
      };
    },
    saveProps() {
      if (this.readonlyComp) {
        return;
      }
      this.blockControllerMut.saveProps();
    },
    savePropsDelayed() {
      if (this.readonlyComp) {
        return;
      }
      this.blockControllerMut.savePropsDelayed();
    },
    onMouseDown() {
      if (this.readonlyComp) {
        return;
      }
      this.createNodeContext = null;
      this.isFocused = true;
      this.mouseDownTime = Date.now();
    },
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
    onMouseUp(ev: PointerEvent) {
      if (this.readonlyComp) {
        return;
      }
      if (ev.button !== 2) {
        // This only for right mouse button
        return;
      }
      const target = ev.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('.vue-flow__pane')) {
        return; // Clicked outside pane
      }
      if (target.closest('.vue-flow__node')) {
        return; // Clicked inside the node
      }
      ev.preventDefault();
      const md_elapsed = Date.now() - this.mouseDownTime;
      if (md_elapsed > 200) {
        return; // Pan move
      }

      const editor_bbox = this.$el.getBoundingClientRect();
      const allowed_types = this._getAvailableNodeTypes(null, null);
      this.createNodeContext = {
        clickedAt: {
          x: ev.clientX - editor_bbox.x,
          y: ev.clientY - editor_bbox.y,
        },
        needDataIn: null,
        needDataOut: null,
        connectStartDescriptor: null,
        connectStartParams: null,
        allowedTypes: allowed_types,
      };
    },
    onConnectEnd(ev: any) {
      if (!this.$el) return;
      if (this.createNodeContext) {
        const editor_bbox = this.$el.getBoundingClientRect();
        this.createNodeContext.clickedAt = {
          x: ev.clientX - editor_bbox.x,
          y: ev.clientY - editor_bbox.y,
        };
      }
    },
    onConnect(ev: Connection) {
      this.blockControllerMut.addEdge(
        ev.source,
        ev.target,
        ev.sourceHandle ?? undefined,
        ev.targetHandle ?? undefined,
      );
      this.createNodeContext = null;
    },
    _getAvailableNodeTypes(
      edge: 'in' | 'out' | null,
      type: 'exec' | 'data' | null,
    ): NodeType[] {
      if (type === 'data') {
        return [NodeType.DATA, NodeType.DATA_START];
      }
      const allowed_types: NodeType[] = [NodeType.EXEC];
      if (edge === 'out' || edge === null) {
        if (!this.blockControllerMut.hasStart) {
          allowed_types.push(NodeType.EXEC_START);
        }
      }
      if (edge === 'in' || edge === null) {
        allowed_types.push(NodeType.EXEC_END);
      }
      if (edge === null && type === null) {
        allowed_types.push(NodeType.DATA_START);
      }
      return allowed_types;
    },
    onConnectStart(ev: OnConnectStartParams) {
      const ev_node_id = ev.nodeId;
      const ev_handle_type = ev.handleType;
      const ev_handle_id = ev.handleId;
      if (!ev_node_id) return;
      if (!ev_handle_type) return;
      if (!ev_handle_id) return;
      const node = this.blockControllerMut.state.nodes.find(
        (n) => n.id === ev_node_id,
      );
      if (!node) return;
      const descriptor = this.nodeDescriptors.find(
        (nd) => nd.name === node.type,
      );
      if (!descriptor) return;

      const from_data = this.blockControllerMut.getNodePinDataType(
        ev_node_id,
        ev_handle_id,
      );
      const allowed_types = this._getAvailableNodeTypes(
        ev.handleType === 'source' ? 'in' : 'out',
        ev.handleId?.startsWith('data-') ? 'data' : 'exec',
      );
      this.createNodeContext = {
        clickedAt: null,
        allowedTypes: allowed_types,
        needDataIn: ev.handleType === 'source' ? from_data : null,
        needDataOut: ev.handleType !== 'source' ? from_data : null,
        connectStartParams: {
          handleId: ev_handle_id,
          nodeId: ev_node_id,
          handleType: ev_handle_type,
        },
        connectStartDescriptor: descriptor,
      };
    },
    onEdgesChange(events: EdgeChange[]) {
      let need_save = false;
      for (const ev of events) {
        switch (ev.type) {
          case 'add':
            need_save = true;
            break;
          case 'remove':
            this.blockControllerMut.onEdgeDeleted(ev.id);
            need_save = true;
            break;
        }
      }
      if (need_save) {
        this.savePropsDelayed();
      }
    },
    onNodesChange(events: NodeChange[]) {
      let need_save = false;
      for (const ev of events) {
        switch (ev.type) {
          case 'add':
          case 'dimensions':
          case 'position':
            need_save = true;
            break;

          case 'remove':
            this.blockControllerMut.onNodeDeleted(ev.id);
            need_save = true;
            break;
        }
      }
      if (need_save) {
        this.savePropsDelayed();
      }
    },
    onDragOver(event: DragEvent) {
      if (this.readonlyComp) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('.vue-flow__pane')) {
        return; // Clicked outside pane
      }
      if (target.closest('.vue-flow__node')) {
        return; // Clicked inside the node
      }

      const event_dt = event.dataTransfer;
      if (!event_dt) return;
      const available_drag_types = [
        'asset',
        'dialog-variable',
        'dialog-action',
      ];
      const drag_is_available = available_drag_types.some((type) =>
        event_dt.types.includes(type),
      );
      if (!drag_is_available) return;
      event_dt.dropEffect = 'link';
      event.preventDefault();
    },
    async onDrop(event: DragEvent) {
      if (this.readonlyComp) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest('.vue-flow__pane')) {
        return; // Clicked outside pane
      }
      if (target.closest('.vue-flow__node')) {
        return; // Clicked inside the node
      }

      event.preventDefault();
      const event_dt = event.dataTransfer;
      if (!event_dt) return;
      const event_dt_asset = event_dt.getData('asset');
      const event_dt_variable = event_dt.getData('dialog-variable');
      const event_dt_action = event_dt.getData('dialog-action');

      if (!event_dt_asset && !event_dt_variable && !event_dt_action) return;

      const editor_bbox = this.$el.getBoundingClientRect();
      const create_context: CreateNodeContext = {
        clickedAt: {
          x: event.clientX - editor_bbox.x,
          y: event.clientY - editor_bbox.y,
        },
        needDataIn: null,
        needDataOut: null,
        connectStartDescriptor: null,
        connectStartParams: null,
        allowedTypes: [],
      };

      if (event_dt_asset) {
        await this.$getAppManager()
          .get(UiManager)
          .doTask(async () => {
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

            const script_call_descr = this.nodeDescriptors.find(
              (d) => d.name === 'callScript',
            );
            if (
              drop_asset_short.typeIds.includes(SCRIPT_ASSET_ID) &&
              script_call_descr
            ) {
              this.createNodeContext = create_context;
              const created = await this.createNode(script_call_descr);
              if (!created) return;

              const node_instance = this.$refs['node-' + created.id] as any;
              if (node_instance) {
                node_instance.nodeDataController.setSubject({
                  AssetId: drop_asset_short.id,
                  Title: drop_asset_short.title,
                  Name: drop_asset_short.name,
                } as AssetPropValueAsset);
              }
            } else {
              const const_asset_descr = this.nodeDescriptors.find(
                (d) => d.name === 'constAsset',
              );
              if (const_asset_descr) {
                this.createNodeContext = create_context;
                const created = await this.createNode(const_asset_descr);
                if (!created) return;

                const node_instance = this.$refs['node-' + created.id] as any;
                if (node_instance) {
                  node_instance.value = {
                    AssetId: drop_asset_short.id,
                    Title: drop_asset_short.title,
                    Name: drop_asset_short.name,
                  } as AssetPropValueAsset;
                }
              }
            }
          });
      }
      if (event_dt_variable) {
        const get_var_descr = this.nodeDescriptors.find(
          (d) => d.name === 'getVar',
        );
        if (get_var_descr) {
          await this.$getAppManager()
            .get(UiManager)
            .doTask(async () => {
              this.createNodeContext = create_context;
              const created = await this.createNode(get_var_descr);
              if (!created) return;

              const node_instance = this.$refs['node-' + created.id] as any;
              if (node_instance) {
                node_instance.nodeDataController.setValue(
                  'variable',
                  event_dt_variable,
                );
              }
            });
        }
      }
      if (event_dt_action) {
        const action = this.blockControllerMut
          .getActions()
          .find((el) => el.name === event_dt_action);
        if (action) {
          const get_action_descr = this.nodeDescriptors.find(
            (d) => d.name === action.type,
          );
          if (get_action_descr) {
            await this.$getAppManager()
              .get(UiManager)
              .doTask(async () => {
                this.createNodeContext = create_context;
                const created = await this.createNode(get_action_descr);
                if (!created) return;

                const node_instance = this.$refs['node-' + created.id] as any;
                if (node_instance) {
                  node_instance.nodeDataController.setSubject(event_dt_action);
                }
              });
          }
        }
      }
    },
    onEdgeClick({ event, edge }: EdgeMouseEvent) {
      if (event.ctrlKey || event.metaKey) {
        this.blockControllerMut.deleteEdgeById(edge.id);
        event.stopPropagation();
        event.preventDefault();
        return;
      }
    },
    onNodeClick({ node }: NodeMouseEvent) {
      this.blockControllerMut.revealBlockContentItem('node-' + node.id);
    },
    async showNode(node_id: string): Promise<boolean> {
      const node = this.blockControllerMut.state.nodes.find(
        (n) => n.id === node_id,
      ) as GraphNode | undefined;
      if (!node) return false;

      const is_visible = this.viewportHelper.checkNodesAreVisible([node]);
      if (is_visible) return true;

      return await this.viewportHelper.moveToNodes([node], {
        duration: 1000,
        interpolate: 'linear',
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
@import '@vue-flow/minimap/dist/style.css';

.DialogEditor {
  --imsde-text-color: #333;
  --imsde-node-content-border-color: transparent;
  --imsde-node-content-inner-border-color: #555;
  --imsde-node-content-bg-color: #444444f6;
  --imsde-node-content-text-color: #eaeaea;
  --imsde-node-selected-color: #999;
  --imsde-node-playing-color: #f6a100;

  --imsde-node-selected-outline-width: 0;
}

:root {
  --imsde-type-boolean-stroke: #ff5757;
  --imsde-type-boolean-fill: #d64848;

  --imsde-type-float-stroke: #82ff57;
  --imsde-type-float-fill: #75d255;

  --imsde-type-integer-stroke: #57f6ff;
  --imsde-type-integer-fill: #4ad6de;

  --imsde-type-string-stroke: #ff57d8;
  --imsde-type-string-fill: #ef53ca;

  --imsde-type-text-stroke: #f7aece;
  --imsde-type-text-fill: #eb83b0;

  --imsde-type-asset-stroke: #ffb957;
  --imsde-type-asset-fill: #f0af55;

  --imsde-type-any-stroke: #fff;
  --imsde-type-any-fill: #555555;
}
[data-theme='ims-light'] {
  .DialogEditor {
    --imsde-node-content-bg-color: #f9fafee9;
    --imsde-node-content-border-color: transparent;
    --imsde-node-content-text-color: var(--local-text-color);
    --imsde-node-content-border-color: #ddd;
    --imsde-node-content-inner-border-color: #ddd;
    --imsde-node-selected-color: #000;
  }
}

.DialogEditorNode {
  border-radius: 4px;
  border: 1px solid transparent;
  &.state-selected {
    border-color: var(--imsde-node-selected-color);
    outline: var(--imsde-node-selected-outline-width) solid
      var(--imsde-node-selected-color);
  }
  & > div:first-child {
    border-top-left-radius: 4px;
    border-top-right-radius: 4px;
  }
  & > div:last-child {
    border-bottom-left-radius: 4px;
    border-bottom-right-radius: 4px;
  }
  &.state-playing {
    outline: calc(2px + var(--imsde-node-selected-outline-width)) solid
      var(--imsde-node-playing-color);
  }
}
.DialogEditorNode-header {
  background: var(--imsde-node-color);
  position: relative;
}

.DialogEditorNode-body {
  background: var(--imsde-node-content-bg-color);
  color: var(--imsde-node-content-text-color);
  border: var(--imsde-node-content-border-color) 1px solid;
  &:not(:first-child) {
    border-top: none;
  }
}
.DialogEditor-flow-edge {
  &.state-playing-visited {
    stroke: var(--imsde-node-playing-color);
    stroke-width: 1;
  }
  &.state-playing-current {
    stroke: var(--imsde-node-playing-color);
    stroke-width: 2;
  }
}
</style>

<style lang="scss" scoped>
.DialogEditor {
  position: relative;
}
.DialogEditor-createNode {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 100;
}
.DialogEditor-wrapper {
  width: 100%;
  height: 100%;
}
.DialogEditor-minimap {
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

:deep(.DialogNode-header) {
  color: var(--imsde-node-header-text-color);
}

.DialogEditor-hint {
  position: absolute;
  top: 10px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  pointer-events: none;
}
.DialogEditor-buttons,
.DialogEditor-topButtons {
  display: flex;
  gap: 5px;
  position: absolute;
}
.DialogEditor-buttons {
  bottom: 5px;
  left: 5px;
}
.DialogEditor-topButtons {
  top: 5px;
  left: 5px;
}
.DialogEditor-buttons,
.DialogEditor-topButtons {
  .is-button {
    padding-left: 18px;
    &:not(:hover):not(:focus) {
      --button-bg-color: var(--local-bg-color);
    }
  }
}
.DialogEdtior-frameSelector-button {
  --button-text-color: var(--imsde-node-playing-color);
  --button-border-color: var(--imsde-node-playing-color);
}

.DialogEdtior-frameSelector-options {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-height: 0;
  overflow: auto;
  min-width: 100px;
}
.DialogEdtior-frameSelector-options-one {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  padding: 5px 5px;
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    background-color: var(--local-hl-bg-color);
  }
}
.DialogEditor-hint-inner {
  padding: 10px 20px;
  border-radius: 4px;
  background: var(--dropdown-bg-color);
  pointer-events: all;
}
.DialogEditor-scriptEnded {
  --local-text-color: var(--imsde-node-playing-color);
  padding: var(--dropdown-padding);
  position: absolute;
  z-index: 200;
  min-width: 200px;

  .is-button {
    --button-border-color: var(--local-text-color);

    &:not(:hover) {
      --button-text-color: var(--local-text-color);
    }

    &:hover {
      --button-bg-color: var(--imsde-node-playing-color);
    }
  }
}
.DialogEditor-scriptEnded-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.DialogEditor-scriptEnded-text {
  font-size: 16px;
  font-weight: bold;
  color: var(--local-text-color);
}
</style>
