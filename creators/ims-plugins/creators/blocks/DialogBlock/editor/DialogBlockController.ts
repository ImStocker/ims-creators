import type {
  Edge,
  GraphEdge,
  GraphNode,
  ViewportTransform,
} from '@vue-flow/core';
import type { DialogBlockState } from './DialogEditor';
import {
  convertNodeToPlainNode,
  exportDialogBlockData,
  extractDialogBlockData,
  generateDataPinId,
  isEdgeBelongToNode,
  parseDataPinId,
} from './DialogEditor';
import type { AssetChanger } from '~ims-app-base/logic/types/AssetChanger';
import type { ResolvedAssetBlock } from '~ims-app-base/logic/utils/assets';
import { debounceForThis } from '~ims-app-base/components/utils/ComponentUtils';
import {
  assignPlainValueToAssetProps,
  castAssetPropValueToString,
  castAssetPropValueToText,
  diffAssetPropObjects,
  makeBlockRef,
  sameAssetPropValues,
  truncateAssetPropValueText,
  type AssetProps,
  type AssetPropValue,
  type AssetPropValueType,
} from '~ims-app-base/logic/types/Props';
import type { NodeData, NodeDataController } from './NodeDataController';
import type { IAppManager } from '~ims-app-base/logic/managers/IAppManager';
import DialogManager from '~ims-app-base/logic/managers/DialogManager';
import {
  ScriptBlockPlainVariableKinds,
  type ScriptBlockPlainAction,
  type ScriptBlockPlainActionTypes,
  type ScriptBlockPlainNode,
  type ScriptBlockPlainVariable,
} from '../logic/nodeStoring';
import { assert } from '~ims-app-base/logic/utils/typeUtils';
import {
  clipboardCopyPlainText,
  clipboardReadPlainText,
} from '~ims-app-base/logic/utils/clipboard';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import { v4 as uuidv4 } from 'uuid';
import { BlockEditorController } from '~ims-app-base/logic/types/BlockEditorController';
import { defineAsyncComponent, watch, markRaw } from 'vue';
import type { BlockContentItem } from '~ims-app-base/logic/types/BlockTypeDefinition';
import { getNodeDescriptorOfType } from '../nodes/getNodeDescriptiors';
import type { MenuListItem } from '~ims-app-base/logic/types/MenuList';
import type { IProjectContext } from '~ims-app-base/logic/types/IProjectContext';
import type { DialogPlayer } from '../play/DialogPlayer';
import ManageCollectionDialog from '../dialogs/ManageCollectionDialog.vue';
import type { IDialogCollectionController } from './DialogVariableController';
import EnterActionDialog from '../dialogs/EnterActionDialog.vue';
import { nodeVariableAdd } from '../logic/nodeVariables';
import isUUID from 'validator/es/lib/isUUID';
import PromptDialog from '~ims-app-base/components/Common/PromptDialog.vue';

export const SCRIPT_BLOCK_CLIPBOARD_TYPE = 'script-block';

export type DialogVariable = ScriptBlockPlainVariable;
export type DialogAction = ScriptBlockPlainAction;

export type DialogBlockContentUserData = {
  type: 'node';
  id: string;
};

export type DialogBlockCollectionItem = {
  index?: number;
  name: string;
  [key: string]: any;
};

export function sortCollectionItems<T extends DialogBlockCollectionItem>(
  items: T[],
) {
  return items
    .sort((a, b) => a.name?.localeCompare(b.name))
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

export function pickMoreSpecificType(
  a: AssetPropValueType,
  b: AssetPropValueType,
) {
  if (a.Type !== b.Type) return a;
  if (a.Kind && !b.Kind) return a;
  if (b.Kind && !a.Kind) return b;
  if (a.Of && !b.Of) return a;
  if (b.Of && !a.Of) return b;
  if (a.Of && b.Of) return pickMoreSpecificType(a.Of, b.Of);
  return a;
}

export class DialogBlockController extends BlockEditorController {
  state!: DialogBlockState;
  private _expectPropsChange = false;
  readonly savePropsDelayed: () => void;
  private _assignedDataTypePins = new Map<string, AssetPropValueType[]>();
  private _newNodeToSelectIds = new Set<string>();

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
      {
        immediate: true,
      },
    );
  }

  get changer(): AssetChanger | null {
    return this.assetBlockEditor ? this.assetBlockEditor.assetChanger : null;
  }

  get hasStart() {
    return this.state.nodes.some((n) => n.type === 'start');
  }

  cutNodes(selected_node_ids: string[], viewport: ViewportTransform) {
    this.copyNodesToClipboard(selected_node_ids, viewport);
    for (const node_id of selected_node_ids) {
      this.deleteNodeById(node_id);
    }
  }

  copyNodesToClipboard(
    selected_node_ids: string[],
    viewport: ViewportTransform,
  ) {
    const nodes_to_copy: { id: string } & ScriptBlockPlainNode = {} as {
      id: string;
    } & ScriptBlockPlainNode;

    for (const selected_id of selected_node_ids) {
      const selected_node = this.state.nodes.find((n) => n.id === selected_id);

      if (!selected_node) return;

      const screenX = selected_node.position.x * viewport.zoom + viewport.x;
      const screenY = selected_node.position.y * viewport.zoom + viewport.y;

      nodes_to_copy[selected_id] = {
        id: selected_id,
        ...convertNodeToPlainNode(selected_node),
        _screenX: screenX,
        _screenY: screenY,
      };
    }
    for (const edge of this.state.edges) {
      if (!nodes_to_copy[edge.source]) {
        continue;
      }
      if (!edge.sourceHandle) {
        continue;
      }
      if (edge.sourceHandle === 'out') {
        nodes_to_copy[edge.source].next = edge.target;
      } else {
        const out_m = edge.sourceHandle.match(/^out-(\d+)$/);
        if (out_m) {
          const options_ind = parseInt(out_m[1]) - 1;
          const source_node = nodes_to_copy[edge.source];
          if (
            edge.source &&
            source_node.options &&
            options_ind < source_node.options.length
          ) {
            source_node.options[options_ind].next = edge.target;
          }
        }
      }
    }
    clipboardCopyPlainText(
      JSON.stringify({
        type: SCRIPT_BLOCK_CLIPBOARD_TYPE,
        nodes: Object.values(nodes_to_copy),
        viewport,
      }),
    );
  }

  async pasteNodesFromClipboard(viewport: ViewportTransform) {
    const changer = this.changer;
    if (!changer) return;

    if (!this.resolvedBlock) {
      return;
    }

    const pasted_data = await clipboardReadPlainText();

    try {
      let parsed: any;
      try {
        parsed = JSON.parse(pasted_data);
      } catch {
        throw new Error(
          this.appManager.$t('imsDialogEditor.noScriptInClipboard'),
        );
      }
      if (parsed.type !== SCRIPT_BLOCK_CLIPBOARD_TYPE) {
        throw new Error(
          this.appManager.$t('imsDialogEditor.noScriptInClipboard'),
        );
      }
      const nodes = parsed.nodes;

      if (!Array.isArray(nodes)) return;

      if (!nodes.length) return;

      const isValidNode = (
        node: any,
      ): node is {
        id: string;
        _screenX?: number;
        _screenY?: number;
      } & ScriptBlockPlainNode =>
        node &&
        typeof node === 'object' &&
        typeof node.id === 'string' &&
        typeof node.type === 'string' &&
        node.pos &&
        typeof node.pos === 'object' &&
        typeof node.pos.x === 'number' &&
        typeof node.pos.y === 'number';

      if (nodes.every(isValidNode)) {
        try {
          const id_map = new Map();
          nodes.forEach((node) => {
            id_map.set(node.id, uuidv4());
          });

          const new_nodes = nodes.map((node) => {
            const new_node = structuredClone(node);
            new_node.id = id_map.get(node.id);

            function remap(obj) {
              if (!obj || typeof obj !== 'object') return;
              for (const key of Object.keys(obj)) {
                const val = obj[key];

                if (key === 'get' && typeof val === 'string') {
                  obj[key] = id_map.get(val) ?? null;
                } else if (key === 'next' && typeof val === 'string') {
                  obj[key] = id_map.get(val) ?? null;
                } else if (typeof val === 'object') {
                  remap(val);
                }
              }
            }
            remap(new_node);
            this._newNodeToSelectIds.add(new_node.id);
            let new_x = new_node.pos.x;
            let new_y = new_node.pos.y;
            if (
              new_node._screenX !== undefined &&
              new_node._screenY !== undefined
            ) {
              new_x = (new_node._screenX - viewport.x) / viewport.zoom;
              new_y = (new_node._screenY - viewport.y) / viewport.zoom;
            }
            new_node.pos.x = new_x + 50;
            new_node.pos.y = new_y + 50;
            return new_node;
          });

          const changed_keys: AssetProps = {};
          for (let i = 0; i < new_nodes.length; i++) {
            delete new_nodes[i]._screenX;
            delete new_nodes[i]._screenY;
            const { id, ...node_data } = new_nodes[i];

            assignPlainValueToAssetProps(
              changed_keys,
              node_data,
              `nodes\\${id}`,
            );
          }
          changer.setBlockPropKeys(
            this.resolvedBlock.assetId,
            makeBlockRef(this.resolvedBlock),
            null,
            changed_keys,
          );
        } catch (err: any) {
          this.appManager.get(UiManager).showError(err);
        }
      }
    } catch (err: any) {
      this.appManager.get(UiManager).showError(err.message);
    }
  }

  private _onBlockUpdated() {
    if (this._expectPropsChange) return;
    if (!this.resolvedBlock) return;

    this.state = extractDialogBlockData(this.resolvedBlock.computed);

    if (this._newNodeToSelectIds.size !== 0) {
      const edge_to_select = new Set<string>();
      for (const node_id of this._newNodeToSelectIds) {
        for (const edge of this.state.edges) {
          if (isEdgeBelongToNode(edge.id, node_id)) {
            edge_to_select.add(edge.id);
          }
        }
      }
      this.setSelectedNodeIds(this._newNodeToSelectIds);
      this.setSelectedEdgeIds(edge_to_select);
      this.setSelection(this._newNodeToSelectIds, edge_to_select);
      this._newNodeToSelectIds = new Set();
    }
  }

  setSelection(node_ids: Set<string>, edge_ids: Set<string>) {
    this.setSelectedNodeIds(node_ids);
    this.setSelectedEdgeIds(edge_ids);
  }

  getNodePinDataType(
    node_id: string,
    pin_id: string,
  ): AssetPropValueType[] | null {
    const own = this._assignedDataTypePins.get(node_id + '|' + pin_id);
    const own_valid = own?.length ? own : null;

    const connected: AssetPropValueType[] = [];
    for (const e of this.state.edges) {
      if (e.target === node_id && e.targetHandle === pin_id) {
        const type = this._assignedDataTypePins.get(
          e.source + '|' + e.sourceHandle,
        );
        if (type?.length) connected.push(...type);
      }
      if (e.source === node_id && e.sourceHandle === pin_id) {
        const type = this._assignedDataTypePins.get(
          e.target + '|' + e.targetHandle,
        );
        if (type?.length) connected.push(...type);
      }
    }
    const connected_valid = connected.length ? connected : null;

    if (!own_valid && !connected_valid) return null;
    if (!own_valid) return connected_valid;
    if (!connected_valid) return own_valid;

    const merged: AssetPropValueType[] = [];
    for (const o_type of own_valid) {
      const c_type = connected_valid.find((t) => t.Type === o_type.Type);
      if (!c_type) continue;
      const existing = merged.find((t) => t.Type === o_type.Type);
      if (existing) {
        merged[merged.indexOf(existing)] = pickMoreSpecificType(
          o_type,
          existing,
        );
      } else {
        merged.push(pickMoreSpecificType(c_type, o_type));
      }
    }
    return merged.length ? merged : null;
  }

  getNodeDataController(node_id: string): NodeDataController {
    const node = this.state.nodes.find((node) => node.id === node_id);
    let node_data = node?.data as NodeData | undefined;

    const ensure_node_data = (): NodeData => {
      assert(node);
      if (!node_data) {
        node_data = {
          options: [],
          params: {
            in: [],
            out: [],
          },
          subject: '',
          values: {},
          index: 0,
        };
        node.data = node_data;
      }
      return node_data;
    };

    const controller: NodeDataController = {
      get values() {
        return node_data?.values ?? {};
      },
      get options() {
        return node_data?.options ?? [];
      },
      get params() {
        return node_data?.params ?? { in: [], out: [] };
      },
      get subject() {
        return node_data?.subject ?? '';
      },
      setSubject: (val: string) => {
        if (!node) return;
        const node_data = ensure_node_data();
        node_data.subject = val;
        this.savePropsDelayed();
      },
      setValues: (vals) => {
        if (!node) return;
        const node_data = ensure_node_data();
        node_data.values = vals;
        this.savePropsDelayed();
      },
      setValue: (prop, val) => {
        if (!node) return;
        const node_data = ensure_node_data();
        node.data = {
          ...node_data,
          values: {
            ...(node_data.values ? node_data.values : {}),
            [prop]: val,
          },
        };
        this.savePropsDelayed();
      },
      deleteValue: (prop) => {
        if (!node) return;
        if (!node_data) return;
        if (!node_data.values) return;
        delete node_data.values[prop];

        // Удалить связи данных
        const data_edge_ind = this.state.edges.findIndex((e) => {
          return (
            e.target === node.id &&
            e.targetHandle === generateDataPinId(false, prop)
          );
        });
        if (data_edge_ind >= 0) {
          const new_edges = [...this.state.edges];
          new_edges.splice(data_edge_ind, 1);
          this.state.edges = new_edges;
        }

        this.savePropsDelayed();
      },
      addOption: () => {
        if (!node) return -1;
        const node_data = ensure_node_data();
        if (!node_data.options) node_data.options = [];
        node_data.options.push({
          values: {},
          next: null,
        });
        if (node_data.options.length === 1) {
          const out_edge_ind = this.state.edges.findIndex((e) => {
            return e.source === node.id && e.sourceHandle === 'out';
          });
          if (out_edge_ind >= 0) {
            const new_edges = [...this.state.edges];
            new_edges.splice(out_edge_ind, 1, {
              id: `${node.id}|out-1|${this.state.edges[out_edge_ind].target}`,
              sourceHandle: 'out-1',
              source: node.id,
              target: this.state.edges[out_edge_ind].target,
            });
            this.state.edges = new_edges;
          }
        }

        this.savePropsDelayed();
        return node_data.options.length - 1;
      },
      deleteOption: (ind) => {
        if (!node) return;
        if (!node_data) return;
        if (!node_data.options) return;
        if (ind >= node_data.options.length) return;

        // Удалить все данные (через метод, чтобы удалить и связи)
        for (const key of Object.keys(node_data.options[ind].values)) {
          controller.deleteOptionValue(ind, key);
        }

        node_data.options.splice(ind, 1);

        const new_edges = [...this.state.edges];

        // Удалить или перецепить наверх ветвь от удаленной опции
        {
          const out_edge_ind = new_edges.findIndex((e) => {
            return (
              e.source === node.id && e.sourceHandle === 'out-' + (ind + 1)
            );
          });
          if (out_edge_ind >= 0) {
            if (node_data.options.length === 0) {
              new_edges.splice(out_edge_ind, 1, {
                id: `${node.id}|out|${new_edges[out_edge_ind].target}`,
                sourceHandle: 'out',
                source: node.id,
                target: new_edges[out_edge_ind].target,
              });
            } else {
              new_edges.splice(out_edge_ind, 1);
            }
          }
        }

        // Сдвинуть опции
        for (let i = ind; i < node_data.options.length; i++) {
          const out_ind = i + 1;
          const out_edge_ind = new_edges.findIndex((e) => {
            return (
              e.source === node.id && e.sourceHandle === 'out-' + (out_ind + 1)
            );
          });
          if (out_edge_ind >= 0) {
            new_edges.splice(out_edge_ind, 1, {
              id: `${node.id}|out-${out_ind}|${new_edges[out_edge_ind].target}`,
              sourceHandle: 'out-' + out_ind,
              source: node.id,
              target: new_edges[out_edge_ind].target,
            });
          }
        }

        this.state.edges = new_edges;

        this.savePropsDelayed();
      },
      getOptionValue: (ind, prop) => {
        if (!node) return null;
        const node_data = ensure_node_data();
        if (!node_data.options) return null;
        if (ind >= node_data.options.length) return null;
        return node_data.options[ind].values[prop];
      },
      setOptionValue: (ind, prop, val) => {
        if (!node) return;
        const node_data = ensure_node_data();
        if (!node_data.options) return;
        if (ind >= node_data.options.length) return;
        node_data.options[ind].values[prop] = val ?? null;
        this.savePropsDelayed();
      },
      deleteOptionValue: (ind, prop) => {
        if (!node) return;
        if (!node_data) return;
        if (!node_data.options) return;
        if (ind >= node_data.options.length) return;
        delete node_data.options[ind].values[prop];

        // Удалить связи данных
        const data_edge_ind = this.state.edges.findIndex((e) => {
          return (
            e.target === node.id &&
            e.targetHandle === generateDataPinId(false, prop, ind)
          );
        });
        if (data_edge_ind >= 0) {
          const new_edges = [...this.state.edges];
          new_edges.splice(data_edge_ind, 1);
          this.state.edges = new_edges;
        }

        this.savePropsDelayed();
      },
      setOptionValues: (ind, props) => {
        if (!node) return;
        const node_data = ensure_node_data();
        if (!node_data.options) return;
        if (ind >= node_data.options.length) return;
        node_data.options[ind].values = props;
        this.savePropsDelayed();
      },
      moveOption: (ind, dir) => {
        if (ind <= 0 && dir < 0) {
          return;
        }
        if (ind >= controller.options.length - 1) {
          return;
        }
        // TODO
      },
      isPinConnected: (pin_id) => {
        return this.state.edges.some((e) => {
          return (
            (e.target === node_id && e.targetHandle === pin_id) ||
            (e.source === node_id && e.sourceHandle === pin_id)
          );
        });
      },
      getPinBind: (pin_id) => {
        for (const e of this.state.edges) {
          if (e.target === node_id && e.targetHandle === pin_id) {
            const parsed = parseDataPinId(e.sourceHandle ?? '');
            if (!parsed) return null;
            return {
              get: e.source,
              param: parsed.param,
            };
          }
          if (e.source === node_id && e.sourceHandle === pin_id) {
            const parsed = parseDataPinId(e.targetHandle ?? '');
            if (!parsed) return null;
            return {
              get: e.target,
              param: parsed.param,
            };
          }
        }
        return null;
      },
      getPinDataType: (pin_id) => this.getNodePinDataType(node_id, pin_id),
      setPinDataType: (pin_id, type) => {
        let current = this._assignedDataTypePins.get(node_id + '|' + pin_id);
        if (type) {
          if (!Array.isArray(type)) type = [type];
          if (!current) current = [];
          let same = current.length === type.length;
          for (let i = 0; same && i < type.length; i++) {
            same = sameAssetPropValues(current[i], type[i], true);
          }
          if (!same) {
            this._assignedDataTypePins.set(node_id + '|' + pin_id, type);
          }
        } else {
          if (current) {
            this._assignedDataTypePins.delete(node_id + '|' + pin_id);
          }
        }
      },
      addParam: (scope: 'in' | 'out', variable: DialogVariable) => {
        if (!node) return;
        const node_data = ensure_node_data();
        if (!node_data.params) node_data.params = { in: [], out: [] };
        if (!node_data.params[scope]) node_data.params[scope] = [];
        if (node_data.params[scope].some((p) => p.name === variable.name)) {
          throw new Error('Parameter already exists');
        }
        node_data.params[scope].push(variable);
        this.savePropsDelayed();
      },
      changeParam: (
        scope: 'in' | 'out',
        variable_name: string,
        variable: DialogVariable,
      ) => {
        if (!node) return;
        if (!node_data) return;
        if (!node_data.params) return;
        if (!node_data.params[scope]) return;

        const ind = node_data.params[scope].findIndex(
          (p) => p.name === variable_name,
        );
        if (ind >= 0) {
          node_data.params[scope][ind] = variable;
          this.savePropsDelayed();
        }
      },
      deleteParam: (scope: 'in' | 'out', variable_name: string) => {
        if (!node) return;
        if (!node_data) return;
        if (!node_data.params) return;
        if (!node_data.params[scope]) return;

        const ind = node_data.params[scope].findIndex(
          (p) => p.name === variable_name,
        );
        if (ind >= 0) {
          node_data.params[scope].splice(ind, 1);

          // Удалить связи с
          if (scope === 'in') {
            controller.deleteValue(variable_name);
          }

          this.savePropsDelayed();
        }
      },
    };

    return controller;
  }

  onEdgeDeleted(edge_id: string) {
    const edge = this.state.edges.find((e) => e.id === edge_id);
    if (!edge) return;

    const fromHandleDataParsed = parseDataPinId(edge.sourceHandle ?? '');
    const toHandleDataMatch = parseDataPinId(edge.targetHandle ?? '');

    if (fromHandleDataParsed && toHandleDataMatch) {
      const to = this.state.nodes.find((n) => n.id === edge.target);
      if (to) {
        const to_node_data = to.data as NodeData | undefined;
        if (to_node_data) {
          if (toHandleDataMatch.optionIndex !== undefined) {
            const opt = to_node_data.options[toHandleDataMatch.optionIndex];
            if (opt) {
              opt.values[toHandleDataMatch.param] = null;
            }
          } else {
            to_node_data.values[toHandleDataMatch.param] = null;
          }
        }
      }
    }

    this.savePropsDelayed();
  }

  addEdge(
    fromNodeId: string,
    toNodeId: string,
    fromHandle?: string,
    toHandle?: string,
  ): { added: Edge | null; removed: Edge[] } {
    const from = this.state.nodes.find((n) => n.id === fromNodeId) as
      | GraphNode
      | undefined;
    const to = this.state.nodes.find((n) => n.id === toNodeId) as
      | GraphNode
      | undefined;
    if (!from || !to) {
      return {
        added: null,
        removed: [],
      };
    }

    const edges = [...this.state.edges];
    if (!fromHandle) {
      fromHandle =
        (from?.handleBounds?.source && from?.handleBounds?.source[0]
          ? from.handleBounds.source[0].id
          : null) ?? 'out';
    }
    if (!toHandle) {
      if (fromHandle.startsWith('data-out-')) {
        toHandle =
          to?.handleBounds?.target?.find((t) => t?.id?.startsWith('data-in'))
            ?.id ?? 'in';
      } else {
        toHandle =
          (to?.handleBounds?.target && to?.handleBounds?.target[0]
            ? to.handleBounds.target[0].id
            : null) ?? 'in';
      }
    }

    let is_data_match = false;
    const fromHandleDataParsed = parseDataPinId(fromHandle);
    const toHandleDataMatch = parseDataPinId(toHandle);
    if (
      (fromHandleDataParsed && !toHandleDataMatch) ||
      (!fromHandleDataParsed && toHandleDataMatch)
    ) {
      // Attach data pin to non data pin
      return {
        added: null,
        removed: [],
      };
    } else is_data_match = !!(fromHandleDataParsed && toHandleDataMatch);

    if (is_data_match) {
      // Check data types
      const from_data_type = this.getNodePinDataType(from.id, fromHandle);
      const to_data_type = this.getNodePinDataType(to.id, toHandle);
      if (from_data_type && to_data_type) {
        const any_match = from_data_type.some((fdt) => {
          return to_data_type.some((tdt) => tdt.Type === fdt.Type);
        });
        if (!any_match) {
          return {
            added: null,
            removed: [],
          };
        }
      }
    }

    const removed: Edge[] = [];
    // Find all edges with same out
    while (true) {
      const index = edges.findIndex((e) => {
        if (is_data_match) {
          return e.target === to.id && e.targetHandle === toHandle;
        } else {
          return e.source === from.id && e.sourceHandle === fromHandle;
        }
      });
      if (index >= 0) {
        removed.push(edges[index]);
        edges.splice(index, 1);
      } else break;
    }

    if (is_data_match) {
      assert(toHandleDataMatch && fromHandleDataParsed);
      const to_node_data = to.data as NodeData | undefined;
      if (to_node_data) {
        if (toHandleDataMatch.optionIndex !== undefined) {
          const opt = to_node_data.options[toHandleDataMatch.optionIndex];
          if (opt) {
            opt.values[toHandleDataMatch.param] = {
              get: from.id,
              param: fromHandleDataParsed.param,
            };
          }
        } else {
          to_node_data.values[toHandleDataMatch.param] = {
            get: from.id,
            param: fromHandleDataParsed.param,
          };
        }
      }
    }

    const edge_id = `${from.id}|${fromHandle}|${toHandle}|${to.id}`;
    const edge: Edge = {
      id: edge_id,
      source: from.id,
      target: to.id,
      sourceHandle: fromHandle,
      targetHandle: toHandle,
    };
    edges.push(edge);
    this.state.edges = edges;
    this.savePropsDelayed();
    return {
      added: edge,
      removed,
    };
  }

  deleteEdgeById(edgeId: string) {
    const edge_index = this.state.edges.findIndex((edge) => edge.id === edgeId);
    if (edge_index >= 0) {
      this.state.edges.splice(edge_index, 1);
      this.onEdgeDeleted(edgeId);
    }
  }

  async deleteNodeById(nodeId: string) {
    const node_index = this.state.nodes.findIndex((node) => node.id === nodeId);
    if (node_index >= 0) {
      this.state.nodes.splice(node_index, 1);
      await this.onNodeDeleted(nodeId);
    }
  }

  async onNodeDeleted(nodeId: string) {
    const leftEdgeIndex = this.state.edges.findIndex(
      (e) => e.target === nodeId && e.targetHandle === 'in',
    );
    let leftEdge: Edge | undefined;
    if (leftEdgeIndex >= 0) {
      leftEdge = this.state.edges[leftEdgeIndex];
      this.state.edges.splice(leftEdgeIndex, 1);
    }

    const rightEdgeIndex = this.state.edges.findIndex(
      (e) =>
        e.source === nodeId &&
        (e.sourceHandle === 'out' || /^out-\d+$/.test(e.sourceHandle ?? '')),
    );
    let rightEdge: Edge | undefined;
    if (rightEdgeIndex >= 0) {
      rightEdge = this.state.edges[rightEdgeIndex];
      this.state.edges.splice(rightEdgeIndex, 1);
    }

    for (let i = this.state.edges.length - 1; i >= 0; i--) {
      const edge = this.state.edges[i];
      if (edge.source === nodeId || edge.target === nodeId) {
        this.state.edges.splice(i, 1);
      }
    }

    if (leftEdge && rightEdge) {
      await new Promise((res) => setTimeout(res, 1));
      this.addEdge(
        leftEdge.source,
        rightEdge.target,
        leftEdge.sourceHandle ?? undefined,
        rightEdge.targetHandle ?? undefined,
      );
    }
    this.savePropsDelayed();
  }

  changeNodeType(nodeId: string, new_type: string) {
    const node = this.state.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    node.type = new_type;
    this.savePropsDelayed();
  }

  saveProps() {
    const changer = this.changer;
    if (!changer) {
      return;
    }
    if (!this.resolvedBlock) {
      return;
    }
    const exported = exportDialogBlockData(this.state);

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

  getOwnVariables() {
    if (!this.resolvedBlock) {
      return [];
    }
    const props_state = extractDialogBlockData(this.resolvedBlock.props);
    const computed_state = this.state;
    const res: DialogVariable[] = [];
    for (const [v_key, v_data] of Object.entries(props_state.variables.own)) {
      if (Object.keys(v_data).length === 1 && v_data['index']) {
        continue;
      }
      if (computed_state.variables.own[v_key]) {
        Object.assign(v_data, computed_state.variables.own[v_key]);
      }
      res.push(v_data);
    }

    return sortCollectionItems(res);
  }

  getOwnActions() {
    if (!this.resolvedBlock) {
      return [];
    }
    const props_state = extractDialogBlockData(this.resolvedBlock.props);
    const computed_state = this.state;
    const res: DialogAction[] = [];
    for (const [v_key, v_data] of Object.entries(props_state.actions.own)) {
      if (Object.keys(v_data).length === 1 && v_data['index']) {
        continue;
      }
      if (computed_state.actions.own[v_key]) {
        Object.assign(v_data, computed_state.actions.own[v_key]);
      }
      res.push(v_data);
    }

    return sortCollectionItems(res);
  }

  getActions(): DialogAction[] {
    const res: DialogAction[] = [];
    for (const v_data of Object.values(this.state.actions.own)) {
      if (Object.keys(v_data).length === 1 && v_data['index']) {
        continue;
      }
      res.push(v_data);
    }
    return sortCollectionItems(res);
  }

  getVariables(): DialogVariable[] {
    const res: DialogVariable[] = [];
    for (const v_data of Object.values(this.state.variables.own)) {
      if (Object.keys(v_data).length === 1 && v_data['index']) {
        continue;
      }
      res.push(v_data);
    }
    return sortCollectionItems(res);
  }

  getVariableByName(variable_name: string): DialogVariable | null {
    return this.state.variables.own.hasOwnProperty(variable_name)
      ? this.state.variables.own[variable_name]
      : null;
  }

  addVariable(variable: DialogVariable) {
    this.state.variables.own = {
      ...this.state.variables.own,
      [variable.name]: variable,
    };
    this.savePropsDelayed();
  }

  addAction(action: DialogAction) {
    this.state.actions.own = {
      ...this.state.actions.own,
      [action.name]: action,
    };
    this.savePropsDelayed();
  }

  changeVariable(variable_name, variable: DialogVariable) {
    if (this.state.variables.own.hasOwnProperty(variable_name)) {
      const res = {
        ...this.state.variables.own,
      };
      delete res[variable_name];
      res[variable.name] = variable;
      this.state.variables.own = res;
      this.savePropsDelayed();
    }
  }

  changeAction(action_name: string, action: DialogAction) {
    if (this.state.actions.own.hasOwnProperty(action_name)) {
      const res = {
        ...this.state.actions.own,
      };
      delete res[action_name];
      res[action.name] = action;
      this.state.actions.own = res;
      this.savePropsDelayed();
    }
  }

  reorderVariables(variables: DialogVariable[]): void {
    if (!this.state.variables) {
      this.state.variables = {
        own: {} as any,
      };
    }
    for (let i = 0; i < variables.length; i++) {
      this.state.variables.own[variables[i].name] = {
        ...variables[i],
        index: i,
      };
    }
    this.savePropsDelayed();
  }
  reorderActions(actions: DialogAction[]): void {
    if (!this.state.actions) {
      this.state.actions = {
        own: {} as any,
      };
    }
    for (let i = 0; i < actions.length; i++) {
      this.state.actions.own[actions[i].name] = {
        ...actions[i],
        index: i,
      };
    }
    this.savePropsDelayed();
  }

  deleteVariable(variable_name: string) {
    if (this.state.variables.own.hasOwnProperty(variable_name)) {
      const res = {
        ...this.state.variables.own,
      };
      delete res[variable_name];
      this.state.variables.own = res;
      this.savePropsDelayed();
    }
  }
  deleteAction(action_name: string) {
    if (this.state.actions.own.hasOwnProperty(action_name)) {
      const res = {
        ...this.state.actions.own,
      };
      delete res[action_name];
      this.state.actions.own = res;
      this.savePropsDelayed();
    }
  }

  canDeleteVariable(_variable_name: string) {
    return true;
  }
  canDeleteAction(_action_name: string) {
    return true;
  }

  async manageVariables(projectContext: IProjectContext) {
    await this.appManager.get(DialogManager).show(ManageCollectionDialog, {
      dialogController: this,
      projectContext,
      header: this.appManager.$t('imsDialogEditor.var.manageVariables'),
      createButtonCaption: this.appManager.$t(
        'imsDialogEditor.var.createVariable',
      ),
      createEntityInitalVals: ({ filters }) => {
        return { kind: filters.kind };
      },
      getCollectionController: (
        dialogController: DialogBlockController,
      ): IDialogCollectionController<DialogVariable> => ({
        getEntities: () => dialogController.getOwnVariables(),
        addEntity: (variable: DialogVariable) =>
          dialogController.addVariable(variable),
        changeEntity: (variable_name: string, variable: DialogVariable) =>
          dialogController.changeVariable(variable_name, variable),
        deleteEntity: (variable_name: string) =>
          dialogController.deleteVariable(variable_name),
        canDeleteEntity: (variable_name: string) =>
          dialogController.canDeleteVariable(variable_name),
        reorderEntities: (variables: DialogVariable[]) =>
          dialogController.reorderVariables(variables),
        createEntity: async (initial) =>
          await nodeVariableAdd(
            this.appManager,
            this.getOwnVariables(),
            {
              alreadyExist: this.appManager.$t(
                'imsDialogEditor.var.variableAlreadyExists',
              ),
            },
            false,
            true,
            initial,
          ),
      }),
      viewComponent: markRaw(
        defineAsyncComponent(() => import('../dialogs/VariableList.vue')),
      ),
      viewComponentProps: {
        showKindControl: true,
      },
      initialFilters: {
        kind: ScriptBlockPlainVariableKinds.GLOBAL,
      },
    });
  }

  async manageActions(
    projectContext: IProjectContext,
    actionType?: ScriptBlockPlainActionTypes,
  ) {
    await this.appManager.get(DialogManager).show(ManageCollectionDialog, {
      dialogController: this,
      projectContext,
      header: this.appManager.$t('imsDialogEditor.actions.manageActions'),
      createButtonCaption: ({ filters }) => {
        if (!filters.type) {
          return this.appManager.$t('imsDialogEditor.actions.createAction');
        } else if (filters.type === 'trigger') {
          return this.appManager.$t('imsDialogEditor.actions.createTrigger');
        } else {
          return this.appManager.$t('imsDialogEditor.actions.createFunction');
        }
      },
      createEntityInitalVals: ({ filters }) => {
        return { type: filters.type };
      },
      getCollectionController: (
        dialogController: DialogBlockController,
      ): IDialogCollectionController<DialogAction> => ({
        getEntities: () => dialogController.getOwnActions(),
        addEntity: (action: DialogAction) => dialogController.addAction(action),
        changeEntity: (action_name: string, action: DialogAction) =>
          dialogController.changeAction(action_name, action),
        deleteEntity: (action_name: string) =>
          dialogController.deleteAction(action_name),
        canDeleteEntity: (action_name: string) =>
          dialogController.canDeleteAction(action_name),
        reorderEntities: (actions: DialogAction[]) =>
          dialogController.reorderActions(actions),
        createEntity: async (initial) => {
          const res = await this.appManager
            .get(DialogManager)
            .show(EnterActionDialog, {
              initial,
              validate: (action) => {
                const list = this.getActions().some(
                  (a) => a.name === action.name,
                );
                if (list) {
                  throw new Error(
                    this.appManager.$t(
                      'imsDialogEditor.actions.actionAlreadyExists',
                    ),
                  );
                }
              },
            });
          if (!res) return null;
          return res;
        },
      }),
      viewComponent: markRaw(
        defineAsyncComponent(() => import('../dialogs/ActionsList.vue')),
      ),
      initialFilters: {
        type: actionType,
      },
    });
  }

  getMainSpeech(): DialogVariable[] {
    return Object.values(this.state.__settings.speech.main)
      .sort((a, b) => a.name.localeCompare(b.name))
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  }

  addMainSpeech(variable: DialogVariable) {
    if (this.state.__settings.speech.main.hasOwnProperty(variable.name)) {
      throw new Error(
        this.appManager.$t('imsDialogEditor.var.variableAlreadyExists'),
      );
    }
    this.state.__settings.speech.main = {
      ...this.state.__settings.speech.main,
      [variable.name]: variable,
    };
    this.savePropsDelayed();
  }

  changeMainSpeech(variable_name, variable: DialogVariable) {
    if (this.state.__settings.speech.main.hasOwnProperty(variable_name)) {
      const res = {
        ...this.state.__settings.speech.main,
      };
      delete res[variable_name];
      res[variable.name] = variable;
      this.state.__settings.speech.main = res;
      this.savePropsDelayed();
    }
  }

  deleteMainSpeech(variable_name: string) {
    if (this.state.__settings.speech.main.hasOwnProperty(variable_name)) {
      const res = {
        ...this.state.__settings.speech.main,
      };
      delete res[variable_name];
      this.state.__settings.speech.main = res;
      this.savePropsDelayed();
    }
  }

  reorderMainSpeech(variables: DialogVariable[]): void {
    for (let i = 0; i < variables.length; i++) {
      this.state.__settings.speech.main[variables[i].name] = {
        ...variables[i],
        index: i,
      };
    }
    this.savePropsDelayed();
  }

  getOptionSpeech(): DialogVariable[] {
    return Object.values(this.state.__settings.speech.option)
      .sort((a, b) => a.name.localeCompare(b.name))
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  }

  addOptionSpeech(variable: DialogVariable) {
    if (this.state.__settings.speech.option.hasOwnProperty(variable.name)) {
      throw new Error(
        this.appManager.$t('imsDialogEditor.var.variableAlreadyExists'),
      );
    }
    this.state.__settings.speech.option = {
      ...this.state.__settings.speech.option,
      [variable.name]: variable,
    };
    this.savePropsDelayed();
  }

  changeOptionSpeech(variable_name, variable: DialogVariable) {
    if (this.state.__settings.speech.option.hasOwnProperty(variable_name)) {
      const res = {
        ...this.state.__settings.speech.option,
      };
      delete res[variable_name];
      res[variable.name] = variable;
      this.state.__settings.speech.option = res;
      this.savePropsDelayed();
    }
  }

  deleteOptionSpeech(variable_name: string) {
    if (this.state.__settings.speech.option.hasOwnProperty(variable_name)) {
      const res = {
        ...this.state.__settings.speech.option,
      };
      delete res[variable_name];
      this.state.__settings.speech.option = res;
      this.savePropsDelayed();
    }
  }

  reorderOptionSpeech(variables: DialogVariable[]): void {
    for (let i = 0; i < variables.length; i++) {
      this.state.__settings.speech.option[variables[i].name] = {
        ...variables[i],
        index: i,
      };
    }
    this.savePropsDelayed();
  }

  override getSelectedContentItemIds(): string[] {
    const selected_item_ids: string[] = [];
    for (const node of this.state.nodes) {
      if ((node as GraphNode).selected) {
        selected_item_ids.push(`node-${node.id}`);
      }
    }
    return selected_item_ids;
  }

  setSelectedNodeIds(selected_node_ids: Set<string>) {
    for (const node of this.state.nodes) {
      const selected_was = (node as GraphNode).selected;
      const selected_need = selected_node_ids.has(node.id);
      if (selected_was !== selected_need) {
        (node as GraphNode).selected = selected_need;
      }
    }
  }
  setSelectedEdgeIds(selected_edge_ids: Set<string>) {
    for (const edge of this.state.edges) {
      const selected_was = (edge as GraphEdge).selected;
      const selected_need = selected_edge_ids.has(edge.id);
      if (selected_was !== selected_need) {
        (edge as GraphEdge).selected = selected_need;
      }
    }
  }

  override setSelectedContentItemIds(itemIds: string[]): void {
    const selected_node_ids = new Set<string>();
    for (const item_id of itemIds) {
      if (item_id.startsWith('node-')) {
        const node_id = item_id.substring('node-'.length);
        if (node_id) {
          selected_node_ids.add(node_id);
        }
      }
    }
    this.setSelectedNodeIds(selected_node_ids);
    this.setSelectedEdgeIds(new Set());
  }

  override getContentItems(): BlockContentItem<DialogBlockContentUserData>[] {
    if (!this.resolvedBlock) {
      return [];
    }
    const root_anchor: BlockContentItem<DialogBlockContentUserData> = {
      blockId: this.resolvedBlock.id,
      itemId: 'root',
      title: this.resolvedBlock.title
        ? this.resolvedBlock.title
        : this.appManager.$t('blockTypes.titles.script'),
      children: [],
    };

    const dialog_state = extractDialogBlockData(this.resolvedBlock.computed);
    const nodes_sorted = [...dialog_state.nodes].sort((a, b) => {
      return (a.data?.index ?? 0) - (b.data?.index ?? 0);
    });
    for (const node of nodes_sorted) {
      assert(root_anchor.children);
      const node_desc = node.type ? getNodeDescriptorOfType(node.type) : null;
      let title = this.appManager.$t(
        `imsDialogEditor.nodes.${node.type}.title`,
      );
      let title_val: AssetPropValue = null;
      if (node.type === 'speech') {
        title_val = node.data?.values?.text ?? null;
      } else if (node.type === 'trigger') {
        title_val = node.data?.subject ?? null;
      } else if (node.type === 'getVar' || node.type === 'setVar') {
        const variable_name = node.data?.values?.variable ?? null;
        const variable = variable_name
          ? this.getVariableByName(variable_name)
          : null;
        if (variable) {
          title_val =
            this.appManager.$t(
              'imsDialogEditor.contents.' +
              (node.type === 'getVar' ? 'varGet' : 'varSet'),
            ) +
            ' ' +
            variable.title;
        }
      }
      if (title_val) {
        const text = truncateAssetPropValueText(
          castAssetPropValueToText(title_val),
          50,
        );
        if (text) {
          title =
            castAssetPropValueToString(text.result) +
            (text.truncated ? '...' : '');
        }
      }
      root_anchor.children.push({
        blockId: this.resolvedBlock.id,
        itemId: 'node-' + node.id,
        title,
        anchor: 'node-' + node.id,
        selectable: true,
        icon: node_desc ? node_desc.icon : undefined,
        userData: {
          type: 'node',
          id: node.id,
        },
      });
    }

    return [root_anchor];
  }

  async setNodeServiceName(nodeId: string): Promise<void> {
    const node = this.state.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const existingIds = new Set(this.state.nodes.map((n) => n.id));
    const result = await this.appManager.get(DialogManager).show(PromptDialog, {
      header: this.appManager.$t('imsDialogEditor.setServiceName'),
      value: nodeId,
      validate: (val: string) => {
        if (!val || val === nodeId) return val;
        if (existingIds.has(val)) {
          throw this.appManager.$t('imsDialogEditor.serviceNameAlreadyExists');
        }
        return val;
      },
    });

    if (!result) {
      if (result !== '') return; // cancelled
      if (isUUID(nodeId, 'loose')) return; // no service name to reset, nothing to do
    } else if (result === nodeId) {
      return;
    }

    const newId = result || uuidv4();
    const nodeIndex = this.state.nodes.findIndex((n) => n.id === nodeId);
    if (nodeIndex === -1) return;
    const newState = {
      ...this.state,
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

    for (let index = 0; index < this.state.nodes.length; index++) {
      const node = this.state.nodes[index];
      if (!node.data) continue;
      const newNode = JSON.parse(JSON.stringify(node));
      const newNodeData = newNode.data as NodeData;
      const updateBind = (v: any) => {
        if (v && typeof v === 'object' && 'get' in v && v.get === nodeId) {
          v.get = newId;
        }
      };
      if (newNodeData.values) {
        for (const key of Object.keys(newNodeData.values)) {
          updateBind(newNodeData.values[key]);
        }
      }
      if (newNodeData.options) {
        for (const opt of newNodeData.options) {
          if (opt.values) {
            for (const key of Object.keys(opt.values)) {
              updateBind(opt.values[key]);
            }
          }
        }
      }
      this.state.nodes[index] = newNode;
    }

    this.state = newState; // Change nodes and edges simultaneously to make VueFlow work corretly

    this.savePropsDelayed();
  }

  getNodeContextMenu(
    nodeIds: string[],
    viewport: ViewportTransform,
    dialogPlayer?: DialogPlayer,
  ): MenuListItem[] {
    if (!nodeIds.length) return [];
    const count = nodeIds.length;
    const suffix = count > 1 ? ` (${count})` : '';
    const items: MenuListItem[] = [];

    if (count === 1 && dialogPlayer) {
      items.push(
        {
          name: 'run',
          title: this.appManager.$t('imsDialogEditor.runFromNode'),
          icon: 'ri-play-fill',
          action: async () => {
            await this.appManager.get(UiManager).doTask(async () => {
              dialogPlayer.startRunWithNode(false, nodeIds[0]);
            });
          },
        },
        {
          name: 'debug',
          title: this.appManager.$t('imsDialogEditor.debugFromNode'),
          icon: 'ri-bug-fill',
          action: async () => {
            await this.appManager.get(UiManager).doTask(async () => {
              dialogPlayer.startRunWithNode(true, nodeIds[0]);
            });
          },
        },
        { type: 'separator', name: 'sep-run' },
      );
    }

    if (count === 1) {
      items.push(
        {
          name: 'set-service-name',
          title: this.appManager.$t('imsDialogEditor.setServiceName'),
          icon: 'ri-price-tag-3-fill',
          action: () => this.setNodeServiceName(nodeIds[0]),
        },
        { type: 'separator', name: 'sep-service-name' },
      );
    }

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

    items.push(
      {
        name: 'copy',
        title: this.appManager.$t('common.dialogs.copy') + suffix,
        icon: 'ri-file-copy-line',
        action: () => this.copyNodesToClipboard(nodeIds, viewport),
      },
      {
        name: 'cut',
        title: this.appManager.$t('imsDialogEditor.cutNode') + suffix,
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

  get readonly() {
    if (!this.assetBlockEditor) return null;
    return this.assetBlockEditor.getIsReadonly();
  }

  override getContentItemsMenu(
    items: BlockContentItem<DialogBlockContentUserData>[],
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
    if (!this.resolvedBlock) {
      return;
    }
    if (!this.assetBlockEditor) {
      return;
    }
    this.assetBlockEditor.revealBlockContentIds(this.resolvedBlock.id, [
      itemId,
    ]);
  }
}
