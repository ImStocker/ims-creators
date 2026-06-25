<template>
  <div class="DialogChanceDemoPlay">
    <div class="DialogChanceDemoPlay-content">
      <div class="DialogChanceDemoPlay-header">
        <i class="ri-dice-line"></i>
        {{ $t('imsDialogEditor.nodes.chance.title') }}
      </div>
    </div>
    <div
      v-if="
        playingNodeData.optionsInputs &&
        playingNodeData.optionsInputs.length > 0
      "
      class="DialogChanceDemoPlay-options"
    >
      <button
        class="PlayerDemoDialog-option-button DialogChanceDemoPlay-options-one"
        :class="{
          'state-default': -1 === dialogPlayer.chanceDefaultOptionIndex,
        }"
        @click="dialogPlayer.playChoose(-1)"
      >
        <span class="DialogChanceDemoPlay-options-one-label">
          {{ $t('imsDialogEditor.nodes.chance.else') }}
        </span>
        <span class="DialogChanceDemoPlay-options-one-chance">
          {{ getOptionChance(-1) }}
        </span>
        <span
          v-if="-1 === dialogPlayer.chanceDefaultOptionIndex"
          class="DialogChanceDemoPlay-options-one-default"
        >
          {{ $t('imsDialogEditor.play.select') }}
        </span>
      </button>
      <button
        v-for="(option, option_index) of playingNodeData.optionsInputs"
        :key="option_index"
        class="PlayerDemoDialog-option-button DialogChanceDemoPlay-options-one"
        :class="{
          'state-default':
            option_index === dialogPlayer.chanceDefaultOptionIndex,
        }"
        @click="dialogPlayer.playChoose(option_index)"
      >
        <span class="DialogChanceDemoPlay-options-one-label">
          {{
            $t('imsDialogEditor.nodes.chance.option', {
              index: option_index,
            })
          }}
        </span>
        <span class="DialogChanceDemoPlay-options-one-chance">
          {{ getOptionChance(option_index) }}
        </span>
        <span
          v-if="option_index === dialogPlayer.chanceDefaultOptionIndex"
          class="DialogChanceDemoPlay-options-one-default"
        >
          {{ $t('imsDialogEditor.play.select') }}
        </span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { ScriptPlayNode } from './ScriptPlayNode';
import type { DialogPlayer } from './DialogPlayer';

export default defineComponent({
  name: 'DialogChanceDemoPlay',
  props: {
    playingNodeData: {
      type: Object as PropType<ScriptPlayNode>,
      required: true,
    },
    dialogPlayer: {
      type: Object as PropType<DialogPlayer>,
      required: true,
    },
  },
  methods: {
    getOptionChance(index: number): string {
      const option = this.dialogPlayer.chanceOptions[index];
      if (!option || option.chance == null) return '';
      return (option.chance * 100).toFixed(0) + '%';
    },
  },
});
</script>

<style lang="scss" rel="stylesheet/scss" scoped>
.DialogChanceDemoPlay-header {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 20px;
  text-align: center;
  color: var(--local-text-color);
  i {
    margin-right: 6px;
    color: var(--imsde-node-playing-color);
  }
}
.DialogChanceDemoPlay-options-one {
  display: flex;
  align-items: center;
  gap: 10px;
  &.state-default {
    outline: 2px solid var(--imsde-node-playing-color);
    outline-offset: -2px;
  }
}
.DialogChanceDemoPlay-options-one-label {
  flex: 1;
}
.DialogChanceDemoPlay-options-one-chance {
  font-size: 12px;
  color: var(--local-sub-text-color);
}
.DialogChanceDemoPlay-options-one-default {
  font-size: 11px;
  color: var(--imsde-node-playing-color);
  font-weight: bold;
}
</style>
