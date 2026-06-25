<template>
  <div class="WelcomeFormContentStart">
    <div class="WelcomeFormContentStart-Main">
      <div
        v-for="option of options"
        :key="option.title"
        class="WelcomeFormContentStart-Action"
      >
        <div class="WelcomeFormContentStart-Action-left">
          <div class="WelcomeFormContentStart-Action-title">
            {{ option.title }}
          </div>
          <div
            v-if="option.subTitle"
            class="WelcomeFormContentStart-Action-subtext"
          >
            {{ option.subTitle }}
          </div>
        </div>
        <button
          class="is-button WelcomeFormContentStart-Action-button"
          :class="{ accent: option.main }"
          @click="option.action"
        >
          {{ option.buttonTitle }}
        </button>
      </div>
    </div>
    <div class="WelcomeFormContentStart-Other">
      <div class="WelcomeFormContentStart-Action">
        <div class="WelcomeFormContentStart-Action-title">{{$t('desktop.settings.fields.theme')}}</div>
        <ims-select
          v-model="currentTheme"
          :options="themeList"
          :clearable="false"
          :get-option-label="
            (opt: any) =>
              opt ? convertTranslatedTitle(opt.title, (key: any) => $t(key)) : ''
          "
          :get-option-key="(opt: any) => opt.name"
          :reduce="(opt: any) => opt.name"
          class="WelcomeFormContentStart-Action-select"
        />
      </div>
      <div class="WelcomeFormContentStart-Action">
        <div class="WelcomeFormContentStart-Action-title">{{$t('desktop.settings.fields.language')}}</div>
        <ims-select
          v-model="currentLang"
          :options="languagesList"
          :clearable="false"
          :get-option-label="
            (opt: any) =>
              opt ? convertTranslatedTitle(opt.title, (key: any) => $t(key)) : ''
          "
          :get-option-key="(opt: any) => opt.name"
          :reduce="(opt: any) => opt.name"
          class="WelcomeFormContentStart-Action-select"
        />
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue';
import ImsSelect from '~ims-app-base/components/Common/ImsSelect.vue';
import type { MenuListItem } from '~ims-app-base/logic/types/MenuList';
import { convertTranslatedTitle } from '~ims-app-base/logic/utils/assets';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import type { LangStr } from '~ims-app-base/logic/types/ProjectTypes';
import AuthManager from '~ims-app-base/logic/managers/AuthManager';
import DesktopCreatorManager from '#logic/managers/DesktopCreatorManager';

export default defineComponent({
  name: 'WelcomeFormContentStart',
  components: {
    ImsSelect,
  },
  emits: ['create-project', 'select-projects', 'sign-in'],
  computed: {
    options(){
      return [
        {
          title: this.$t('desktop.welcome.createNewProject'),
          subTitle: this.$t('desktop.welcome.createNewProjectTooltip'),
          buttonTitle: this.$t('desktop.welcome.create'),
          main: true,
          action: () => {
            this.$emit('create-project');
          },
        },
        {
          title: this.$t('desktop.welcome.openFolderAsProject'),
          subTitle: this.$t('desktop.welcome.openFolderAsProjectTooltip'),
          buttonTitle: this.$t('desktop.welcome.open'),
          action: () => this.openFolderAsProject(),
        },
        {
          title: this.$t('desktop.welcome.openCloudProject'),
          subTitle: this.$t('desktop.welcome.openCloudProjectTooltip'),
          buttonTitle: this.userInfo ? this.$t('desktop.welcome.select') : this.$t('desktop.welcome.signIn'),
          action: () => {
            if (this.userInfo) this.$emit('select-projects')
            else this.$emit('sign-in');
          },
        },
      ]
    },
    userInfo(){
      return this.$getAppManager().get(AuthManager).getUserInfo();
    },
    currentLang: {
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
    availableLangs() {
      return [
        {
          value: 'en',
          title: 'English',
          enTitle: 'English',
        }, 
        {
          value: 'ru',
          title: 'Русский',
          enTitle: 'Russian',
        }, 
        {
          value: 'de',
          title: 'Deutsche',
          enTitle: 'German',
        }];
    },
    languagesList() {
      const list: MenuListItem[] = [];
      for (const lang of this.availableLangs) {
        list.push({
          name: lang.value,
          title: `${lang.title} - ${lang.enTitle}`,
          action:
            this.currentLang.substring(0, 2) === lang.value.substring(0, 2)
              ? undefined
              : () => this.changeLang(lang.value as LangStr),
        });
      }
      return list;
    },
    themeList() {
      const list: MenuListItem[] = [
        {
          name: 'ims-light',
          title: this.$t('desktop.settings.fields.lightTheme'),
        },
        {
          name: 'ims-dark',
          title: this.$t('desktop.settings.fields.darkTheme'),
        },
      ];
      return list;
    },
  },
  methods: {
    changeLang(lang: LangStr) {
      this.currentLang = lang;
    },
    convertTranslatedTitle,
    async openFolderAsProject() {
      const res = await window.imshost.fs.showSelectDirectoryDialog();
      if (res.canceled) return
      await this.$getAppManager().get(DesktopCreatorManager).openProjectWindow(res.filePaths[0]);
    },
  },
});
</script>

<style lang="scss">
.WelcomeFormContentStart-Action-subtext {
  font-size: 12px;
  color: var(--local-sub-text-color);
}
.WelcomeFormContentStart {
  display: flex;
  flex-direction: column;
}
.WelcomeFormContentStart-Action {
  display: flex;
  gap: 10px;
  padding: 10px 0;
  align-items: center;
  &:not(:last-child) {
    border-bottom: 1px solid var(--local-border-color);
  }
}
.WelcomeFormContentStart-Action-left,
.WelcomeFormContentStart-Action-title,
.WelcomeFormContentStart-Action-select {
  flex: 1;
}
.WelcomeFormContentStart-Main {
  padding: 10px 15px;
  background-color: var(--app-menu-bg-color);
  border: 1px solid var(--app-menu-bg-color);
  border-radius: 10px;
  margin-bottom: 40px;
}
.WelcomeFormContentStart-Other {
  padding: 10px 15px;
}
.WelcomeFormContentStart-Action-button{
  width: 114px;
  justify-content: center;
}
</style>
