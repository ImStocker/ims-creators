<template>
  <dialog-content
    class="EnterVariableDialog"
    @enter-press="save"
    @escape-press="dialog.close()"
  >
    <div class="Dialog-body">
      <div class="EnterVariableDialog-field">
        <div class="EnterVariableDialog-field-caption">
          {{ $t('imsDialogEditor.var.enterName') }}
        </div>
        <div class="EnterVariableDialog-field-control">
          <ims-input
            :model-value="variable.title"
            @update:model-value="setTitle($event)"
          ></ims-input>
        </div>
      </div>
      <div class="EnterVariableDialog-field">
        <div class="EnterVariableDialog-field-caption">
          {{ $t('imsDialogEditor.var.enterServiceName') }}
        </div>
        <div class="EnterVariableDialog-field-control">
          <ims-input
            :model-value="variable.name"
            @update:model-value="setName($event)"
          ></ims-input>
        </div>
      </div>
      <div
        v-if="dialog.state.showKindControl"
        class="EnterVariableDialog-field"
      >
        <div class="EnterVariableDialog-field-caption">
          {{ $t('imsDialogEditor.var.enterKind') }}
        </div>
        <div class="EnterVariableDialog-field-control">
          <variable-kind-selector
            v-model="variable.kind"
            class="EnterVariableDialog-selectKind"
          ></variable-kind-selector>
        </div>
      </div>
      <div class="EnterVariableDialog-field">
        <div class="EnterVariableDialog-field-caption">
          {{ $t('imsDialogEditor.var.enterDataType') }}
        </div>
        <div class="EnterVariableDialog-field-control">
          <variable-type-selector
            v-model="variable.type"
          ></variable-type-selector>
        </div>
      </div>
      <div class="EnterVariableDialog-field">
        <div class="EnterVariableDialog-field-caption">
          {{ $t('imsDialogEditor.var.enterDescription') }}
        </div>
        <div class="EnterVariableDialog-field-control">
          <ims-input v-model="variableDescription" type="textarea"></ims-input>
        </div>
      </div>
      <div v-if="dialog.state.showAutoFill" class="EnterVariableDialog-field">
        <div class="EnterVariableDialog-field-control">
          <FormCheckBox
            :value="variable.autoFill"
            :icon="'ri-arrow-right-box-line'"
            :caption="$t('imsDialogEditor.speech.autoSubstitutionHelpText')"
            @input="variable.autoFill = $event"
          />
        </div>
      </div>
    </div>
    <div class="Form-row-buttons">
      <div class="Form-row-buttons-center use-buttons-action">
        <button type="button" class="is-button" @click="dialog.close()">
          {{ $t('common.dialogs.cancel') }}
        </button>
        <button
          type="button"
          class="is-button accent EnterVariableDialog-button-ok"
          :disabled="!variable.name || !variable.name.trim()"
          @click="save"
        >
          {{ $t('common.dialogs.ok') }}
        </button>
      </div>
    </div>
  </dialog-content>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import DialogContent from '~ims-app-base/components/Dialog/DialogContent.vue';
import type { DialogInterface } from '~ims-app-base/logic/managers/DialogManager';
import type { DialogVariable } from '../editor/DialogBlockController';
import { normalizeAssetPropPart } from '~ims-app-base/logic/types/Props';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import ImsInput from '~ims-app-base/components/Common/ImsInput.vue';
import VariableTypeSelector from '../parts/VariableTypeSelector.vue';
import FormCheckBox from '~ims-app-base/components/Form/FormCheckBox.vue';
import VariableKindSelector from '../parts/VariableKindSelector.vue';
import { ScriptBlockPlainVariableKinds } from '../logic/nodeStoring';

type DialogProps = {
  initial?: DialogVariable;
  validate: (variable: DialogVariable) => void | Promise<void>;
  showAutoFill?: boolean;
  showKindControl?: boolean;
};

type DialogResult = DialogVariable | null;

export default defineComponent({
  name: 'EnterVariableDialog',
  components: {
    DialogContent,
    ImsInput,
    VariableTypeSelector,
    VariableKindSelector,
    FormCheckBox,
  },
  props: {
    dialog: {
      type: Object as PropType<DialogInterface<DialogProps, DialogResult>>,
      required: true,
    },
  },
  data() {
    return {
      variable: {
        name: this.dialog.state.initial?.name ?? '',
        title: this.dialog.state.initial?.title ?? '',
        type: this.dialog.state.initial?.type ?? null,
        description: this.dialog.state.initial?.description ?? null,
        autoFill: this.dialog.state.initial?.autoFill ?? null,
        kind:
          this.dialog.state.initial?.kind ??
          ScriptBlockPlainVariableKinds.GLOBAL,
      } as DialogVariable,
      hasUserInteractedWithServiceName: false,
    };
  },
  computed: {
    ScriptBlockPlainVariableKinds() {
      return ScriptBlockPlainVariableKinds;
    },
    variableDescription: {
      get() {
        return this.variable.description ?? '';
      },
      set(val: string) {
        this.variable.description = val ? val : '';
      },
    },
  },
  methods: {
    setTitle(val: string) {
      if (!this.variable.name || !this.hasUserInteractedWithServiceName) {
        this.variable.name = normalizeAssetPropPart(val);
      }
      this.variable.title = val;
    },
    setName(val: string) {
      if (!val.trim()) {
        this.hasUserInteractedWithServiceName = false;
      } else {
        this.hasUserInteractedWithServiceName = true;
      }
      this.variable.name = normalizeAssetPropPart(val);
    },
    async save() {
      if (!this.variable.name) {
        return;
      }
      await this.$getAppManager()
        .get(UiManager)
        .doTask(async () => {
          if (this.dialog.state.validate) {
            await this.dialog.state.validate(this.variable);
          }
          this.dialog.close({
            ...this.variable,
          });
        });
    },
  },
});
</script>

<style lang="scss" rel="stylesheet/scss" scoped>
@use '~ims-app-base/style/Form';

.EnterVariableDialog {
  width: 500px;
}
.EnterVariableDialog-field-caption {
  text-align: center;
  margin-bottom: 5px;
}
.EnterVariableDialog-field {
  margin-bottom: 10px;
}
.EnterVariableDialog-selectKind {
  :deep(.ref-item) {
    flex: 1;
  }
}
</style>
