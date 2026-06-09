import { type NodeDescriptor } from './NodeDescriptor';
import GraphTextNode from './GraphTextNode.vue';

export function getNodeDescriptors(): NodeDescriptor[] {
  return [
    {
      name: 'graph-node',
      icon: 'ri-node-tree',
      node: GraphTextNode,
      color: '#6c8cff',
      initData: () => ({ text: '' }),
    },
  ];
}

export function getNodeDescriptorOfType(type: string): NodeDescriptor | null {
  return getNodeDescriptors().find((desc) => desc.name === type) ?? null;
}
