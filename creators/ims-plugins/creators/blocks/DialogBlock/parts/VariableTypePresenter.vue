<template>
  <div class="VariableTypePresenter">{{ typeTitle }}</div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { AssetPropValueType } from '~ims-app-base/logic/types/Props';
import { getVariableTypeTitleKey } from '../logic/variableTypes';

export default defineComponent({
  name: 'VariableTypePresenter',
  props: {
    modelValue: {
      type: [Object, null] as PropType<AssetPropValueType | null>,
      default: null,
    },
  },
  computed: {
    typeTitle(): string {
      return this.$t(getVariableTypeTitleKey(this.modelValue));
    },
  },
});
</script>

<style lang="scss" scoped>
.VariableTypePresenter {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
