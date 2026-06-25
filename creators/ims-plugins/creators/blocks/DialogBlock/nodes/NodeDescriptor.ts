import type { Component } from 'vue';
import type { AssetPropValueType } from '~ims-app-base/logic/types/Props';
import type {
  NodeData,
  NodeDataController,
} from '../editor/NodeDataController';
import type { DialogBlockController } from '../editor/DialogBlockController';
import type { IProjectContext } from '~ims-app-base/logic/types/IProjectContext';
import type { MenuListItem } from '~ims-app-base/logic/types/MenuList';

export enum NodeType {
  EXEC_START = 'exec-start',
  EXEC_END = 'exec-end',
  EXEC = 'exec',
  DATA = 'data',
  DATA_START = 'data-start',
  META = 'meta',
}

export type NodeDescriptorTemplate = {
  title: string;
  apply: (nodeDataController: NodeDataController) => void;
};

export type NodeDescriptorTemplateController = {
  getTemplates: () => NodeDescriptorTemplate[];
  manageTemplates: (projectContext: IProjectContext) => Promise<void>;
  createTemplate: (name?: string) => Promise<NodeDescriptorTemplate | null>;
};

export type NodeDescriptor = {
  name: string;
  icon: string;
  node: Component;
  params?: any;
  color: string;
  type: NodeType;
  dataInTypes?: AssetPropValueType[] | null;
  dataOutTypes?: AssetPropValueType[] | null;
  initData?: () => Omit<NodeData, 'index'>;
  getTemplateController?: (
    dialogController: DialogBlockController,
  ) => NodeDescriptorTemplateController;
  getContextMenuItems?: (
    controller: DialogBlockController,
    nodeId: string,
    $t: (key: string) => string,
  ) => MenuListItem[];
};
