<template>
  <button
    class="is-button is-button-toolbar LevelEditorToolbarButtonBase"
    :class="{ 'state-active': isActive, loading: isLoading }"
    :title="tooltip"
    :disabled="isDisabled || isLoading"
    @click.prevent="$emit('click')"
  >
    <slot>
      <i :class="tool.icon"></i>
    </slot>
  </button>
</template>
<script lang="ts">
import { defineComponent, type PropType, type UnwrapRef } from 'vue';
import type Tool from './tools/base/Tool';
import type ToolManager from './ToolManager';

export default defineComponent({
  name: 'LevelEditorToolbarButtonBase',
  props: {
    tool: {
      type: Object as PropType<Tool>,
      required: true,
    },
    toolManager: {
      type: Object as PropType<UnwrapRef<ToolManager>>,
      required: true,
    },
  },
  emits: ['click'],
  computed: {
    isActive() {
      return this.toolManager.isToolActive(this.tool);
    },
    isDisabled() {
      return this.tool.isDisabled();
    },
    isLoading() {
      return this.tool.isLoading();
    },
    tooltip() {
      const title = this.$t('levelEditor.tools.' + this.tool.name);
      if (!this.tool.supportsMultiInsert) return title;
      return `${title} — ${this.$t('levelEditor.tools.holdCtrlHint')}`;
    },
  },
});
</script>
<style lang="scss" scoped>
.LevelEditorToolbarButtonBase {
  &.active {
    color: var(--color-accent);
  }
}
</style>
