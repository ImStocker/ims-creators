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
import { ScriptBlockPlainVariableKinds } from '../logic/nodeStoring';

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
        {
          key: ScriptBlockPlainVariableKinds.GLOBAL,
          title: this.$t('imsDialogEditor.var.kinds.global'),
          icon: 'ri-global-line',
        },
        {
          key: ScriptBlockPlainVariableKinds.LOCAL,
          title: this.$t('imsDialogEditor.var.kinds.local'),
          icon: 'ri-terminal-line',
        },
        {
          key: ScriptBlockPlainVariableKinds.IN,
          title: this.$t('imsDialogEditor.var.kinds.in'),
          icon: 'ri-contract-right-line',
        },
        {
          key: ScriptBlockPlainVariableKinds.OUT,
          title: this.$t('imsDialogEditor.var.kinds.out'),
          icon: 'ri-expand-right-line',
        },
        {
          key: ScriptBlockPlainVariableKinds.INOUT,
          title: this.$t('imsDialogEditor.var.kinds.in-out'),
          icon: 'ri-expand-horizontal-line',
        },
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
