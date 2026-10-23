<template>
  <ims-select
    class="VariableSelector nodrag nopan"
    :model-value="selectedOption"
    :options="variableOptions"
    :get-option-label="(opt: VarOpt) => opt.title"
    :get-option-key="(opt: VarOpt) => opt.key"
    :clearable="true"
    :title="selectedOption?.variable?.description ?? ''"
    :disabled="readonly"
    @update:model-value="setVariable($event)"
  >
    <template #option="{ option }">
      <button v-if="option" class="is-button is-button-dropdown-item">
        <span
          v-if="option.variable"
          class="VariableSelector-type-circle field-type-dot"
          :class="typeDotClass(option.variable.type)"
        ></span>
        {{ option.title }}
      </button>
    </template>
  </ims-select>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import ImsSelect from '~ims-app-base/components/Common/ImsSelect.vue';
import type {
  DialogBlockController,
  DialogVariable,
} from '../editor/DialogBlockController';
import type { IProjectContext } from '~ims-app-base/logic/types/IProjectContext';
import { assert } from '~ims-app-base/logic/utils/typeUtils';
import { getVariableTypeDotClass } from '../logic/variableTypes';

type VarOpt = {
  variable: DialogVariable | null;
  title: string;
  key: string;
};

const VAR_OPT_MANAGE_KEY = '--!manage!--';

export default defineComponent({
  name: 'VaraibleSelector',
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
      type: Object as PropType<DialogVariable | null>,
      default: null,
    },
    readonly: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue'],
  computed: {
    selectedOption(): VarOpt | null {
      const model_value = this.modelValue;
      if (!model_value) return null;
      const variable = this.variableOptions.find(
        (opt) => opt.variable && opt.variable.name === model_value.name,
      );
      if (variable) return variable;
      return {
        variable: model_value,
        title: model_value.title,
        key: model_value.name,
      };
    },
    variableOptions(): VarOpt[] {
      return [
        ...[
          ...this.dialogController.getVariables().map((x) => {
            return {
              variable: x,
              title: x.title,
              key: x.name,
            };
          }),
        ].sort((a, b) => a.title.localeCompare(b.title)),
        {
          variable: null,
          title: this.$t('imsDialogEditor.var.manageVariables') + '...',
          key: VAR_OPT_MANAGE_KEY,
        },
      ];
    },
  },
  methods: {
    typeDotClass(type: DialogVariable['type']): string {
      return getVariableTypeDotClass(type);
    },
    setVariable(new_val: VarOpt | null) {
      if (new_val && !new_val.variable && new_val.key === VAR_OPT_MANAGE_KEY) {
        assert(this.projectContext, 'Project context is not provided');
        this.dialogController.manageVariables(
          this.projectContext as IProjectContext,
        );
      } else {
        this.$emit(
          'update:modelValue',
          new_val && new_val.variable ? new_val.variable : null,
        );
      }
    },
  },
});
</script>

<style lang="scss" scoped>
@use '~ims-app-base/style/field-type-dot' as *;
</style>
