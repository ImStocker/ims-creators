<template>
  <div class="NodeSelector">
    <div
      v-if="modelValue"
      class="NodeSelector-value"
      :title="$t('imsDialogEditor.nodes.jump.clickToGo')"
      @click.stop="goToNode"
    >
      <i :class="targetIcon"></i>
      <div class="NodeSelector-value-text">
        <span class="NodeSelector-name">{{ targetTitle }}</span>
        <span v-if="targetPreview" class="NodeSelector-preview">{{
          targetPreview
        }}</span>
      </div>
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
import {
  castAssetPropValueToText,
  castAssetPropValueToString,
  truncateAssetPropValueText,
} from '~ims-app-base/logic/types/Props';

export default defineComponent({
  name: 'NodeSelector',
  inject: {
    nodePicker: { default: null },
    navigateToNode: { default: null },
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
    targetPreview() {
      if (!this.targetNode || !this.targetDescriptor) return '';
      const values = (this.targetNode as any).data?.values ?? {};
      const subject = (this.targetNode as any).data?.subject ?? '';
      const type = this.targetDescriptor.name;
      let preview: string | null = null;
      if (type === 'speech' || type === 'comment' || type === 'jump') {
        const val = values['text'] ?? values['value'] ?? null;
        if (val) {
          const text = truncateAssetPropValueText(
            castAssetPropValueToText(val),
            60,
          );
          preview = text
            ? castAssetPropValueToString(text.result) +
              (text.truncated ? '...' : '')
            : null;
        }
      } else if (
        type === 'trigger' ||
        type === 'function' ||
        type === 'callScript'
      ) {
        preview = subject ? castAssetPropValueToString(subject) : null;
      } else if (type === 'setVar' || type === 'getVar') {
        const varName = values['variable'] ?? null;
        if (varName) {
          preview = castAssetPropValueToString(varName);
        }
      } else if (type === 'timer') {
        const val = values['value'] ?? null;
        if (val != null) {
          preview = String(val) + 's';
        }
      }
      return preview ? castAssetPropValueToString(preview) : '';
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
          const node = this.dialogController.state.nodes.find(
            (n) => n.id === nodeId,
          );
          if (node?.type === 'comment') return;
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
      this.dialogController.setSelectedNodeIds(new Set([this.modelValue]));
      this.dialogController.setSelectedEdgeIds(new Set());
      if (this.navigateToNode) {
        this.navigateToNode(this.modelValue);
      }
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
.NodeSelector-value-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.NodeSelector-preview {
  font-size: 10px;
  opacity: 0.7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
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
