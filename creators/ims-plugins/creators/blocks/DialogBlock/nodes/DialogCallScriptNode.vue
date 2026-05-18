<template>
  <div class="DialogCallScriptNode DialogEditorNode">
    <div
      class="DialogCallScriptNode-header DialogNode-header DialogEditorNode-header"
      :title="$t(`imsDialogEditor.nodes.${nodeDescriptor.name}.description`)"
    >
      <i :class="nodeDescriptor.icon"></i>
      {{ $t(`imsDialogEditor.nodes.${nodeDescriptor.name}.title`) }}
    </div>
    <div class="DialogCallScriptNode-body DialogEditorNode-body">
      <div v-if="loading" class="DialogCallScriptNode-loading">
        <div class="loaderSpinner"></div>
      </div>
      <div class="DialogCallScriptNode-body-main">
        <ExecHandle id="in" type="target" :position="Position.Left" />
        <div class="DialogCallScriptNode-content">
          <select-asset-combo-box
            class="VariableTypeSelector-selectAsset"
            :model-value="externalScriptForSelection"
            :where="selectAssetWhere"
            @update:model-value="selectExternalAsset"
          >
          </select-asset-combo-box>
        </div>
        <ExecHandle id="out" type="source" :position="Position.Right" />
      </div>
      <div
        v-if="inputParameters.length > 0 || outputParameters.length > 0"
        class="DialogCallScriptNode-parameters"
      >
        <ContextMenuZone
          v-for="param_gr of parametersGrid"
          :key="(param_gr.isOutput ? 'out-' : 'in-') + param_gr.variable.name"
          class="DialogCallScriptNode-parameters-one"
          :class="param_gr.isOutput ? 'type-output' : 'type-input'"
          :menu-list="
            getParameterContextMenu(param_gr.variable, param_gr.isOutput)
          "
        >
          <DataField
            :in-id="
              !param_gr.isOutput
                ? generateDataPinId(false, param_gr.variable.name)
                : ''
            "
            :out-id="
              param_gr.isOutput
                ? generateDataPinId(true, param_gr.variable.name)
                : ''
            "
            :model-value="
              !param_gr.isOutput
                ? nodeDataController.values[param_gr.variable.name] ===
                  undefined
                  ? param_gr.variable.default
                  : nodeDataController.values[param_gr.variable.name]
                : null
            "
            :play-value="
              !param_gr.isOutput
                ? playingNodeData?.values
                  ? playingNodeData?.values[param_gr.variable.name]
                  : null
                : dialogPlayer.playGetCurrentNodeParam(param_gr.variable.name)
            "
            :caption="param_gr.variable.title"
            :node-data-controller="nodeDataController"
            :title="param_gr.variable.description ?? ''"
            :readonly="readonly"
            :play-value-set="false"
            @update:play-value="
              dialogPlayer.playSetCurrentNodeParam(
                param_gr.variable.name,
                $event,
              )
            "
            @update:model-value="
              setParamValue(param_gr.variable, param_gr.isOutput, $event)
            "
          ></DataField>
          <div
            v-if="
              wrongParameterNames.has(
                (param_gr.isOutput ? 'out-' : 'in-') + param_gr.variable.name,
              )
            "
            :title="$t('imsDialogEditor.callScript.wrongParameter')"
            class="DialogCallScriptNode-badParam"
          >
            <i class="ri-error-warning-fill"></i>
          </div>
        </ContextMenuZone>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { NodeDescriptor } from './NodeDescriptor';
import type { NodeDataController } from '../editor/NodeDataController';
import {
  DialogBlockController,
  type DialogVariable,
} from '../editor/DialogBlockController';
import type { ScriptPlayNode } from '../play/ScriptPlayNode';
import type { DialogPlayer } from '../play/DialogPlayer';
import type {
  ScriptBlockPlainActionTypes,
  ScriptBlockPlainPropValue,
} from '../logic/nodeStoring';
import { Position } from '@vue-flow/core';
import ExecHandle from '../parts/ExecHandle.vue';
import SelectAssetComboBox from '~ims-app-base/components/Asset/SelectAssetComboBox.vue';
import ProjectManager from '~ims-app-base/logic/managers/ProjectManager';
import type { AssetPropWhere } from '~ims-app-base/logic/types/PropsWhere';
import { SCRIPT_ASSET_ID } from '~ims-app-base/logic/constants';
import type { AssetForSelection } from '~ims-app-base/logic/types/AssetsType';
import CreatorAssetManager from '~ims-app-base/logic/managers/CreatorAssetManager';
import { AssetBlockEditorVM } from '~ims-app-base/logic/vm/AssetBlockEditorVM';
import { generateDataPinId } from '../editor/DialogEditor';
import {
  castAssetPropValueToAsset,
  type AssetPropValueAsset,
} from '~ims-app-base/logic/types/Props';
import ContextMenuZone from '~ims-app-base/components/Common/ContextMenuZone.vue';
import DataField from '../parts/DataField.vue';
import {
  nodeVariableChange,
  nodeVariableDuplicate,
} from '../logic/nodeVariables';
import DialogManager from '~ims-app-base/logic/managers/DialogManager';
import ConfirmDialog from '~ims-app-base/components/Common/ConfirmDialog.vue';
import UiManager from '../../../../../../ims-app-base/app/logic/managers/UiManager';

export default defineComponent({
  name: 'DialogCallScriptNode',
  components: {
    ExecHandle,
    SelectAssetComboBox,
    ContextMenuZone,
    DataField,
  },
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
      calledScript: null as AssetForSelection | null,
      calledScriptController: null as null | DialogBlockController,
      loading: false,
      wrongParameterNames: new Set<string>(),
    };
  },
  computed: {
    parametersGrid(): {
      variable: DialogVariable;
      isOutput: boolean;
      index: number;
    }[] {
      const res: {
        variable: DialogVariable;
        isOutput: boolean;
        index: number;
      }[] = [];
      for (
        let i = 0;
        i < Math.max(this.inputParameters.length, this.outputParameters.length);
        i++
      ) {
        if (i < this.inputParameters.length) {
          res.push({
            variable: this.inputParameters[i],
            isOutput: false,
            index: i,
          });
        }
        if (i < this.outputParameters.length) {
          res.push({
            variable: this.outputParameters[i],
            isOutput: true,
            index: i,
          });
        }
      }
      return res;
    },
    externalScriptForSelection() {
      if (!this.externalScript) return null;
      return {
        id: this.externalScript.AssetId,
        name: this.externalScript.Name,
        title: this.externalScript.Title,
        icon: null,
      };
    },
    externalScript: {
      get(): AssetPropValueAsset | null {
        return this.nodeDataController.subject
          ? castAssetPropValueToAsset(this.nodeDataController.subject)
          : null;
      },
      set(val: AssetPropValueAsset) {
        this.nodeDataController.setSubject(val);
      },
    },
    Position() {
      return Position;
    },
    inputParameters(): DialogVariable[] {
      const res: DialogVariable[] = [];

      if (this.calledScriptController) {
        const variables = this.calledScriptController.getVariables();
        const in_params = variables.filter(
          (el) => el.kind && ['in', 'in-out'].includes(el.kind),
        );
        if (in_params) {
          for (const param of in_params) {
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

      if (this.calledScriptController) {
        const variables = this.calledScriptController.getVariables();
        const out_params = Object.values(variables).filter(
          (el) => el.kind && ['out', 'in-out'].includes(el.kind),
        );
        if (out_params) {
          for (const param of out_params) {
            res.push(param);
            if (this.wrongParameterNames.has('out-' + param.name)) {
              this.wrongParameterNames.delete(param.name);
            }
          }
        }
      }
      return res;
    },
    selectAssetWhere(): AssetPropWhere {
      const res: AssetPropWhere = {
        workspaceids:
          this.$getAppManager()
            .get(ProjectManager)
            .getWorkspaceIdByName('gdd') ?? null,
        typeids: [SCRIPT_ASSET_ID],
      };
      return res;
    },
  },
  watch: {
    externalScript: {
      async handler(val: AssetPropValueAsset | null) {
        if (val) {
          await this.loadExternalScript(val);
        } else {
          this.externalScript = null;
          this.calledScriptController = null;
        }
        this.wrongParameterNames = new Set();
      },
      immediate: true,
    },
    parametersGrid() {
      this.updatePins();
    },
  },
  mounted() {
    this.updatePins();
  },
  methods: {
    generateDataPinId,
    updatePins() {
      for (let i = 0; i < this.inputParameters.length; i++) {
        this.nodeDataController.setPinDataType(
          generateDataPinId(false, this.inputParameters[i].name),
          this.inputParameters[i].type,
        );
      }
      for (let i = 0; i < this.outputParameters.length; i++) {
        this.nodeDataController.setPinDataType(
          generateDataPinId(true, this.outputParameters[i].name),
          this.outputParameters[i].type,
        );
      }
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
      if (this.calledScriptController) {
        this.calledScriptController.changeVariable(param.name, new_variable);
      }
      this.nodeDataController.changeParam(
        is_out ? 'out' : 'in',
        param.name,
        new_variable,
      );
      this.updatePins();
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
      this.updatePins();
    },
    getParameterContextMenu(_param: DialogVariable, _is_out: boolean) {
      if (this.readonly) return [];
      return [];
      // TODO:
      // return [
      //   {
      //     icon: 'edit',
      //     title: this.$t('imsDialogEditor.trigger.changeParameter'),
      //     action: () => this.changeParameter(param, is_out),
      //   },
      //   {
      //     icon: 'copy',
      //     title: this.$t('imsDialogEditor.trigger.duplicateParameter'),
      //     action: () => this.duplicateParameter(param, is_out),
      //   },
      //   {
      //     icon: 'delete',
      //     title: this.$t('imsDialogEditor.trigger.deleteParameter'),
      //     action: () => this.deleteParameter(param, is_out),
      //     danger: true,
      //   },
      // ];
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

      // if (this.action) {
      //   const modified_action = this.action;
      //   const existing_var_index = modified_action.params?.[key]?.findIndex(
      //     (el) => el.name === param.name,
      //   );
      //   if (existing_var_index !== undefined && existing_var_index >= 0) {
      //     modified_action.params![key].splice(existing_var_index, 1);
      //     this.dialogController.changeAction(this.action.name, modified_action);
      //   }
      // }

      this.nodeDataController.deleteParam(key, param.name);

      this.updatePins();
    },
    setParamValue(
      param: DialogVariable,
      is_out: boolean,
      val: ScriptBlockPlainPropValue,
    ) {
      if (is_out) return;
      this.nodeDataController.setValue(param.name, val);
    },
    selectExternalAsset(val: AssetForSelection | null) {
      this.externalScript = val
        ? {
            AssetId: val.id,
            Title: val.title ?? '',
            Name: val.name,
          }
        : null;
    },
    async loadExternalScript(val: AssetPropValueAsset) {
      try {
        this.loading = true;
        const asset_full = await this.$getAppManager()
          .get(CreatorAssetManager)
          .getAssetInstance(val.AssetId);
        if (!asset_full) return;
        asset_full.activate();
        const asset_block_editor = AssetBlockEditorVM.CreateInstance(
          this.$getAppManager(),
          asset_full,
        );
        const controller = new DialogBlockController(
          this.$getAppManager(),
          () =>
            asset_block_editor
              .resolveBlocks()
              .list.find((el) => el.name === 'content') ?? null,
        );
        controller.postCreate();
        controller.mountEditor(asset_block_editor);

        this.calledScriptController = controller;
      } catch (err: any) {
        this.$getAppManager().get(UiManager).showError(err);
      } finally {
        this.loading = false;
      }
    },
  },
});
</script>
<style lang="scss" scoped>
.DialogCallScriptNode-content {
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
.DialogCallScriptNode-header {
  padding: 7px 10px;
  font-size: 14px;
}
.DialogCallScriptNode-body {
  position: relative;
}
.DialogCallScriptNode-loading {
  position: absolute;
  z-index: 2;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
}
.DialogCallScriptNode-body-main {
  padding: 7px 10px;
  position: relative;
  --local-text-color: var(--imsde-node-content-text-color);
  --input-text-color: var(--imsde-node-content-text-color);
}
.DialogCallScriptNode-parameters {
  padding-bottom: 5px;
  display: grid;
  gap: 10px;
  align-items: center;
  border-top: 1px solid var(--imsde-node-content-inner-border-color);
  padding-top: 10px;
}
.DialogCallScriptNode-parameters-one {
  margin-bottom: 5px;
  display: flex;
  align-items: baseline;
  &.type-input {
    grid-column: 1;
  }
  &.type-output {
    flex-direction: row-reverse;
    grid-column: 2;
    justify-self: flex-end;
  }
}
.DialogCallScriptNode-badParam {
  display: inline-block;
  color: var(--color-warning);
}
</style>
