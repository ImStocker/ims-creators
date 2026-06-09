import type { Edge, Node } from '@vue-flow/core';
import {
  assignPlainValueToAssetProps,
  convertAssetPropsToPlainObject,
  type AssetProps,
} from '~ims-app-base/logic/types/Props';
import type { GraphBlockPlain, GraphBlockPlainNode, GraphLink } from '../logic/nodeStoring';

export type GraphNodeData = {
  value: any;
  width: number;
  height: number;
  index: number;
  color?: string;
};

export type GraphBlockState = {
  nodes: Node[];
  edges: Edge[];
};

export const DATA_COLOR_TO_HEX: Record<string, string> = {
  red: '#dc3545',
  orange: '#e67e22',
  yellow: '#f1c40f',
  green: '#2ecc71',
  blue: '#3498db',
  purple: '#9b59b6',
};

export const COLOR_SWATCHES: { value: string; hex: string }[] = [
  { value: '', hex: '' },
  { value: 'red', hex: '#dc3545' },
  { value: 'orange', hex: '#e67e22' },
  { value: 'yellow', hex: '#f1c40f' },
  { value: 'green', hex: '#2ecc71' },
  { value: 'blue', hex: '#3498db' },
  { value: 'purple', hex: '#9b59b6' },
];

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const SIDE_SOURCE_MAP: Record<string, string> = {
  top: 'source-top',
  left: 'source-left',
  bottom: 'source-bottom',
  right: 'source-right',
};

const SIDE_TARGET_MAP: Record<string, string> = {
  top: 'target-top',
  left: 'target-left',
  bottom: 'target-bottom',
  right: 'target-right',
};

const SOURCE_PREFIX = 'source-';
const TARGET_PREFIX = 'target-';

export function parseSourceHandle(handle: string): string | null {
  if (!handle.startsWith(SOURCE_PREFIX)) return null;
  return handle.slice(SOURCE_PREFIX.length);
}

export function parseTargetHandle(handle: string): string | null {
  if (!handle.startsWith(TARGET_PREFIX)) return null;
  return handle.slice(TARGET_PREFIX.length);
}

export function extractGraphBlockData(props: AssetProps): GraphBlockState {
  const plain = convertAssetPropsToPlainObject<Partial<GraphBlockPlain>>(props);
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  if (plain.nodes) {
    for (const [node_id, node_plain] of Object.entries(plain.nodes)) {
      nodes.push({
        id: node_id,
        type: 'graph-node',
        position: {
          x: node_plain?.pos?.x ?? 0,
          y: node_plain?.pos?.y ?? 0,
        },
        data: {
          value: node_plain.value ?? null,
          width: node_plain.width ?? 150,
          height: node_plain.height ?? 60,
          index: node_plain.index ?? 0,
          color: node_plain.color ?? undefined,
        } as GraphNodeData,
      });

      if (node_plain.links) {
        for (const link of node_plain.links) {
          const sourceHandle = SIDE_SOURCE_MAP[link.fromSide ?? 'right'] ?? 'source-right';
          const targetHandle = SIDE_TARGET_MAP[link.toSide ?? 'left'] ?? 'target-left';
          edges.push({
            id: `${node_id}|${sourceHandle}|${targetHandle}|${link.to}`,
            source: node_id,
            target: link.to,
            sourceHandle,
            targetHandle,
            type: 'graph-edge',
          });
        }
      }
    }
  }

  return { nodes, edges };
}

export function exportGraphBlockData(state: GraphBlockState): AssetProps {
  const res: GraphBlockPlain = {
    nodes: {},
  };

  for (const node of state.nodes) {
    const node_data = node.data as GraphNodeData | undefined;
    const links: GraphLink[] = [];

    for (const edge of state.edges) {
      if (edge.source !== node.id) continue;
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

    const plain_node: GraphBlockPlainNode = {
      value: node_data?.value ?? null,
      width: node_data?.width ?? 150,
      height: node_data?.height ?? 60,
      pos: {
        x: node.position.x,
        y: node.position.y,
      },
      index: node_data?.index ?? 0,
      links,
      color: node_data?.color ?? undefined,
    };
    res.nodes[node.id] = plain_node;
  }

  const props: AssetProps = {};
  assignPlainValueToAssetProps(props, res);
  return props;
}
