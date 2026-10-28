<template>
  <DialogBaseNode
    :node-id="id"
    :dialog-player="dialogPlayer"
    class="DialogEndNode DialogEditorNode"
  >
    <div
      class="DialogEndNode-header DialogNode-header DialogEditorNode-header"
      :title="$t(`imsDialogEditor.nodes.${nodeDescriptor.name}.description`)"
    >
      <div class="DialogEndNode-header-title">
        <ExecHandle id="in" type="target" :position="Position.Left" />
        <i :class="nodeDescriptor.icon"></i>
        <span class="DialogEndNode-caption">
          {{ $t(`imsDialogEditor.nodes.${nodeDescriptor.name}.title`) }}
        </span>
      </div>
      <div v-if="exitName" class="DialogEndNode-exitName" :title="exitName">
        {{ exitName }}
      </div>
    </div>
    <div
      v-if="inputParameters.length > 0"
      class="DialogEndNode-body DialogEditorNode-body"
    >
      <node-parameters-grid
        :dialog-player="dialogPlayer"
        :node-data-controller="nodeDataController"
        :readonly="readonly"
        :input-params="inputParameters"
        :playing-node-data="playingNodeData"
        :explicit-values="true"
      ></node-parameters-grid>
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

import type { ScriptPlayNode } from '../play/ScriptPlayNode';
import type { DialogPlayer } from '../play/DialogPlayer';
import { castAssetPropValueToString } from '~ims-app-base/logic/types/Props';
import ExecHandle from '../parts/ExecHandle.vue';
import DialogBaseNode from '../parts/DialogBaseNode.vue';
import NodeParametersGrid from '../parts/NodeParametersGrid.vue';

export default defineComponent({
  name: 'DialogEndNode',
  components: {
    ExecHandle,
    DialogBaseNode,
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
    Position() {
      return Position;
    },
    inputParameters(): DialogVariable[] {
      return this.dialogController
        .getVariables()
        .filter((v) => v.kind && ['out', 'in-out'].includes(v.kind));
    },
    exitName() {
      return castAssetPropValueToString(this.nodeDataController.subject);
    },
  },
});
</script>

<style lang="scss" scoped>
.DialogEndNode-header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 7px 10px;
  font-size: 14px;
}
.DialogEndNode-header-title {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  // full-bleed row, so the incoming handle stays at the node left edge
  margin: 0 -10px;
  padding: 0 10px;
}
.DialogEndNode-caption {
  white-space: nowrap;
}
.DialogEndNode-body {
  padding: 0;
}
.DialogEndNode-exitName {
  max-width: 200px;
  font-size: 10px;
  line-height: 12px;
  color: var(--imsde-node-header-text-color);
  opacity: 0.75;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
