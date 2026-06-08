import type { Edge, GraphEdge, GraphNode } from '@vue-flow/core';
import type { GraphBlockState } from './GraphEditor';
import {
  exportGraphBlockData,
  extractGraphBlockData,
  parseSourceHandle,
  parseTargetHandle,
} from './GraphEditor';
import type { AssetChanger } from '~ims-app-base/logic/types/AssetChanger';
import type { ResolvedAssetBlock } from '~ims-app-base/logic/utils/assets';
import { debounceForThis } from '~ims-app-base/components/utils/ComponentUtils';
import {
  diffAssetPropObjects,
  makeBlockRef,
  truncateAssetPropValueText,
  castAssetPropValueToString,
  castAssetPropValueToText,
  type AssetProps,
} from '~ims-app-base/logic/types/Props';
import type { IAppManager } from '~ims-app-base/logic/managers/IAppManager';
import { v4 as uuidv4 } from 'uuid';
import { BlockEditorController } from '~ims-app-base/logic/types/BlockEditorController';
import { watch } from 'vue';
import type { BlockContentItem } from '~ims-app-base/logic/types/BlockTypeDefinition';
import { getNodeDescriptorOfType } from '../nodes/getNodeDescriptors';
import type { MenuListItem } from '~ims-app-base/logic/types/MenuList';
import { getNextIndexWithTimestamp } from '~ims-app-base/components/Asset/Editor/blockUtils';

export type GraphBlockContentUserData = {
  type: 'node';
  id: string;
};

export class GraphBlockController extends BlockEditorController {
  state!: GraphBlockState;
  private _expectPropsChange = false;
  readonly savePropsDelayed: () => void;

  constructor(
    appManager: IAppManager,
    getResolvedBlock: () => ResolvedAssetBlock | null,
  ) {
    super(appManager, getResolvedBlock);
    this.savePropsDelayed = debounceForThis(function (this: any) {
      this.saveProps();
    }, 300);
  }

  override postCreate(): void {
    watch(
      () => this.resolvedBlock,
      () => this._onBlockUpdated(),
      { immediate: true },
    );
  }

  get changer(): AssetChanger | null {
    return this.assetBlockEditor ? this.assetBlockEditor.assetChanger : null;
  }

  private _onBlockUpdated() {
    if (this._expectPropsChange) return;
    if (!this.resolvedBlock) return;
    this.state = extractGraphBlockData(this.resolvedBlock.computed);
  }

  addEdge(
    source: string,
    target: string,
    sourceHandle?: string,
    targetHandle?: string,
  ) {
    const existing = this.state.edges.find(
      (e) => e.source === source && e.target === target
        && e.sourceHandle === sourceHandle
        && e.targetHandle === targetHandle,
    );
    if (existing) return;

    const edge: Edge = {
      id: `${source}|${sourceHandle ?? 'source-right'}|${targetHandle ?? 'target-left'}|${target}`,
      source,
      target,
      sourceHandle,
      targetHandle,
      type: 'graph-edge',
    };
    this.state.edges = [...this.state.edges, edge];
    this.savePropsDelayed();
  }

  deleteEdgeById(edgeId: string) {
    const index = this.state.edges.findIndex((e) => e.id === edgeId);
    if (index >= 0) {
      this.state.edges.splice(index, 1);
      this.savePropsDelayed();
    }
  }

  async deleteNodeById(nodeId: string) {
    const index = this.state.nodes.findIndex((n) => n.id === nodeId);
    if (index >= 0) {
      this.state.nodes.splice(index, 1);
      for (let i = this.state.edges.length - 1; i >= 0; i--) {
        const e = this.state.edges[i];
        if (e.source === nodeId || e.target === nodeId) {
          this.state.edges.splice(i, 1);
        }
      }
      this.savePropsDelayed();
    }
  }

  async createNode(
    position: { x: number; y: number },
    connectFrom?: { nodeId: string; handleId: string; handleType: string } | null,
  ) {
    const id = uuidv4();
    const maxIndex = this.state.nodes.reduce(
      (acc, n) => Math.max(acc, ((n.data as any)?.index ?? 0)),
      0,
    );

    this.state.nodes.push({
      id,
      type: 'graph-node',
      position,
      data: {
        value: null,
        width: 200,
        height: 80,
        index: getNextIndexWithTimestamp(maxIndex),
      },
    });

    if (connectFrom) {
      const OPPOSITE_SIDE: Record<string, string> = {
        top: 'bottom',
        bottom: 'top',
        left: 'right',
        right: 'left',
      };

      if (connectFrom.handleType === 'source') {
        const fromSide = parseSourceHandle(connectFrom.handleId);
        const toSide = fromSide ? (OPPOSITE_SIDE[fromSide] ?? 'left') : 'left';
        this.addEdge(
          connectFrom.nodeId,
          id,
          connectFrom.handleId,
          `target-${toSide}`,
        );
      } else if (connectFrom.handleType === 'target') {
        const toSide = parseTargetHandle(connectFrom.handleId);
        const fromSide = toSide ? (OPPOSITE_SIDE[toSide] ?? 'right') : 'right';
        this.addEdge(
          id,
          connectFrom.nodeId,
          `source-${fromSide}`,
          connectFrom.handleId,
        );
      }
    }

    this.savePropsDelayed();
    return id;
  }

  saveProps() {
    const changer = this.changer;
    if (!changer) return;
    if (!this.resolvedBlock) return;

    const exported = exportGraphBlockData(this.state);
    const changes = diffAssetPropObjects(exported, this.resolvedBlock.computed);

    if (changes && changes.length) {
      this._expectPropsChange = true;
      try {
        this.changer.registerBlockPropsChanges(
          this.resolvedBlock.assetId,
          makeBlockRef(this.resolvedBlock),
          null,
          changes,
        );
      } finally {
        setTimeout(() => {
          this._expectPropsChange = false;
        }, 0);
      }
    }
  }

  override getSelectedContentItemIds(): string[] {
    const selected: string[] = [];
    for (const node of this.state.nodes) {
      if ((node as GraphNode).selected) {
        selected.push(`node-${node.id}`);
      }
    }
    return selected;
  }

  override setSelectedContentItemIds(itemIds: string[]): void {
    const selectedNodeIds = new Set<string>();
    for (const itemId of itemIds) {
      if (itemId.startsWith('node-')) {
        const nodeId = itemId.substring('node-'.length);
        if (nodeId) selectedNodeIds.add(nodeId);
      }
    }
    for (const node of this.state.nodes) {
      (node as GraphNode).selected = selectedNodeIds.has(node.id);
    }
  }

  override getContentItems(): BlockContentItem<GraphBlockContentUserData>[] {
    if (!this.resolvedBlock) return [];

    const root: BlockContentItem<GraphBlockContentUserData> = {
      blockId: this.resolvedBlock.id,
      itemId: 'root',
      title: this.resolvedBlock.title ?? this.appManager.$t('graphBlock.outline.rootTitle'),
      children: [],
    };

    const state = extractGraphBlockData(this.resolvedBlock.computed);
    const sortedNodes = [...state.nodes].sort(
      (a, b) => ((a.data as any)?.index ?? 0) - ((b.data as any)?.index ?? 0),
    );

    for (const node of sortedNodes) {
      const nodeDesc = node.type ? getNodeDescriptorOfType(node.type) : null;
      const nodeData = node.data as { value?: any } | undefined;

      let title = this.appManager.$t('graphBlock.node.title');
      if (nodeData?.value) {
        const text = truncateAssetPropValueText(
          castAssetPropValueToText(nodeData.value),
          50,
        );
        if (text) {
          title =
            castAssetPropValueToString(text.result) +
            (text.truncated ? '...' : '');
        }
      }

      root.children!.push({
        blockId: this.resolvedBlock.id,
        itemId: 'node-' + node.id,
        title,
        anchor: 'node-' + node.id,
        selectable: true,
        icon: nodeDesc ? nodeDesc.icon : undefined,
        userData: { type: 'node', id: node.id },
      });
    }

    return [root];
  }

  override getContentItemsMenu(
    items: BlockContentItem<GraphBlockContentUserData>[],
  ): MenuListItem[] {
    if ((items.length === 1 && !items[0].userData) || !this.assetBlockEditor) {
      return [];
    }
    if (this.assetBlockEditor.getIsReadonly()) {
      return [];
    }

    return [
      {
        title:
          this.appManager.$t('common.dialogs.delete') +
          (items.length > 1 ? ` (${items.length})` : ''),
        danger: true,
        action: async () => {
          for (const item of items) {
            if (item.userData && item.userData.type === 'node') {
              await this.deleteNodeById(item.userData.id);
            }
          }
        },
      },
    ];
  }

  revealBlockContentItem(itemId: string) {
    if (!this.resolvedBlock || !this.assetBlockEditor) return;
    this.assetBlockEditor.revealBlockContentIds(this.resolvedBlock.id, [
      itemId,
    ]);
  }
}
