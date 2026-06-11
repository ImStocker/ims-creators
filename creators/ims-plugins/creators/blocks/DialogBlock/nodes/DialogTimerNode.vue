<template>
  <DialogBaseNode
    :node-id="id"
    :dialog-player="dialogPlayer"
    class="DialogTimerNode DialogEditorNode"
  >
    <div
      class="DialogTimerNode-header DialogNode-header DialogEditorNode-header"
      :title="$t(`imsDialogEditor.nodes.${nodeDescriptor.name}.description`)"
    >
      <ExecHandle id="in" type="target" :position="Position.Left" />
      <i :class="nodeDescriptor.icon"></i>
      {{ $t(`imsDialogEditor.nodes.${nodeDescriptor.name}.title`) }}
    </div>
    <div class="DialogTimerNode-body DialogEditorNode-body">
      <div class="DialogTimerNode-content">
        <DataField
          v-model="valueVal"
          :play-value="valuePlayVal"
          :in-id="valuePinId"
          class="DialogBranchNode-condition"
          :node-data-controller="nodeDataController"
          :readonly="readonly"
        ></DataField>
        <div class="DialogTimerNode-unit">s</div>
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
import { AssetPropType } from '~ims-app-base/logic/types/Props';
import { generateDataPinId } from '../editor/DialogEditor';
import type { ScriptBlockPlainPropValue } from '../logic/nodeStoring';
import type { NodeDataController } from '../editor/NodeDataController';
import DataField from '../parts/DataField.vue';
import type { ScriptPlayNode } from '../play/ScriptPlayNode';
import DialogBaseNode from '../parts/DialogBaseNode.vue';
import type { DialogPlayer } from '../play/DialogPlayer';

export default defineComponent({
  name: 'DialogTimerNode',
  components: {
    ExecHandle,
    DataField,
    DialogBaseNode,
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
    selected: {
      type: Boolean,
      required: true,
    },
    readonly: {
      type: Boolean,
      required: false,
    },
    nodeDataController: {
      type: Object as PropType<NodeDataController>,
      required: true,
    },
    playingNodeData: {
      type: [Object, null] as PropType<ScriptPlayNode> | null,
      default: null,
    },
    dialogPlayer: {
      type: Object as PropType<DialogPlayer>,
      required: true,
    },
  },
  computed: {
    Position() {
      return Position;
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

  mounted() {
    this.nodeDataController.setPinDataType(this.valuePinId, {
      Type: AssetPropType.FLOAT,
    });
  },
});
</script>

<style lang="scss" scoped>
.DialogTimerNode-header {
  padding: 7px 10px;
  font-size: 14px;
}
.DialogTimerNode-body {
  padding: 7px 0;
  padding-right: 10px;
  position: relative;
}
.DialogTimerNode-content {
  display: flex;
  align-items: center;
}
</style>
