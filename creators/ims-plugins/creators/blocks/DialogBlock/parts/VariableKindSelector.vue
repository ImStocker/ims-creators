<template>
  <segmented-tabs
    v-model="ownModelValue"
    class="VariableKindSelector"
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
import type { ScriptBlockPlainVariableKinds } from '../logic/nodeStoring';
import { VARIABLE_KINDS } from '../logic/variableKinds';

export default defineComponent({
  name: 'VariableKindSelector',
  components: {
    SegmentedTabs,
  },
  props: {
    modelValue: {
      type: [String, null] as PropType<ScriptBlockPlainVariableKinds | null>,
      default: null,
    },
    showAll: {
      type: Boolean,
      default: true,
    },
  },
  emits: ['update:model-value'],
  computed: {
    ownModelValue: {
      get() {
        return this.modelValue ?? null;
      },
      set(val: ScriptBlockPlainVariableKinds | null) {
        this.$emit('update:model-value', val);
      },
    },
    items() {
      const items = [
        {
          key: null,
          label: this.$t('imsDialogEditor.var.kinds.all'),
          title: this.$t('imsDialogEditor.var.kinds.all'),
        },
        ...VARIABLE_KINDS.map((option) => ({
          key: option.kind,
          title: this.$t(option.titleKey),
          icon: option.icon,
        })),
      ];
      return this.showAll ? items : items.slice(1);
    },
  },
});
</script>
<style lang="scss" scoped>
.VariableKindSelector {
  flex-shrink: 0;
}
</style>
