import DialogBranchNode from './DialogBranchNode.vue';
import DialogSpeechNode from './DialogSpeechNode.vue';
import DialogStartNode from './DialogStartNode.vue';
import DialogTriggerNode from './DialogTriggerNode.vue';
import DialogSetVarNode from './DialogSetVarNode.vue';
import DialogGetVarNode from './DialogGetVarNode.vue';
import DialogFunctionNode from './DialogFunctionNode.vue';
import { NodeType, type NodeDescriptor } from './NodeDescriptor';
import DialogEndNode from './DialogEndNode.vue';
import DialogOpNode from './DialogOpNode.vue';
import { AssetPropType } from '~ims-app-base/logic/types/Props';
import DialogConstNode from './DialogConstNode.vue';
import type { DialogBlockController } from '../editor/DialogBlockController';
import { ScriptBlockPlainActionTypes } from '../logic/nodeStoring';
import type { NodeDataController } from '../editor/NodeDataController';
import DialogManager from '~ims-app-base/logic/managers/DialogManager';
import EnterActionDialog from '../dialogs/EnterActionDialog.vue';
import type { IProjectContext } from '~ims-app-base/logic/types/IProjectContext';
import DialogCallScriptNode from './DialogCallScriptNode.vue';
import DialogCommentNode from './DialogCommentNode.vue';
import DialogTimerNode from './DialogTimerNode.vue';
import DialogChanceNode from './DialogChanceNode.vue';
import DialogJumpNode from './DialogJumpNode.vue';

const opOptionsEq = {
  opEqual: {
    sign: '=',
  },
  opNotEqual: {
    sign: '≠',
  },
} as const;
const opOptionsCompare = {
  opLess: {
    sign: '<',
  },
  opLessEqual: {
    sign: '≤',
  },
  opMore: {
    sign: '>',
  },
  opMoreEqual: {
    sign: '≥',
  },
} as const;
const opOptionsMath = {
  opPlus: {
    sign: '+',
  },
  opMinus: {
    sign: '-',
  },
  opMult: {
    sign: '×',
  },
  opDiv: {
    sign: '÷',
  },
  opMod: {
    sign: 'MOD',
  },
} as const;
const opOptionsLogical = {
  opAnd: {
    sign: 'AND',
    type: 'logical',
  },
  opOr: {
    sign: 'OR',
    type: 'logical',
  },
  opNot: {
    sign: 'NOT',
    type: 'logical',
  },
} as const;

export const opOptions = {
  ...opOptionsEq,
  ...opOptionsCompare,
  ...opOptionsMath,
  ...opOptionsLogical,
} as const;

export type NodeDescriptorOpEq = keyof typeof opOptionsEq;
export type NodeDescriptorOpCompare = keyof typeof opOptionsCompare;
export type NodeDescriptorOpMath = keyof typeof opOptionsMath;
export type NodeDescriptorOpLogical = keyof typeof opOptionsLogical;
export type NodeDescriptorOp = keyof typeof opOptions;

export function getNodeDescriptors(): NodeDescriptor[] {
  return [
    {
      name: 'start',
      icon: 'ri-play-circle-line',
      node: DialogStartNode,
      color: '#95eab0',
      type: NodeType.EXEC_START,
    },
    {
      name: 'speech',
      icon: 'ri-message-3-line',
      node: DialogSpeechNode,
      color: '#95dcea',
      type: NodeType.EXEC,
    },
    {
      name: 'branch',
      icon: 'ri-git-fork-line',
      node: DialogBranchNode,
      color: '#ffba6e',
      type: NodeType.EXEC,
      dataInTypes: [
        {
          Type: AssetPropType.BOOLEAN,
        },
      ],
      initData: () => {
        return {
          options: [
            {
              next: null,
              values: {
                value: true,
              },
            },
            {
              next: null,
              values: {
                value: false,
              },
            },
          ],
          params: {
            in: [],
            out: [],
          },
          subject: '',
          values: {},
        };
      },
    },
    {
      name: 'trigger',
      icon: 'ri-flashlight-line',
      node: DialogTriggerNode,
      color: '#ea9595',
      type: NodeType.EXEC,
      getTemplateController: (dialogController: DialogBlockController) => {
        return {
          getTemplates: () => {
            const triggers = dialogController
              .getActions()
              .filter((el) => el.type === ScriptBlockPlainActionTypes.TRIGGER);
            if (!triggers) return [];
            return triggers.map((el) => {
              return {
                title: el.name,
                apply: (nodeDataController: NodeDataController) =>
                  nodeDataController.setSubject(el.name),
              };
            });
          },
          createTemplate: async (_name?: string) => {
            const res = await dialogController.appManager
              .get(DialogManager)
              .show(EnterActionDialog);
            if (!res) return null;
            dialogController.addAction(res);
            return {
              title: res.name,
              apply: (nodeDataController: NodeDataController) =>
                nodeDataController.setSubject(res.name),
            };
          },
          manageTemplates: async (projectContext: IProjectContext) => {
            await dialogController.manageActions(
              projectContext,
              ScriptBlockPlainActionTypes.TRIGGER,
            );
          },
        };
      },
    },
    {
      name: 'function',
      icon: 'ri-code-s-slash-line',
      node: DialogFunctionNode,
      color: '#ea95ea',
      type: NodeType.DATA_START,
      getTemplateController: (dialogController: DialogBlockController) => {
        return {
          getTemplates: () => {
            const functions = dialogController
              .getActions()
              .filter((el) => el.type === ScriptBlockPlainActionTypes.FUNCTION);
            if (!functions) return [];
            return functions.map((el) => {
              return {
                title: el.name,
                apply: (nodeDataController: NodeDataController) =>
                  nodeDataController.setSubject(el.name),
              };
            });
          },
          createTemplate: async (_name?: string) => {
            const res = await dialogController.appManager
              .get(DialogManager)
              .show(EnterActionDialog);
            if (!res) return null;
            dialogController.addAction(res);
            return {
              title: res.name,
              apply: (nodeDataController: NodeDataController) =>
                nodeDataController.setSubject(res.name),
            };
          },
          manageTemplates: async (projectContext: IProjectContext) => {
            await dialogController.manageActions(
              projectContext,
              ScriptBlockPlainActionTypes.FUNCTION,
            );
          },
        };
      },
    },
    {
      name: 'callScript',
      icon: 'ri-file-paper-2-line',
      node: DialogCallScriptNode,
      color: '#afc8ff',
      type: NodeType.EXEC,
    },
    // {
    //   name: 'getProps',
    //   icon: 'ri-braces-line',
    //   node: DialogGetPropsNode,
    //   color: '#affaff',
    //   type: NodeType.DATA_START,
    // },

    {
      name: 'timer',
      icon: 'ri-time-line',
      node: DialogTimerNode,
      color: '#ffd56a',
      type: NodeType.EXEC,
    },
    {
      name: 'chance',
      icon: 'ri-dice-line',
      node: DialogChanceNode,
      color: '#ea95c3',
      type: NodeType.EXEC,
      initData: () => {
        return {
          options: [
            {
              next: null,
              values: {},
            },
            {
              next: null,
              values: {},
            },
          ],
          params: {
            in: [],
            out: [],
          },
          subject: '',
          values: {},
        };
      },
    },
    {
      name: 'jump',
      icon: 'ri-arrow-right-circle-line',
      node: DialogJumpNode,
      color: '#c9a9ff',
      type: NodeType.EXEC,
      getContextMenuItems: (controller, nodeId, $t) => {
        const node = controller.state.nodes.find((n) => n.id === nodeId);
        if (!node) return [];
        const nodeData = node.data as any;
        const to: string | null = nodeData?.values?.to ?? null;
        if (!to) return [];
        const targetNode = controller.state.nodes.find((n) => n.id === to);
        if (!targetNode) return [];
        return [
          {
            name: 'go-to-target',
            title: $t('imsDialogEditor.nodes.jump.goToTarget'),
            icon: 'ri-share-forward-2-line',
            action: () => {
              controller.revealBlockContentItem('node-' + to);
            },
          },
        ];
      },
    },
    {
      name: 'comment',
      icon: 'ri-chat-4-line',
      node: DialogCommentNode,
      color: '#b5d8d4',
      type: NodeType.DATA,
      params: {
        dataType: {
          Type: AssetPropType.TEXT,
        },
      },
    },
    {
      name: 'setVar',
      icon: 'ri-edit-fill',
      node: DialogSetVarNode,
      color: '#afb2ff',
      type: NodeType.EXEC,
      dataInTypes: null,
    },
    {
      name: 'getVar',
      icon: 'ri-terminal-line',
      node: DialogGetVarNode,
      color: '#afb2ff',
      type: NodeType.DATA_START,
      dataOutTypes: null,
    },
    {
      name: 'end',
      icon: 'ri-stop-circle-fill',
      node: DialogEndNode,
      color: '#cccccc',
      type: NodeType.EXEC_END,
    },
    ...(Object.keys(opOptionsEq) as NodeDescriptorOpEq[]).map((op) => {
      return {
        name: op,
        icon: 'ri-code-line',
        node: DialogOpNode,
        params: {
          operator: op,
        },
        color: '#f7ea84',
        type: NodeType.DATA,
        dataInTypes: null,
        dataOutTypes: [
          {
            Type: AssetPropType.BOOLEAN,
          },
        ],
      };
    }),
    ...(Object.keys(opOptionsCompare) as NodeDescriptorOpCompare[]).map(
      (op) => {
        return {
          name: op,
          icon: 'ri-code-line',
          node: DialogOpNode,
          params: {
            operator: op,
          },
          color: '#f7ea84',
          type: NodeType.DATA,
          dataInTypes: [
            {
              Type: AssetPropType.INTEGER,
            },
            {
              Type: AssetPropType.FLOAT,
            },
            {
              Type: AssetPropType.STRING,
            },
            {
              Type: AssetPropType.TEXT,
            },
          ],
          dataOutTypes: [
            {
              Type: AssetPropType.BOOLEAN,
            },
          ],
        };
      },
    ),
    ...(Object.keys(opOptionsMath) as NodeDescriptorOpMath[]).map((op) => {
      return {
        name: op,
        icon: 'ri-calculator-line',
        node: DialogOpNode,
        params: {
          operator: op,
        },
        color: '#f7ea84',
        type: NodeType.DATA,
        dataInTypes: [
          {
            Type: AssetPropType.INTEGER,
          },
          {
            Type: AssetPropType.FLOAT,
          },
        ],
        dataOutTypes: [
          {
            Type: AssetPropType.INTEGER,
          },
          {
            Type: AssetPropType.FLOAT,
          },
        ],
      };
    }),
    ...(Object.keys(opOptionsLogical) as NodeDescriptorOpLogical[]).map(
      (op) => {
        return {
          name: op,
          icon: 'ri-contrast-fill',
          node: DialogOpNode,
          params: {
            operator: op,
          },
          color: '#f7ea84',
          type: NodeType.DATA,
          dataInTypes: [
            {
              Type: AssetPropType.BOOLEAN,
            },
          ],
          dataOutTypes: [
            {
              Type: AssetPropType.BOOLEAN,
            },
          ],
        };
      },
    ),
    {
      name: 'constBoolean',
      icon: 'ri-circle-line',
      params: {
        dataType: {
          Type: AssetPropType.BOOLEAN,
        },
      },
      node: DialogConstNode,
      color: '#d64848',
      type: NodeType.DATA,
      dataOutTypes: [
        {
          Type: AssetPropType.BOOLEAN,
        },
      ],
    },
    {
      name: 'constFloat',
      icon: 'ri-circle-line',
      params: {
        dataType: {
          Type: AssetPropType.FLOAT,
        },
      },
      node: DialogConstNode,
      color: '#75d255',
      type: NodeType.DATA,
      dataOutTypes: [
        {
          Type: AssetPropType.FLOAT,
        },
      ],
    },
    {
      name: 'constInteger',
      icon: 'ri-circle-line',
      params: {
        dataType: {
          Type: AssetPropType.INTEGER,
        },
      },
      node: DialogConstNode,
      color: '#4ad6de',
      type: NodeType.DATA,
      dataOutTypes: [
        {
          Type: AssetPropType.INTEGER,
        },
      ],
    },
    {
      name: 'constString',
      icon: 'ri-circle-line',
      params: {
        dataType: {
          Type: AssetPropType.STRING,
        },
      },
      node: DialogConstNode,
      color: '#ef53ca',
      type: NodeType.DATA,
      dataOutTypes: [
        {
          Type: AssetPropType.STRING,
        },
      ],
    },
    {
      name: 'constText',
      icon: 'ri-circle-line',
      params: {
        dataType: {
          Type: AssetPropType.TEXT,
        },
      },
      node: DialogConstNode,
      color: '#eb83b0',
      type: NodeType.DATA,
      dataOutTypes: [
        {
          Type: AssetPropType.TEXT,
        },
      ],
    },
    {
      name: 'constAsset',
      icon: 'ri-circle-line',
      params: {
        dataType: {
          Type: AssetPropType.ASSET,
        },
      },
      node: DialogConstNode,
      color: '#f0af55',
      type: NodeType.DATA,
      dataOutTypes: [
        {
          Type: AssetPropType.ASSET,
        },
      ],
    },
  ];
}

export function getNodeDescriptorOfType(type: string): NodeDescriptor | null {
  return getNodeDescriptors().find((desc) => desc.name === type) ?? null;
}
