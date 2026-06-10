<template>
  <ContextMenuZone
    class="DialogActionNode DialogEditorNode"
    :menu-list="contextMenuComp"
  >
    <slot></slot>
  </ContextMenuZone>
</template>

<script lang="ts">
import { defineComponent, unref, type PropType } from 'vue';
import ContextMenuZone from '~ims-app-base/components/Common/ContextMenuZone.vue';
import type { MenuListItem } from '~ims-app-base/logic/types/MenuList';
import type { DialogPlayer } from '../play/DialogPlayer';
import type { DialogBlockController } from '../editor/DialogBlockController';

export default defineComponent({
  name: 'DialogBaseNode',
  components: {
    ContextMenuZone,
  },
  inject: {
    dialogBlockController: { default: null },
  },
  props: {
    additionalMenuList: {
      type: Array as PropType<MenuListItem[]>,
      default: () => [],
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
    contextMenuComp() {
      const controller = unref(
        this.dialogBlockController,
      ) as DialogBlockController | null;
      let menu: MenuListItem[] = [];
      if (controller) {
        const nodeIds = [this.nodeId];
        const viewport = { x: 0, y: 0, zoom: 1 };
        menu = controller.getNodeContextMenu(
          nodeIds,
          viewport,
          this.dialogPlayer,
        );
      }
      if (this.additionalMenuList.length > 0) {
        if (menu.length > 0) {
          menu.unshift({ type: 'separator' });
        }
        menu = [...this.additionalMenuList, ...menu];
      }
      return menu;
    },
  },
});
</script>
