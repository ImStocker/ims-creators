<template>
  <div class="DialogSpeechDemoPlay">
    <div v-if="coverValue" class="DialogSpeechDemoPlay-cover">
      <file-presenter
        :value="coverValue"
        :inline="true"
        class="DialogSpeechDemoPlay-cover-image"
      ></file-presenter>
    </div>
    <div class="DialogSpeechDemoPlay-content">
      <div
        v-for="info of displayingMainSpeechInfoList"
        :key="info.variable.name"
        class="DialogSpeechDemoPlay-prop-line"
      >
        <div
          v-if="getMainVariableCaption(info.index)"
          class="DialogSpeechDemoPlay-prop-line-caption"
        >
          {{ getMainVariableCaption(info.index) }}
        </div>
        <div class="DialogSpeechDemoPlay-prop-line-value">
          <DataFieldDisplay
            :data-type="info.variable.type"
            :model-value="info.value"
            :readonly="true"
          ></DataFieldDisplay>
        </div>
      </div>
    </div>
    <div
      v-if="playingNodeData.options && playingNodeData.options.length > 0"
      class="DialogSpeechDemoPlay-options"
    >
      <button
        v-for="(option, option_index) of playingNodeData.options"
        :key="option_index"
        class="PlayerDemoDialog-option-button DialogSpeechDemoPlay-options-one"
        :class="{
          'state-unavailable': !playOptionConditionPass(option_index),
        }"
        :disabled="!playOptionConditionPass(option_index)"
        @click="dialogPlayer.playChoose(option_index)"
      >
        <div
          v-for="info of getOptionSpeechInfoList(option_index)"
          :key="info.variable.name"
          class="DialogSpeechDemoPlay-options-one-param"
        >
          <div class="DialogSpeechDemoPlay-options-one-param-caption">
            {{ getOptionVariableCaption(option_index, info.index) }}
          </div>
          <div
            class="DialogSpeechDemoPlay-options-one-param-input"
            @click="optionInnerClick($event)"
          >
            <DataFieldDisplay
              :data-type="info.variable.type"
              :model-value="info.value"
            ></DataFieldDisplay>
          </div>
        </div>
      </button>
    </div>
    <div v-else class="DialogSpeechDemoPlay-options">
      <button
        class="PlayerDemoDialog-option-button"
        @click="dialogPlayer.playChoose(null)"
      >
        {{ $t('imsDialogEditor.play.continue') }}
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { ScriptPlayNode } from './ScriptPlayNode';
import type { DialogPlayer } from './DialogPlayer';
import type { DialogBlockController } from '../editor/DialogBlockController';
import DataFieldDisplay from '../parts/DataFieldDisplay.vue';
import { convertTranslatedTitle } from '~ims-app-base/logic/utils/assets';
import { isElementInteractive } from '~ims-app-base/components/utils/DomElementUtils';
import type { AssetPropValueFile } from '~ims-app-base/logic/types/Props';
import FilePresenter from '~ims-app-base/components/File/FilePresenter.vue';

export default defineComponent({
  name: 'DialogSpeechDemoPlay',
  components: { DataFieldDisplay, FilePresenter },
  props: {
    playingNodeData: {
      type: Object as PropType<ScriptPlayNode>,
      required: true,
    },
    dialogPlayer: {
      type: Object as PropType<DialogPlayer>,
      required: true,
    },
    dialogController: {
      type: Object as PropType<DialogBlockController>,
      required: true,
    },
  },
  computed: {
    coverValue() {
      return (this.playingNodeData?.values?.cover ??
        null) as null | AssetPropValueFile;
    },
    mainSpeechList() {
      return this.dialogController.getMainSpeech();
    },
    optionSpeechList() {
      return this.dialogController.getOptionSpeech();
    },
    displayingMainSpeechInfoList() {
      return this.mainSpeechList
        .map((variable, index) => {
          return {
            index,
            variable,
            value: this.playingNodeData.values
              ? (this.playingNodeData.values[variable.name] ?? variable.default)
              : variable.default,
          };
        })
        .filter((info) => {
          return info.value !== null;
        });
    },
  },
  methods: {
    getMainVariableCaption(var_index: number) {
      const variable = this.mainSpeechList[var_index];
      return variable &&
        variable.name === 'text' &&
        var_index === this.mainSpeechList.length - 1 &&
        variable.type
        ? ''
        : convertTranslatedTitle(variable.title, (key: any) => this.$t(key));
    },

    playOptionConditionPass(option_index: number) {
      if (!this.playingNodeData) {
        return true;
      }
      if (
        !this.playingNodeData.options ||
        !this.playingNodeData.options[option_index]
      ) {
        return true;
      }
      const option = this.playingNodeData.options[option_index];
      if (!option.values) {
        return true;
      }
      return option.values.condition === undefined || option.values.condition;
    },

    getOptionVariableCaption(option_index: number, var_index: number) {
      const variable = this.optionSpeechList[var_index];
      const caption =
        variable.name === 'text' && var_index === 0 && variable.type
          ? ''
          : convertTranslatedTitle(variable.title, (key: any) => this.$t(key));
      return caption;
    },

    getOptionSpeechInfoList(option_index: number) {
      const option = this.playingNodeData.options
        ? this.playingNodeData.options[option_index]
        : null;
      if (!option) return [];
      return this.optionSpeechList
        .map((variable, index) => {
          return {
            index,
            variable,
            value: option.values
              ? (option.values[variable.name] ?? null)
              : null,
          };
        })
        .filter((info) => {
          return info.value !== null;
        });
    },
    optionInnerClick(event: MouseEvent) {
      if (event.target && isElementInteractive(event.target as HTMLElement)) {
        event.stopPropagation();
        return;
      }
    },
  },
});
</script>

<style lang="scss" scoped>
.DialogSpeechDemoPlay-prop-line-caption,
.DialogSpeechDemoPlay-options-one-param-caption {
  font-weight: bold;
  font-size: 12px;
  color: var(--local-sub-text-color);
}
.DialogSpeechDemoPlay-content {
  margin-bottom: 20px;
}
.DialogSpeechDemoPlay-options-one {
  &.state-unavailable {
    opacity: 0.5;
  }
}

.DialogSpeechDemoPlay-cover {
  margin-bottom: 20px;
}

.DialogSpeechDemoPlay-cover-image {
  max-width: 100%;
  object-fit: cover;
  max-height: 600px;
  display: block;
  margin: 0 auto;
  border-radius: 4px;
}
</style>
