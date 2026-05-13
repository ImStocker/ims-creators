<template>
  <ims-select
    class="ActionSelector"
    :disabled="readonly"
    :options="actionOptions"
    :model-value="selectedOption"
    :get-option-key="(opt: ActionOpt) => opt.key"
    :get-option-label="(opt: ActionOpt) => opt.title"
    @update:model-value="setAction($event)"
  >
    <template #list-footer="{ search, searching }">
      <button
        v-if="searching"
        class="is-button is-button-dropdown-item"
        @click="createAction(search)"
      >
        {{ $t('imsDialogEditor.actions.createAction') }}
      </button>
      <button class="is-button is-button-dropdown-item" @click="manageActions">
        {{ $t('imsDialogEditor.actions.manageActions') }}...
      </button>
    </template>
  </ims-select>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import ImsSelect from '~ims-app-base/components/Common/ImsSelect.vue';
import type {
  DialogAction,
  DialogBlockController,
} from '../editor/DialogBlockController';
import { ScriptBlockPlainActionTypes } from '../logic/nodeStoring';
import DialogManager from '~ims-app-base/logic/managers/DialogManager';
import EnterActionDialog from '../dialogs/EnterActionDialog.vue';
import type { IProjectContext } from '~ims-app-base/logic/types/IProjectContext';

type ActionOpt = {
  action: DialogAction | null;
  title: string;
  key: string;
};

export default defineComponent({
  name: 'ActionSelector',
  components: {
    ImsSelect,
  },
  inject: ['projectContext'],
  props: {
    dialogController: {
      type: Object as PropType<DialogBlockController>,
      required: true,
    },
    modelValue: {
      type: String,
      default: null,
    },
    readonly: {
      type: Boolean,
      default: false,
    },
    actionType: {
      type: String as PropType<ScriptBlockPlainActionTypes>,
      default: ScriptBlockPlainActionTypes.TRIGGER,
    },
  },
  emits: ['update:model-value'],
  computed: {
    selectedOption() {
      const model_value = this.modelValue;
      if (!model_value) return;
      const action = this.actionOptions.find(
        (opt) => opt.action && opt.action.name === model_value,
      );
      if (action) return action;
      return {
        action: null,
        title: model_value,
        key: model_value,
      };
    },
    actionOptions(): ActionOpt[] {
      return [
        ...this.dialogController
          .getActions()
          .filter((x) => x.type === this.actionType)
          .map((x) => {
            return {
              action: x,
              title: x.name,
              key: x.name,
            };
          }),
      ].sort((a, b) => a.title.localeCompare(b.title));
    },
  },
  methods: {
    async manageActions() {
      await this.dialogController.manageActions(
        this.projectContext as IProjectContext,
      );
    },
    async createAction(name: string) {
      const new_action = await this.$getAppManager()
        .get(DialogManager)
        .show(EnterActionDialog, {
          initial: {
            type: this.actionType,
            name,
          },
          params: {
            disableTypeChange: true,
          },
        });
      if (!new_action) return;
      this.dialogController.addAction(new_action);
      this.$emit('update:model-value', new_action.name);
    },
    setAction(new_val: ActionOpt | null) {
      this.$emit(
        'update:model-value',
        new_val?.action?.name ? new_val.action.name : null,
      );
    },
  },
});
</script>
