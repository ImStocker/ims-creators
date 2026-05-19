<template>
  <ContextMenuZone
    class="DialogActionNode DialogEditorNode"
    :menu-list="contextMenu"
  >
    <div
      class="DialogActionNode-header DialogNode-header DialogEditorNode-header"
      :title="$t(`imsDialogEditor.nodes.${nodeDescriptor.name}.description`)"
    >
      <i :class="nodeDescriptor.icon"></i>
      {{ $t(`imsDialogEditor.nodes.${nodeDescriptor.name}.title`) }}
    </div>
    <div class="DialogActionNode-body DialogEditorNode-body">
      <div class="DialogActionNode-body-main">
        <ExecHandle
          v-if="nodeDescriptor.type === NodeType.EXEC"
          id="in"
          type="target"
          :position="Position.Left"
        />
        <div class="DialogActionNode-content">
          <action-selector
            v-model="actionVal"
            :dialog-controller="dialogController"
            :readonly="readonly"
            :action-type="actionType"
          ></action-selector>
        </div>
        <ExecHandle
          v-if="nodeDescriptor.type === NodeType.EXEC"
          id="out"
          type="source"
          :position="Position.Right"
        />
      </div>
      <node-parameters-grid
        :dialog-player="dialogPlayer"
        :node-data-controller="nodeDataController"
        :readonly="readonly"
        :output-params="outputParameters"
        :input-params="inputParameters"
        :play-wait-user="playWaitUser"
        :playing-node-data="playingNodeData"
        :wrong-parameter-names="wrongParameterNames"
        :get-parameter-context-menu="getParameterContextMenu"
      ></node-parameters-grid>
      <div v-if="playWaitUser" class="DialogActionNode-play">
        <button class="is-button" @click="dialogPlayer.playChoose(null)">
          {{ $t('imsDialogEditor.play.continue') }}
        </button>
      </div>
    </div>
  </ContextMenuZone>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { Position } from '@vue-flow/core';
import ExecHandle from '../parts/ExecHandle.vue';
import type { NodeDataController } from '../editor/NodeDataController';
import {
  AssetPropType,
  castAssetPropValueToString,
} from '~ims-app-base/logic/types/Props';
import ContextMenuZone from '~ims-app-base/components/Common/ContextMenuZone.vue';
import type {
  DialogBlockController,
  DialogVariable,
} from '../editor/DialogBlockController';
import DialogManager from '~ims-app-base/logic/managers/DialogManager';
import {
  nodeVariableAdd,
  nodeVariableChange,
  nodeVariableDuplicate,
} from '../logic/nodeVariables';
import ConfirmDialog from '~ims-app-base/components/Common/ConfirmDialog.vue';
import { generateDataPinId } from '../editor/DialogEditor';
import { ScriptBlockPlainActionTypes } from '../logic/nodeStoring';
import type { ScriptPlayNode } from '../play/ScriptPlayNode';
import type { DialogPlayer } from '../play/DialogPlayer';
import ActionSelector from '../parts/ActionSelector.vue';
import { NodeType, type NodeDescriptor } from '../nodes/NodeDescriptor';
import NodeParametersGrid from './NodeParametersGrid.vue';

export default defineComponent({
  name: 'DialogActionNode',
  components: {
    ExecHandle,
    ContextMenuZone,
    NodeParametersGrid,
    ActionSelector,
  },
  inject: ['projectContext'],
  props: {
    id: {
      type: String,
      required: true,
    },
    nodeDescriptor: {
      type: Object as PropType<NodeDescriptor>,
      required: true,
    },
    nodeDataController: {
      type: Object as PropType<NodeDataController>,
      required: true,
    },
    selected: {
      type: Boolean,
      required: true,
    },
    dialogController: {
      type: Object as PropType<DialogBlockController>,
      required: true,
    },
    readonly: {
      type: Boolean,
      default: false,
    },
    playingNodeData: {
      type: [Object, null] as PropType<ScriptPlayNode> | null,
      default: null,
    },
    dialogPlayer: {
      type: Object as PropType<DialogPlayer>,
      required: true,
    },
    actionType: {
      type: String as PropType<ScriptBlockPlainActionTypes>,
      required: true,
    },
  },
  data() {
    return {
      wrongParameterNames: new Set<string>(),
    };
  },
  computed: {
    Position() {
      return Position;
    },
    NodeType() {
      return NodeType;
    },
    AssetPropType() {
      return AssetPropType;
    },
    ScriptBlockPlainActionTypes() {
      return ScriptBlockPlainActionTypes;
    },
    playWaitUser() {
      return (
        this.dialogPlayer.currentPlayingNode?.id === this.id &&
        this.outputParameters.length > 0 &&
        this.nodeDescriptor.type === NodeType.EXEC
      );
    },
    actionVal: {
      get(): string {
        return (
          castAssetPropValueToString(this.nodeDataController.subject) ?? null
        );
      },
      set(val: string) {
        this.nodeDataController.setSubject(val);
      },
    },
    contextMenu() {
      if (this.readonly) return [];
      if (!this.action)
        return [
          {
            title: this.$t(
              `imsDialogEditor.nodes.${this.nodeDescriptor.name}.manageCaption`,
            ),
            action: () => {
              this.dialogController.manageActions(
                this.projectContext as any,
                this.actionType,
              );
            },
          },
        ];
      return [
        {
          title: this.$t('imsDialogEditor.trigger.addInputParameter'),
          action: () => this.addParameter(false),
          icon: 'ri-arrow-right-circle-fill',
        },
        {
          title: this.$t('imsDialogEditor.trigger.addOutputParameter'),
          action: () => this.addParameter(true),
          icon: 'ri-arrow-left-circle-line',
        },
      ];
    },
    inputParameters(): DialogVariable[] {
      const res: DialogVariable[] = [];

      for (const legacy_param of this.nodeDataController.params['in'] ?? []) {
        res.push(legacy_param);
        this.wrongParameterNames.add('in-' + legacy_param.name);
      }

      if (this.actionVal) {
        const existing_action = this.dialogController
          .getActions()
          .find((a) => a.name === this.actionVal);
        if (existing_action) {
          for (const param of existing_action.params?.['in'] ?? []) {
            res.push(param);
            if (this.wrongParameterNames.has('in-' + param.name)) {
              this.wrongParameterNames.delete(param.name);
            }
          }
        }
      }

      if (this.nodeDataController.values) {
        for (const value of Object.keys(this.nodeDataController.values)) {
          if (
            !res.find((v) => v.name === value) &&
            this.nodeDataController.values[value] &&
            this.nodeDataController.values[value]['get']
          ) {
            res.push({
              name: value,
              title: value,
              default: null,
              description: null,
              type: null,
            });
            this.wrongParameterNames.add('in-' + value);
          }
        }
      }
      return res;
    },
    outputParameters(): DialogVariable[] {
      const res: DialogVariable[] = [];

      for (const legacy_param of this.nodeDataController.params['out'] ?? []) {
        res.push(legacy_param);
        this.wrongParameterNames.add('out-' + legacy_param.name);
      }

      if (this.actionVal) {
        const existing_action = this.dialogController
          .getActions()
          .find((a) => a.name === this.actionVal);
        if (existing_action) {
          for (const param of existing_action.params?.['out'] ?? []) {
            res.push(param);
            if (this.wrongParameterNames.has('out-' + param.name)) {
              this.wrongParameterNames.delete(param.name);
            }
          }
        }
      }

      return res;
    },
    action() {
      return this.dialogController
        .getActions()
        .find((el) => el.name === this.actionVal);
    },
  },
  watch: {
    actionVal() {
      this.wrongParameterNames = new Set();
    },
  },

  methods: {
    generateDataPinId,
    async addParameter(is_out: boolean) {
      const new_variable = await nodeVariableAdd(
        this.$getAppManager(),
        this[is_out ? 'outputParameters' : 'inputParameters'],
        {
          alreadyExist: this.$t(
            'imsDialogEditor.trigger.parameterAlreadyExists',
          ),
        },
      );
      if (!new_variable) return;
      const key = is_out ? 'out' : 'in';
      if (this.action) {
        const modified_action = this.action;
        if (!modified_action.params) {
          modified_action.params = { in: [], out: [] };
        }
        modified_action.params[key].push(new_variable);
        this.dialogController.changeAction(this.action.name, modified_action);
      } else {
        this.nodeDataController.addParam(key, new_variable);
      }
    },
    async deleteParameter(param: DialogVariable, is_out: boolean) {
      const confirm = await this.$getAppManager()
        .get(DialogManager)
        .show(ConfirmDialog, {
          header: this.$t('imsDialogEditor.trigger.deleteParameter'),
          message: this.$t('imsDialogEditor.trigger.deleteParameterConfirm'),
          danger: true,
        });
      if (!confirm) return;
      const key = is_out ? 'out' : 'in';

      if (this.action) {
        const modified_action = this.action;
        const existing_var_index = modified_action.params?.[key]?.findIndex(
          (el) => el.name === param.name,
        );
        if (existing_var_index !== undefined && existing_var_index >= 0) {
          modified_action.params![key].splice(existing_var_index, 1);
          this.dialogController.changeAction(this.action.name, modified_action);
        }
      }

      this.nodeDataController.deleteParam(key, param.name);
      this.nodeDataController.deleteValue(param.name);
    },
    async changeParameter(param: DialogVariable, is_out: boolean) {
      const new_variable = await nodeVariableChange(
        this.$getAppManager(),
        this[is_out ? 'outputParameters' : 'inputParameters'],
        param,
        {
          alreadyExist: this.$t(
            'imsDialogEditor.trigger.parameterAlreadyExists',
          ),
        },
      );
      if (!new_variable) return;
      const key = is_out ? 'out' : 'in';

      if (this.action) {
        const modified_action = this.action;
        const existing_var_index = modified_action.params?.[key]?.findIndex(
          (el) => el.name === param.name,
        );
        if (existing_var_index !== undefined && existing_var_index >= 0) {
          modified_action.params![key][existing_var_index] = new_variable;
          this.dialogController.changeAction(this.action.name, modified_action);
        }
      }

      this.nodeDataController.changeParam(
        is_out ? 'out' : 'in',
        param.name,
        new_variable,
      );
    },
    async duplicateParameter(param: DialogVariable, is_out: boolean) {
      const new_variable = await nodeVariableDuplicate(
        this.$getAppManager(),
        this[is_out ? 'outputParameters' : 'inputParameters'],
        param,
        {
          alreadyExist: this.$t(
            'imsDialogEditor.trigger.parameterAlreadyExists',
          ),
        },
      );
      if (!new_variable) return;
      this.nodeDataController.addParam(is_out ? 'out' : 'in', new_variable);
    },
    getParameterContextMenu(param: DialogVariable, is_out: boolean) {
      if (this.readonly) return [];
      return [
        {
          icon: 'edit',
          title: this.$t('imsDialogEditor.trigger.changeParameter'),
          action: () => this.changeParameter(param, is_out),
        },
        {
          icon: 'copy',
          title: this.$t('imsDialogEditor.trigger.duplicateParameter'),
          action: () => this.duplicateParameter(param, is_out),
        },
        {
          icon: 'delete',
          title: this.$t('imsDialogEditor.trigger.deleteParameter'),
          action: () => this.deleteParameter(param, is_out),
          danger: true,
        },
      ];
    },
  },
});
</script>

<style lang="scss" scoped>
.DialogActionNode-content {
  &:deep(.ImsSelect) {
    min-width: 150px;
  }
  &:not(:hover):deep(
      .DataField-in:not(.state-connected),
      .DataField-out:not(.state-connected)
    ) {
    opacity: 0;
  }
}

.DialogActionNode-header {
  padding: 7px 10px;
  font-size: 14px;
}
.DialogActionNode-body-main {
  --local-text-color: var(--imsde-node-content-text-color);
  // --input-bg-color: transparent;
  // --input-border-color: transparent;
  --input-text-color: var(--imsde-node-content-text-color);
  padding: 7px 10px;
  position: relative;
}
.DialogActionNode-addOption {
  font-weight: bold;
  font-size: 12px;
}

.DialogActionNode-text {
  background: transparent;
  border: none;
  color: var(--local-text-color);
  max-width: 600px;
  min-width: 150px;
}

.DialogActionNode:deep(.DataFieldInput-string) {
  min-width: 100px;
}

.DialogActionNode-play {
  text-align: center;
  padding-top: 10px;
  padding-bottom: 10px;
  border-top: 1px solid var(--imsde-node-playing-color);
  & > .is-button {
    --button-border-color: var(--imsde-node-playing-color);
    &:not(:hover) {
      --button-text-color: var(--imsde-node-playing-color);
    }
    &:hover {
      --button-bg-color: var(--imsde-node-playing-color);
    }
  }
}
</style>
