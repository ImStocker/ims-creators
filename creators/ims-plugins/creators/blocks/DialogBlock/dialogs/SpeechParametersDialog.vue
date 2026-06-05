<template>
  <dialog-content
    class="SpeechParametersDialog"
    @escape-press="choose(false)"
    @enter-press="choose(true)"
  >
    <div class="SpeechParametersDialog">
      <div class="Form">
        <div class="Dialog-header">
          {{ $t('imsDialogEditor.speech.parameters') }}
        </div>
        <div class="Dialog-message">
          <div>
            <div class="Dialog-message-header">
              {{ $t('imsDialogEditor.speech.speechProperties') }}
            </div>
            <variable-list
              :show-auto-fill="true"
              :collection-controller="mainSpeechController"
            ></variable-list>
            <button
              type="button"
              class="is-button"
              @click="addSettingSpeechMain"
            >
              {{ $t('imsDialogEditor.speech.add') }}
            </button>
          </div>
          <div>
            <div class="Dialog-message-header">
              {{ $t('imsDialogEditor.speech.responseOptionsProperties') }}
            </div>
            <variable-list
              :collection-controller="optionSpeechController"
            ></variable-list>
            <button
              type="button"
              class="is-button"
              @click="addSettingSpeechOption"
            >
              {{ $t('imsDialogEditor.speech.add') }}
            </button>
          </div>
        </div>
        <div class="Form-row-buttons">
          <div class="Form-row-buttons-center use-buttons-action">
            <button type="button" class="is-button" @click="choose(null)">
              {{ $t('common.dialogs.close') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </dialog-content>
</template>

<script lang="ts" type="text/ecmascript-6">
import { defineComponent, type PropType } from 'vue';
import DialogContent from '~ims-app-base/components/Dialog/DialogContent.vue';
import type { DialogInterface } from '~ims-app-base/logic/managers/DialogManager';
import VariableList from './VariableList.vue';
import { nodeVariableAdd } from '../logic/nodeVariables';
import type { IDialogVariableController } from '../editor/DialogVariableController';
import type {
  DialogBlockController,
  DialogVariable,
} from '../editor/DialogBlockController';
import type { IProjectContext } from '~ims-app-base/logic/types/IProjectContext';

type DialogProps = {
  dialogController: DialogBlockController;
  projectContext: IProjectContext;
};

type DialogResult = boolean | undefined | null;

export default defineComponent({
  name: 'SpeechParametersDialog',
  components: {
    DialogContent,
    VariableList,
  },
  provide() {
    return {
      projectContext: this.dialog.state.projectContext,
    };
  },
  props: {
    dialog: {
      type: Object as PropType<DialogInterface<DialogProps, DialogResult>>,
      required: true,
    },
  },
  computed: {
    mainSpeechController(): IDialogVariableController {
      return {
        getEntities: () => this.dialogController.getMainSpeech(),
        addEntity: (variable: DialogVariable) =>
          this.dialogController.addMainSpeech(variable),
        changeEntity: (variable_name: string, variable: DialogVariable) =>
          this.dialogController.changeMainSpeech(variable_name, variable),
        deleteEntity: (variable_name: string) =>
          this.dialogController.deleteMainSpeech(variable_name),
        canDeleteEntity: (variable_name: string) => variable_name !== 'text',
        reorderEntities: (variables: DialogVariable[]) =>
          this.dialogController.reorderMainSpeech(variables),
        createEntity: async () => {
          const new_variable = await nodeVariableAdd(
            this.$getAppManager(),
            this.mainSpeechList,
            {
              alreadyExist: this.$t(
                'imsDialogEditor.var.variableAlreadyExists',
              ),
            },
            true,
          );
          return new_variable ?? null;
        },
      };
    },
    optionSpeechController(): IDialogVariableController {
      return {
        getEntities: () => this.dialogController.getOptionSpeech(),
        addEntity: (variable: DialogVariable) =>
          this.dialogController.addOptionSpeech(variable),
        changeEntity: (variable_name: string, variable: DialogVariable) =>
          this.dialogController.changeOptionSpeech(variable_name, variable),
        deleteEntity: (variable_name: string) =>
          this.dialogController.deleteOptionSpeech(variable_name),
        canDeleteEntity: (variable_name: string) => variable_name !== 'text',
        reorderEntities: (variables: DialogVariable[]) =>
          this.dialogController.reorderOptionSpeech(variables),
        createEntity: async () => {
          const new_variable = await nodeVariableAdd(
            this.$getAppManager(),
            this.optionSpeechList,
            {
              alreadyExist: this.$t(
                'imsDialogEditor.var.variableAlreadyExists',
              ),
            },
          );
          if (!new_variable) return null;
          const max_index = Math.max(
            ...[
              ...this.optionSpeechList.map((option) =>
                option.index ? option.index : 0,
              ),
              0,
            ],
          );
          return { ...new_variable, index: max_index + 1 };
        },
      };
    },
    dialogController() {
      return this.dialog.state.dialogController;
    },
    mainSpeechList() {
      return [...this.mainSpeechController.getEntities()];
    },
    optionSpeechList() {
      return [...this.optionSpeechController.getEntities()];
    },
  },
  methods: {
    async addSettingSpeechMain() {
      const new_variable = await this.mainSpeechController.createEntity();
      if (!new_variable) return;
      this.mainSpeechController.addEntity(new_variable);
    },
    async addSettingSpeechOption() {
      debugger;
      const new_variable = await this.optionSpeechController.createEntity();
      if (!new_variable) return;
      this.optionSpeechController.addEntity(new_variable);
    },
    choose(val: boolean | null) {
      this.dialog.close(val);
    },
  },
});
</script>

<style lang="scss" rel="stylesheet/scss" scoped>
.SpeechParametersDialog {
  width: 700px;
  max-width: 100%;
  margin: auto;
  .Dialog-message {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .Dialog-message-header {
    font-size: 16px;
    margin-bottom: 10px;
    font-weight: bold;
    text-align: center;
  }
  .Form-row-buttons-center {
    text-align: center;
  }
}
</style>
