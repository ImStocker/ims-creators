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
import type { NodeDataController } from '../editor/NodeDataController';
import {
  AssetPropType,
  type AssetPropValueType,
} from '~ims-app-base/logic/types/Props';
import { generateDataPinId } from '../editor/DialogEditor';
import type { ScriptBlockPlainPropValue } from '../logic/nodeStoring';
import type { ScriptPlayNode } from '../play/ScriptPlayNode';
import { opOptions } from './getNodeDescriptiors';
import OpNodeTypeSelector from '../parts/OpNodeTypeSelector.vue';
import DialogBaseNode from './DialogBaseNode.vue';
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
    inputDataType() {
      return this.nodeDataController.getPinDataType(this.arg1PinId) ?? [];
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
    inputDataType() {
      this.updatePins();
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
      this.nodeDataController.setPinDataType(
        this.arg2PinId,
        this.inputDataType,
      );
      let out_type = null as null | AssetPropValueType;
      switch (this.operator) {
        case 'opEqual':
        case 'opNotEqual':
        case 'opLess':
        case 'opLessEqual':
        case 'opMore':
        case 'opMoreEqual':
          out_type = {
            Type: AssetPropType.BOOLEAN,
          };
          break;
        case 'opPlus':
        case 'opMinus':
        case 'opMult':
        case 'opDiv':
        case 'opMod':
          if (
            this.inputDataType &&
            this.inputDataType.length === 1 &&
            [AssetPropType.INTEGER, AssetPropType.FLOAT].includes(
              this.inputDataType[0].Type,
            )
          ) {
            out_type = this.inputDataType[0];
          }
          break;
        case 'opAnd':
        case 'opOr':
        case 'opNot':
          out_type = {
            Type: AssetPropType.BOOLEAN,
          };
          break;
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
