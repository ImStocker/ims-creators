<template>
  <div class="NodeSelector">
    <div
      v-if="modelValue"
      class="NodeSelector-value"
      :title="$t('imsDialogEditor.nodes.jump.dblClickToGo')"
      @dblclick="goToNode"
    >
      <i :class="targetIcon"></i>
      <span class="NodeSelector-name">{{ targetTitle }}</span>
    </div>
    <span v-else class="NodeSelector-empty">
      {{ $t('imsDialogEditor.common.noValue') }}
    </span>
    <button
      v-if="!readonly"
      class="is-button NodeSelector-btn"
      :class="{ active: isPicking }"
      @click="togglePicker"
    >
      {{
        modelValue
          ? $t('imsDialogEditor.nodes.jump.changeNode')
          : $t('imsDialogEditor.nodes.jump.selectNode')
      }}
    </button>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { DialogBlockController } from '../editor/DialogBlockController';
import type { NodeDataController } from '../editor/NodeDataController';
import { getNodeDescriptorOfType } from '../nodes/getNodeDescriptiors';

type NodePicker = {
  active: boolean;
  callback: ((nodeId: string) => void) | null;
};

export default defineComponent({
  name: 'NodeSelector',
  inject: {
    nodePicker: { default: null },
  },
  props: {
    modelValue: {
      type: [String, null] as PropType<string | null>,
      default: null,
    },
    readonly: { type: Boolean, default: false },
    excludeId: { type: String, default: '' },
    nodeDataController: {
      type: Object as PropType<NodeDataController>,
      required: true,
    },
    dialogController: {
      type: Object as PropType<DialogBlockController>,
      required: true,
    },
  },
  emits: ['update:modelValue'],
  data() {
    return {
      isPicking: false,
    };
  },
  computed: {
    targetNode() {
      if (!this.modelValue) return null;
      return (
        this.dialogController.state.nodes.find(
          (n) => n.id === this.modelValue,
        ) ?? null
      );
    },
    targetDescriptor() {
      if (!this.targetNode) return null;
      return this.targetNode.type
        ? getNodeDescriptorOfType(this.targetNode.type)
        : null;
    },
    targetIcon() {
      return this.targetDescriptor
        ? this.targetDescriptor.icon
        : 'ri-question-line';
    },
    targetTitle() {
      if (!this.targetNode || !this.targetDescriptor)
        return this.modelValue ?? '';
      return this.$t(
        `imsDialogEditor.nodes.${this.targetDescriptor.name}.title`,
      );
    },
  },
  unmounted() {
    if (this.isPicking) this.cancelPicker();
  },
  methods: {
    togglePicker() {
      if (!this.nodePicker) return;
      if (this.isPicking) {
        this.cancelPicker();
      } else {
        this.startPicker();
      }
    },
    startPicker() {
      if (!this.nodePicker) return;
      this.isPicking = true;
      this.nodePicker.active = true;
      this.$nextTick(() => {
        this.nodePicker!.callback = (nodeId: string) => {
          if (nodeId === this.excludeId) return;
          this.$emit('update:modelValue', nodeId);
          this.isPicking = false;
          this.nodePicker!.active = false;
          this.nodePicker!.callback = null;
        };
      });
    },
    cancelPicker() {
      if (!this.nodePicker) return;
      this.isPicking = false;
      this.nodePicker.active = false;
      this.nodePicker.callback = null;
    },
    goToNode() {
      if (!this.modelValue) return;
      this.dialogController.revealBlockContentItem('node-' + this.modelValue);
    },
  },
});
</script>

<style lang="scss" scoped>
.NodeSelector {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.NodeSelector-value {
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  &:hover {
    color: var(--imsde-node-selected-color);
  }
}
.NodeSelector-name {
  font-weight: 600;
}
.NodeSelector-id {
  font-size: 10px;
  opacity: 0.6;
}
.NodeSelector-empty {
  font-size: 12px;
  opacity: 0.5;
  font-style: italic;
}
.NodeSelector-btn {
  font-size: 11px;
  padding: 2px 8px;
  &.active {
    border-color: var(--imsde-node-selected-color);
    background: rgba(255, 255, 255, 0.1);
  }
}
</style>
