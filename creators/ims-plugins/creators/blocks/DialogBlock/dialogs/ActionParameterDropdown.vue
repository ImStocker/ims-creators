<template>
  <dropdown-element
    class="ActionParameterDropdown"
    :shown="true"
    @update:shown="onShown"
  >
    <div class="ActionParameterDropdown-content">
      <div class="ActionParameterDropdown-field">
        <div class="ActionParameterDropdown-caption">
          {{ $t('imsDialogEditor.var.name') }}
        </div>
        <ims-text-input
          :autofocus="focusField === 'title'"
          :model-value="param.title ?? ''"
          :placeholder="param.name"
          @update:model-value="change({ title: $event })"
          @enter="$emit('close')"
          @escape="$emit('close')"
        ></ims-text-input>
      </div>
      <div class="ActionParameterDropdown-field">
        <div class="ActionParameterDropdown-caption">
          {{ $t('imsDialogEditor.var.dataType') }}
        </div>
        <variable-type-selector
          ref="typeSelector"
          :model-value="param.type"
          @update:model-value="change({ type: $event })"
        ></variable-type-selector>
      </div>
    </div>
  </dropdown-element>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { ScriptBlockPlainVariable } from '../logic/nodeStoring';
import DropdownElement from '~ims-app-base/components/Common/DropdownElement.vue';
import ImsTextInput from '~ims-app-base/components/Common/ImsTextInput.vue';
import VariableTypeSelector from '../parts/VariableTypeSelector.vue';

export type ActionParameterDropdownFocus = 'title' | 'type';

export default defineComponent({
  name: 'ActionParameterDropdown',
  components: {
    DropdownElement,
    ImsTextInput,
    VariableTypeSelector,
  },
  props: {
    param: {
      type: Object as PropType<ScriptBlockPlainVariable>,
      required: true,
    },
    focusField: {
      type: String as PropType<ActionParameterDropdownFocus>,
      default: 'title',
    },
  },
  emits: ['change', 'close'],
  mounted() {
    if (this.focusField === 'type') {
      this.$nextTick(() => {
        const type_selector = this.$refs['typeSelector'] as
          | { $el?: HTMLElement }
          | undefined;
        const input = type_selector?.$el?.querySelector('input');
        (input as HTMLInputElement | null)?.focus();
      });
    }
  },
  methods: {
    change(change: Partial<ScriptBlockPlainVariable>) {
      this.$emit('change', {
        ...this.param,
        ...change,
      });
    },
    onShown(shown: boolean) {
      if (!shown) {
        this.$emit('close');
      }
    },
  },
});
</script>
<style lang="scss" rel="stylesheet/scss" scoped>
.ActionParameterDropdown {
  width: 260px;
}

.ActionParameterDropdown-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  background: var(--local-bg-color);
  border: 1px solid var(--local-border-color);
  border-radius: 8px;
}

.ActionParameterDropdown-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.ActionParameterDropdown-caption {
  font-weight: bold;
}
</style>
