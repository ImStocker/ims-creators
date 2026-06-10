import type { Component } from 'vue';
import type { GraphBlockController } from '../editor/GraphBlockController';
import type { MenuListItem } from '~ims-app-base/logic/types/MenuList';

export type NodeDescriptor = {
  name: string;
  icon: string;
  node: Component;
  color: string;
  initData?: () => { text?: string };
  params?: any;
  getContextMenuItems?: (
    controller: GraphBlockController,
    nodeId: string,
    t: (key: string) => string,
  ) => MenuListItem[];
};
