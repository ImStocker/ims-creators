<template>
  <div class="App">
    <app-menu
      :section-state="true"
      v-model:mobile-menu-state="mobileMenuState"
      :initial-section-name="initialSection"
      class="App-menu"
    ></app-menu>
    <div class="App-header-wrapper">
      <app-menu-toggle
        class="App-menu-toggle if-size-not-pc"
        @click="toggleMenu"
      ></app-menu-toggle>
      <div class="App-header-emptySpace"></div>
    </div>
    <div class="DesktopApp-page" :class="projectId !== undefined ? 'App-content' : 'App-content-noProjects'">
      <div class="DesktopApp-page-header">
        <div class="DesktopApp-page-header-switcher">
          <button class="is-button is-button-icon switcherButton" @click="previous()" :disabled="!tabController.canGoBack">
            <i class="ri-arrow-left-line"></i>
          </button>
          <button class="is-button is-button-icon switcherButton" @click="next()" :disabled="!tabController.canGoForward">
            <i class="ri-arrow-right-line"></i>
          </button>
        </div>
        <tab-list class="DesktopApp-page-header-tabs"
          :list="tabController.tabs"
          :current-tab="tabController.currentTab ?? undefined"
          @open="openTab($event)"
          @remove="removeTab($event)"
          @create="openNewTab()"
        ></tab-list>
        <div class="DesktopApp-page-header-menuSpace">
          <new-version-box class="DesktopApp-page-header-menuSpace-item"></new-version-box>
        </div>
        <button
          class="is-button is-button-icon DesktopApp-aiToggle"
          :class="{ 'is-active': aiPanelOpen }"
          :title="$t('desktop.aiAssistant.title')"
          @click="toggleAiPanel"
        >
          <i class="ri-bard-line"></i>
        </button>
        <app-sync-menu></app-sync-menu>
        <app-user-info></app-user-info>
      </div>
      <div class="DesktopApp-page-content">
        <slot />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue';
import DesktopCreatorManager from '#logic/managers/DesktopCreatorManager';
import ProjectManager from '~ims-app-base/logic/managers/ProjectManager';
import type { ProjectShortInfo } from '~ims-app-base/logic/types/ProjectTypes';
import AppMenuToggle from '#components/App/AppMenuToggle.vue';
import UiPreferenceManager from '~ims-app-base/logic/managers/UiPreferenceManager';
import {
  APP_NAVIGATION_SECTION_INITIAL_WIDTH,
  APP_NAVIGATION_SECTIONS_WIDTH,
} from '~ims-app-base/components/layoutConstants';
import TabList from '#components/App/TabList.vue';
import AppMenu from '#components/App/AppMenu.vue';
import DesktopUiManager from '#logic/managers/DesktopUiManager';
import type { DesktopTab } from '#logic/types/DesktopTabController';
import { ScreenSize } from '~ims-app-base/logic/managers/UiManager';
import AuthManager from '~ims-app-base/logic/managers/AuthManager';
import NewVersionBox from '#components/Update/NewVersionBox.vue';
import AppUserInfo from '#components/App/AppUserInfo.vue';
import AppSyncMenu from '#components/Sync/AppSyncMenu.vue';

export default defineComponent({
  name: 'ProjectLayout',
  inject: {
    aiPanelOpen: { from: 'aiPanelOpen', default: false },
    toggleAiPanel: { from: 'toggleAiPanel', default: () => {} },
  },
  components: {
    AppMenu,
    AppMenuToggle,
    TabList,
    NewVersionBox,
    AppUserInfo,
    AppSyncMenu,
  },
  provide() {
    return {
      providedMenuWidth: computed(() => this.menuWidth),
    };
  },
  data() {
    return {
      guestSectionState: false,
    };
  },
  computed: {
    userInfo() {
      return this.$getAppManager().get(AuthManager).getUserInfo();
    },
    tabs(){
      return this.tabController.tabs;
    },
    tabController() {
      return this.$getAppManager().get(DesktopUiManager).tabController;
    },
    projectInfo(){
      return this.$getAppManager().get(ProjectManager).getProjectInfo();
    },
    projects(): ProjectShortInfo[] {
      return this.$getAppManager().get(DesktopCreatorManager).projectList;
    },
    projectId() {
      return this.$getAppManager().get(ProjectManager).getProjectInfo()?.id;
    },
    selectedProject(): ProjectShortInfo | null {
      return (
        this.projects.find((project) => project.id === this.projectId) ?? null
      );
    },
    isMobile() {
      return this.$getAppManager()
        .get(DesktopUiManager)
        .isScreenSize(ScreenSize.NOT_PC);
    },
    isGuest() {
      return !this.$getAppManager().get(ProjectManager).getUserRoleInProject();
    },
    menuWidth() {
      const sectionWidth = this.$getAppManager()
        .get(UiPreferenceManager)
        .getPreference(
          'AppMenu.sectionWidth',
          APP_NAVIGATION_SECTION_INITIAL_WIDTH,
        );
      return (sectionWidth ?? 0) + APP_NAVIGATION_SECTIONS_WIDTH;
    },
    mobileMenuState: {
      get(): boolean {
        return this.$getAppManager()
          .get(UiPreferenceManager)
          .getPreference('AppMenu.mobileMenuState', false);
      },
      set(val: boolean) {
        return this.$getAppManager()
          .get(UiPreferenceManager)
          .setPreference('AppMenu.mobileMenuState', val);
      },
    },
    initialSection(): string | undefined {
      return 'project-gdd';
    },
  },
  methods: {
    previous(){
      this.tabController.goBack();
    },
    next(){
      this.tabController.goForward();
    },
    toggleMenu() {
      if (!this.isMobile) return;
      this.mobileMenuState = !this.mobileMenuState;
    },
    openNewTab(){
      this.$getAppManager().get(DesktopUiManager).openLink({
        name: 'project-new-tab',
        params: {
          projectId: '-',
        }
      }, true);
    },
    openTab(tab: DesktopTab){
      this.tabController.openTab(tab);
    },
    removeTab(tab: DesktopTab){
      this.tabController.removeTab(tab);
    }
  },
});
</script>

<style lang="scss" rel="stylesheet/scss">
@use '~ims-app-base/style/devices-mixins.scss';

$header-height: 60px;

.App {
  height: 100dvh;
  display: flex;

  .App-header,
  .App-header h1 {
    font-size: 24px;
    font-weight: 700;
    line-height: 30px;
    color: var(--local-header-color);
    margin: 0;
  }
  .App-header h2 {
    font-size: 20px;
    font-weight: 700;
    line-height: 30px;
    margin: 0;
  }

  .App-header {
    margin-bottom: 8px;
  }
}
.App-menu {
  padding-top: var(--ProjectLayout-header-height);
}
.App-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 100%;
  min-width: 0px;
}
.App-content-noProjects {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding-top: 50px;
  height: 100%;
  overflow:auto;
}

.App-header-emptySpace {
  flex: 1;
}

.App-header-wrapper {
  display: flex;
  align-items: center;

  @include devices-mixins.device-type(not-pc) {
    z-index: 400;
    background-color: var(--local-box-color);
    height: $header-height;
    padding: 10px 25px;
    pointer-events: none;
    position: absolute;
    top: 0;
    width: 100%;
    .App-header-theme-toggle,
    .App-menu-toggle,
    .App-userInfo {
      pointer-events: all;
    }
  }
  @include devices-mixins.device-type(pc) {
    position: absolute;
    right: 10px;
    top: 15px;
    z-index: 200;
  }
}

.App-header-theme-toggle {
  background: none;
  border: none;
  font-size: 38px;
  line-height: 38px;
  padding: 0;
  margin-top: -1px;
  color: #666;
  &:hover {
    color: #eee;
    cursor: pointer;
  }
}

.App-userInfo,
.App-header-theme-toggle {
  margin-left: 10px;
}
.DesktopApp-page-header{
  display: flex;
  justify-content: space-between;
  width: 100%;
  background-color: var(--local-bg-color);
  --local-bg-color: var(--app-menu-bg-color);
  --local-box-color: var(--editor-bg-color);
}

.DesktopApp-page-header-switcher{
  display: flex;
  gap: 10px;
}

.DesktopApp-page-header-tabs{
  padding-right: 5px;
  width: 100%;
}

.DesktopApp-page-content{
  overflow: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: var(--local-bg-color);
  --local-bg-color: var(--editor-bg-color);
  --local-box-color: var(--editor-box-color);

  --panel-bg-color: var(--local-box-color);
}
.switcherButton:disabled{
  cursor: default;
}

.DesktopApp-page-header-menuSpace{
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.DesktopApp-page-header-menuSpace-item{
  margin-right: 10px;
}

.DesktopApp-aiToggle {
  margin-right: 4px;
  font-size: 20px;
  color: var(--button-icon-color);

  &.is-active {
    color: var(--color-accent);
  }
}
</style>
