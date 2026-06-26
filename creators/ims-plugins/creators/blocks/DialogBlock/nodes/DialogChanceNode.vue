<template>
  <DialogBaseNode
    :node-id="id"
    :dialog-player="dialogPlayer"
    class="DialogChanceNode DialogEditorNode"
  >
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
          :node-data-controller="nodeDataController"
        >
          <template #caption>
            <div class="DialogChanceNode-random-caption">
              {{ $t('imsDialogEditor.dataFields.random')
              }}{{ randomValue !== null ? ':' : '' }}
              <span
                v-if="randomValue !== null"
                class="DialogChanceNode-random-caption-value"
                >{{ randomValue }}</span
              >
            </div>
          </template>
        </DataField>
        <div class="DialogChanceNode-options">
          <div
            class="DialogChanceNode-option"
            :class="{
              'state-default-computed':
                isPlaying && -1 === dialogPlayer.chanceDefaultOptionIndex,
            }"
          >
            <span
              v-if="options.length === 0"
              class="DialogChanceNode-option-exit"
            >
              {{ $t('imsDialogEditor.nodes.chance.exit') }}
            </span>
            <span v-else class="DialogChanceNode-option-else">
              {{ $t('imsDialogEditor.nodes.chance.else') }}
              {{ elseChancePercent !== null ? `${elseChancePercent}%` : '' }}
            </span>
            <button
              v-if="isPlaying"
              class="is-button DialogChanceNode-option-select"
              @click="dialogPlayer.playChoose(-1)"
            >
              {{ $t('imsDialogEditor.play.select') }}
            </button>
            <ExecHandle :id="'out'" type="source" :position="Position.Right" />
          </div>
          <div
            v-for="(option, option_index) of options"
            :key="option_index"
            class="DialogChanceNode-option"
            :class="{
              'state-default-computed':
                isPlaying &&
                option_index === dialogPlayer.chanceDefaultOptionIndex,
            }"
          >
            <DataField
              :model-value="getOptionChance(option_index)"
              :in-id="getChancePinId(option_index)"
              class="DialogChanceNode-option-field"
              :node-data-controller="nodeDataController"
              :readonly="readonly"
              @update:model-value="
                (val: any) => setOptionChance(option_index, val)
              "
            />
            <span
              v-if="isOptionPercentageVisible(option_index)"
              class="DialogChanceNode-option-pct"
            >
              {{ getOptionPercentageText(option_index) }}%
            </span>
            <button
              v-if="!readonly"
              class="is-button is-button-icon DialogChanceNode-option-delete"
              :title="$t('imsDialogEditor.speech.deleteOption')"
              @click="deleteOption(option_index)"
            >
              <i class="ri-close-line"></i>
            </button>
            <button
              v-if="isPlaying"
              class="is-button DialogChanceNode-option-select"
              @click="dialogPlayer.playChoose(option_index)"
            >
              {{ $t('imsDialogEditor.play.select') }}
            </button>
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
        <div
          v-if="totalChance && totalChance > 1"
          class="DialogChanceNode-warning"
        >
          <i class="ri-alert-line"></i>
          {{ $t('imsDialogEditor.nodes.chance.sumExceeds') }}
          ({{ computePercent(totalChance) }}%)
        </div>
      </div>
    </div>
  </DialogBaseNode>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { Position } from '@vue-flow/core';
import type { NodeDescriptor } from './NodeDescriptor';
import ExecHandle from '../parts/ExecHandle.vue';
import DataField from '../parts/DataField.vue';
import type { NodeDataController } from '../editor/NodeDataController';
import {
  AssetPropType,
  castAssetPropValueToFloat,
  type AssetPropValue,
} from '~ims-app-base/logic/types/Props';
import { generateDataPinId } from '../editor/DialogEditor';
import type {
  ScriptBlockPlainPropValue,
  ScriptBlockPlainPropValueBind,
} from '../logic/nodeStoring';
import DialogBaseNode from '../parts/DialogBaseNode.vue';
import type { DialogPlayer } from '../play/DialogPlayer';

export default defineComponent({
  name: 'DialogChanceNode',
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
    randomValue() {
      const outRandom = this.dialogPlayer.getNodePlayOutputs(this.id)['random'];
      if (this.isPlaying && this.dialogPlayer.chanceRandomValue != null) {
        return this.dialogPlayer.chanceRandomValue.toFixed(2);
      } else if (outRandom) {
        return castAssetPropValueToFloat(outRandom as AssetPropValue)?.toFixed(
          2,
        );
      }
      return null;
    },
    options() {
      return this.nodeDataController.options;
    },
    floatType() {
      return { Type: AssetPropType.FLOAT };
    },
    totalChance(): number | null {
      let sum = 0;
      for (let i = 0; i < this.options.length; i++) {
        const chance = this.getOptionChance(i);
        if (chance === null) {
          return null;
        }
        sum += Number(chance);
      }
      return sum;
    },
    elseChance() {
      if (this.totalChance === null) {
        return null;
      }
      const remaining = 1 - this.totalChance;
      return remaining > 0 ? remaining : 0;
    },
    elseChancePercent() {
      if (this.elseChance === null) return null;
      return (Math.round(this.elseChance * 10) / 10) * 100;
    },
    isPlaying() {
      return (
        this.dialogPlayer.currentPlayingNodeId === this.id &&
        this.dialogPlayer.displayingFrameIndex === 0
      );
    },
  },
  mounted() {
    this.nodeDataController.setPinDataType(this.randomPinId, {
      Type: AssetPropType.FLOAT,
    });
    for (let i = 0; i < this.options.length; i++) {
      this.ensureChancePin(i);
    }
  },
  methods: {
    getChancePinId(index: number) {
      return generateDataPinId(false, 'chance', index);
    },
    ensureChancePin(index: number) {
      const pinId = this.getChancePinId(index);
      this.nodeDataController.setPinDataType(pinId, {
        Type: AssetPropType.FLOAT,
      });
    },
    hasOptionChanceValue(index: number) {
      const val = this.nodeDataController.getOptionValue(index, 'chance');
      return val != null && val !== '';
    },
    isOptionChanceBound(index: number) {
      const pinId = this.getChancePinId(index);
      return this.nodeDataController.isPinConnected(pinId);
    },
    isOptionPercentageVisible(index: number) {
      if (this.isPlaying) return true;
      if (this.isOptionChanceBound(index)) return false;
      return this.hasOptionChanceValue(index);
    },
    getOptionPercentageText(index: number) {
      return this.computePercent(this.getOptionChance(index));
    },
    getOptionChance(index: number): number | null {
      if (this.isPlaying) {
        const options = this.dialogPlayer.chanceOptions;
        if (options && options[index]) {
          return options[index].chance ?? 0;
        }
      }

      const val =
        this.nodeDataController.getOptionValue(index, 'chance') ?? null;
      if (val === null) return 0;
      if (val && (val as ScriptBlockPlainPropValueBind).get) {
        return null;
      }
      return castAssetPropValueToFloat(val as AssetPropValue);
    },
    setOptionChance(index: number, val: ScriptBlockPlainPropValue) {
      this.nodeDataController.setOptionValue(index, 'chance', val);
    },
    computePercent(val: any) {
      const num = Number(val);
      if (isNaN(num)) return '0';
      return (num * 100).toFixed(0);
    },
    formatFraction(val: number) {
      return val.toFixed(2);
    },
    addOption() {
      this.nodeDataController.addOption();
      const newIdx = this.options.length - 1;
      this.ensureChancePin(newIdx);
    },
    deleteOption(index: number) {
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
      opacity: 1 !important;
    }
  }
}
.DialogChanceNode-option-field {
  flex: 1;
}
.DialogChanceNode-option-pct {
  font-size: 12px;
  color: var(--imsde-label-text-color);
  min-width: 30px;
  text-align: right;
  margin-right: 4px;
}
.DialogChanceNode-option-exit {
  font-size: 12px;
  color: var(--imsde-label-text-color);
  padding: 0 10px;
}
.DialogChanceNode-option-else {
  padding: 0 10px;
  font-size: 12px;
  color: var(--imsde-label-text-color);
  display: flex;
  align-items: center;
  gap: 4px;
}
.DialogChanceNode-option-delete {
  opacity: 0 !important;
  transition: opacity 0.2s;
  margin-left: 4px;
  margin-right: 8px;
}
.DialogChanceNode-option-select {
  --button-border-color: var(--imsde-node-playing-color) !important;
  &:not(:hover) {
    --button-text-color: var(--imsde-node-playing-color);
  }
  &:hover {
    --button-bg-color: var(--imsde-node-playing-color);
  }
}
.DialogChanceNode-option.state-default-computed {
  outline: 2px solid var(--imsde-node-playing-color);
  outline-offset: -2px;
  border-radius: var(--panel-border-radius);
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
.DialogChanceNode-random-caption {
  padding-right: 10px;
}
.DialogChanceNode-random-caption-value {
  color: var(--imsde-node-playing-color);
}
</style>
