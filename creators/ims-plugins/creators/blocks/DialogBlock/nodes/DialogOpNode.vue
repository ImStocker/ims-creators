<template>
  <DialogBaseNode
    :node-id="id"
    :dialog-player="dialogPlayer"
    class="DialogOpNode DialogEditorNode"
  >
    <div
      v-if="!sign"
      class="DialogOpNode-header DialogNode-header DialogEditorNode-header"
      :title="$t(`imsDialogEditor.nodes.${nodeDescriptor.name}.description`)"
    >
      <i :class="nodeDescriptor.icon"></i>
      {{ $t(`imsDialogEditor.nodes.${nodeDescriptor.name}.title`) }}
    </div>
    <div class="DialogOpNode-body DialogEditorNode-body">
      <div class="DialogOpNode-content">
        <op-node-type-selector
          v-if="sign && operator === 'opNot'"
          :operator="operator"
          :readonly="readonly"
          class="DialogOpNode-sign"
          @choose="changeType($event)"
        ></op-node-type-selector>
        <DataField
          v-model="arg1Val"
          :in-id="arg1PinId"
          :play-value="arg1PlayVal"
          :prefer-input-type="arg1PreferInputType"
          class="DialogBranchNode-condition"
          :caption="$t('imsDialogEditor.dataFields.value')"
          :node-data-controller="nodeDataController"
          :readonly="readonly"
        ></DataField>
        <template v-if="operator !== 'opNot'">
          <op-node-type-selector
            v-if="sign"
            :operator="operator"
            :readonly="readonly"
            class="DialogOpNode-sign"
            @choose="changeType($event)"
          ></op-node-type-selector>
          <DataField
            v-model="arg2Val"
            :in-id="arg2PinId"
            :play-value="arg2PlayVal"
            :prefer-input-type="arg2PreferInputType"
            class="DialogBranchNode-condition"
            :caption="$t('imsDialogEditor.dataFields.value')"
            :node-data-controller="nodeDataController"
            :readonly="readonly"
          ></DataField>
        </template>
      </div>
      <DataField
        class="DialogOpNode-body-dataOut"
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
import DataField from '../parts/DataField.vue';
import {
  samePinDataTypes,
  type NodeDataController,
} from '../editor/NodeDataController';
import {
  AssetPropType,
  type AssetPropValueType,
} from '~ims-app-base/logic/types/Props';
import { generateDataPinId } from '../editor/DialogEditor';
import type { ScriptBlockPlainPropValue } from '../logic/nodeStoring';
import type { ScriptPlayNode } from '../play/ScriptPlayNode';
import { opOptions } from './getNodeDescriptiors';
import OpNodeTypeSelector from '../parts/OpNodeTypeSelector.vue';
import DialogBaseNode from '../parts/DialogBaseNode.vue';
import type { DialogPlayer } from '../play/DialogPlayer';

export default defineComponent({
  name: 'DialogOpNode',
  components: {
    DataField,
    OpNodeTypeSelector,
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
    selected: {
      type: Boolean,
      required: true,
    },
    operator: {
      type: String,
      required: true,
    },
    nodeDataController: {
      type: Object as PropType<NodeDataController>,
      required: true,
    },
    playingNodeData: {
      type: [Object, null] as PropType<ScriptPlayNode> | null,
      default: null,
    },
  },
  emits: ['change-type'],
  data() {
    return {};
  },
  computed: {
    Position() {
      return Position;
    },
    sign() {
      return opOptions[this.operator] ? opOptions[this.operator].sign : null;
    },
    arg1DataType() {
      return this.nodeDataController.getPinDataType(this.arg1PinId) ?? [];
    },
    arg2DataType() {
      return this.nodeDataController.getPinDataType(this.arg2PinId) ?? [];
    },
    arg1PreferInputType() {
      if (
        !this.nodeDataController.isPinConnected(this.arg1PinId) &&
        this.arg2DataType.length === 1
      ) {
        return this.arg2DataType[0];
      } else return null;
    },
    arg2PreferInputType() {
      if (
        !this.nodeDataController.isPinConnected(this.arg2PinId) &&
        this.arg1DataType.length === 1
      ) {
        return this.arg1DataType[0];
      } else return null;
    },
    arg1PinId() {
      return generateDataPinId(false, 'arg1');
    },
    arg2PinId() {
      return generateDataPinId(false, 'arg2');
    },
    outPinId() {
      return generateDataPinId(true, 'result');
    },
    arg1PlayVal() {
      return this.playingNodeData?.inputs?.arg1 ?? null;
    },
    arg1Val: {
      get() {
        return this.nodeDataController.values['arg1'] ?? null;
      },
      set(val: ScriptBlockPlainPropValue) {
        this.nodeDataController.setValue('arg1', val);
      },
    },
    arg2PlayVal() {
      return this.playingNodeData?.inputs?.arg2 ?? null;
    },
    arg2Val: {
      get() {
        return this.nodeDataController.values['arg2'] ?? null;
      },
      set(val: ScriptBlockPlainPropValue) {
        this.nodeDataController.setValue('arg2', val);
      },
    },
  },
  watch: {
    arg1DataType(newVal, oldVal) {
      if (!samePinDataTypes(newVal, oldVal)) {
        this.updatePins();
      }
    },
    arg2DataType(newVal, oldVal) {
      if (!samePinDataTypes(newVal, oldVal)) {
        this.updatePins();
      }
    },
  },
  mounted() {
    this.updatePins();
  },
  methods: {
    changeType(opName: string) {
      this.$emit('change-type', opName);
    },
    updatePins() {
      let out_type = null as null | AssetPropValueType;
      switch (this.operator) {
        case 'opEqual':
        case 'opNotEqual':
        case 'opLess':
        case 'opLessEqual':
        case 'opMore':
        case 'opMoreEqual': {
          this.nodeDataController.setPinDataType(
            this.arg2PinId,
            this.arg1DataType,
          );
          out_type = {
            Type: AssetPropType.BOOLEAN,
          };
          break;
        }
        case 'opPlus':
        case 'opMinus':
        case 'opMult':
        case 'opDiv':
        case 'opMod': {
          this.nodeDataController.setPinDataType(this.arg1PinId, [
            { Type: AssetPropType.INTEGER },
            { Type: AssetPropType.FLOAT },
          ]);
          this.nodeDataController.setPinDataType(this.arg2PinId, [
            { Type: AssetPropType.INTEGER },
            { Type: AssetPropType.FLOAT },
          ]);
          const arg1Type =
            this.arg1DataType && this.arg1DataType.length === 1
              ? this.arg1DataType[0].Type
              : null;
          const arg2Type =
            this.arg2DataType && this.arg2DataType.length === 1
              ? this.arg2DataType[0].Type
              : null;

          if (
            arg1Type &&
            [AssetPropType.INTEGER, AssetPropType.FLOAT].includes(arg1Type) &&
            !arg2Type
          ) {
            out_type = this.arg1DataType[0];
          } else if (
            arg2Type &&
            [AssetPropType.INTEGER, AssetPropType.FLOAT].includes(arg2Type) &&
            !arg1Type
          ) {
            out_type = this.arg2DataType[0];
          } else if (
            arg1Type &&
            [AssetPropType.INTEGER, AssetPropType.FLOAT].includes(arg1Type) &&
            arg2Type &&
            [AssetPropType.INTEGER, AssetPropType.FLOAT].includes(arg2Type)
          ) {
            if (arg2Type === AssetPropType.FLOAT) {
              out_type = this.arg2DataType[0];
            } else {
              out_type = this.arg1DataType[0];
            }
          }
          break;
        }
        case 'opAnd':
        case 'opOr':
        case 'opNot': {
          this.nodeDataController.setPinDataType(
            this.arg2PinId,
            this.arg1DataType,
          );
          out_type = {
            Type: AssetPropType.BOOLEAN,
          };
          break;
        }
      }
      this.nodeDataController.setPinDataType(this.outPinId, out_type);
    },
  },
});
</script>

<style lang="scss" scoped>
.DialogOpNode-body {
  padding: 7px 0;
  padding-right: 10px;
}
.DialogOpNode-addOption {
  font-weight: bold;
  font-size: 12px;
}
.DialogOpNode-body-dataOut {
  position: absolute;
  top: 50%;
  right: 0;
  transform: translate(50%, -50%);
}
</style>
