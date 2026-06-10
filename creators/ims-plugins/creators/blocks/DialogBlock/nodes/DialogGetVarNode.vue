<template>
  <DialogBaseNode
    :node-id="id"
    :dialog-player="dialogPlayer"
    class="DialogGetVarNode DialogEditorNode"
  >
    <div
      class="DialogGetVarNode-header DialogNode-header DialogEditorNode-header"
      :title="$t(`imsDialogEditor.nodes.${nodeDescriptor.name}.description`)"
    >
      <i :class="nodeDescriptor.icon"></i>
      {{ $t(`imsDialogEditor.nodes.${nodeDescriptor.name}.title`) }}
    </div>
    <div class="DialogGetVarNode-body DialogEditorNode-body">
      <div class="DialogGetVarNode-content">
        <variable-selector
          :dialog-controller="dialogController"
          :model-value="variable"
          :readonly="readonly"
          @update:model-value="setVariable($event)"
        ></variable-selector>
      </div>
      <DataField
        class="DialogGetVarNode-body-dataOut"
        :out-id="outPinId"
        :node-data-controller="nodeDataController"
      />
    </div>
  </DialogBaseNode>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { Position } from '@vue-flow/core';
import type { NodeDescriptor } from './NodeDescriptor';
import type { NodeDataController } from '../editor/NodeDataController';
import type {
  DialogBlockController,
  DialogVariable,
} from '../editor/DialogBlockController';
import VariableSelector from '../parts/VariableSelector.vue';
import DataField from '../parts/DataField.vue';
import { generateDataPinId } from '../editor/DialogEditor';
import {
  castAssetPropValueToString,
  type AssetPropValue,
} from '~ims-app-base/logic/types/Props';
import type { ScriptBlockPlainPropValueBind } from '../logic/nodeStoring';
import DialogBaseNode from '../parts/DialogBaseNode.vue';
import type { DialogPlayer } from '../play/DialogPlayer';

export default defineComponent({
  name: 'DialogGetVarNode',
  components: {
    DataField,
    VariableSelector,
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
    nodeDescriptor: {
      type: Object as PropType<NodeDescriptor>,
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
    nodeDataController: {
      type: Object as PropType<NodeDataController>,
      required: true,
    },
    readonly: {
      type: Boolean,
      default: false,
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
    outPinId() {
      return generateDataPinId(true, 'result');
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
        this.outPinId,
        this.variable ? this.variable.type : null,
      );
    },
  },
});
</script>

<style lang="scss" scoped>
.DialogGetVarNode-header {
  padding: 7px 10px;
  font-size: 14px;
}
.DialogGetVarNode-body {
  padding: 7px 10px;
  position: relative;
}
.DialogGetVarNode-addOption {
  font-weight: bold;
  font-size: 12px;
}

.DialogGetVarNode-body-dataOut {
  position: absolute;
  top: 50%;
  right: 0;
  transform: translate(50%, -50%);
}
</style>
