<template>
  <div class="DialogEndNode DialogEditorNode-wrapper">
    <div v-if="exitName" class="DialogEndNode-exitName" :title="exitName">
      {{ exitName }}
    </div>
    <ContextMenuZone :menu-list="contextMenuComp">
      <div
        class="DialogEndNode-header DialogNode-header DialogEditorNode-header DialogEditorNode"
        :title="$t(`imsDialogEditor.nodes.${nodeDescriptor.name}.description`)"
      >
        <div class="DialogEndNode-header-title">
          <ExecHandle id="in" type="target" :position="Position.Left" />
          <i :class="nodeDescriptor.icon"></i>
          {{ $t(`imsDialogEditor.nodes.${nodeDescriptor.name}.title`) }}
        </div>
      </div>
    </ContextMenuZone>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { Position } from '@vue-flow/core';
import type { NodeDescriptor } from './NodeDescriptor';
import type { NodeDataController } from '../editor/NodeDataController';
import type { DialogBlockController } from '../editor/DialogBlockController';
import type { MenuListItem } from '~ims-app-base/logic/types/MenuList';
import { castAssetPropValueToString } from '~ims-app-base/logic/types/Props';
import ExecHandle from '../parts/ExecHandle.vue';
import ContextMenuZone from '~ims-app-base/components/Common/ContextMenuZone.vue';

export default defineComponent({
  name: 'DialogEndNode',
  components: {
    ExecHandle,
    ContextMenuZone,
  },
  props: {
    id: {
      type: String,
      required: true,
    },
    nodeDescriptor: {
      type: Object as PropType<NodeDescriptor>,
      required: true,
    },
    nodeDataController: {
      type: Object as PropType<NodeDataController>,
      required: true,
    },
    selected: {
      type: Boolean,
      required: true,
    },
    dialogController: {
      type: Object as PropType<DialogBlockController>,
      required: true,
    },
    readonly: {
      type: Boolean,
      default: false,
    },
  },
  computed: {
    Position() {
      return Position;
    },
    exitName() {
      return castAssetPropValueToString(this.nodeDataController.subject);
    },
    contextMenuComp(): MenuListItem[] {
      return this.dialogController.getNodeContextMenu([this.id], {
        x: 0,
        y: 0,
        zoom: 1,
      });
    },
  },
});
</script>

<style lang="scss" scoped>
.DialogEndNode-exitName {
  padding: 2px 8px;
  font-size: 10px;
  color: var(--local-sub-text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.DialogEndNode-header {
  padding: 7px 10px;
  font-size: 14px;
}
.DialogEndNode-header-title {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
