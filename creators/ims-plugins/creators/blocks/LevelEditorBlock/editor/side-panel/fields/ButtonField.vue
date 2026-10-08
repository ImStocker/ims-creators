<template>
  <button
    class="is-button is-button-text ButtonField"
    :disabled="readonly"
    @click="$emit('update:model-value', !modelValue)"
  >
    <div v-if="activeIcon" class="ButtonField-icon">
      <i :class="activeIcon"></i>
    </div>
    <div class="ButtonField-label">
      {{ $t('levelEditor.properties.fields.' + activeLabel) }}
    </div>
  </button>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue';

export default defineComponent({
  name: 'ButtonField',
  props: {
    modelValue: {
      type: Boolean,
      default: false,
    },
    icon: {
      type: String,
      default: null,
    },
    label: {
      type: String,
      required: true,
    },
    checkedIcon: {
      type: String as PropType<string | null>,
      default: null,
    },
    checkedLabel: {
      type: String as PropType<string | null>,
      default: null,
    },
    readonly: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:model-value'],
  computed: {
    activeIcon() {
      return this.modelValue ? (this.checkedIcon ?? this.icon) : this.icon;
    },
    activeLabel() {
      return this.modelValue ? (this.checkedLabel ?? this.label) : this.label;
    },
  },
});
</script>
<style lang="scss" scoped>
.ButtonField.is-button {
  width: 100%;
  gap: 10px;
  --button-padding: 5px;
}
.ButtonField-icon {
  font-size: 15px;
}
.ButtonField-label {
  font-size: 13px;
}
</style>
