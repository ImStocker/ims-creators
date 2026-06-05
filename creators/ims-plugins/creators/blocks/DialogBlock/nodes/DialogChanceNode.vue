<template>
  <div class="DialogChanceNode DialogEditorNode">
    <div
      class="DialogChanceNode-header DialogNode-header DialogEditorNode-header"
      :title="$t(`imsDialogEditor.nodes.${nodeDescriptor.name}.description`)"
    >
      <ExecHandle id="in" type="target" :position="Position.Left" />
      <i :class="nodeDescriptor.icon"></i>
      {{ $t(`imsDialogEditor.nodes.${nodeDescriptor.name}.title`) }}
    </div>
    <div class="DialogChanceNode-body DialogEditorNode-body">
      <div class="DialogChanceNode-content">
        <DataField
          :out-id="randomPinId"
          class="DialogChanceNode-random"
          :caption="$t('imsDialogEditor.dataFields.random')"
          :node-data-controller="nodeDataController"
        />
        <div class="DialogChanceNode-options">
          <div
            v-for="(option, option_index) of options"
            :key="option_index"
            class="DialogChanceNode-option"
            :class="{ 'type-else': isElseOption(option_index) }"
          >
            <div class="DialogChanceNode-option-main">
              <template v-if="!isElseOption(option_index)">
                <DataFieldInput
                  :model-value="getOptionChance(option_index)"
                  :data-type="floatType"
                  :readonly="readonly"
                  @update:model-value="
                    (val: any) => setOptionChance(option_index, val)
                  "
                />
                <span class="DialogChanceNode-option-unit">%</span>
                <button
                  v-if="!readonly && options.length > 2"
                  class="is-button is-button-icon DialogChanceNode-option-delete"
                  :title="$t('imsDialogEditor.speech.deleteOption')"
                  @click="deleteOption(option_index)"
                >
                  <i class="ri-close-line"></i>
                </button>
              </template>
              <span v-else class="DialogChanceNode-option-else">
                {{ $t('imsDialogEditor.dataFields.else') || 'Else' }}
                <span v-if="elseChance > 0"
class="DialogChanceNode-else-pct"
                  >({{ elseChance }}%)</span
                >
              </span>
            </div>
            <ExecHandle
              :id="'out-' + (option_index + 1)"
              type="source"
              :position="Position.Right"
            />
          </div>
        </div>
        <div
          v-if="!readonly"
          class="DialogChanceNode-addOption"
          @click="addOption"
        >
          + {{ $t('imsDialogEditor.speech.addOption') }}
        </div>
        <div v-if="totalChance > 100" class="DialogChanceNode-warning">
          <i class="ri-alert-line"></i>
          {{
            $t('imsDialogEditor.chance.sumExceeds') ||
            'Sum of chances exceeds 100%'
          }}
          ({{ totalChance }}%)
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
import DataFieldInput from '../parts/DataFieldInput.vue';
import type { NodeDataController } from '../editor/NodeDataController';
import { AssetPropType } from '~ims-app-base/logic/types/Props';
import { generateDataPinId } from '../editor/DialogEditor';
import type { AssetPropValue } from '~ims-app-base/logic/types/Props';

export default defineComponent({
  name: 'DialogChanceNode',
  components: {
    ExecHandle,
    DataField,
    DataFieldInput,
  },
  props: {
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
      default: false,
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
    randomPinId() {
      return generateDataPinId(true, 'random');
    },
    options() {
      return this.nodeDataController.options;
    },
    floatType() {
      return { Type: AssetPropType.FLOAT };
    },
    totalChance() {
      let sum = 0;
      for (let i = 0; i < this.options.length - 1; i++) {
        const chance = this.nodeDataController.getOptionValue(i, 'chance');
        if (chance != null && chance !== '' && !isNaN(Number(chance))) {
          sum += Number(chance);
        }
      }
      return sum;
    },
    elseChance() {
      const remaining = 100 - this.totalChance;
      return remaining > 0 ? remaining : 0;
    },
  },
  mounted() {
    this.nodeDataController.setPinDataType(this.randomPinId, {
      Type: AssetPropType.FLOAT,
    });
  },
  methods: {
    isElseOption(index: number) {
      return index === this.options.length - 1;
    },
    getOptionChance(index: number) {
      return this.nodeDataController.getOptionValue(index, 'chance') ?? null;
    },
    setOptionChance(index: number, val: AssetPropValue) {
      this.nodeDataController.setOptionValue(index, 'chance', val);
    },
    addOption() {
      const lastIdx = this.options.length - 1;
      const lastOption = this.options[lastIdx];
      const savedValues: Record<string, AssetPropValue> = {};
      for (const key of Object.keys(lastOption.values)) {
        savedValues[key] = lastOption.values[key];
      }
      this.nodeDataController.deleteOption(lastIdx);
      this.nodeDataController.addOption();
      const newElseIdx = this.nodeDataController.addOption();
      for (const [key, val] of Object.entries(savedValues)) {
        this.nodeDataController.setOptionValue(newElseIdx, key, val);
      }
    },
    deleteOption(index: number) {
      if (this.options.length <= 2) return;
      if (this.isElseOption(index)) return;
      this.nodeDataController.deleteOption(index);
    },
  },
});
</script>

<style lang="scss" scoped>
.DialogChanceNode-header {
  padding: 7px 10px;
  font-size: 14px;
}
.DialogChanceNode-body {
  padding: 7px 0;
  display: flex;
}
.DialogChanceNode-content {
  flex: 1;
}
.DialogChanceNode-random {
  justify-content: flex-end;
}
.DialogChanceNode-options {
  margin-top: 5px;
}
.DialogChanceNode-option {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: 4px;
  position: relative;
  &:hover {
    .DialogChanceNode-option-delete {
      opacity: 1;
    }
  }
}
.DialogChanceNode-option-main {
  display: flex;
  align-items: center;
  gap: 4px;
}
.DialogChanceNode-option-unit {
  font-size: 12px;
  color: var(--imsde-label-text-color);
}
.DialogChanceNode-option-delete {
  opacity: 0;
  transition: opacity 0.2s;
  margin-left: 4px;
}
.DialogChanceNode-option-else {
  padding: 0 10px;
  font-size: 12px;
  color: var(--imsde-label-text-color);
  display: flex;
  align-items: center;
  gap: 4px;
}
.DialogChanceNode-else-pct {
  opacity: 0.6;
}
.DialogChanceNode-addOption {
  font-weight: bold;
  font-size: 12px;
  padding: 10px 10px 0 10px;
  cursor: pointer;
  border-top: 1px solid var(--imsde-node-content-inner-border-color);
  margin-top: 5px;
}
.DialogChanceNode-warning {
  padding: 5px 10px;
  font-size: 11px;
  color: #ff4444;
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
