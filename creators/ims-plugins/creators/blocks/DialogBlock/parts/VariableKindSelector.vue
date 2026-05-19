<template>
  <value-switcher
    v-model="ownModelValue"
    class="VariableKindSelector"
    :options="options"
    label-prop="title"
    value-prop="value"
  ></value-switcher>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import ValueSwitcher from '~ims-app-base/components/Common/ValueSwitcher.vue';
import { ScriptBlockPlainVariableKinds } from '../logic/nodeStoring';

export default defineComponent({
  name: 'VariableKindSelector',
  components: {
    ValueSwitcher,
  },
  props: {
    modelValue: {
      type: String as PropType<ScriptBlockPlainVariableKinds>,
      default: ScriptBlockPlainVariableKinds.LOCAL,
    },
  },
  emits: ['update:model-value'],
  computed: {
    ownModelValue: {
      get() {
        return this.modelValue ?? ScriptBlockPlainVariableKinds.LOCAL;
      },
      set(val: ScriptBlockPlainVariableKinds) {
        this.$emit('update:model-value', val);
      },
    },
    options() {
      const available_kinds = ['local', 'in', 'out', 'in-out'];
      return available_kinds.map((k) => {
        return {
          title: this.$t('imsDialogEditor.var.kinds.' + k),
          value: k,
        };
      });
    },
  },
});
</script>
