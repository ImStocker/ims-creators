<template>
  <DialogBaseNode
    :node-id="id"
    :dialog-player="dialogPlayer"
    class="DialogSetVarNode DialogEditorNode"
  >
    <div
      class="DialogSetVarNode-header DialogNode-header DialogEditorNode-header"
      :title="$t(`imsDialogEditor.nodes.${nodeDescriptor.name}.description`)"
    >
      <i :class="nodeDescriptor.icon"></i>
      {{ $t(`imsDialogEditor.nodes.${nodeDescriptor.name}.title`) }}
    </div>
    <div class="DialogSetVarNode-body DialogEditorNode-body">
      <ExecHandle id="in" type="target" :position="Position.Left" />
      <div class="DialogSetVarNode-content">
        <variable-selector
          class="DialogSetVarNode-variable"
          :dialog-controller="dialogController"
          :model-value="variable"
          :readonly="readonly"
          @update:model-value="setVariable($event)"
        ></variable-selector>
        <DataField
          v-model="valueVal"
          :in-id="valuePinId"
          :play-value="valuePlayVal"
          class="DialogSetVarNode-value"
          :caption="$t('imsDialogEditor.dataFields.value')"
          :node-data-controller="nodeDataController"
          :readonly="readonly"
        ></DataField>
      </div>
      <ExecHandle id="out" type="source" :position="Position.Right" />
    </div>
  </DialogBaseNode>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { Position } from '@vue-flow/core';
import type { NodeDescriptor } from './NodeDescriptor';
import ExecHandle from '../parts/ExecHandle.vue';
import VariableSelector from '../parts/VariableSelector.vue';
import type {
  DialogBlockController,
  DialogVariable,
} from '../editor/DialogBlockController';
import type { NodeDataController } from '../editor/NodeDataController';
import DataField from '../parts/DataField.vue';
import { generateDataPinId } from '../editor/DialogEditor';
import type {
  ScriptBlockPlainPropValue,
  ScriptBlockPlainPropValueBind,
} from '../logic/nodeStoring';
import {
  castAssetPropValueToString,
  type AssetPropValue,
} from '~ims-app-base/logic/types/Props';
import type { ScriptPlayNode } from '../play/ScriptPlayNode';
import type { DialogPlayer } from '../play/DialogPlayer';
import DialogBaseNode from '../parts/DialogBaseNode.vue';

export default defineComponent({
  name: 'DialogSetVarNode',
  components: {
    ExecHandle,
    VariableSelector,
    DataField,
    DialogBaseNode,
  },
  props: {
    id: {
      type: String,
      required: true,
    },
    dialogPlayer: {
      type: Object as PropType<DialogPlayer>,
      required: true,
    },
    readonly: {
      type: Boolean,
      default: false,
    },
    nodeDescriptor: {
      type: Object as PropType<NodeDescriptor>,
      required: true,
    },
    dialogController: {
      type: Object as PropType<DialogBlockController>,
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
    playingNodeData: {
      type: [Object, null] as PropType<ScriptPlayNode> | null,
      default: null,
    },
  },
  computed: {
    Position() {
      return Position;
    },
    variableName: {
      get(): string | null {
        const val = this.nodeDataController.values['variable'];
        if (val && (val as ScriptBlockPlainPropValueBind).get !== undefined) {
          return null;
        }
        return castAssetPropValueToString(val as AssetPropValue) ?? null;
      },
      set(val: string) {
        this.nodeDataController.setValue('variable', val);
      },
    },
    variable(): DialogVariable | null {
      if (!this.variableName) return null;
      const exist_variable = this.dialogController
        .getVariables()
        .find((x) => x.name === this.variableName);
      if (exist_variable) return exist_variable;
      return {
        title: this.variableName,
        name: this.variableName,
        type: null,
        description: null,
        default: null,
      };
    },
    valuePinId() {
      return generateDataPinId(false, 'value');
    },
    valuePlayVal() {
      return this.playingNodeData?.inputs?.value ?? null;
    },
    valueVal: {
      get() {
        return this.nodeDataController.values['value'] ?? null;
      },
      set(val: ScriptBlockPlainPropValue) {
        this.nodeDataController.setValue('value', val);
      },
    },
  },
  watch: {
    variable() {
      this.updatePins();
    },
  },
  mounted() {
    this.updatePins();
  },
  methods: {
    setVariable(variable: DialogVariable) {
      this.variableName = variable ? variable.name : null;
    },
    updatePins() {
      this.nodeDataController.setPinDataType(
        this.valuePinId,
        this.variable ? this.variable.type : null,
      );
    },
  },
});
</script>

<style lang="scss" scoped>
.DialogSetVarNode-header {
  padding: 7px 10px;
  font-size: 14px;
}
.DialogSetVarNode-body {
  padding: 7px 10px;
}
.DialogSetVarNode-addOption {
  font-weight: bold;
  font-size: 12px;
}
.DialogSetVarNode-value {
  margin-left: -10px;
  margin-top: 10px;
}
</style>
