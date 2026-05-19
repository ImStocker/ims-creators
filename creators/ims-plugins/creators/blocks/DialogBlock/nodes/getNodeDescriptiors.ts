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
import {
  playDataComputeOpFabric,
  playDataComputeGetVar,
  playDataComputeTrigger,
  playDataComputeConstBoolean,
  playDataComputeConstFloat,
  playDataComputeConstInteger,
  playDataComputeConstString,
  playDataComputeConstText,
  playDataComputeConstAsset,
} from '../play/playDataComputeFunctions';
import {
  playNodeExecuteBranch,
  playNodeExecuteSetVar,
} from '../play/playNodeExecuteFunctions';
import type { DialogBlockController } from '../editor/DialogBlockController';
import { ScriptBlockPlainActionTypes } from '../logic/nodeStoring';
import type { NodeDataController } from '../editor/NodeDataController';
import DialogManager from '~ims-app-base/logic/managers/DialogManager';
import EnterActionDialog from '../dialogs/EnterActionDialog.vue';
import type { IProjectContext } from '~ims-app-base/logic/types/IProjectContext';
import DialogCallScriptNode from './DialogCallScriptNode.vue';

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
      playNodeExecute: playNodeExecuteBranch,
    },
    {
      name: 'trigger',
      icon: 'ri-flashlight-line',
      node: DialogTriggerNode,
      color: '#ea9595',
      type: NodeType.EXEC,
      playDataCompute: playDataComputeTrigger,
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
      type: NodeType.EXEC,
      playDataCompute: playDataComputeTrigger,
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
      color: '#afb2ff',
      type: NodeType.EXEC,
    },
    /*{
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
    },*/
    {
      name: 'setVar',
      icon: 'ri-edit-fill',
      node: DialogSetVarNode,
      color: '#afb2ff',
      type: NodeType.EXEC,
      dataInTypes: null,
      playNodeExecute: playNodeExecuteSetVar,
    },
    {
      name: 'getVar',
      icon: 'ri-terminal-line',
      node: DialogGetVarNode,
      color: '#afb2ff',
      type: NodeType.DATA_START,
      dataOutTypes: null,
      playDataCompute: playDataComputeGetVar,
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
        playDataCompute: playDataComputeOpFabric(op),
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
          playDataCompute: playDataComputeOpFabric(op),
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
        playDataCompute: playDataComputeOpFabric(op),
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
          playDataCompute: playDataComputeOpFabric(op),
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
      playDataCompute: playDataComputeConstBoolean,
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
      playDataCompute: playDataComputeConstFloat,
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
      playDataCompute: playDataComputeConstInteger,
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
      playDataCompute: playDataComputeConstString,
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
      playDataCompute: playDataComputeConstText,
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
      playDataCompute: playDataComputeConstAsset,
    },
  ];
}

export function getNodeDescriptorOfType(type: string): NodeDescriptor | null {
  return getNodeDescriptors().find((desc) => desc.name === type) ?? null;
}
