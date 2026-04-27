<template>
  <div class="DialogSpeechNode DialogEditorNode">
    <div
      class="DialogSpeechNode-header DialogNode-header DialogEditorNode-header"
      :title="$t(`imsDialogEditor.nodes.${nodeDescriptor.name}.description`)"
    >
      <div>
        <ExecHandle
          id="in"
          type="target"
          :position="Position.Left"
        ></ExecHandle>
        <i :class="nodeDescriptor.icon"></i>
        {{ $t(`imsDialogEditor.nodes.${nodeDescriptor.name}.title`) }}
      </div>
      <div v-if="!readonly" class="DialogSpeechNode-header-settings">
        <dialog-speech-node-attach-cover
          v-if="!coverValue"
          v-model="coverValue"
        ></dialog-speech-node-attach-cover>
        <button
          class="is-button is-button-icon"
          :title="$t('gddPage.settings')"
          @click="openSpeechParametersDialog()"
        >
          <i class="ri-settings-3-fill" />
        </button>
      </div>
    </div>
    <div class="DialogSpeechNode-body DialogEditorNode-body">
      <div v-if="coverValue" class="DialogSpeechNode-cover">
        <file-presenter
          :value="coverValue"
          :inline="true"
          class="DialogSpeechNode-cover-image"
        ></file-presenter>
        <menu-button
          v-if="!readonly"
          v-model:shown="coverMenuShown"
          class="DialogSpeechNode-cover-menu"
          :class="{ 'state-active': coverMenuShown }"
        >
          <menu-list :menu-list="coverMenu"></menu-list>
        </menu-button>
      </div>
      <div class="DialogSpeechNode-content">
        <DataField
          v-for="(variable, var_index) of mainSpeechList"
          :key="variable.name"
          :ref="'main-' + variable.name"
          class="DialogSpeechNode-prop-line"
          :model-value="
            nodeDataController.values[variable.name] === undefined
              ? variable.default
              : nodeDataController.values[variable.name]
          "
          :play-value="
            playingNodeData?.values
              ? playingNodeData.values[variable.name]
              : null
          "
          :in-id="generateDataPinId(false, variable.name)"
          :node-data-controller="nodeDataController"
          :readonly="readonly"
          :title="variable.description ?? ''"
          :placeholder="
            variable.name === 'text'
              ? $t('imsDialogEditor.speech.enterSpeech')
              : ''
          "
          :caption="getMainVariableCaption(var_index)"
          @update:model-value="
            nodeDataController.setValue(variable.name, $event)
          "
        ></DataField>
        <button
          v-if="!readonly && mainSpeechVariablesHasDefault"
          class="is-button is-button-action DialogSpeechNode-restore-button"
          @click="setMainSpeechDefault()"
        >
          {{ $t('imsDialogEditor.speech.restoreValues') }}
        </button>
        <div v-if="options.length > 0" class="DialogSpeechNode-options">
          <ContextMenuZone
            v-for="(option, option_index) of options"
            :key="option_index"
            class="DialogSpeechNode-options-one"
            :class="{
              'state-unavailable':
                isPlaying && !playOptionConditionPass(option_index),
            }"
            :menu-list="getOptionContextMenu(option, option_index)"
            ignoring-css-selector=".DataField-input"
          >
            <div class="DialogSpeechNode-options-one-common">
              <div
                v-if="isOptionConditionDisplaying(option)"
                class="DialogSpeechNode-options-one-param type-first"
              >
                <DataField
                  class="DialogSpeechNode-options-one-param-input"
                  :in-id="generateDataPinId(false, 'condition', option_index)"
                  :option="option"
                  :option-index="option_index"
                  :placeholder="$t('imsDialogEditor.speech.enterText')"
                  :node-data-controller="nodeDataController"
                  caption="[[t:Condition]]"
                  :readonly="readonly"
                  :model-value="option.values['condition'] ?? null"
                  :play-value="
                    playingNodeData?.options &&
                    playingNodeData.options[option_index] &&
                    playingNodeData.options[option_index].values
                      ? playingNodeData.options[option_index].values[
                          'condition'
                        ]
                      : null
                  "
                  @update:model-value="
                    nodeDataController.setOptionValue(
                      option_index,
                      'condition',
                      $event,
                    )
                  "
                ></DataField>
              </div>
              <div
                v-for="(variable, var_index) of optionSpeechList"
                :key="variable.name"
                class="DialogSpeechNode-options-one-param"
                :class="{
                  ' type-first':
                    var_index === 0 && !isOptionConditionDisplaying(option),
                }"
              >
                <DataField
                  class="DialogSpeechNode-options-one-param-input"
                  :model-value="
                    nodeDataController.getOptionValue(
                      option_index,
                      variable.name,
                    ) === undefined
                      ? variable.default
                      : nodeDataController.getOptionValue(
                          option_index,
                          variable.name,
                        )
                  "
                  :play-value="
                    playingNodeData?.options &&
                    playingNodeData.options[option_index] &&
                    playingNodeData.options[option_index].values
                      ? playingNodeData.options[option_index].values[
                          variable.name
                        ]
                      : null
                  "
                  :in-id="generateDataPinId(false, variable.name, option_index)"
                  :caption="getOptionVariableCaption(option_index, var_index)"
                  :node-data-controller="nodeDataController"
                  :readonly="readonly"
                  :title="variable.description ?? ''"
                  :placeholder="
                    variable.name === 'text'
                      ? $t('imsDialogEditor.speech.enterText')
                      : ''
                  "
                  @update:model-value="
                    nodeDataController.setOptionValue(
                      option_index,
                      variable.name,
                      $event,
                    )
                  "
                ></DataField>
              </div>
              <button
                v-if="!readonly && optionSpeechVariablesHasDefault"
                class="is-button is-button-action DialogSpeechNode-restore-button"
                @click="setOptionDefault(option_index)"
              >
                {{ $t('imsDialogEditor.speech.restoreValues') }}
              </button>
            </div>
            <div
              v-if="isPlaying && playOptionConditionPass(option_index)"
              class="DialogSpeechNode-options-one-select"
            >
              <button
                class="is-button"
                @click="dialogPlayer.playChoose(option_index)"
              >
                {{ $t('imsDialogEditor.play.select') }}
              </button>
            </div>
            <div class="DialogSpeechNode-options-one-handle">
              <ExecHandle
                :id="`out-${option_index + 1}`"
                type="source"
                :position="Position.Right"
              ></ExecHandle>
            </div>
            <menu-button class="DialogSpeechNode-options-one-menu">
              <menu-list
                :menu-list="getOptionContextMenu(option, option_index)"
              />
            </menu-button>
          </ContextMenuZone>
        </div>
        <div
          v-if="!readonly"
          class="DialogSpeechNode-addOption"
          @click="addOption"
        >
          + {{ $t('imsDialogEditor.speech.addOption') }}
        </div>
      </div>
      <ExecHandle
        v-if="options.length === 0"
        id="out"
        type="source"
        :position="Position.Right"
      ></ExecHandle>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { Position } from '@vue-flow/core';
import type { NodeDescriptor } from './NodeDescriptor';
import ExecHandle from '../parts/ExecHandle.vue';
import type {
  NodeDataController,
  NodeDataOption,
} from '../editor/NodeDataController';
import ContextMenuZone from '~ims-app-base/components/Common/ContextMenuZone.vue';
import DataField from '../parts/DataField.vue';
import {
  AssetPropType,
  type AssetPropValueFile,
} from '~ims-app-base/logic/types/Props';
import { convertTranslatedTitle } from '~ims-app-base/logic/utils/assets';
import { generateDataPinId } from '../editor/DialogEditor';
import ConfirmDialog from '~ims-app-base/components/Common/ConfirmDialog.vue';
import type { ScriptBlockPlainPropValue } from '../logic/nodeStoring';
import DialogManager from '~ims-app-base/logic/managers/DialogManager';
import type { DialogBlockController } from '../editor/DialogBlockController';
import SpeechParametersDialog from '../dialogs/SpeechParametersDialog.vue';
import MenuButton from '~ims-app-base/components/Common/MenuButton.vue';
import MenuList from '~ims-app-base/components/Common/MenuList.vue';
import type { ScriptPlayNode } from '../play/ScriptPlayNode';
import type { DialogPlayer } from '../play/DialogPlayer';
import DialogSpeechNodeAttachCover from './DialogSpeechNodeAttachCover.vue';
import FilePresenter from '~ims-app-base/components/File/FilePresenter.vue';

export default defineComponent({
  name: 'DialogSpeechNode',
  components: {
    ExecHandle,
    ContextMenuZone,
    DataField,
    MenuButton,
    MenuList,
    DialogSpeechNodeAttachCover,
    FilePresenter,
  },
  inject: ['projectContext'],
  props: {
    id: {
      type: String,
      required: true,
    },
    dialogController: {
      type: Object as PropType<DialogBlockController>,
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
  data() {
    return {
      coverMenuShown: false,
    };
  },
  computed: {
    Position() {
      return Position;
    },
    options() {
      return this.nodeDataController.options;
    },
    mainSpeechList() {
      return this.dialogController.getMainSpeech();
    },
    mainSpeechVariablesHasDefault() {
      return !!this.mainSpeechList.find((v) => v.default);
    },
    optionSpeechList() {
      return this.dialogController.getOptionSpeech();
    },
    optionSpeechVariablesHasDefault() {
      return !!this.optionSpeechList.find((v) => v.default);
    },
    isPlaying() {
      return this.dialogPlayer.currentPlayingNode?.id === this.id;
    },
    coverValue: {
      get() {
        return this.nodeDataController.values[
          'cover'
        ] as null | AssetPropValueFile;
      },
      set(val: null | AssetPropValueFile) {
        this.nodeDataController.setValue('cover', val);
      },
    },
    coverMenu() {
      return [
        {
          title: this.$t('imsDialogEditor.speech.dettachCover'),
          action: () => this.deleteCover(),
          icon: 'delete',
          danger: true,
        },
      ];
    },
  },
  watch: {
    options() {
      this.updatePins();
    },
    mainSpeechList() {
      this.updatePins();
    },
    optionSpeechList() {
      this.updatePins();
    },
  },
  mounted() {
    this.updatePins();
  },
  methods: {
    setMainSpeechDefault() {
      for (const variable of this.mainSpeechList) {
        this.nodeDataController.deleteValue(variable.name);
      }
    },
    setOptionDefault(option_index: number) {
      for (const variable of this.optionSpeechList) {
        this.nodeDataController.deleteOptionValue(option_index, variable.name);
      }
    },
    async deleteCover() {
      const confirm = await this.$getAppManager()
        .get(DialogManager)
        .show(
          ConfirmDialog,
          {
            header: this.$t('imsDialogEditor.speech.dettachCover'),
            message: this.$t('imsDialogEditor.speech.dettachCoverConfirm'),
            danger: true,
          },
          this,
        );
      if (!confirm) {
        return;
      }
      this.coverValue = null;
      this.coverMenuShown = false;
    },
    getMainVariableCaption(var_index: number) {
      const variable = this.mainSpeechList[var_index];
      return variable &&
        variable.name === 'text' &&
        var_index === this.mainSpeechList.length - 1 &&
        variable.type &&
        !this.isInputPinConnected(variable.name)
        ? ''
        : convertTranslatedTitle(variable.title, (key: any) => this.$t(key));
    },
    getOptionVariableCaption(option_index: number, var_index: number) {
      const variable = this.optionSpeechList[var_index];
      const caption =
        variable.name === 'text' &&
        var_index === 0 &&
        variable.type &&
        !this.isInputPinConnected(variable.name)
          ? ''
          : convertTranslatedTitle(variable.title, (key: any) => this.$t(key));
      return var_index === 0
        ? option_index + 1 + (caption ? '. ' + caption : '')
        : caption;
    },
    generateDataPinId,
    isInputPinConnected(param: string, option_index?: number) {
      return this.nodeDataController.isPinConnected(
        generateDataPinId(false, param, option_index),
      );
    },
    convertTranslatedTitle(title: string) {
      return convertTranslatedTitle(title, (...args) => this.$t(...args));
    },
    updatePins() {
      for (const variable of this.mainSpeechList) {
        this.nodeDataController.setPinDataType(
          generateDataPinId(false, variable.name),
          variable.type,
        );
      }
      for (
        let option_index = 0;
        option_index < this.options.length;
        option_index++
      ) {
        for (const variable of this.optionSpeechList) {
          this.nodeDataController.setPinDataType(
            generateDataPinId(false, variable.name, option_index),
            variable.type,
          );
        }
        this.nodeDataController.setPinDataType(
          generateDataPinId(false, 'condition', option_index),
          {
            Type: AssetPropType.BOOLEAN,
          },
        );
      }
    },
    activate() {
      for (const variable_name of Object.keys(
        this.dialogController.state.__settings.speech.main,
      )) {
        if (
          !this.$refs['main-' + variable_name] ||
          (this.$refs['main-' + variable_name] as any).length === 0
        )
          continue;
        if (!this.nodeDataController.values[variable_name]) {
          (this.$refs['main-' + variable_name] as any)[0].focus();
          return;
        }
      }
    },
    async addOption() {
      const new_index = this.nodeDataController.addOption();
      this.updatePins();
      await this.$nextTick();
      let option_input = this.$refs['option-' + new_index];
      if (Array.isArray(option_input)) option_input = option_input[0];
      if (!option_input) return;
      (option_input as any).focus();
    },
    setOptionValue(option_index: number, value: ScriptBlockPlainPropValue) {
      this.nodeDataController.setOptionValue(option_index, 'text', value);
    },
    isOptionConditionDisplaying(option: NodeDataOption) {
      return option.values.condition !== undefined;
    },
    getOptionContextMenu(option: NodeDataOption, option_index: number) {
      if (this.readonly) return [];
      return [
        this.isOptionConditionDisplaying(option)
          ? {
              title: this.$t('imsDialogEditor.speech.deleteOptionCondition'),
              action: async () => {
                const confirm = await this.$getAppManager()
                  .get(DialogManager)
                  .show(ConfirmDialog, {
                    header: this.$t(
                      'imsDialogEditor.speech.deleteOptionCondition',
                    ),
                    message: this.$t(
                      'imsDialogEditor.speech.deleteOptionConditionConfirm',
                    ),
                    danger: true,
                  });
                if (!confirm) return;
                this.nodeDataController.deleteOptionValue(
                  option_index,
                  'condition',
                );
              },
              icon: 'ri-filter-off-fill',
            }
          : {
              title: this.$t('imsDialogEditor.speech.addOptionCondition'),
              action: async () => {
                this.nodeDataController.setOptionValue(
                  option_index,
                  'condition',
                  true,
                );
              },
              icon: 'ri-filter-fill',
            },
        {
          title: this.$t('imsDialogEditor.speech.deleteOption'),
          action: async () => {
            const confirm = await this.$getAppManager()
              .get(DialogManager)
              .show(ConfirmDialog, {
                header: this.$t('imsDialogEditor.speech.deleteOption'),
                message: this.$t('imsDialogEditor.speech.deleteOptionConfirm'),
                danger: true,
              });
            if (!confirm) return;
            this.nodeDataController.deleteOption(option_index);
          },
          danger: true,
          icon: 'delete',
        },
      ];
    },
    async openSpeechParametersDialog() {
      await this.$getAppManager()
        .get(DialogManager)
        .show(SpeechParametersDialog, {
          dialogController: this.dialogController,
          projectContext: this.projectContext,
        });
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
  },
});
</script>

<style lang="scss" scoped>
.DialogSpeechNode-prop-line {
  display: flex;
  margin-bottom: 10px;
  align-items: baseline;
}

.DialogSpeechNode-prop-line,
.DialogSpeechNode-options-one-param {
  &:not(:hover):deep(
      .DataField-in:not(.state-connected),
      .DataField-out:not(.state-connected)
    ) {
    opacity: 0;
  }
}
.DialogSpeechNode {
  max-width: 600px;
}

.DialogSpeechNode-prop-caption {
  margin-right: 5px;
}
.DialogSpeechNode-prop-content {
  flex: 1;
}

.DialogSpeechNode-header {
  padding: 7px 10px;
  font-size: 14px;
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}
.DialogSpeechNode-header-settings {
  &:deep(.is-button) {
    color: var(--imsde-node-header-text-color);
  }
  display: flex;
}
.DialogSpeechNode-content {
  padding-top: 7px;
}
.DialogSpeechNode-body {
  padding-bottom: 7px;
}
.DialogSpeechNode-addOption {
  font-weight: bold;
  font-size: 12px;
  padding: 10px 10px 0 10px;
  cursor: pointer;
  border-top: 1px solid var(--imsde-node-content-inner-border-color);
}
.DialogSpeechNode-contentPlaceholder {
  font-style: italic;
}

.DialogSpeechNode-speechContent {
  margin: 5px 0;
}

.DialogSpeechNode-options-one {
  position: relative;
  border-top: 1px solid var(--imsde-node-content-inner-border-color);
  padding: 10px 0;
  display: flex;
  align-items: center;
  &.state-unavailable {
    opacity: 0.5;
  }
}
.DialogSpeechNode-options-one-common {
  flex: 1;
}

.DialogSpeechNode-options-one-param {
  &:not(:last-child) {
    margin-bottom: 10px;
  }
  &:not(.type-first) {
    .DialogSpeechNode-options-one-param-input {
      padding-left: 22px;
    }
  }
}

.DialogSpeechNode-restore-button {
  margin: 0 10px;
}
.DialogSpeechNode-options {
  margin-top: 10px;
}

.DialogSpeechNode-prop-content {
  min-width: 100px;
}

.DialogSpeechNode-options-one-menu {
  opacity: 0;
  margin-right: 10px;
}
.DialogSpeechNode-options-one:hover {
  .DialogSpeechNode-options-one-menu {
    opacity: 100%;
  }
}

.DialogSpeechNode-options-one-select > .is-button {
  --button-border-color: var(--imsde-node-playing-color);
  &:not(:hover) {
    --button-text-color: var(--imsde-node-playing-color);
  }
  &:hover {
    --button-bg-color: var(--imsde-node-playing-color);
  }
}
.DialogSpeechNode-cover {
  position: relative;
}
.DialogSpeechNode-cover-image {
  max-width: 100%;
  object-fit: cover;
  max-height: 400px;
  display: block;
  margin: 0 auto;
}

.DialogSpeechNode-cover-menu {
  position: absolute;
  top: 0px;
  right: 0px;
  background-color: var(--local-bg-color);
  display: none;
  border-bottom-left-radius: 2px;
  color: var(--local-text-color);
}

.DialogSpeechNode-cover:hover .DialogSpeechNode-cover-menu,
.DialogSpeechNode-cover-menu.state-active {
  display: flex;
}
</style>
