<template>
  <div v-show="isOpen" class="DesktopAiPanel" :style="{ width: panelWidth + 'px' }">
    <div class="DesktopAiPanel-resizer" @mousedown="startResize" />
    <div class="DesktopAiPanel-inner">
      <AiPanel :title="t('desktop.aiAssistant.title')">
        <template #header-actions>
          <button class="is-button is-button-icon DesktopAiPanel-closeBtn" @click="$emit('close')">
            <i class="ri-close-line"></i>
          </button>
        </template>
      </AiPanel>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAppManager, useI18n } from '#imports';
import UiPreferenceManager from '~ims-app-base/logic/managers/UiPreferenceManager';
import AiPanel from '~ims-app-base/components/ai/AiPanel.vue';

defineProps<{ isOpen: boolean }>();
defineEmits<{ close: [] }>();

const { t } = useI18n();

const DEFAULT_WIDTH = 420;
const MIN_WIDTH = 280;
const MAX_WIDTH = 800;
const STORAGE_KEY = 'DesktopAiPanel.width';

const panelWidth = ref(DEFAULT_WIDTH);

onMounted(async () => {
  const appManager = useAppManager();
  const pref = appManager.get(UiPreferenceManager);
  const saved = pref.getPreference<number>(STORAGE_KEY, DEFAULT_WIDTH);
  panelWidth.value = saved ?? DEFAULT_WIDTH;
});

function saveWidth(width: number) {
  useAppManager().get(UiPreferenceManager).setPreference(STORAGE_KEY, width);
}

function startResize(e: MouseEvent) {
  e.preventDefault();
  const startX = e.clientX;
  const startWidth = panelWidth.value;

  function onMouseMove(ev: MouseEvent) {
    const diff = startX - ev.clientX;
    panelWidth.value = Math.round(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + diff)));
  }

  function onMouseUp() {
    saveWidth(panelWidth.value);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    document.body.classList.remove('DesktopAiPanel-resizing');
  }

  window.addEventListener('mousemove', onMouseMove, { passive: true });
  window.addEventListener('mouseup', onMouseUp);
  document.body.classList.add('DesktopAiPanel-resizing');
}
</script>

<style lang="scss" scoped>
.DesktopAiPanel {
  flex-shrink: 0;
  display: flex;
  position: relative;
  z-index: 100;
  background: var(--local-box-color);
  border-left: 1px solid var(--local-border-color);
}

.DesktopAiPanel-resizer {
  width: 5px;
  cursor: ew-resize;
  flex-shrink: 0;
  background: transparent;
  transition: background 0.15s;
  z-index: 1;

  &:hover,
  &:active {
    background: var(--color-accent, #4fc3f7);
  }
}

.DesktopAiPanel-inner {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  width: 0;
}

.DesktopAiPanel-closeBtn {
  font-size: 18px;
  color: var(--button-icon-color);
}
</style>

<style lang="scss" rel="stylesheet/scss">
.DesktopAiPanel-resizing {
  cursor: ew-resize;
  user-select: none;
}
</style>
