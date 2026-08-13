<template>
  <div class="DesktopApp" ref="el">
    <NuxtLoadingIndicator
      color="var(--color-accent)"
      error-color="var(--color-danger)"
    ></NuxtLoadingIndicator>
    <div class="DesktopApp-main" ref="mainEl">
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
      <DialogHost :dialogs="openedDialogs"></DialogHost>
      <div class="App-proTooltip"><i class="ri-arrow-up-double-fill"></i></div>
      <div class="App-toasts">
        <AppToasts></AppToasts>
      </div>
    </div>
    <DesktopAiPanel
      :is-open="aiPanelOpen"
      @close="aiPanelOpen = false"
    />
  </div>
</template>
<script setup lang="ts">
import { createError, useAppManager, useHead, useLocaleHead } from '#imports';
import {
  computed,
  onMounted,
  onUnmounted,
  provide,
  useTemplateRef,
  watch,
  ref,
} from 'vue';
import DialogHost from '~ims-app-base/components/Dialog/DialogHost.vue';
import DialogManager from '~ims-app-base/logic/managers/DialogManager';
import LocalFsSyncManager from '~ims-app-base/logic/managers/LocalFsSyncManager';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import UiPreferenceManager from '~ims-app-base/logic/managers/UiPreferenceManager';
import AppToasts from '~ims-app-base/components/Common/AppToasts.vue';
import DesktopUpdateManager from '#logic/managers/DesktopUpdateManager';
import DesktopAiPanel from '#components/App/DesktopAiPanel.vue';

const appManager = useAppManager();

const i18nHead = useLocaleHead();

const openedDialogs = computed(() => {
  return appManager.get(DialogManager)?.dialogs ?? [];
});

const themeType = ref(appManager.get(UiManager).getColorTheme());
watch(
  () => {
    return appManager.get(UiManager).getColorTheme();
  },
  (val) => {
    themeType.value = val;
    if (typeof window !== 'undefined' && window.document) {
      // Ensure that theme will be changed immediately
      window.document.body.dataset['theme'] = val;
    }
  },
);

useHead(() => ({
  htmlAttrs: {
    lang: i18nHead.value.htmlAttrs!.lang,
    link: [...(i18nHead.value.link || [])],
    meta: [...(i18nHead.value.meta || [])],
  },
  bodyAttrs: {
    'data-theme': themeType.value,
  },
}));

function handleResize() {
  appManager.get(UiManager).handleResize(window.innerWidth);
}
onMounted(async () => {
  await appManager.get(UiPreferenceManager).initClient();
  await appManager.get(UiManager).initClient();
  await appManager.get(LocalFsSyncManager).initClient();
  const updateManager = appManager.get(DesktopUpdateManager);
  if (updateManager.isAutoCheckingUpdateEnabled){
    updateManager.checkAndShowNewVersion();
  }
  window.addEventListener('resize', handleResize, {
    passive: true,
  });
});
onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});

const aiPanelOpen = ref(false);
provide('aiPanelOpen', aiPanelOpen);
provide('toggleAiPanel', () => { aiPanelOpen.value = !aiPanelOpen.value; });

const el = useTemplateRef('el');
const mainEl = useTemplateRef('mainEl');
let rightPanelDiv: HTMLDivElement | null = null;
provide('getRightPanel', () => {
  if (!mainEl.value) return null;
  if (!rightPanelDiv){
    rightPanelDiv = document.createElement('DIV') as HTMLDivElement;
    rightPanelDiv.className = 'right-panel';
    mainEl.value.appendChild(rightPanelDiv);
  }
  return rightPanelDiv;
})

let dropdownHostDiv: HTMLDivElement | null = null;
provide('getDropdownHost', () => {
  if (!el.value) return null;
  if (!dropdownHostDiv) {
    dropdownHostDiv = document.createElement('DIV') as HTMLDivElement;
    dropdownHostDiv.className = 'dropdown-host';
    el.value.appendChild(dropdownHostDiv);
  }
  return dropdownHostDiv;
});
</script>

<style lang="scss">
@use '~ims-app-base/style/vue-select';
@use '~ims-app-base/style/new-vars.scss';
@use '~ims-app-base/style/app';
@use '~ims-app-base/style/load-page';
@use './style/desktop';
@import '~ims-app-base/style/fonts/Ubuntu/stylesheet.css';
@import '~ims-app-base/style/fonts/Montserrat/stylesheet.css';
@import 'remixicon/fonts/remixicon.css';
@import '~ims-creators/../assets/ims-icon-font/out/ims-icon-font.css';
@import '~ims-app-base/style/creators-colors.css';

.DesktopApp {
  height: 100vh;
  user-select: none;
  display: flex;
  --ProjectLayout-header-height: 51px;
}

.DesktopApp-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  position: relative;
}

.DesktopApp-main > .right-panel {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 0;
  overflow: visible;
  pointer-events: none;
}

.DesktopApp-main > .right-panel > .RightPanel {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 400px;
  pointer-events: auto;
}

.dropdown-host{
  z-index: 900;
  position: fixed;
}

.selectable-text{
  user-select: all;
}

.fa-circle {
  color: #cccccc;
}
.state-readiness,
.fa-circle-check {
  color: var(--color-ready-value);
}
.App-proTooltip {
  display: none;
  z-index: 10000;
  position: absolute;
  left: 0;
  top: 0;
  background: #fff382;
  color: #000;
  font-size: 16px;
  padding: 0 2px;
  font-weight: bold;
  border-radius: 4px;
  overflow: hidden;
  transform: translate3d(0, 0, 0);
  &:not(:disabled):before {
    content: '';
    background-color: rgba(255, 255, 255, 0.5);
    display: block;
    position: absolute;
    transform: skewX(-45deg) translateX(0);
    transition: none;
    animation: App-proTooltip-ripple 2s ease-in-out infinite;
    height: 1rem * calc(20 / 14);
    width: 1rem * calc(20 / 14);
    top: 0px;
    left: -1rem * calc(20 / 14);
  }
  &:hover {
    &:before {
      visibility: hidden;
    }
  }
}
@keyframes App-proTooltip-ripple {
  25% {
    opacity: 1;
  }
  30% {
    transform: skewX(-45deg) translateX(10em);
    opacity: 0;
  }
  100% {
    transform: skewX(-45deg) translateX(10em);
    opacity: 0;
  }
}
.App-toasts {
  position: fixed;
  right: 50%;
  bottom: 0;
  transform: translateX(50%);
  pointer-events: none;
  z-index: 3000;
}
</style>
