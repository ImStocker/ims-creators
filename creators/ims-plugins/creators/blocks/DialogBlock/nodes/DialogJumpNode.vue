<template>
  <DialogBaseNode :node-id="id" :dialog-player="dialogPlayer">
    <div class="DialogJumpNode DialogEditorNode">
      <div
        class="DialogJumpNode-header DialogNode-header DialogEditorNode-header"
        :title="$t(`imsDialogEditor.nodes.${nodeDescriptor.name}.description`)"
      >
        <ExecHandle id="in" type="target" :position="Position.Left" />
        <i :class="nodeDescriptor.icon"></i>
        {{ $t(`imsDialogEditor.nodes.${nodeDescriptor.name}.title`) }}
      </div>
      <div class="DialogJumpNode-body DialogEditorNode-body">
        <NodeSelector
          v-model="targetNodeId"
          :dialog-controller="dialogController"
          :node-data-controller="nodeDataController"
          :readonly="readonly"
          :exclude-id="id"
        />
      </div>
    </div>
  </DialogBaseNode>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { Position } from '@vue-flow/core';
import type { NodeDescriptor } from './NodeDescriptor';
import ExecHandle from '../parts/ExecHandle.vue';
import type { DialogPlayer } from '../play/DialogPlayer';
import type { DialogBlockController } from '../editor/DialogBlockController';
import type { NodeDataController } from '../editor/NodeDataController';
import DialogBaseNode from '../parts/DialogBaseNode.vue';
import NodeSelector from '../parts/NodeSelector.vue';
import type { ScriptBlockPlainPropValue } from '../logic/nodeStoring';

export default defineComponent({
  name: 'DialogJumpNode',
  components: { ExecHandle, DialogBaseNode, NodeSelector },
  props: {
    id: { type: String, required: true },
    dialogPlayer: { type: Object as PropType<DialogPlayer>, required: true },
    readonly: { type: Boolean, default: false },
    nodeDescriptor: {
      type: Object as PropType<NodeDescriptor>,
      required: true,
    },
    selected: { type: Boolean, required: true },
    dialogController: {
      type: Object as PropType<DialogBlockController>,
      required: true,
    },
    nodeDataController: {
      type: Object as PropType<NodeDataController>,
      required: true,
    },
  },
  computed: {
    Position() {
      return Position;
    },
    targetNodeId: {
      get(): string | null {
        return (
          this.nodeDataController.values['targetNodeId']?.toString() ?? null
        );
      },
      set(val: ScriptBlockPlainPropValue) {
        this.nodeDataController.setValue('targetNodeId', val);
      },
    },
  },
});
</script>

<style lang="scss" scoped>
.DialogJumpNode-header {
  padding: 7px 10px;
  font-size: 14px;
}
.DialogJumpNode-body {
  padding: 7px 10px;
  --local-text-color: var(--imsde-node-content-text-color);
  --input-text-color: var(--imsde-node-content-text-color);
}
</style>
