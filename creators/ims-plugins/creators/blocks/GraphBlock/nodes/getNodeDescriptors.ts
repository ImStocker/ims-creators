import type { NodeDescriptor } from './NodeDescriptor';
import type { MenuListItem } from '~ims-app-base/logic/types/MenuList';
import type { GraphBlockController } from '../editor/GraphBlockController';
import {
  getAssetPropType,
  AssetPropType,
} from '~ims-app-base/logic/types/Props';
import GraphTextNode from './GraphTextNode.vue';

export function getNodeDescriptors(): NodeDescriptor[] {
  return [
    {
      name: 'graph-node',
      icon: 'ri-node-tree',
      node: GraphTextNode,
      color: '#6c8cff',
      initData: () => ({ text: '' }),
      getContextMenuItems: (
        controller: GraphBlockController,
        nodeId: string,
        t: (key: string) => string,
      ): MenuListItem[] => {
        const node = controller.state.nodes.find((n) => n.id === nodeId);
        if (!node) return [];
        const nodeData = node.data as { value?: any } | undefined;
        if (!nodeData?.value) return [];
        const valueType = getAssetPropType(nodeData.value);
        if (valueType === AssetPropType.FILE) {
          return [
            {
              name: 'replaceFile',
              title: t('graphBlock.editor.replaceFile'),
              icon: 'ri-attachment-2',
              action: async () => {
                const result = await controller.pickAndAttachFile();
                if (!result) return;
                const n = controller.state.nodes.find((x) => x.id === nodeId);
                if (n) {
                  (n.data as any).value = result;
                  controller.savePropsDelayed();
                }
              },
            },
          ];
        }
        if (valueType === AssetPropType.ASSET) {
          return [
            {
              name: 'replaceAsset',
              title: t('graphBlock.editor.replaceAsset'),
              icon: 'ri-link-m',
              action: async () => {
                const result = await controller.pickAsset();
                if (!result) return;
                const n = controller.state.nodes.find((x) => x.id === nodeId);
                if (n) {
                  (n.data as any).value = result;
                  controller.savePropsDelayed();
                }
              },
            },
          ];
        }
        return [];
      },
    },
  ];
}

export function getNodeDescriptorOfType(type: string): NodeDescriptor | null {
  return getNodeDescriptors().find((desc) => desc.name === type) ?? null;
}
