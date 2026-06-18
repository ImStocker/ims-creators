<template>
  <div class="GraphTextNode GraphEditorNode-wrapper">
    <div
      v-if="showServiceName"
      class="GraphTextNode-serviceName"
      @dblclick.stop="onDblClickServiceName"
    >
      <i class="ri-price-tag-3-fill"></i>
      {{ id }}
    </div>
    <context-menu-zone
      class="GraphEditorNode GraphTextNode-box"
      :class="{ 'state-selected': selected }"
      :style="nodeStyle"
      :menu-list="menuList"
    >
      <div v-if="projectInfo" class="GraphTextNode-body GraphEditorNode-body">
        <div class="GraphTextNode-content">
          <file-presenter
            v-if="isFileValue"
            :value="localValue"
            :inline="true"
            :width="nodeWidth"
            :height="nodeHeight"
            is-static
            class="GraphTextNode-filePresenter"
          />
          <div
            v-else-if="isAssetValue && assetLink"
            class="GraphTextNode-asset tiny-scrollbars"
            :class="{
              'type-has-image': assetHasImage,
            }"
            @dblclick="onDblClickAsset"
          >
            <asset-icon-image
              v-if="assetHasImage"
              :asset="assetLink"
              :width="96"
              :height="96"
              class="GraphTextNode-assetIcon"
            />
            <asset-link
              class="GraphTextNode-assetTitle"
              :project="projectInfo"
              :asset="assetLink"
              :show-icon="!assetHasImage"
              :draggable="false"
              @click.prevent
            ></asset-link>
          </div>
          <template v-else>
            <imc-editor
              v-if="editing"
              ref="editorRef"
              v-model="localValue"
              class="GraphTextNode-editor nodrag nopan nowheel tiny-scrollbars"
              :multiline="true"
              toolbar="inline"
              :placeholder="$t('graphBlock.node.placeholder')"
              @update:model-value="onValueChange"
              @blur="onEditorBlur"
            ></imc-editor>
            <imc-presenter
              v-else
              :value="localValue"
              class="GraphTextNode-presenter tiny-scrollbars"
              @dblclick="onDblClickText"
            ></imc-presenter>
          </template>
        </div>
        <div class="GraphTextNode-top">
          <div
            v-if="!readonly"
            class="GraphTextNode-resizeHandle GraphTextNode-resizeHandle-t"
            @mousedown.stop="(e) => onResizeStart(e, 't')"
          ></div>
          <Handle
            id="source-top"
            type="source"
            :position="Position.Top"
            class="GraphTextNode-handle"
          />
          <Handle
            id="target-top"
            type="target"
            :position="Position.Top"
            class="GraphTextNode-targetHandle"
          />
        </div>
        <div class="GraphTextNode-right">
          <div
            v-if="!readonly"
            class="GraphTextNode-resizeHandle GraphTextNode-resizeHandle-r"
            @mousedown.stop="(e) => onResizeStart(e, 'r')"
          ></div>
          <Handle
            id="source-right"
            type="source"
            :position="Position.Right"
            class="GraphTextNode-handle"
          />
          <Handle
            id="target-right"
            type="target"
            :position="Position.Right"
            class="GraphTextNode-targetHandle"
          />
        </div>
        <div class="GraphTextNode-bottom">
          <div
            v-if="!readonly"
            class="GraphTextNode-resizeHandle GraphTextNode-resizeHandle-b"
            @mousedown.stop="(e) => onResizeStart(e, 'b')"
          ></div>
          <Handle
            id="source-bottom"
            type="source"
            :position="Position.Bottom"
            class="GraphTextNode-handle"
          />
          <Handle
            id="target-bottom"
            type="target"
            :position="Position.Bottom"
            class="GraphTextNode-targetHandle"
          />
        </div>
        <div class="GraphTextNode-left">
          <div
            v-if="!readonly"
            class="GraphTextNode-resizeHandle GraphTextNode-resizeHandle-l"
            @mousedown.stop="(e) => onResizeStart(e, 'l')"
          ></div>
          <Handle
            id="source-left"
            type="source"
            :position="Position.Left"
            class="GraphTextNode-handle"
          />
          <Handle
            id="target-left"
            type="target"
            :position="Position.Left"
            class="GraphTextNode-targetHandle"
          />
        </div>
        <template v-if="!readonly">
          <div
            class="GraphTextNode-resizeHandle GraphTextNode-resizeHandle-tl"
            @mousedown.stop="(e) => onResizeStart(e, 'tl')"
          ></div>
          <div
            class="GraphTextNode-resizeHandle GraphTextNode-resizeHandle-tr"
            @mousedown.stop="(e) => onResizeStart(e, 'tr')"
          ></div>
          <div
            class="GraphTextNode-resizeHandle GraphTextNode-resizeHandle-br"
            @mousedown.stop="(e) => onResizeStart(e, 'br')"
          ></div>
          <div
            class="GraphTextNode-resizeHandle GraphTextNode-resizeHandle-bl"
            @mousedown.stop="(e) => onResizeStart(e, 'bl')"
          ></div>
        </template>
      </div>
    </context-menu-zone>
  </div>
</template>

<script lang="ts">
import { defineAsyncComponent, defineComponent, type PropType } from 'vue';
import { Position, Handle, type ViewportTransform } from '@vue-flow/core';
import type { NodeDescriptor } from './NodeDescriptor';
import type { GraphBlockController } from '../editor/GraphBlockController';
import { DATA_COLOR_TO_HEX, hexToRgba } from '../editor/GraphEditor';
import ImcEditor from '~ims-app-base/components/ImcText/ImcEditor.vue';
import ImcPresenter from '~ims-app-base/components/ImcText/ImcPresenter.vue';
import ContextMenuZone from '~ims-app-base/components/Common/ContextMenuZone.vue';
import type { MenuListItem } from '~ims-app-base/logic/types/MenuList';
import type {
  AssetPropValueFile,
  AssetPropValueAsset,
} from '~ims-app-base/logic/types/Props';
import EditorManager from '~ims-app-base/logic/managers/EditorManager';
import ProjectManager from '~ims-app-base/logic/managers/ProjectManager';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import AssetLink from '~ims-app-base/components/Asset/AssetLink.vue';
import CreatorAssetManager from '~ims-app-base/logic/managers/CreatorAssetManager';
import { getAssetImageFromPreview } from '~ims-app-base/components/Asset/AssetIconImage.vue';
import isUUID from 'validator/es/lib/isUUID';

type ResizeDirection = 'tl' | 't' | 'tr' | 'r' | 'br' | 'b' | 'bl' | 'l';
const MIN_NODE_WIDTH = 60;
const MIN_NODE_HEIGHT = 60;

export default defineComponent({
  name: 'GraphTextNode',
  components: {
    Handle,
    ImcEditor,
    ImcPresenter,
    ContextMenuZone,
    FilePresenter: defineAsyncComponent(
      () => import('~ims-app-base/components/File/FilePresenter.vue'),
    ),
    AssetIconImage: defineAsyncComponent(
      () => import('~ims-app-base/components/Asset/AssetIconImage.vue'),
    ),
    AssetLink,
  },
  props: {
    nodeDescriptor: {
      type: Object as PropType<NodeDescriptor>,
      required: true,
    },
    selected: {
      type: Boolean,
      required: true,
    },
    id: {
      type: String,
      required: true,
    },
    data: {
      type: Object as PropType<{
        value?: any;
        width?: number;
        height?: number;
        index?: number;
        color?: string;
      }>,
      required: true,
    },
    readonly: {
      type: Boolean,
      default: false,
    },
    dialogController: {
      type: Object as PropType<GraphBlockController>,
      required: true,
    },
    editingNodeId: {
      type: [String, null] as PropType<string | null>,
      default: null,
    },
    viewportTransform: {
      type: Object as PropType<ViewportTransform>,
      default: () => ({ x: 0, y: 0, zoom: 1 }),
    },
  },
  emits: ['change-type', 'request-edit', 'request-view'],
  data() {
    return {
      localValue: (this as any).data?.value ?? null,
      resizing: null as {
        startX: number;
        startY: number;
        startWidth: number;
        startHeight: number;
        startPosX: number;
        startPosY: number;
        direction: ResizeDirection;
        zoom: number;
      } | null,
    };
  },
  computed: {
    Position() {
      return Position;
    },
    editing() {
      return !this.readonly && this.editingNodeId === this.id;
    },
    nodeColor() {
      return (this.data as any)?.color ?? '';
    },
    nodeWidth(): number | null {
      return (this.data as any)?.width ?? null;
    },
    nodeHeight(): number | null {
      return (this.data as any)?.height ?? null;
    },
    nodeStyle() {
      const w = this.nodeWidth;
      const h = this.nodeHeight;
      const storedColor = (this.data as any)?.color;
      const result: Record<string, string> = {};
      if (w) result.width = w + 'px';
      if (h) result.height = h + 'px';
      if (storedColor) {
        const hex = DATA_COLOR_TO_HEX[storedColor] || storedColor;
        result['--imsgr-node-color'] = hex;
        result['--imsgr-node-bg'] = hexToRgba(hex, 0.12);
      }
      return result;
    },
    isFileValue(): boolean {
      return !!(this.localValue as AssetPropValueFile)?.FileId;
    },
    isAssetValue(): boolean {
      return !!(this.localValue as AssetPropValueAsset)?.AssetId;
    },
    assetLink(): {
      id: string;
      title: string | null;
      name: string | null;
    } | null {
      if (!this.isAssetValue) return null;
      const v = this.localValue as AssetPropValueAsset;
      return { id: v.AssetId, title: v.Title ?? null, name: v.Name ?? null };
    },
    assetHasImage(): boolean {
      if (!this.assetLink) return false;
      const cached_preview = this.$getAppManager()
        .get(CreatorAssetManager)
        .getAssetPreviewViaCacheSync(this.assetLink.id);
      if (cached_preview === undefined) {
        this.$getAppManager()
          .get(CreatorAssetManager)
          .requestAssetPreviewInCache(this.assetLink.id);
      }
      if (!cached_preview) return false;
      return !!getAssetImageFromPreview(cached_preview);
    },
    selectedNodeIds(): string[] {
      return this.dialogController.state.nodes
        .filter((n: any) => n.selected)
        .map((n: any) => n.id);
    },
    menuList(): MenuListItem[] {
      if (this.readonly) return [];
      if (this.editing) return [];
      const ids = this.selectedNodeIds.length
        ? this.selectedNodeIds
        : [this.id];
      return this.dialogController.getNodeContextMenu(
        ids,
        this.viewportTransform,
      );
    },
    showServiceName() {
      return !isUUID(this.id, 'loose');
    },
    projectInfo() {
      return this.$getAppManager().get(ProjectManager).getProjectInfo();
    },
  },
  watch: {
    'data.value'(val: any) {
      this.localValue = val ?? null;
    },
    editing() {
      if (this.editing) {
        this.$nextTick(() => {
          const editor = this.$refs['editorRef'] as InstanceType<
            typeof ImcEditor
          > | null;
          if (editor) {
            editor.focus();
          }
        });
      }
    },
  },
  methods: {
    setValue(val: any) {
      this.localValue = val;
      const node = this.dialogController.state.nodes.find(
        (n) => n.id === this.id,
      );
      if (node) {
        (node.data as any).value = val;
        this.dialogController.savePropsDelayed();
      }
    },
    onValueChange(val: any) {
      this.setValue(val);
    },
    onDblClickText(e: MouseEvent) {
      if (this.readonly) return;
      this.$emit('request-edit', this.id);
      e.preventDefault();
      e.stopPropagation();
    },
    onDblClickAsset(e: MouseEvent) {
      e.preventDefault();
      e.stopPropagation();
      const open_blank = e.ctrlKey || e.metaKey;
      this.$getAppManager()
        .get(UiManager)
        .doTask(async () => {
          if (!this.assetLink) return;
          this.$getAppManager()
            .get(EditorManager)
            .openAsset(this.assetLink.id, open_blank ? 'new-tab' : 'popup');
        });
    },
    onDblClickServiceName() {
      if (this.readonly) return;
      this.dialogController.setNodeServiceName(this.id);
    },
    onEditorBlur() {
      this.$emit('request-view');
    },
    onResizeStart(ev: MouseEvent, direction: ResizeDirection) {
      if (this.readonly) return;
      const node = this.dialogController.state.nodes.find(
        (n) => n.id === this.id,
      );
      if (!node) return;
      const w = this.nodeWidth ?? 200;
      const h = this.nodeHeight ?? 80;
      this.resizing = {
        startX: ev.clientX,
        startY: ev.clientY,
        startWidth: w,
        startHeight: h,
        startPosX: node.position.x,
        startPosY: node.position.y,
        direction,
        zoom: this.viewportTransform.zoom || 1,
      };
      window.addEventListener('mousemove', this.onResizeMove);
      window.addEventListener('mouseup', this.onResizeEnd);
    },
    onResizeMove(ev: MouseEvent) {
      if (!this.resizing) return;
      const d = this.resizing;
      const dx = (ev.clientX - d.startX) / d.zoom;
      const dy = (ev.clientY - d.startY) / d.zoom;
      let newW = d.startWidth;
      let newH = d.startHeight;
      let newPosX = d.startPosX;
      let newPosY = d.startPosY;

      switch (d.direction) {
        case 'tl':
          newW = Math.max(MIN_NODE_WIDTH, d.startWidth - dx);
          newH = Math.max(MIN_NODE_HEIGHT, d.startHeight - dy);
          newPosX = d.startPosX + (d.startWidth - newW);
          newPosY = d.startPosY + (d.startHeight - newH);
          break;
        case 't':
          newH = Math.max(MIN_NODE_HEIGHT, d.startHeight - dy);
          newPosY = d.startPosY + (d.startHeight - newH);
          break;
        case 'tr':
          newW = Math.max(MIN_NODE_WIDTH, d.startWidth + dx);
          newH = Math.max(MIN_NODE_HEIGHT, d.startHeight - dy);
          newPosY = d.startPosY + (d.startHeight - newH);
          break;
        case 'r':
          newW = Math.max(MIN_NODE_WIDTH, d.startWidth + dx);
          break;
        case 'br':
          newW = Math.max(MIN_NODE_WIDTH, d.startWidth + dx);
          newH = Math.max(MIN_NODE_HEIGHT, d.startHeight + dy);
          break;
        case 'b':
          newH = Math.max(MIN_NODE_HEIGHT, d.startHeight + dy);
          break;
        case 'bl':
          newW = Math.max(MIN_NODE_WIDTH, d.startWidth - dx);
          newH = Math.max(MIN_NODE_HEIGHT, d.startHeight + dy);
          newPosX = d.startPosX + (d.startWidth - newW);
          break;
        case 'l':
          newW = Math.max(MIN_NODE_WIDTH, d.startWidth - dx);
          newPosX = d.startPosX + (d.startWidth - newW);
          break;
      }

      const node = this.dialogController.state.nodes.find(
        (n) => n.id === this.id,
      );
      if (node) {
        (node.data as any).width = newW;
        (node.data as any).height = newH;
        node.position.x = newPosX;
        node.position.y = newPosY;
      }
    },
    onResizeEnd() {
      window.removeEventListener('mousemove', this.onResizeMove);
      window.removeEventListener('mouseup', this.onResizeEnd);
      if (this.resizing) {
        this.dialogController.savePropsDelayed();
        this.resizing = null;
      }
    },
  },
});
</script>

<style lang="scss" scoped>
.GraphTextNode {
  position: relative;
  min-width: 60px;
}

.GraphTextNode-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-size: 13px;
  font-weight: 600;
  position: relative;
}

.GraphTextNode-header-title {
  flex: 1;
}

.GraphTextNode-body {
  padding: 4px;
}
.GraphTextNode-presenter,
.GraphTextNode-editor {
  overflow: auto;
}

.GraphTextNode-body,
.GraphTextNode-content,
.GraphTextNode-presenter,
.GraphTextNode-editor {
  height: 100%;
  width: 100%;
}

.GraphTextNode-footer {
  display: flex;
  justify-content: space-between;
  padding: 2px 10px;
  position: relative;
}

.GraphTextNode-editor {
  min-height: 36px;
  font-size: 13px;
  line-height: 1.4;
}

.GraphTextNode-presenter,
.GraphTextNode-editor {
  padding: 4px 6px;
  font-size: 13px;
  line-height: 1.4;
}
.GraphTextNode-presenter {
  min-height: 36px;
  cursor: grab;
}

.GraphTextNode-handle {
  z-index: 20;
  width: calc(12px + var(--imsde-node-selected-outline-width) * 4);
  height: calc(12px + var(--imsde-node-selected-outline-width) * 4);
  background: #888;
  border: 2px solid #fff;
  border-radius: 50%;
  opacity: 0;
  transition: opacity ease-in-out 0.2s;
}

.GraphTextNode-targetHandle {
  opacity: 0;
  pointer-events: none;
}

.GraphTextNode-top,
.GraphTextNode-bottom,
.GraphTextNode-left,
.GraphTextNode-right {
  position: absolute;
  &:hover .GraphTextNode-handle {
    opacity: 1;
  }
  &:hover .GraphTextNode-resizeHandle {
    opacity: 1;
  }
}
.GraphTextNode-top,
.GraphTextNode-bottom {
  left: 0;
  right: 0;
  height: 10px;
}
.GraphTextNode-left,
.GraphTextNode-right {
  top: 0;
  bottom: 0;
  width: 10px;
}
.GraphTextNode-top {
  top: 0;
}
.GraphTextNode-bottom {
  bottom: 0;
}
.GraphTextNode-left {
  left: 0;
}
.GraphTextNode-right {
  right: 0;
}

.GraphTextNode-resizeHandle {
  position: absolute;
  z-index: 10;
}

.GraphTextNode-resizeHandle-tl,
.GraphTextNode-resizeHandle-tr,
.GraphTextNode-resizeHandle-bl,
.GraphTextNode-resizeHandle-br {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.GraphTextNode-resizeHandle-tl {
  top: -6px;
  left: -6px;
  cursor: nwse-resize;
}

.GraphTextNode-resizeHandle-tr {
  top: -6px;
  right: -6px;
  cursor: nesw-resize;
}

.GraphTextNode-resizeHandle-bl {
  bottom: -6px;
  left: -6px;
  cursor: nesw-resize;
}

.GraphTextNode-resizeHandle-br {
  bottom: -6px;
  right: -6px;
  cursor: nwse-resize;
}

.GraphTextNode-resizeHandle-t {
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  height: 8px;
  cursor: ns-resize;
  border-radius: 2px;
}

.GraphTextNode-resizeHandle-b {
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  height: 8px;
  cursor: ns-resize;
  border-radius: 2px;
}

.GraphTextNode-resizeHandle-l {
  left: -4px;
  top: 50%;
  transform: translateY(-50%);
  width: 8px;
  height: 100%;
  cursor: ew-resize;
  border-radius: 2px;
}

.GraphTextNode-resizeHandle-r {
  right: -4px;
  top: 50%;
  transform: translateY(-50%);
  width: 8px;
  height: 100%;
  cursor: ew-resize;
  border-radius: 2px;
}

.GraphTextNode-filePresenter,
.GraphTextNode-filePresenter :deep(.FilePresenter),
.GraphTextNode-filePresenter :deep(img),
.GraphTextNode-filePresenter :deep(video),
.GraphTextNode-filePresenter :deep(iframe) {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.GraphTextNode-asset {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 100%;
  overflow: auto;
  &:not(.type-has-image) {
    text-align: center;
    justify-content: center;
  }
}

.GraphTextNode-assetIcon {
  flex-shrink: 0;
  max-height: 100%;
  width: auto;
  border-radius: 4px;
}

.GraphTextNode-assetTitle {
  font-size: 13px;
  line-height: 1.4;
  color: var(--local-text-color);
  text-decoration: none;
}
.GraphTextNode-serviceName {
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
