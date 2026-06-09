<template>
  <ContextMenuZone
    class="DialogActionNode DialogEditorNode"
    :menu-list="menuList ?? contextMenu"
  >
    <slot name="node"></slot>
  </ContextMenuZone>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import ContextMenuZone from '~ims-app-base/components/Common/ContextMenuZone.vue';
import type { MenuListItem } from '~ims-app-base/logic/types/MenuList';
import type { DialogPlayer } from '../play/DialogPlayer';
import UiManager from '~ims-app-base/logic/managers/UiManager';

export default defineComponent({
  name: 'DialogBaseNode',
  components: {
    ContextMenuZone,
  },
  props: {
    menuList: {
      type: Array as PropType<MenuListItem[]>,
      default: null,
    },
    nodeId: {
      type: String,
      required: true,
    },
    dialogPlayer: {
      type: Object as PropType<DialogPlayer>,
      required: true,
    },
  },
  computed: {
    contextMenu() {
      return [
        {
          title: this.$t('imsDialogEditor.run'),
          action: async () => await this.startRunWithNode(false),
          icon: 'ri-arrow-right-circle-fill',
        },
        {
          title: this.$t('imsDialogEditor.debug'),
          action: async () => await this.startRunWithNode(true),
          icon: 'ri-arrow-right-circle-fill',
        },
      ];
    },
  },
  methods: {
    async startRunWithNode(debug: boolean) {
      await this.$getAppManager()
        .get(UiManager)
        .doTask(async () => {
          this.dialogPlayer.startRunWithNode(debug, this.nodeId);
        });
    },
  },
});
</script>
