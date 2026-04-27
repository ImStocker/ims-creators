<template>
  <menu-button class="ProjectDropdownMenu" @show="isOpened = true" @hide="isOpened = false">
    <template #button="{ toggle }">
      <div class="ProjectDropdownMenu-button"
          :title="projectTitle"
          @click="toggle"
      >
        <div
          class="ProjectDropdownMenu-button-label"
          :title="projectTitle"
          :class="{ active: isOpened, 'not-project': !currentProject?.title }"
        >
          {{ currentProject?.title ? currentProject.title : $t('profilePage.myProjects') }}
        </div>

        <div class="ProjectDropdownMenu-button-append">
          <template v-if="currentProject">
            <i class=" ProjectDropdownMenu-button-localIcon ri-computer-fill"></i>
            <caption-string
                v-if="!isDesktop"
                class="ProjectDropdownMenu-button-license"
                :value="'local'"
              ></caption-string>
          </template>
          <div
            class="ProjectDropdownMenu-button-arrow"
            :class="{
              'down': isOpened,
              'up': !isOpened,
            }"
          >
            <i class="ri-arrow-drop-down-line"></i>
          </div>
        </div>
      </div>
    </template>
    <menu-list :menu-list="projectMenu" class="ProjectDropdownMenu-menu"></menu-list>
  </menu-button>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { LangStr } from '~ims-app-base/logic/types/ProjectTypes';
import CaptionString from '~ims-app-base/components/Common/CaptionString.vue';
import ProjectLink from '~ims-app-base/components/Common/ProjectLink.vue';
import type { LocalProjectInitInfo } from '#bridge/api/ImsHostProject';
import MenuButton from '~ims-app-base/components/Common/MenuButton.vue';
import MenuList from '~ims-app-base/components/Common/MenuList.vue';
import DialogManager from '~ims-app-base/logic/managers/DialogManager';
import DesktopSettingsDialog from '../Settings/DesktopSettingsDialog.vue';
import AboutProgramDialog from './AboutProgramDialog.vue';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import { openSignInLink } from '~ims-app-base/logic/router/routes-helpers';
import AuthManager from '~ims-app-base/logic/managers/AuthManager';
import type { MenuListItem } from '~ims-app-base/logic/types/MenuList';
import DesktopCreatorManager from '#logic/managers/DesktopCreatorManager';
import ProjectManager from '~ims-app-base/logic/managers/ProjectManager';
import type DesktopAuthManager from '#logic/managers/DesktopAuthManager';


export default defineComponent({
  name: 'ProjectDropdownMenu',
  components: {
    CaptionString,
    ProjectLink,
    MenuButton,
    MenuList
  },
  props: {
    projects: {
      type: Array as PropType<LocalProjectInitInfo[]>,
      required: true,
    },
    currentProject: {
      type: Object as PropType<LocalProjectInitInfo | null>,
      default: null,
    },
  },

  data() {
    return {
      loading: false,
      isOpened: false,
    };
  },
  async mounted(){
    this.loading = true;
    
    this.loading = false;
  },
  methods: {
    async logout() {
      await this.$getAppManager().get<DesktopAuthManager>(AuthManager).logout();
      await openSignInLink(this.$router as any);
    },
    changeLang(lang: LangStr) {
      this.currentLang = lang;
    },
    async openProject(project_path: string){
      await this.$getAppManager().get(DesktopCreatorManager).openProjectWindow(project_path);
    }
  },
  computed: {
    currentLang: {
      get() {
        return this.$getAppManager().get(UiManager).getLanguage();
      },
      set(val: LangStr) {
        this.$getAppManager().get(UiManager).setLanguage(val);
      },
    },
    projectTitle(){
      if(this.isDesktop) {
        return `${this.$t('desktop.welcome.localProject')}:\n${this.currentProject?.localPath}`;
      }
      else {
        return this.currentProject?.title;
      }
    },
    projectInfo() {
      return this.$getAppManager().get(ProjectManager).getProjectInfo()
    },
    recentProjectList(){
      return this.$getAppManager().get(DesktopCreatorManager).getRecentProjectList();
    },
    userInfo() {
      return this.$getAppManager().get(AuthManager).getUserInfo();
    },
    lang: {
      get() {
        return this.$getAppManager().get(UiManager).getLanguage();
      },
      set(val: LangStr) {
        this.$getAppManager().get(UiManager).setLanguage(val);
      },
    },
    currentTheme: {
      get() {
        return this.$getAppManager().get(UiManager).getColorTheme();
      },
      set(val: string) {
        this.$getAppManager().get(UiManager).setColorTheme(val);
      },
    },
    isDesktop() {
      return this.$getAppManager().$appConfiguration.isDesktop;
    },
    projectMenu() {
      return [
        {
          title: this.$t('desktop.mainMenu.settings'),
          action: async () => await this.$getAppManager().get(DialogManager).show(DesktopSettingsDialog),
        },
        {
          title: this.$t('desktop.mainMenu.about'),
          action: async () => await this.$getAppManager().get(DialogManager).show(AboutProgramDialog),
        },
        {
          title: this.$t('desktop.mainMenu.goToSite'),
          action: () => window.location.replace(`https://ims.cr5.space/${this.lang}`),
        },
        {
          title: this.$t('desktop.mainMenu.help'),
          action: () => window.location.replace(`https://ims.cr5.space/help/${this.lang}/start/`),
        },
        {
          title: this.$t('desktop.mainMenu.feedback'),
          action: () => window.location.replace(`https://ims.cr5.space/${this.lang}/feedback`),
        },
        {
          type: 'separator',
        },
        {
          title: this.$t('desktop.mainMenu.newWindow'),
          action: async () => {
            window.imshost.window.openNew({ localPath: null });
          },
        },
        {
          title: this.$t('desktop.mainMenu.openOtherProject'),
          children: [
            ...this.recentProjectList.map((el: any) => {
              return {
                title: el.localPath,
                action: this.projectInfo?.localPath === el.localPath ? undefined : () => this.openProject(el.localPath),
              }
            }),
            {
              type: 'separator'
            },
            {
              title: this.$t('desktop.mainMenu.openOtherProject') + '...',
              action: async () => {
                window.imshost.window.openNew({ localPath: null });
              },
            }
        ]
        },
        {
          type: 'separator',
        },
        // {
        //   title: this.$t('desktop.mainMenu.changeUser'),
        //   action: async () => await this.logout(),
        // },
        {
          title: this.$t('mainMenu.lang'),
          children: [
            {
              title: 'EN',
              action: () => this.changeLang('en'),
            },
            {
              title: 'RU',
              action: () => this.changeLang('ru'),
            },
          ],
        },
        {
          title: this.$t('desktop.settings.fields.theme'),
          children: [
            {
              title: this.$t('desktop.settings.fields.lightTheme'),
              action: () => this.currentTheme = 'ims-light'
            },
            {
              title: this.$t('desktop.settings.fields.darkTheme'),
              action: () => this.currentTheme = 'ims-dark'
            },
          ]
        },
        {
          type: 'separator',
        },
        {
          title: this.$t('desktop.mainMenu.closeWindow'),
          danger: true,
          action: () => window.imshost.window.close(),
        },

        // !this.userInfo
        //   ? {
        //       title: this.$t('auth.signInHeader'),
        //       icon: 'ri-login-circle-line',
        //       action: () =>
        //         this.$getAppManager().get(AuthManager).ensureLoggedInDialog(),
        //     }
        //   : null,
        // this.userInfo
        //   ? {
        //       type: 'service_link',
        //       params: {
        //         name: 'profile',
        //       },
        //       title:
        //         this.$t('mainMenu.profile') +
        //         (this.displayingUserName !== this.userInfo.name
        //           ? ` (${this.userInfo.name})`
        //           : ''),
        //       icon: 'user',
        //     }
        //   : null,
        // this.userInfo
        //   ? {
        //       type: 'service_link',
        //       params: {
        //         name: 'notifications',
        //       },
        //       title: this.$t('profilePage.notifications'),
        //       name: 'notifications',
        //       icon: 'notifications',
        //     }
        //   : null,
        // this.userInfo
        //   ? {
        //       type: 'separator',
        //     }
        //   : null,
        // this.userInfo
        //   ? {
        //       type: 'separator',
        //     }
        //   : null,
        // this.userInfo
        //   ? {
        //       title: this.$t('profilePage.logout'),
        //       icon: 'exit',
        //       danger: true,
        //       action: this.logout,
        //     }
        //   : null,
      ].filter((x) => x) as MenuListItem[];
    }
  }
});
</script>

<style lang="scss" scoped>
@use "~ims-app-base/style/devices-mixins.scss";

[data-theme='ims-light'] {
  .ProjectDropdownMenu-button-localIcon {
    color: var(--color-accent);
  }
  .ProjectDropdownMenu {
    background-color: var(--input-bg-color);
  }
  .ProjectDropdownMenu-button-label {
    color: var(--local-text-color) !important;
  }
}
.ProjectDropdownMenu {
  min-width: 200px;
  width: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--input-border-color);
  background-color: transparent;
  cursor: pointer;
  border-radius: 4px;
}
.ProjectDropdownMenu-button {
  display: flex;
  justify-content: space-between;
  padding: 5px 15px;

  .ProjectDropdownMenu-button-label {
    font-size: var(--local-font-size);
    font-weight: 700;
    max-width: 100%;
    color: var(--color-accent);
    overflow: hidden;
    text-overflow: ellipsis;
    text-wrap: nowrap;

    &.active {
      color: var(--local-text-color);
    }
  }
}

.ProjectDropdownMenu-button-append {
  display: flex;
  align-items: center;
  gap: 7px;
  font-weight: 400;
  margin-left: 10px;
}

.ProjectDropdownMenu-button-license {
  height: 16px;
  margin-left: 0px;
  max-width: 45px;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--root-text-on-primary-color);
  font-size: 8px;
  font-weight: 700;
  text-transform: uppercase;
  vertical-align: middle;
  line-height: 12px;

  padding: 2.4px 4px;
  border-radius: 4px;
  background-color: #fff;

  i {
    color: var(--color-accent);
  }
}
.ProjectDropdownMenu-button-arrow {
  color: var(--input-placeholder-color) !important;

  &.down {
    transition: ease-in-out 0.4s;
    transform: rotate(180deg);
    -moz-transform: rotate(180deg);
  }
  &.up {
    transition: ease-in-out 0.4s;
    transform: rotate(0);
    -moz-transform: rotate(0);
  }
}

.ProjectDropdownMenu-menu {
  @include devices-mixins.device-type(pc) {
    width: var(--DropdownContainer-attachToElement-width);
  }
}
</style>
