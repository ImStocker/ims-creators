<template>
  <div class="DialogStartNode DialogEditorNode">
    <div
      class="DialogStartNode-header DialogNode-header DialogEditorNode-header"
      :title="$t(`imsDialogEditor.nodes.${nodeDescriptor.name}.description`)"
    >
      <i :class="nodeDescriptor.icon"></i>
      {{ $t(`imsDialogEditor.nodes.${nodeDescriptor.name}.title`) }}
      <ExecHandle id="out" type="source" :position="Position.Right" />
    </div>
    <div
      v-if="inputParameters.length > 0"
      class="DialogStartNode-body DialogEditorNode-body"
    >
      <node-parameters-grid
        :dialog-player="dialogPlayer"
        :node-data-controller="nodeDataController"
        :readonly="readonly"
        :input-params="inputParameters"
        :playing-node-data="playingNodeData"
      ></node-parameters-grid>
    </div>
  </div>
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
import type { ScriptPlayNode } from '../play/ScriptPlayNode';
import type { DialogPlayer } from '../play/DialogPlayer';
import ExecHandle from '../parts/ExecHandle.vue';
import NodeParametersGrid from '../parts/NodeParametersGrid.vue';

export default defineComponent({
  name: 'DialogStartNode',
  components: {
    ExecHandle,
    NodeParametersGrid,
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
    nodeDataController: {
      type: Object as PropType<NodeDataController>,
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
  },
  computed: {
    Position() {
      return Position;
    },
    inputParameters(): DialogVariable[] {
      return this.dialogController
        .getVariables()
        .filter(
          (v) => v.kind && ['in', 'in-out'].includes(v.kind),
        );
    },
  },
});
</script>

<style lang="scss" scoped>
.DialogStartNode-header {
  padding: 7px 10px;
  font-size: 14px;
}
.DialogStartNode-body {
  padding: 0;
}
</style>