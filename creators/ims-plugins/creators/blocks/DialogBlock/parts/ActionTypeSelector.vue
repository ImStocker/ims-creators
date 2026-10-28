<template>
  <segmented-tabs
    v-model="ownModelValue"
    class="ActionTypeSelector"
    variant="raised"
    :style="{
      '--SegmentedTabs-item-gap': '2px',
    }"
    :items="items"
  />
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import SegmentedTabs from '~ims-app-base/components/Common/SegmentedTabs.vue';
import type { ScriptBlockPlainActionTypes } from '../logic/nodeStoring';

export default defineComponent({
  name: 'ActionTypeSelector',
  components: {
    SegmentedTabs,
  },
  props: {
    modelValue: {
      type: [String, null] as PropType<ScriptBlockPlainActionTypes | null>,
      default: null,
    },
  },
  emits: ['update:model-value'],
  computed: {
    ownModelValue: {
      get() {
        return this.modelValue ?? null;
      },
      set(val: ScriptBlockPlainActionTypes | null) {
        this.$emit('update:model-value', val);
      },
    },
    items() {
      return [
        {
          key: null,
          label: this.$t('imsDialogEditor.actions.types.all'),
          hint: this.$t('imsDialogEditor.actions.types.all'),
        },
        {
          key: 'trigger',
          hint: this.$t('imsDialogEditor.actions.types.triggers'),
          icon: 'ri-flashlight-fill',
        },
        {
          key: 'function',
          hint: this.$t('imsDialogEditor.actions.types.functions'),
          icon: 'ri-formula',
        },
      ];
    },
  },
});
</script>
<style lang="scss" scoped>
.ActionTypeSelector {
  flex-shrink: 0;
  height: 36px;
}
</style>
