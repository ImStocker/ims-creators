<template>
  <dialog-content class="EnterActionDialog">
    <template #content>
      <div class="EnterActionDialog-field">
        <div class="EnterActionDialog-field-caption">
          {{ $t('imsDialogEditor.actions.enterName') }}
        </div>
        <div class="EnterActionDialog-field-input">
          <ims-input v-model="action.name"></ims-input>
        </div>
      </div>
      <div
        v-if="!dialog.state.params?.disableTypeChange"
        class="EnterActionDialog-field"
      >
        <div class="EnterActionDialog-field-caption">
          {{ $t('imsDialogEditor.actions.selectType') }}
        </div>
        <div class="EnterActionDialog-field-input">
          <value-switcher
            v-model="action.type"
            class="EnterActionDialog-selectType"
            :options="availableActionTypes"
            label-prop="title"
            value-prop="value"
          >
            <template #option="{ option }">
              <div class="EnterActionDialog-selectType-option">
                <i
                  :class="option.icon"
                  class="EnterActionDialog-selectType-option-icon"
                ></i>
                <div class="EnterActionDialog-selectType-option-title">
                  {{ option.title }}
                </div>
              </div>
            </template>
          </value-switcher>
        </div>
      </div>
      <div class="EnterActionDialog-field">
        <div class="EnterActionDialog-field-caption">
          {{ $t('imsDialogEditor.actions.inputParameters') }}
        </div>
        <div class="EnterActionDialog-field-input">
          <variable-list
            class="EnterActionDialog-params input tiny-scrollbars"
            :collection-controller="inputParametersController"
          ></variable-list>
        </div>
        <button class="is-button is-button-action" @click="addParameter('in')">
          {{ $t('imsDialogEditor.actions.addInputParameter') }}
        </button>
      </div>
      <div class="EnterActionDialog-field">
        <div class="EnterActionDialog-field-caption">
          {{ $t('imsDialogEditor.actions.outputParameters') }}
        </div>
        <div class="EnterActionDialog-field-input">
          <variable-list
            class="EnterActionDialog-params output tiny-scrollbars"
            :collection-controller="outputParametersController"
          ></variable-list>
        </div>
        <button class="is-button is-button-action" @click="addParameter('out')">
          {{ $t('imsDialogEditor.actions.addOutputParameter') }}
        </button>
      </div>
    </template>
    <template #footer>
      <div class="Form-row-buttons">
        <div
          class="EnterActionDialog-buttons Form-row-buttons-center use-buttons-action"
        >
          <button type="button" class="is-button" @click="dialog.close()">
            {{ $t('common.dialogs.cancel') }}
          </button>
          <button
            type="button"
            class="is-button accent"
            :disabled="!canSave"
            @click="save"
          >
            {{ $t('common.dialogs.ok') }}
          </button>
        </div>
      </div>
    </template>
  </dialog-content>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import DialogContent from '~ims-app-base/components/Dialog/DialogContent.vue';
import type { DialogAction } from '../editor/DialogBlockController';
import type { DialogInterface } from '~ims-app-base/logic/managers/DialogManager';
import {
  ScriptBlockPlainActionTypes,
  type ScriptBlockPlainVariable,
} from '../logic/nodeStoring';
import ImsInput from '~ims-app-base/components/Common/ImsInput.vue';
import ValueSwitcher from '~ims-app-base/components/Common/ValueSwitcher.vue';
import VariableList from './VariableList.vue';
import type { IDialogVariableController } from '../editor/DialogVariableController';
import DialogManager from '~ims-app-base/logic/managers/DialogManager';
import EnterVariableDialog from './EnterVariableDialog.vue';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import { getAvailableActionTypes } from '../logic/nodeActions';

type DialogProps = {
  initial?: DialogAction;
  validate?: (variable: DialogAction) => void | Promise<void>;
  params?: {
    disableTypeChange?: boolean;
  };
};

type DialogResult = DialogAction | null;

export default defineComponent({
  name: 'EnterActionDialog',
  components: {
    DialogContent,
    ImsInput,
    ValueSwitcher,
    VariableList,
  },
  props: {
    dialog: {
      type: Object as PropType<DialogInterface<DialogProps, DialogResult>>,
      required: true,
    },
  },
  data() {
    return {
      action: {
        name: this.dialog.state.initial?.name ?? '',
        type:
          this.dialog.state.initial?.type ??
          ScriptBlockPlainActionTypes.TRIGGER,
        params: this.dialog.state.initial?.params ?? null,
      } as DialogAction,
    };
  },
  computed: {
    canSave() {
      return this.action.name && this.action.name.trim();
    },
    inputParametersController(): IDialogVariableController {
      return this._createParametersController(
        'in',
        this.$t('imsDialogEditor.actions.inputParamsAlreadyExists'),
      );
    },
    outputParametersController(): IDialogVariableController {
      return this._createParametersController(
        'out',
        this.$t('imsDialogEditor.actions.outputParamsAlreadyExists'),
      );
    },
    availableActionTypes() {
      return getAvailableActionTypes((key: string) => this.$t(key));
    },
  },
  methods: {
    async save() {
      if (!this.action.name) {
        return;
      }
      await this.$getAppManager()
        .get(UiManager)
        .doTask(async () => {
          if (
            this.action.type === ScriptBlockPlainActionTypes.FUNCTION &&
            !this.action.params?.out?.length
          ) {
            throw new Error(
              this.$t('imsDialogEditor.actions.atLeastOneOutputParam'),
            );
          }
          if (this.dialog.state.validate) {
            await this.dialog.state.validate(this.action);
          }
          this.dialog.close({
            ...this.action,
          });
        });
    },
    _createParametersController(
      type: 'in' | 'out',
      alreadyExistsCaption: string,
    ): IDialogVariableController {
      const key = type;

      return {
        getEntities: () => {
          return this.action.params?.[key] ?? [];
        },
        addEntity: (variable: ScriptBlockPlainVariable) => {
          if (
            this.action.params?.[key]?.find((el) => el.name === variable.name)
          ) {
            throw new Error(alreadyExistsCaption);
          }
          if (!this.action.params) {
            this.action.params = { in: [], out: [] };
          }
          this.action.params[key].push(variable);
        },
        canDeleteEntity: (_variable_name: string) => true,
        changeEntity: (
          variable_name: string,
          variable: ScriptBlockPlainVariable,
        ) => {
          const existing_var_index = this.action.params?.[key]?.findIndex(
            (el) => el.name === variable_name,
          );
          if (existing_var_index !== undefined && existing_var_index >= 0) {
            this.action.params![key][existing_var_index] = variable;
          }
        },
        createEntity: async () => {
          const res = await this.$getAppManager()
            .get(DialogManager)
            .show(EnterVariableDialog);
          if (!res) return null;
          return res;
        },
        deleteEntity: (variable_name: string) => {
          const existing_var_index = this.action.params?.[key]?.findIndex(
            (el) => el.name === variable_name,
          );
          if (existing_var_index !== undefined && existing_var_index >= 0) {
            this.action.params![key].splice(existing_var_index, 1);
          }
        },
        reorderEntities: (variables: ScriptBlockPlainVariable[]) => {
          if (!this.action.params) {
            this.action.params = { in: [], out: [] };
          }
          this.action.params[key] = variables;
        },
      };
    },
    async addParameter(type: 'in' | 'out') {
      const controller =
        type === 'in'
          ? this.inputParametersController
          : this.outputParametersController;
      const res = await controller.createEntity();
      if (!res) return;
      controller.addEntity(res);
    },
  },
});
</script>
<style lang="scss" scoped>
.EnterActionDialog {
  width: 700px;
}
.EnterActionDialog-field-caption {
  text-align: center;
  margin-bottom: 5px;
}
.EnterActionDialog-field {
  margin-bottom: 10px;
}
.EnterActionDialog-selectType {
  :deep(.ref-item) {
    flex: 1;
  }
}
.EnterActionDialog-params {
  max-height: 300px;
  overflow: auto;
}
.EnterActionDialog-selectType-option {
  display: flex;
  gap: 5px;
}
</style>
