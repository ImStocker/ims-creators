<template>
  <dialog-action-node
    :id="id"
    ref="node"
    class="DialogTriggerNode"
    :node-descriptor="nodeDescriptor"
    :node-data-controller="nodeDataController"
    :selected="selected"
    :dialog-controller="dialogController"
    :readonly="readonly"
    :playing-node-data="playingNodeData"
    :dialog-player="dialogPlayer"
    :action-type="ScriptBlockPlainActionTypes.TRIGGER"
  ></dialog-action-node>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { NodeDescriptor } from './NodeDescriptor';
import type { NodeDataController } from '../editor/NodeDataController';
import type { DialogBlockController } from '../editor/DialogBlockController';
import { ScriptBlockPlainActionTypes } from '../logic/nodeStoring';
import type { ScriptPlayNode } from '../play/ScriptPlayNode';
import type { DialogPlayer } from '../play/DialogPlayer';
import DialogActionNode from '../parts/DialogActionNode.vue';

export default defineComponent({
  name: 'DialogTriggerNode',
  components: {
    DialogActionNode,
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
  },
  computed: {
    ScriptBlockPlainActionTypes() {
      return ScriptBlockPlainActionTypes;
    },
  },
});
</script>

<style lang="scss" scoped></style>
