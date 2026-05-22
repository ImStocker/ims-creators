<template>
  <value-switcher
    v-model="ownModelValue"
    class="ActionTypeSelector"
    :options="availableActionTypes"
    label-prop="title"
    value-prop="value"
  >
    <template #option="{ option }">
      <div class="ActionTypeSelector-option">
        <i
          v-if="option.icon"
          :class="option.icon"
          class="ActionTypeSelector-option-icon"
        ></i>
        <div class="ActionTypeSelector-option-title">
          {{ option.title }}
        </div>
      </div>
    </template>
  </value-switcher>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { ScriptBlockPlainActionTypes } from '../logic/nodeStoring';
import { getAvailableActionTypes } from '../logic/nodeActions';
import ValueSwitcher from '~ims-app-base/components/Common/ValueSwitcher.vue';

export default defineComponent({
  name: 'ActionTypeSelector',
  components: {
    ValueSwitcher,
  },
  props: {
    modelValue: {
      type: [String, null] as PropType<ScriptBlockPlainActionTypes | null>,
      required: true,
    },
    nullable: {
      type: Boolean,
      default: null,
    },
  },
  emits: ['update:model-value'],
  computed: {
    ownModelValue: {
      get() {
        return this.modelValue;
      },
      set(val: ScriptBlockPlainActionTypes | null) {
        this.$emit('update:model-value', val);
      },
    },
    availableActionTypes() {
      const res = getAvailableActionTypes((key: string) => this.$t(key));
      if (this.nullable) {
        res.unshift({
          title: this.$t('imsDialogEditor.actions.all'),
          value: null,
        });
      }
      return res;
    },
  },
});
</script>
<style lang="scss" scoped>
.ActionTypeSelector-option {
  display: flex;
  gap: 5px;
}
</style>
