import type { Edge, Node } from '@vue-flow/core';
import {
  AssetPropType,
  assignPlainValueToAssetProps,
  castAssetPropValueToString,
  convertAssetPropsToPlainObject,
  type AssetProps,
  type AssetPropValue,
} from '~ims-app-base/logic/types/Props';
import type {
  ScriptBlockPlain,
  ScriptBlockPlainNode,
  ScriptBlockPlainPropValueBind,
  ScriptBlockPlainVariable,
} from '../logic/nodeStoring';
import type { DialogVariable } from './DialogBlockController';
import type { NodeData, NodeDataOption } from './NodeDataController';

export function generateDataPinId(
  isOut: boolean,
  param: string,
  option_index?: number,
) {
  return (
    'data-' +
    (isOut ? 'out-' : 'in-') +
    param +
    (option_index !== undefined ? '*O' + (option_index + 1) : '')
  );
}

export function parseDataPinId(pin_id: string): {
  isOut: boolean;
  param: string;
  optionIndex?: number;
} | null {
  const match = pin_id.match(/^data-(in|out)-(.+?)(\*O(\d+))?$/);
  if (!match) return null;
  return {
    isOut: match[1] === 'out',
    param: match[2],
    optionIndex: match[3] ? parseInt(match[4]) - 1 : undefined,
  };
}

export type DialogBlockState = {
  nodes: Node[];
  edges: Edge[];
  variables: {
    own: {
      [name: string]: DialogVariable;
    };
  };
  __settings: {
    speech: {
      main: {
        [name: string]: DialogVariable;
      };
      option: {
        [name: string]: DialogVariable;
      };
    };
  };
};

export function isEdgeBelongToNode(edge_id: string, node_id: string) {
  const parts = edge_id.split('|');
  const bind = parts[0];
  const node = parts[parts.length - 1];
  return bind === node_id || node === node_id;
}

export function extractDialogBlockPlain(props: AssetProps): ScriptBlockPlain {
  return convertAssetPropsToPlainObject<ScriptBlockPlain>(props);
}

export function extractDialogBlockData(props: AssetProps): DialogBlockState {
  const plain =
    convertAssetPropsToPlainObject<Partial<ScriptBlockPlain>>(props);
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  if (plain.nodes) {
    for (const [node_id, node_plain] of Object.entries(plain.nodes)) {
      const node_data: NodeData = {
        subject: '',
        values: {},
        options: [],
        params: {
          in: [],
          out: [],
        },
        index: node_plain.index ?? 0,
      };
      const node: Node = {
        id: node_id,
        type: node_plain.type ?? 'unknown',
        position: {
          x: node_plain?.pos?.x ?? 0,
          y: node_plain?.pos?.y ?? 0,
        },
        data: node_data,
      };
      nodes.push(node);

      function add_data_bind_edge(
        param: string,
        bind: ScriptBlockPlainPropValueBind,
        param_opt_ind?: number,
      ) {
        const out_pin = generateDataPinId(true, bind.param);
        const in_pin = generateDataPinId(false, param, param_opt_ind);
        edges.push({
          id: `${bind.get}|${out_pin}|${in_pin}|${node_id}`,
          source: bind.get,
          target: node_id,
          sourceHandle: out_pin,
          targetHandle: in_pin,
        });
      }

      function add_flow_edge(out_pin_id, in_node_id) {
        edges.push({
          id: `${node_id}|${out_pin_id}|in|${in_node_id}`,
          source: node_id,
          target: in_node_id,
          sourceHandle: out_pin_id,
          targetHandle: 'in',
          type: 'flow',
        });
      }

      if (node_plain.values) {
        for (const [key, val] of Object.entries(node_plain.values)) {
          let rename_key = key;
          if (node_plain.type === 'branch' && rename_key === 'condiiton') {
            // Fix typo 28.11.25
            rename_key = 'condition';
          }
          node_data.values[rename_key] = val;
          if (val && (val as ScriptBlockPlainPropValueBind).get) {
            add_data_bind_edge(
              rename_key,
              val as ScriptBlockPlainPropValueBind,
            );
          }
        }
      }

      if (node_plain.params) {
        node_data.params = node_plain.params;
      }

      if (node_plain.subject) {
        node_data.subject = castAssetPropValueToString(node_plain.subject);
      } else {
        if (
          node.type === 'trigger' &&
          node_plain.values &&
          node_plain.values.trigger &&
          !node_plain.params
        ) {
          // Old format 11.04.2025
          const trigger_subject = node_plain.values.trigger;
          if (
            trigger_subject &&
            !(trigger_subject as ScriptBlockPlainPropValueBind).get
          ) {
            node_data.subject = castAssetPropValueToString(
              trigger_subject as AssetPropValue,
            );
          }
        }
      }

      if (node_plain.next) {
        add_flow_edge('out', node_plain.next);
      }
      if (Array.isArray(node_plain.options)) {
        for (let opt_ind = 0; opt_ind < node_plain.options.length; opt_ind++) {
          const plain_option = node_plain.options[opt_ind];
          const option: NodeDataOption = {
            values: {},
            next: null,
          };
          if (plain_option.values) {
            for (const [key, val] of Object.entries(plain_option.values)) {
              option.values[key] = val;
              if (val && (val as ScriptBlockPlainPropValueBind).get) {
                add_data_bind_edge(
                  key,
                  val as ScriptBlockPlainPropValueBind,
                  opt_ind,
                );
              }
            }
          }

          node_data.options.push(option);
          if ((plain_option as any).value) {
            // Old format 11.04.2025
            option.values.text = (node_plain.options[opt_ind] as any).value;
          }
          const opt_next = node_plain.options[opt_ind].next;
          if (opt_next) {
            add_flow_edge('out-' + (opt_ind + 1), opt_next);
          }
        }
      }
    }
  }

  const speech_main: {
    [name: string]: ScriptBlockPlainVariable;
  } =
    plain?.__settings?.speech?.main &&
    Object.keys(plain?.__settings?.speech?.main).length > 0
      ? plain?.__settings?.speech?.main
      : {
          character: {
            name: 'character',
            title: '[[t:Character]]',
            type: {
              Type: AssetPropType.TEXT,
            },
            description: null,
            default: null,
            autoFill: true,
          },
          text: {
            name: 'text',
            title: '[[t:Text]]',
            type: {
              Type: AssetPropType.TEXT,
            },
            description: null,
            default: null,
          },
        };
  const speech_option: {
    [name: string]: ScriptBlockPlainVariable;
  } =
    plain?.__settings?.speech?.option &&
    Object.keys(plain?.__settings?.speech?.option).length > 0
      ? plain?.__settings?.speech?.option
      : {
          text: {
            name: 'text',
            title: '[[t:Text]]',
            type: {
              Type: AssetPropType.TEXT,
            },
            description: null,
            default: null,
          },
        };

  return {
    nodes,
    edges,
    variables: {
      own: plain?.variables?.own ?? {},
    },
    __settings: {
      speech: {
        main: speech_main,
        option: speech_option,
      },
    },
  };
}

export function convertNodeToPlainNode(node: Node): ScriptBlockPlainNode {
  const node_data = node.data as NodeData | undefined;
  const node_plain: ScriptBlockPlainNode = {
    type: node.type ?? '',
    pos: {
      x: node.position.x,
      y: node.position.y,
    },
    next: null,
    index: node_data?.index ?? 0,
  };
  if (node_data) {
    if ([...Object.keys(node_data.values)].length > 0) {
      node_plain.values = node_data.values;
    }
    if (node_data.options.length > 0) {
      node_plain.options = node_data.options;
    }
    if (node_data.params.in.length > 0 || node_data.params.out.length > 0) {
      node_plain.params = node_data.params;
    }
    if (node_data.subject) {
      node_plain.subject = node_data.subject;
    }
  }
  return node_plain;
}

export function exportDialogBlockData(state: DialogBlockState): AssetProps {
  const res: ScriptBlockPlain = {
    start: null,
    nodes: {},
    variables: state.variables,
    __settings: state.__settings,
  };
  for (const node of state.nodes) {
    res.nodes[node.id] = convertNodeToPlainNode(node);
    if (node.type === 'start' && !res.start) {
      res.start = node.id;
    }
  }
  for (const edge of state.edges) {
    if (!res.nodes[edge.source]) {
      continue;
    }
    if (!edge.sourceHandle) {
      continue;
    }
    if (edge.sourceHandle === 'out') {
      res.nodes[edge.source].next = edge.target;
    } else {
      const out_m = edge.sourceHandle.match(/^out-(\d+)$/);
      if (out_m) {
        const options_ind = parseInt(out_m[1]) - 1;
        const source_node = res.nodes[edge.source];
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

  const props: AssetProps = {};
  assignPlainValueToAssetProps(props, res);
  return props;
}
