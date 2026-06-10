<template>
  <div class="CreateNodeDropdown">
    <NodeDescriptorsItem
      v-for="option of nodeDescriptors"
      :key="option.name"
      class="CreateNodeDropdown-item"
      :option="option"
      :dialog-block-controller="dialogBlockController"
      @choose="chooseOption($event)"
      @choose-template="chooseTemplate($event)"
    />
    <div class="CreateNodeDropdown-sep"></div>
    <button class="CreateNodeDropdown-paste" @click="$emit('paste')">
      <i class="ri-clipboard-line"></i>
      {{ $t('imsDialogEditor.pasteNode') }}
    </button>
  </div>
</template>

<script lang="ts">
import type { PropType } from 'vue';
import { defineComponent } from 'vue';
import { getNodeDescriptors } from '../nodes/getNodeDescriptiors';
import type {
  NodeDescriptor,
  NodeDescriptorTemplate,
  NodeType,
} from '../nodes/NodeDescriptor';
import {
  AssetPropType,
  type AssetPropValueType,
} from '~ims-app-base/logic/types/Props';
import NodeDescriptorsItem from './NodeDescriptorsItem.vue';
import type { DialogBlockController } from './DialogBlockController';

export default defineComponent({
  name: 'CreateNodeDropdown',
  components: {
    NodeDescriptorsItem,
  },
  props: {
    dialogBlockController: {
      type: Object as PropType<DialogBlockController>,
      required: true,
    },
    allowedTypes: {
      type: Array<NodeType>,
      required: true,
    },
    needDataIn: {
      type: [Array<AssetPropValueType>, null] as PropType<
        AssetPropValueType[] | null
      >,
      default: null,
    },
    needDataOut: {
      type: [Array<AssetPropValueType>, null] as PropType<
        AssetPropValueType[] | null
      >,
      default: null,
    },
  },
  emits: ['choose', 'choose-template', 'paste'],
  computed: {
    nodeDescriptors() {
      const need_data_in_set = this.needDataIn
        ? new Set(this.needDataIn.map((t) => t.Type))
        : null;
      const need_data_out_set = this.needDataOut
        ? new Set(this.needDataOut.map((t) => t.Type))
        : null;
      return getNodeDescriptors().filter((option) => {
        if (
          need_data_in_set?.size === 1 &&
          need_data_in_set.has(AssetPropType.BOOLEAN) &&
          option.name === 'branch'
        ) {
          return true;
        }
        if (this.allowedTypes && !this.allowedTypes.includes(option.type)) {
          return false;
        }
        if (need_data_in_set) {
          if (
            option.dataInTypes === undefined ||
            (option.dataInTypes &&
              option.dataInTypes.every((t) => !need_data_in_set.has(t.Type)))
          ) {
            return false;
          }
        }
        if (need_data_out_set) {
          if (
            option.dataOutTypes === undefined ||
            (option.dataOutTypes &&
              option.dataOutTypes.every((t) => !need_data_out_set.has(t.Type)))
          ) {
            return false;
          }
        }
        return true;
      });
    },
  },
  methods: {
    chooseOption(opt: NodeDescriptor) {
      this.$emit('choose', opt);
    },
    chooseTemplate({
      descriptor,
      template,
    }: {
      descriptor: NodeDescriptor;
      template?: NodeDescriptorTemplate;
    }) {
      this.$emit('choose-template', { descriptor, template });
    },
  },
});
</script>

<style lang="scss" scoped>
.CreateNodeDropdown {
  background-color: var(--imsde-dropdown-bg-color);
  border-radius: var(--imsde-dropdown-border-radius);
  box-shadow: var(--imsde-dropdown-box-shadow);
}
.CreateNodeDropdown-sep {
  height: 1px;
  background: var(--local-border-color, #ddd);
  margin: 4px 0;
}
.CreateNodeDropdown-item {
  display: flex;
  justify-content: space-between;
  padding: 5px 10px;
  cursor: pointer;
  color: var(--local-text-color);
  &:not(:last-child) {
    border-bottom: 1px solid var(--imsde-dropdown-border-color);
  }
  &:hover {
    --local-text-color: var(--imsde-dropdown-text-color);
    background: var(--imsde-node-color);
    &:deep(.NodeDescriptorsDropdown-item-icon) {
      color: var(--local-text-color);
    }
  }
}
.CreateNodeDropdown-paste {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 5px 10px;
  border: none;
  background: transparent;
  color: var(--local-text-color);
  cursor: pointer;
  white-space: nowrap;
  &:hover {
    background: var(--dropdown-hl-bg-color, #eee);
  }
}
</style>
