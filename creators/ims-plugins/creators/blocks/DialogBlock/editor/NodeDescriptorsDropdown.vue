<template>
  <div class="NodeDescriptorsDropdown is-dropdown">
    <div
      v-for="option of nodeDescriptors"
      :key="option.name"
      :ref="(el) => setNodeItemRef(option.name, el as HTMLElement)"
      class="NodeDescriptorsDropdown-item"
      :style="{
        '--imsde-node-color': option.color,
      }"
      :title="$t(`imsDialogEditor.nodes.${option.name}.description`)"
      @click="chooseOption(option)"
    >
      <div class="NodeDescriptorsDropdown-item-content">
        <i class="NodeDescriptorsDropdown-item-icon" :class="option.icon"></i>
        {{ $t(`imsDialogEditor.nodes.${option.name}.title`) }}
      </div>
      <menu-button
        v-if="
          dialogBlockController &&
          option.getTemplateController &&
          option.getTemplateController(dialogBlockController)?.getTemplates()
            .length
        "
        :attach-to-element="getNodeItem(option.name)"
        :attach-position="'right'"
      >
        <template #button="{ toggle }">
          <button
            class="is-button is-button-icon-small NodeDescriptorsDropdown-item-expand"
            @click.stop="toggle"
          >
            <i class="ri-arrow-right-s-line"></i>
          </button>
        </template>
        <node-templates-dropdown
          :template-controller="
            option.getTemplateController(dialogBlockController)
          "
          :node-name="option.name"
          @choose-template="chooseTemplate(option, $event)"
        ></node-templates-dropdown>
      </menu-button>
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type {
  NodeDescriptor,
  NodeDescriptorTemplate,
} from '../nodes/NodeDescriptor';
import MenuButton from '~ims-app-base/components/Common/MenuButton.vue';
import NodeTemplatesDropdown from './NodeTemplatesDropdown.vue';
import type { DialogBlockController } from './DialogBlockController';

export default defineComponent({
  name: 'NodeDescriptorsDropdown',
  components: {
    MenuButton,
    NodeTemplatesDropdown,
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
  data() {
    return {
      nodeItemRefs: new Map<string, HTMLElement>(),
    };
  },
  methods: {
    setNodeItemRef(node_name: string, item_element: HTMLElement) {
      if (!item_element) this.nodeItemRefs.delete(node_name);
      else {
        this.nodeItemRefs.set(node_name, item_element);
      }
    },
    getNodeItem(node_name: string) {
      return this.nodeItemRefs.get(node_name);
    },
    chooseOption(opt: NodeDescriptor) {
      this.$emit('choose', opt);
    },
    chooseTemplate(opt: NodeDescriptor, template?: NodeDescriptorTemplate) {
      this.$emit('choose-template', {
        descriptor: opt,
        template,
      });
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
    .NodeDescriptorsDropdown-item-icon {
      color: var(--local-text-color);
    }
  }
}
.NodeDescriptorsDropdown-item-icon {
  color: var(--imsde-node-color);
}
.NodeDescriptorsDropdown-item-expand {
  color: var(--local-text-color);
}
</style>
