<template>
  <div
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
  name: 'NodeDescriptorsItem',
  components: {
    MenuButton,
    NodeTemplatesDropdown,
  },
  props: {
    option: {
      type: Object as PropType<NodeDescriptor>,
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
    chooseTemplate(opt: NodeDescriptor, template?: NodeDescriptorTemplate) {
      this.$emit('choose-template', {
        descriptor: opt,
        template,
      });
    },
  },
});
</script>
<style lang="scss">
.NodeDescriptorsDropdown-item-icon {
  color: var(--imsde-node-color);
}
.NodeDescriptorsDropdown-item-expand {
  color: var(--local-text-color);
}
</style>
