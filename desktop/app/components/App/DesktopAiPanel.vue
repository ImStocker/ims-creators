<template>
  <div v-show="isOpen" class="DesktopAiPanel" :style="{ width: panelWidth + 'px' }">
    <div class="DesktopAiPanel-resizer" @mousedown="startResize" />
    <div class="DesktopAiPanel-inner">
      <div class="DesktopAiPanel-header">
        <i class="ri-bard-line DesktopAiPanel-header-icon"></i>
        <span class="DesktopAiPanel-header-title">{{ t('desktop.aiAssistant.title') }}</span>
        <button class="is-button is-button-icon DesktopAiPanel-closeBtn" @click="$emit('close')">
          <i class="ri-close-line"></i>
        </button>
      </div>
      <div class="DesktopAiPanel-messages tiny-scrollbars">
        <div class="DesktopAiPanel-empty">
          <i class="ri-bard-line"></i>
          <p>{{ t('desktop.aiAssistant.startPrompt') }}</p>
        </div>
      </div>
      <div class="DesktopAiPanel-send">
        <textarea
          v-model="messageText"
          class="DesktopAiPanel-textarea"
          :placeholder="t('desktop.aiAssistant.placeholder')"
          rows="1"
          @keydown.enter.exact="sendMessage"
        />
        <button class="DesktopAiPanel-sendBtn" @click="sendMessage">
          <i class="ri-send-plane-fill"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAppManager, useI18n } from '#imports';
import UiPreferenceManager from '~ims-app-base/logic/managers/UiPreferenceManager';

defineProps<{ isOpen: boolean }>();
defineEmits<{ close: [] }>();

const { t } = useI18n();

const DEFAULT_WIDTH = 420;
const MIN_WIDTH = 280;
const MAX_WIDTH = 800;
const STORAGE_KEY = 'DesktopAiPanel.width';

const panelWidth = ref(DEFAULT_WIDTH);
const messageText = ref('');

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

function sendMessage() {
  if (!messageText.value.trim()) return;
  messageText.value = '';
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

.DesktopAiPanel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--local-border-color);
}

.DesktopAiPanel-header-icon {
  font-size: 22px;
  color: var(--color-accent);
}

.DesktopAiPanel-header-title {
  flex: 1;
  font-weight: 600;
  font-size: 15px;
}

.DesktopAiPanel-closeBtn {
  font-size: 18px;
  color: var(--button-icon-color);
}

.DesktopAiPanel-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.DesktopAiPanel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-placeholder);
  gap: 12px;
  text-align: center;

  i { font-size: 48px; opacity: 0.3; }
  p { margin: 0; font-size: 14px; max-width: 240px; }
}

.DesktopAiPanel-send {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--local-border-color);
  background: var(--local-box-color);
}

.DesktopAiPanel-textarea {
  flex: 1;
  border: 1px solid var(--local-border-color);
  border-radius: 8px;
  padding: 8px 12px;
  background: var(--local-bg-color);
  color: var(--local-text-color);
  font-family: inherit;
  font-size: 13px;
  resize: none;
  outline: none;
  min-height: 36px;
  max-height: 120px;

  &::placeholder { color: var(--color-placeholder); }
}

.DesktopAiPanel-sendBtn {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  background-color: var(--color-accent);
  color: var(--local-text-on-primary-color);
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.15s;

  &:hover { background-color: var(--color-accent-light); }
}
</style>

<style lang="scss" rel="stylesheet/scss">
.DesktopAiPanel-resizing {
  cursor: ew-resize;
  user-select: none;
}
</style>
