import type { Edge, GraphNode } from '@vue-flow/core';
import type { DialogBlockState } from './DialogEditor';
import {
  convertNodeToPlainNode,
  exportDialogBlockData,
  extractDialogBlockData,
  generateDataPinId,
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
  truncateAssetPropValueText,
  type AssetProps,
  type AssetPropValue,
  type AssetPropValueType,
} from '~ims-app-base/logic/types/Props';
import type { NodeData, NodeDataController } from './NodeDataController';
import type { IAppManager } from '~ims-app-base/logic/managers/IAppManager';
import DialogManager from '~ims-app-base/logic/managers/DialogManager';
import ManageVariableListDialog from '../dialogs/ManageVariableListDialog.vue';
import type {
  ScriptBlockPlainNode,
  ScriptBlockPlainVariable,
} from '../logic/nodeStoring';
import { assert } from '~ims-app-base/logic/utils/typeUtils';
import type { IDialogVariableController } from './DialogVariableController';
import {
  clipboardCopyPlainText,
  clipboardReadPlainText,
} from '~ims-app-base/logic/utils/clipboard';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import { v4 as uuidv4 } from 'uuid';
import { BlockEditorController } from '~ims-app-base/logic/types/BlockEditorController';
import { watch } from 'vue';
import type { BlockContentItem } from '~ims-app-base/logic/types/BlockTypeDefinition';
import { getNodeDescriptorOfType } from '../nodes/getNodeDescriptiors';
import type { MenuListItem } from '~ims-app-base/logic/types/MenuList';
import type { IProjectContext } from '~ims-app-base/logic/types/IProjectContext';

export type DialogVariable = ScriptBlockPlainVariable;

export type DialogBlockContentUserData = {
  type: 'node';
  id: string;
};

export function sortVariables(variables: DialogVariable[]) {
  return variables
    .sort((a, b) => a.name?.localeCompare(b.name))
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

export class DialogBlockController
  extends BlockEditorController
  implements IDialogVariableController
{
  state!: DialogBlockState;
  private _expectPropsChange = false;
  readonly savePropsDelayed: () => void;
  private _assignedDataTypePins = new Map<string, AssetPropValueType[]>();

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
    return this.state.nodes.find((n) => n.type === 'start');
  }

  copyNodesToClipboard(selected_node_ids: string[]) {
    const nodes_to_copy: ({ id: string } & ScriptBlockPlainNode)[] = [];
    for (const selected_id of selected_node_ids) {
      const selected_node = this.state.nodes.find((n) => n.id === selected_id);
      if (!selected_node) return;
      nodes_to_copy.push({
        id: selected_id,
        ...convertNodeToPlainNode(selected_node),
      });
    }
    clipboardCopyPlainText(JSON.stringify(nodes_to_copy));
  }

  async pasteNodesFromClipboard() {
    const changer = this.changer;
    if (!changer) return;

    const pasted_data = await clipboardReadPlainText();
    try {
      const parsed = JSON.parse(pasted_data);

      if (!Array.isArray(parsed)) return;

      if (!parsed.length) return;

      const isValidNode = (
        node: any,
      ): node is { id: string } & ScriptBlockPlainNode =>
        node &&
        typeof node === 'object' &&
        typeof node.id === 'string' &&
        typeof node.type === 'string' &&
        node.pos &&
        typeof node.pos === 'object' &&
        typeof node.pos.x === 'number' &&
        typeof node.pos.y === 'number';

      if (parsed.every(isValidNode)) {
        try {
          const id_map = new Map();
          parsed.forEach((node) => {
            id_map.set(node.id, uuidv4());
          });

          const new_nodes = parsed.map((node) => {
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
            new_node.pos.x += 50;
            new_node.pos.y += 50;
            return new_node;
          });

          const changed_keys: AssetProps = {};
          for (let i = 0; i < new_nodes.length; i++) {
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
    } catch {
      // do nothing
    }
  }

  private _onBlockUpdated() {
    if (this._expectPropsChange) return;

    this.state = extractDialogBlockData(this.resolvedBlock.computed);
  }

  getNodePinDataType(
    node_id: string,
    pin_id: string,
  ): AssetPropValueType[] | null {
    const assigned = this._assignedDataTypePins.get(node_id + '|' + pin_id);
    if (assigned) return assigned.length > 0 ? assigned : null;

    for (const e of this.state.edges) {
      if (e.target === node_id && e.targetHandle === pin_id) {
        const assigned = this._assignedDataTypePins.get(
          e.source + '|' + e.sourceHandle,
        );
        if (assigned) return assigned.length > 0 ? assigned : null;
      }
      if (e.source === node_id && e.sourceHandle === pin_id) {
        const assigned = this._assignedDataTypePins.get(
          e.target + '|' + e.targetHandle,
        );
        if (assigned) return assigned.length > 0 ? assigned : null;
      }
    }
    return null;
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
        node_data.options[ind].values[prop] = val;
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
        if (type) {
          if (!Array.isArray(type)) type = [type];
          this._assignedDataTypePins.set(node_id + '|' + pin_id, type);
        } else {
          this._assignedDataTypePins.delete(node_id + '|' + pin_id);
        }
      },
      addParam: (scope: 'in' | 'out', variable: DialogVariable) => {
        if (!node) return;
        const node_data = ensure_node_data();
        if (!node_data.params) node_data.params = { in: [], out: [] };
        if (!node_data.params[scope]) node_data.params[scope] = [];
        if (node_data.params[scope].some((p) => p.name === variable.name)) {
          throw new Error('Paramter already exists');
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
    const leftEdge = this.state.edges.find(
      (e) => e.target === nodeId && e.targetHandle === 'in',
    );
    const rightEdge = this.state.edges.find(
      (e) =>
        e.source === nodeId &&
        (e.sourceHandle === 'out' || /^out-\d+$/.test(e.sourceHandle ?? '')),
    );
    if (!leftEdge || !rightEdge) {
      return;
    }
    await new Promise((res) => setTimeout(res, 1));
    this.addEdge(
      leftEdge.source,
      rightEdge.target,
      leftEdge.sourceHandle ?? undefined,
      rightEdge.targetHandle ?? undefined,
    );
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

    return sortVariables(res);
  }

  getVariables(): DialogVariable[] {
    const res: DialogVariable[] = [];
    for (const v_data of Object.values(this.state.variables.own)) {
      if (Object.keys(v_data).length === 1 && v_data['index']) {
        continue;
      }
      res.push(v_data);
    }
    return sortVariables(res);
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

  canDeleteVariable(_variable_name: string) {
    return true;
  }

  async manageVariables(projectContext: IProjectContext) {
    await this.appManager.get(DialogManager).show(ManageVariableListDialog, {
      dialogController: this,
      projectContext,
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
    for (const node of this.state.nodes) {
      const selected_was = (node as GraphNode).selected;
      const selected_need = selected_node_ids.has(node.id);
      if (selected_was !== selected_need) {
        (node as GraphNode).selected = selected_need;
      }
    }
  }

  override getContentItems(): BlockContentItem<DialogBlockContentUserData>[] {
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

  override getContentItemsMenu(
    items: BlockContentItem<DialogBlockContentUserData>[],
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
    if (!this.assetBlockEditor) {
      return;
    }
    this.assetBlockEditor.revealBlockContentIds(this.resolvedBlock.id, [
      itemId,
    ]);
  }
}
