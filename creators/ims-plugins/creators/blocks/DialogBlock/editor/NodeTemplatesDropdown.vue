<template>
  <div class="NodeTemplatesDropdown is-dropdown">
    <div class="NodeTemplatesDropdown-search">
      <form-search
        :value="searchQuery"
        :autofocus="true"
        @change="searchQuery = $event"
      ></form-search>
    </div>
    <menu-list
      class="NodeTemplatesDropdown-list"
      :menu-list="menuList"
    ></menu-list>
  </div>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import FormSearch from '~ims-app-base/components/Form/FormSearch.vue';
import MenuList from '~ims-app-base/components/Common/MenuList.vue';
import type { NodeDescriptorTemplateController } from '../nodes/NodeDescriptor';
import type { MenuListItem } from '~ims-app-base/logic/types/MenuList';

export default defineComponent({
  name: 'NodeTemplatesDropdown',
  components: {
    FormSearch,
    MenuList,
  },
  inject: ['projectContext'],
  props: {
    templateController: {
      type: Object as PropType<NodeDescriptorTemplateController>,
      default: null,
    },
    nodeName: {
      type: String,
      required: true,
    },
  },
  emits: ['choose-template'],
  data() {
    return {
      searchQuery: '',
    };
  },
  computed: {
    menuList(): MenuListItem[] {
      return [
        ...this.templateMenuItems,
        {
          type: 'separator',
        },
        // {
        //   title: this.$t('imsDialogEditor.nodes.' + this.nodeName + '.create'),
        //   icon: 'create',
        //   action: async () => {
        //     const res = await this.templateController.createTemplate();
        //     if (!res) return;
        //     // TODO: не срабатывает эмит, вероятно из-за того, что компонент закрывается в момент открытия createTemplate диалога
        //     this.$emit('choose-template', res);
        //   },
        // },
        {
          title: this.$t(
            'imsDialogEditor.nodes.' + this.nodeName + '.manageCaption',
          ),
          icon: 'edit',
          action: async () => {
            this.templateController.manageTemplates(this.projectContext as any);
          },
        },
      ];
    },
    templateMenuItems(): MenuListItem[] {
      return this.templateController
        .getTemplates()
        .map((el) => {
          return {
            title: el.title,
            action: () => this.$emit('choose-template', el),
          };
        })
        .filter((el) => el.title.includes(this.searchQuery));
    },
  },
});
</script>
<style lang="scss" scoped>
.NodeTemplatesDropdown-search {
  padding: var(--dropdown-padding);
}
.NodeTemplatesDropdown-list {
  background-color: transparent;
  border-radius: 0px;
  :deep(.MenuList-item:first-child .is-button) {
    border-radius: 0px !important;
  }
}
</style>
