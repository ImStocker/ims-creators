<template>
  <DialogBaseNode
    :node-id="id"
    :dialog-player="dialogPlayer"
    class="DialogCommentNode DialogEditorNode"
  >
    <div
      class="DialogCommentNode-header DialogNode-header DialogEditorNode-header"
      :title="$t(`imsDialogEditor.nodes.${nodeDescriptor.name}.description`)"
    >
      <i :class="nodeDescriptor.icon"></i>
      {{ $t(`imsDialogEditor.nodes.${nodeDescriptor.name}.title`) }}
    </div>
    <div class="DialogCommentNode-body DialogEditorNode-body">
      <div class="DialogCommentNode-content">
        <DataFieldInput
          v-model="value"
          class="DialogCommentNode-input"
          :data-type="dataType"
          :readonly="readonly"
        ></DataFieldInput>
      </div>
    </div>
  </DialogBaseNode>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { NodeDescriptor } from './NodeDescriptor';
import DataFieldInput from '../parts/DataFieldInput.vue';
import {
  type AssetPropValueType,
  type AssetPropValue,
  AssetPropType,
} from '~ims-app-base/logic/types/Props';

import type { NodeDataController } from '../editor/NodeDataController';
import type { ScriptBlockPlainPropValueBind } from '../logic/nodeStoring';
import type { DialogPlayer } from '../play/DialogPlayer';
import DialogBaseNode from '../parts/DialogBaseNode.vue';

export default defineComponent({
  name: 'DialogCommentNode',
  components: {
    DataFieldInput,
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
    readonly: {
      type: Boolean,
      required: false,
    },
    dataType: {
      type: Object as PropType<AssetPropValueType>,
      required: true,
    },
    nodeDataController: {
      type: Object as PropType<NodeDataController>,
      required: true,
    },
  },
  computed: {
    AssetPropType() {
      return AssetPropType;
    },
    value: {
      get(): AssetPropValue {
        const val = this.nodeDataController.values['value'];
        if (val && (val as ScriptBlockPlainPropValueBind).get !== undefined) {
          return null;
        }
        return (val as AssetPropValue) ?? null;
      },
      set(val: AssetPropValue) {
        this.nodeDataController.setValue('value', val);
      },
    },
  },
});
</script>

<style lang="scss" scoped>
.DialogCommentNode-header {
  padding: 7px 10px;
  font-size: 14px;
  position: relative;
}

.DialogCommentNode-body {
  padding: 7px 10px;
  position: relative;
}
.DialogGonstNode-body-dataOut {
  position: absolute;
  top: 50%;
  right: 0;
  transform: translate(50%, -50%);
}
.DialogCommentNode-input:first-child:last-child {
  flex: 1;
}
.DialogCommentNode-input:deep(.DataFieldInput-number) {
  width: 120px;
}
.DialogCommentNode-input:deep(.DataFieldInput-string) {
  min-width: 150px;
  max-width: 600px;
}

.DialogCommentNode-input:deep(.DataFieldInput-text) {
  min-width: 150px;
  max-width: 600px;
}

.DialogCommentNode-caption {
  margin-left: 10px;
}
.DialogCommentNode-content {
  display: flex;
  align-items: center;
}
</style>
