import type { AssetPropValue } from '~ims-app-base/logic/types/Props';
import type {
  ScriptBlockPlain,
  ScriptBlockPlainProps,
  ScriptBlockPlainPropValue,
  ScriptBlockPlainPropValueBind,
} from '../logic/nodeStoring';
import { getNodeDescriptorOfType } from '../nodes/getNodeDescriptiors';
import {
  cloneScriptPlayContext,
  type ScriptPlayContext,
} from './ScriptPlayContext';
import type { ScriptPlayNode, ScriptPlayNodeProps } from './ScriptPlayNode';
import type { DialogVariable } from '../editor/DialogBlockController';

export class ScriptPlayGraph {
  constructor(public scriptPlain: ScriptBlockPlain) {}

  evaluateInputParam(
    context: ScriptPlayContext,
    inputParam: ScriptBlockPlainPropValue,
    visited_pins: Set<string>,
  ): AssetPropValue {
    if (
      inputParam &&
      typeof inputParam === 'object' &&
      (inputParam as ScriptBlockPlainPropValueBind).get
    ) {
      const get_id = (inputParam as ScriptBlockPlainPropValueBind).get;
      const get_param = (inputParam as ScriptBlockPlainPropValueBind).param;
      if (visited_pins.has(get_id + '-' + get_param)) {
        throw new Error('Recursion detected');
      }
      const new_visited_pins = new Set(visited_pins);
      new_visited_pins.add(get_id + '-' + get_param);
      const node = this.preparePlayNode(context, get_id, new_visited_pins);
      if (!node) {
        throw new Error(`Data input node not found (${get_id})`);
      }
      const node_descriptor = getNodeDescriptorOfType(node.type);
      if (!node_descriptor) {
        throw new Error(`Data input node descriptor not found (${node.type})`);
      }
      if (!node_descriptor.playDataCompute) {
        throw new Error(
          `Data input node descriptor doesn't provide data (${node.type})`,
        );
      }
      return node_descriptor.playDataCompute(context, node, get_param);
    } else return inputParam as AssetPropValue;
  }

  preparePlayNode(
    context: ScriptPlayContext,
    node_id: string,
    visited_pins: Set<string>,
  ): ScriptPlayNode | null {
    const node = this.scriptPlain.nodes[node_id];
    if (!node) return null;

    let default_option_values;
    if (this.scriptPlain.__settings[node.type]?.option) {
      default_option_values = Object.entries(
        this.scriptPlain.__settings[node.type].option,
      ).reduce(
        (acc, [key, value]) => {
          acc[key] = (value as DialogVariable).default;
          return acc;
        },
        {} as Record<string, any>,
      );
    }

    let main_values_computed = node.values;
    if (
      node.type === 'speech' &&
      this.scriptPlain.__settings[node.type]?.main
    ) {
      const default_main_values = Object.entries(
        this.scriptPlain.__settings[node.type].main,
      ).reduce(
        (acc, [key, value]) => {
          acc[key] = (value as DialogVariable).default;
          return acc;
        },
        {} as Record<string, any>,
      );
      main_values_computed = {
        ...default_main_values,
        ...main_values_computed,
      };
    } else if (
      (node.type === 'function' || node.type === 'trigger') &&
      this.scriptPlain.actions.own &&
      node.subject
    ) {
      const action = this.scriptPlain.actions.own[node.subject];
      if (action) {
        const default_main_values = action.params?.in.reduce(
          (acc, item) => {
            acc[item.name] = item.default;
            return acc;
          },
          {} as Record<string, any>,
        );
        main_values_computed = {
          ...default_main_values,
          ...main_values_computed,
        };
      }
    }
    const res = {
      id: node_id,
      type: node.type,
      next: node.next,
      options: node.options
        ? node.options.map((opt) => {
            const values = {
              ...default_option_values,
              ...opt.values,
            };
            return {
              values: values
                ? this.evaluateInputParams(context, values, visited_pins)
                : undefined,
              next: opt.next,
            };
          })
        : undefined,
      params: node.params,
      subject: node.subject,
      values: main_values_computed
        ? this.evaluateInputParams(context, main_values_computed, visited_pins)
        : undefined,
    };

    return res;
  }

  evaluateInputParams(
    context: ScriptPlayContext,
    input: ScriptBlockPlainProps,
    visited_nodes: Set<string>,
  ): ScriptPlayNodeProps {
    const res: ScriptPlayNodeProps = {};
    for (const [param, value] of Object.entries(input)) {
      res[param] = this.evaluateInputParam(context, value, visited_nodes);
    }
    return res;
  }

  step(
    context: ScriptPlayContext,
    choice: number | null = null,
  ): ScriptPlayContext {
    if (context.ended) {
      return context;
    }

    let next_node_id: string | null = null;

    if (!context.currentNode) {
      next_node_id = this.scriptPlain.start;
    } else {
      const node_descriptor = getNodeDescriptorOfType(context.currentNode.type);
      if (!node_descriptor) {
        throw new Error(
          `Current node descriptor not found (${context.currentNode.type})`,
        );
      }

      if (node_descriptor.playNodeExecute) {
        next_node_id = node_descriptor.playNodeExecute(
          context,
          context.currentNode,
          choice,
        );
      } else if (
        choice &&
        context.currentNode.options &&
        context.currentNode.options.length > choice
      ) {
        next_node_id = context.currentNode.options[choice].next;
      } else if (context.currentNode.next) {
        next_node_id = context.currentNode.next;
      } else if (
        context.currentNode.options &&
        context.currentNode.options.length > 0
      ) {
        next_node_id = context.currentNode.options[0].next;
      }
    }

    const res = cloneScriptPlayContext(context);
    if (!next_node_id) {
      res.currentNode = null;
      res.ended = true;
    } else {
      res.currentNode = this.preparePlayNode(context, next_node_id, new Set());
      if (!res.currentNode) {
        throw new Error(`Next node not found (${next_node_id})`);
      }
    }

    return res;
  }
}
