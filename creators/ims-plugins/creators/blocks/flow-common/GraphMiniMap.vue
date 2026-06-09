<template>
  <div class="GraphMiniMap">
    <MiniMap
class="GraphMiniMap-map"
zoomable pannable
@click="onClick" />
    <button
      class="GraphMiniMap-fitButton is-button is-button-icon"
      :title="$t('creatorsCommon.fitToScreen')"
      @click="fitToScreen"
    >
      <i class="ri-fullscreen-line"></i>
    </button>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { MiniMap } from '@vue-flow/minimap';
import type { FlowViewportHelper } from './FlowViewportHelper';

export default defineComponent({
  name: 'GraphMiniMap',
  components: { MiniMap },
  props: {
    viewportHelper: {
      type: Object as () => FlowViewportHelper,
      required: true,
    },
  },
  methods: {
    onClick({
      position,
    }: {
      event: MouseEvent;
      position: { x: number; y: number };
    }) {
      this.viewportHelper.setCenter(position.x, position.y);
    },
    fitToScreen() {
      this.viewportHelper.fitToAll();
    },
  },
});
</script>

<style lang="scss" scoped>
@import '@vue-flow/minimap/dist/style.css';

.GraphMiniMap {
  position: absolute;
  z-index: 5;
  bottom: 15px;
  right: 15px;
}

.GraphMiniMap-map {
  background-color: transparent;
  position: relative;
  margin: 0;

  &:deep(svg) {
    background-color: var(--imsde-minimap-bg-color);
    display: block;
  }
  &:deep(.vue-flow__minimap-node) {
    fill: var(--imsde-minimap-node-color);
  }
  &:deep(.vue-flow__minimap-mask) {
    fill: var(--imsde-minimap-mask-color);
  }
}

.GraphMiniMap-fitButton {
  position: absolute;
  bottom: 4px;
  right: 4px;
  z-index: 10;
  padding: 2px;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.15s;

  &:hover {
    opacity: 1;
  }
}
</style>
