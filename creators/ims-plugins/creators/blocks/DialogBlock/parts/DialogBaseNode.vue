<template>
  <div class="DialogBaseNode DialogEditorNode-wrapper">
    <div
      v-if="showServiceName"
      class="DialogBaseNode-serviceName"
      @dblclick.stop="onDblClickServiceName"
    >
      <i class="ri-price-tag-3-fill"></i>
      {{ nodeId }}
    </div>
    <ContextMenuZone class="DialogEditorNode" :menu-list="contextMenuComp">
      <slot></slot>
    </ContextMenuZone>
  </div>
</template>

<script lang="ts">
import { defineComponent, unref, type PropType } from 'vue';
import ContextMenuZone from '~ims-app-base/components/Common/ContextMenuZone.vue';
import type { MenuListItem } from '~ims-app-base/logic/types/MenuList';
import type { DialogPlayer } from '../play/DialogPlayer';
import type { DialogBlockController } from '../editor/DialogBlockController';
import isUUID from 'validator/es/lib/isUUID';

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
    showServiceName() {
      return !isUUID(this.nodeId);
    },
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
  methods: {
    onDblClickServiceName() {
      const controller = unref(
        this.dialogBlockController,
      ) as DialogBlockController | null;
      if (!controller) return;
      if (controller.readonly) return;
      controller.setNodeServiceName(this.nodeId);
    },
  },
});
</script>

<style lang="scss" scoped>
.DialogBaseNode-serviceName {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 10px;
  color: var(--local-sub-text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
