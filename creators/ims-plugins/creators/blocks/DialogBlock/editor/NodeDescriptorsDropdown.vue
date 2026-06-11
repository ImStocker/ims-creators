<template>
  <div class="NodeDescriptorsDropdown is-dropdown">
    <NodeDescriptorsItem
      v-for="option of nodeDescriptors"
      :key="option.name"
      :option="option"
      :dialog-block-controller="dialogBlockController"
      @choose="chooseOption($event)"
      @choose-template="chooseTemplate($event)"
    />
  </div>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type {
  NodeDescriptor,
  NodeDescriptorTemplate,
} from '../nodes/NodeDescriptor';
import NodeDescriptorsItem from './NodeDescriptorsItem.vue';
import type { DialogBlockController } from './DialogBlockController';

export default defineComponent({
  name: 'NodeDescriptorsDropdown',
  components: {
    NodeDescriptorsItem,
  },
  props: {
    nodeDescriptors: {
      type: Array as PropType<NodeDescriptor[]>,
      required: true,
    },
    dialogBlockController: {
      type: Object as PropType<DialogBlockController>,
      default: null,
    },
  },
  emits: ['choose', 'choose-template'],
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
.NodeDescriptorsDropdown {
  background-color: var(--imsde-dropdown-bg-color);
  border-radius: var(--imsde-dropdown-border-radius);
  box-shadow: var(--imsde-dropdown-box-shadow);
  max-height: var(--DropdownContainer-freeHeight);
  width: max-content;
  max-width: var(--DropdownContainer-freeWidth);
  user-select: none;
}
.NodeDescriptorsDropdown-item {
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
</style>
