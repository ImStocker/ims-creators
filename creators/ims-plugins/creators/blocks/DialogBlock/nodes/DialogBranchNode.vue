<template>
  <div class="DialogBranchNode DialogEditorNode">
    <div
      class="DialogBranchNode-header DialogNode-header DialogEditorNode-header"
      :title="$t(`imsDialogEditor.nodes.${nodeDescriptor.name}.description`)"
    >
      <ExecHandle id="in" type="target" :position="Position.Left" />
      <i :class="nodeDescriptor.icon"></i>
      {{ $t(`imsDialogEditor.nodes.${nodeDescriptor.name}.title`) }}
    </div>
    <div class="DialogBranchNode-body DialogEditorNode-body">
      <div class="DialogBranchNode-content">
        <DataField
          v-model="conditionVal"
          :in-id="conditionPinId"
          class="DialogBranchNode-condition"
          :caption="$t('imsDialogEditor.dataFields.condition')"
          :node-data-controller="nodeDataController"
          :readonly="readonly"
          :play-value="conditionPlayVal"
        ></DataField>
        <div class="DialogBranchNode-options">
          <div
            v-for="(option, option_index) of options"
            :key="option_index"
            class="DialogBranchNode-option"
          >
            <div class="DialogBranchNode-option-caption">
              {{
                option.values?.value
                  ? $t('imsDialogEditor.dataFields.yes')
                  : $t('imsDialogEditor.dataFields.no')
              }}
            </div>
            <ExecHandle
              :id="'out-' + (option_index + 1)"
              type="source"
              :position="Position.Right"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { Position } from '@vue-flow/core';
import type { NodeDescriptor } from './NodeDescriptor';
import ExecHandle from '../parts/ExecHandle.vue';
import DataField from '../parts/DataField.vue';
import type { NodeDataController } from '../editor/NodeDataController';
import { AssetPropType } from '~ims-app-base/logic/types/Props';
import { generateDataPinId } from '../editor/DialogEditor';
import type { ScriptBlockPlainPropValue } from '../logic/nodeStoring';
import type { ScriptPlayNode } from '../play/ScriptPlayNode';

export default defineComponent({
  name: 'DialogBranchNode',
  components: {
    ExecHandle,
    DataField,
  },
  props: {
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
    nodeDataController: {
      type: Object as PropType<NodeDataController>,
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
    conditionPinId() {
      return generateDataPinId(false, 'condition');
    },
    options() {
      return this.nodeDataController.options;
    },
    conditionPlayVal() {
      return this.playingNodeData?.inputs?.condition ?? null;
    },
    conditionVal: {
      get() {
        return this.nodeDataController.values['condition'] ?? null;
      },
      set(val: ScriptBlockPlainPropValue) {
        this.nodeDataController.setValue('condition', val);
      },
    },
  },
  mounted() {
    this.nodeDataController.setPinDataType(this.conditionPinId, {
      Type: AssetPropType.BOOLEAN,
    });
  },
});
</script>

<style lang="scss" scoped>
.DialogBranchNode-header {
  padding: 7px 10px;
  font-size: 14px;
  position: relative;
}
.DialogBranchNode-body {
  padding: 7px 0;
  display: flex;
}
.DialogBranchNode-content {
  flex: 1;
}
.DialogBranchNode-addOption {
  font-weight: bold;
  font-size: 12px;
}
.DialogBranchNode-option {
  position: relative;
}
.DialogBranchNode-option-caption {
  padding: 0 10px;
}

.DialogBranchNode-content {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
