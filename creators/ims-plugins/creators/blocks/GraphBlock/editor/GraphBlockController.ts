import type {
  Edge,
  GraphEdge,
  GraphNode,
  ViewportTransform,
} from '@vue-flow/core';
import type { GraphBlockState } from './GraphEditor';
import {
  exportGraphBlockData,
  extractGraphBlockData,
  parseSourceHandle,
  parseTargetHandle,
} from './GraphEditor';
import type { AssetChanger } from '~ims-app-base/logic/types/AssetChanger';
import {
  convertTranslatedTitle,
  type ResolvedAssetBlock,
} from '~ims-app-base/logic/utils/assets';
import { debounceForThis } from '~ims-app-base/components/utils/ComponentUtils';
import {
  diffAssetPropObjects,
  makeBlockRef,
  truncateAssetPropValueText,
  castAssetPropValueToString,
  castAssetPropValueToText,
  getAssetPropType,
  AssetPropType,
  type AssetPropValue,
  type AssetPropValueFile,
  type AssetPropValueAsset,
} from '~ims-app-base/logic/types/Props';
import type { IAppManager } from '~ims-app-base/logic/managers/IAppManager';
import { v4 as uuidv4 } from 'uuid';
import { BlockEditorController } from '~ims-app-base/logic/types/BlockEditorController';
import { watch } from 'vue';
import type { BlockContentItem } from '~ims-app-base/logic/types/BlockTypeDefinition';
import type { MenuListItem } from '~ims-app-base/logic/types/MenuList';
import { getNextIndexWithTimestamp } from '~ims-app-base/components/Asset/Editor/blockUtils';
import {
  clipboardCopyPlainText,
  clipboardReadPlainText,
} from '~ims-app-base/logic/utils/clipboard';
import type { GraphLink } from '../logic/nodeStoring';
import { useFilePresenterParams } from '~ims-app-base/components/File/FilePresenter';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import EditorManager from '~ims-app-base/logic/managers/EditorManager';
import DialogManager from '~ims-app-base/logic/managers/DialogManager';
import ProjectManager from '~ims-app-base/logic/managers/ProjectManager';
import { getNodeDescriptorOfType } from '../nodes/getNodeDescriptors';
import isUUID from 'validator/es/lib/isUUID';
import PromptDialog from '~ims-app-base/components/Common/PromptDialog.vue';

export const GRAPH_BLOCK_CLIPBOARD_TYPE = 'graph-block';

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

  get readonly() {
    if (!this.assetBlockEditor) return null;
    return this.assetBlockEditor.getIsReadonly();
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
      (e) =>
        e.source === source &&
        e.target === target &&
        e.sourceHandle === sourceHandle &&
        e.targetHandle === targetHandle,
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
    connectFrom?: {
      nodeId: string;
      handleId: string;
      handleType: string;
    } | null,
    value?: AssetPropValue | null,
  ) {
    const id = uuidv4();
    const maxIndex = this.state.nodes.reduce(
      (acc, n) => Math.max(acc, (n.data as any)?.index ?? 0),
      0,
    );

    const valueType = value ? getAssetPropType(value) : null;
    let isInlineFile = false;
    if (valueType === AssetPropType.FILE) {
      const fileInfo = useFilePresenterParams(value as AssetPropValueFile);
      isInlineFile = !!fileInfo?.inlineType;
    }
    const isAssetType = valueType === AssetPropType.ASSET;

    this.state.nodes.push({
      id,
      type: 'graph-node',
      position,
      data: {
        value: value ?? null,
        width: isInlineFile ? 600 : 200,
        height: isInlineFile ? 400 : isAssetType ? 60 : 80,
        index: getNextIndexWithTimestamp(maxIndex),
        color: undefined,
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

  copyNodesToClipboard(selectedNodeIds: string[], viewport: ViewportTransform) {
    const nodesToCopy: any[] = [];
    for (const nodeId of selectedNodeIds) {
      const node = this.state.nodes.find((n) => n.id === nodeId);
      if (!node) continue;
      const screenX = node.position.x * viewport.zoom + viewport.x;
      const screenY = node.position.y * viewport.zoom + viewport.y;
      const nodeData = node.data as
        | { value?: any; width?: number; height?: number; index?: number }
        | undefined;
      const links: GraphLink[] = [];
      for (const edge of this.state.edges) {
        if (edge.source !== node.id) continue;
        if (!selectedNodeIds.includes(edge.target)) continue;
        const fromSide = edge.sourceHandle
          ? (parseSourceHandle(edge.sourceHandle) ?? undefined)
          : undefined;
        const toSide = edge.targetHandle
          ? (parseTargetHandle(edge.targetHandle) ?? undefined)
          : undefined;
        links.push({
          to: edge.target,
          fromSide: fromSide !== 'right' ? fromSide : undefined,
          toSide: toSide !== 'left' ? toSide : undefined,
        });
      }
      nodesToCopy.push({
        id: node.id,
        value: nodeData?.value ?? null,
        width: nodeData?.width ?? 200,
        height: nodeData?.height ?? 80,
        pos: { x: node.position.x, y: node.position.y },
        index: nodeData?.index ?? 0,
        links,
        color: nodeData?.color ?? undefined,
        _screenX: screenX,
        _screenY: screenY,
      });
    }
    clipboardCopyPlainText(
      JSON.stringify({
        type: GRAPH_BLOCK_CLIPBOARD_TYPE,
        nodes: nodesToCopy,
        viewport,
      }),
    );
  }

  async pasteNodesFromClipboard(
    viewport: ViewportTransform,
    targetFlowPos?: { x: number; y: number },
  ) {
    const changer = this.changer;
    if (!changer) return;
    if (!this.resolvedBlock) return;

    const pastedData = await clipboardReadPlainText();
    try {
      let parsed: any;
      try {
        parsed = JSON.parse(pastedData);
      } catch {
        throw new Error(
          this.appManager.$t('graphBlock.editor.noGraphInClipboard'),
        );
      }
      if (parsed.type !== GRAPH_BLOCK_CLIPBOARD_TYPE) {
        throw new Error(
          this.appManager.$t('graphBlock.editor.noGraphInClipboard'),
        );
      }
      const nodes = parsed.nodes;
      if (!Array.isArray(nodes) || !nodes.length) return;

      const isValidNode = (n: any) =>
        n &&
        typeof n === 'object' &&
        typeof n.id === 'string' &&
        n.pos &&
        typeof n.pos === 'object' &&
        typeof n.pos.x === 'number' &&
        typeof n.pos.y === 'number';

      if (!nodes.every(isValidNode)) return;

      const idMap = new Map<string, string>();
      nodes.forEach((n: any) => idMap.set(n.id, uuidv4()));

      // Calculate center of copied nodes for offset-based positioning
      let centerX = 0;
      let centerY = 0;
      for (const node of nodes) {
        centerX += node.pos.x;
        centerY += node.pos.y;
      }
      centerX /= nodes.length;
      centerY /= nodes.length;

      for (const node of nodes) {
        const newId = idMap.get(node.id);
        const maxIndex = this.state.nodes.reduce(
          (acc, n) => Math.max(acc, (n.data as any)?.index ?? 0),
          0,
        );

        let newX: number;
        let newY: number;
        if (targetFlowPos) {
          newX = targetFlowPos.x + (node.pos.x - centerX);
          newY = targetFlowPos.y + (node.pos.y - centerY);
        } else if (node._screenX !== undefined && node._screenY !== undefined) {
          newX = (node._screenX - viewport.x) / viewport.zoom;
          newY = (node._screenY - viewport.y) / viewport.zoom;
          newX += 50;
          newY += 50;
        } else {
          newX = node.pos.x + 50;
          newY = node.pos.y + 50;
        }

        const remappedLinks: {
          to: string;
          fromSide?: string;
          toSide?: string;
        }[] = (node.links || []).map((link: any) => ({
          ...link,
          to: idMap.get(link.to) ?? link.to,
        }));

        this.state.nodes.push({
          id: newId,
          type: 'graph-node',
          position: { x: newX, y: newY },
          data: {
            value: node.value ?? null,
            width: node.width ?? 200,
            height: node.height ?? 80,
            index: getNextIndexWithTimestamp(maxIndex),
            color: node.color ?? undefined,
          },
        });

        for (const link of remappedLinks) {
          const sourceHandle = `source-${link.fromSide ?? 'right'}`;
          const targetHandle = `target-${link.toSide ?? 'left'}`;
          this.state.edges.push({
            id: `${newId}|${sourceHandle}|${targetHandle}|${link.to}`,
            source: newId,
            target: link.to,
            sourceHandle,
            targetHandle,
            type: 'graph-edge',
          });
        }
      }

      this.savePropsDelayed();
    } catch (err: any) {
      this.appManager.get(UiManager).showError(err.message);
    }
  }

  cutNodes(selectedNodeIds: string[], viewport: ViewportTransform) {
    this.copyNodesToClipboard(selectedNodeIds, viewport);
    for (const nodeId of selectedNodeIds) {
      this.deleteNodeById(nodeId);
    }
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
      title:
        this.resolvedBlock.title ??
        this.appManager.$t('graphBlock.outline.rootTitle'),
      children: [],
    };

    const state = extractGraphBlockData(this.resolvedBlock.computed);
    const sortedNodes = [...state.nodes].sort(
      (a, b) => ((a.data as any)?.index ?? 0) - ((b.data as any)?.index ?? 0),
    );

    for (const node of sortedNodes) {
      const nodeData = node.data as { value?: any } | undefined;

      let icon: string | undefined;
      let title = this.appManager.$t('graphBlock.node.title');
      if (nodeData?.value) {
        const valueType = getAssetPropType(nodeData.value);
        if (valueType === AssetPropType.FILE) {
          icon = 'ri-attachment-2';
          title = (nodeData.value as AssetPropValueFile).Title;
        } else if (valueType === AssetPropType.ASSET) {
          icon = 'ri-link-m';
          title = (nodeData.value as AssetPropValueAsset).Title
            ? convertTranslatedTitle(
                (nodeData.value as AssetPropValueAsset).Title,
                (key: any) => this.appManager.$t(key),
              )
            : ((nodeData.value as AssetPropValueAsset).Name ??
              castAssetPropValueToString(nodeData.value));
        } else {
          icon = 'ri-info-card-line';
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
      }

      root.children!.push({
        blockId: this.resolvedBlock.id,
        itemId: 'node-' + node.id,
        title,
        anchor: 'node-' + node.id,
        selectable: true,
        icon,
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
    if (this.readonly) {
      return [];
    }

    return [
      {
        title:
          this.appManager.$t('common.dialogs.delete') +
          (items.length > 1 ? ` (${items.length})` : ''),
        danger: true,
        icon: 'ri-delete-bin-line',
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

  async pickAndAttachFile(): Promise<AssetPropValue | null> {
    const editorManager = this.appManager.get(EditorManager);
    const files = await editorManager.pickFiles();
    if (!files || files.length === 0) return null;
    const file = files[0];
    const uploadingJob = editorManager.attachFile(file.blob, file.name);
    return await uploadingJob.awaitResult();
  }

  async pickAsset(): Promise<AssetPropValueAsset | null> {
    const dialogManager = this.appManager.get(DialogManager);
    const gdd_workspace = this.appManager
      .get(ProjectManager)
      .getWorkspaceByName('gdd');
    if (!gdd_workspace) return null;
    const SelectAssetDialog = (
      await import('~ims-app-base/components/Asset/SelectAssetDialog.vue')
    ).default;
    const assetResult = await dialogManager.show(SelectAssetDialog, {
      dialogHeader: this.appManager.$t('graphBlock.editor.selectAsset'),
      where: { workspaceids: gdd_workspace.id },
    });
    if (!assetResult) return null;
    return {
      AssetId: assetResult.id,
      Title: assetResult.title ?? '',
      Name: assetResult.name,
    };
  }

  async setNodeServiceName(nodeId: string): Promise<void> {
    const node = this.state.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const existingIds = new Set(this.state.nodes.map((n) => n.id));
    const result = await this.appManager.get(DialogManager).show(PromptDialog, {
      header: this.appManager.$t('graphBlock.editor.setServiceName'),
      value: nodeId,
      validate: (val: string) => {
        if (!val || val === nodeId) return val;
        if (existingIds.has(val)) {
          throw this.appManager.$t(
            'graphBlock.editor.serviceNameAlreadyExists',
          );
        }
        return val;
      },
    });

    if (!result) {
      if (result !== '') return; // cancelled
      if (isUUID(nodeId)) return; // no service name to reset, nothing to do
    } else if (result === nodeId) {
      return;
    }

    const newId = result || uuidv4();
    const nodeIndex = this.state.nodes.findIndex((n) => n.id === nodeId);
    if (nodeIndex === -1) return;
    const newState = {
      nodes: [...this.state.nodes],
      edges: [...this.state.edges],
    };
    newState.nodes[nodeIndex] = {
      ...this.state.nodes[nodeIndex],
      id: newId,
    };

    for (let index = 0; index < this.state.edges.length; index++) {
      let newEdge: Edge | undefined;
      const edge = this.state.edges[index];
      const parts = edge.id.split('|');
      if (parts.length >= 4) {
        let changed = false;
        if (edge.source === nodeId && parts[0] === nodeId) {
          parts[0] = newId;
          changed = true;
        }
        if (edge.target === nodeId && parts[parts.length - 1] === nodeId) {
          parts[parts.length - 1] = newId;
          changed = true;
        }
        if (changed) {
          newEdge = { ...edge, id: parts.join('|') };
        }
      }
      if (edge.source === nodeId) {
        if (!newEdge) newEdge = { ...edge };
        newEdge.source = newId;
      }
      if (edge.target === nodeId) {
        if (!newEdge) newEdge = { ...edge };
        newEdge.target = newId;
      }
      if (newEdge) {
        newState.edges[index] = newEdge;
      }
    }

    this.state = newState; // Change nodes and edges simultaneously to make VueFlow work corretly
    this.savePropsDelayed();
  }

  getNodeContextMenu(
    nodeIds: string[],
    viewport: ViewportTransform,
  ): MenuListItem[] {
    if (!nodeIds.length) return [];
    const count = nodeIds.length;
    const suffix = count > 1 ? ` (${count})` : '';
    const items: MenuListItem[] = [];

    if (count === 1) {
      const node = this.state.nodes.find((n) => n.id === nodeIds[0]);
      if (node) {
        const descriptor = getNodeDescriptorOfType(node.type ?? '');
        if (descriptor?.getContextMenuItems) {
          const nodeItems = descriptor.getContextMenuItems(
            this,
            nodeIds[0],
            (key: string) => this.appManager.$t(key),
          );
          if (nodeItems.length > 0) {
            items.push({ type: 'separator', name: 'sep-value' });
            items.push(...nodeItems);
          }
        }
      }
    }

    if (count === 1) {
      items.push(
        {
          name: 'set-service-name',
          title: this.appManager.$t('graphBlock.editor.setServiceName'),
          icon: 'ri-price-tag-3-fill',
          action: () => this.setNodeServiceName(nodeIds[0]),
        },
        { type: 'separator', name: 'sep-service-name' },
      );
    }

    items.push(
      {
        name: 'copy',
        title: this.appManager.$t('common.dialogs.copy') + suffix,
        icon: 'ri-file-copy-line',
        action: () => this.copyNodesToClipboard(nodeIds, viewport),
      },
      {
        name: 'cut',
        title: this.appManager.$t('graphBlock.editor.cutNode') + suffix,
        icon: 'ri-scissors-cut-line',
        action: () => this.cutNodes(nodeIds, viewport),
      },
      {
        name: 'delete',
        title: this.appManager.$t('common.dialogs.delete') + suffix,
        icon: 'ri-delete-bin-line',
        danger: true,
        action: async () => {
          for (const id of nodeIds) {
            await this.deleteNodeById(id);
          }
        },
      },
    );
    return items;
  }

  revealBlockContentItem(itemId: string) {
    if (!this.resolvedBlock || !this.assetBlockEditor) return;
    this.assetBlockEditor.revealBlockContentIds(this.resolvedBlock.id, [
      itemId,
    ]);
  }
}
