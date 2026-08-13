<template>
  <div class="AppUserInfo" :title="displayingUserName">
    <menu-button v-if="userInfo" class="AppUserInfo-user">
      <template #button="{ toggle }">
        <button class="is-button is-button-user" @click="toggle">
          <user-profile-icon :user="userAccountInfo"></user-profile-icon>
        </button>
      </template>
      <menu-list :menu-list="menuList" :attach-position="'left'">
      </menu-list>
    </menu-button>
    <button v-else class="is-button is-button-icon AppUserInfo-sign"
      :title="$t('auth.signInHeader')"
      @click="signIn()"
    >
      <i class="ri-login-circle-line"></i>
    </button>
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue';
import MenuButton from '~ims-app-base/components/Common/MenuButton.vue';
import MenuList from '~ims-app-base/components/Common/MenuList.vue';
import AuthManager from '~ims-app-base/logic/managers/AuthManager';
import ProjectManager from '~ims-app-base/logic/managers/ProjectManager';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import type { MenuListItem } from '~ims-app-base/logic/types/MenuList';
import type { LangStr } from '~ims-app-base/logic/types/ProjectTypes';
import UserProfileIcon from '~ims-app-base/components/Common/UserProfileIcon.vue';

export default defineComponent({
  name: 'AppUserInfo',
  components: {
    UserProfileIcon,
    MenuButton,
    MenuList,
  },
  computed: {
    userInfo() {
      return this.$getAppManager().get(AuthManager).getUserInfo();
    },
    userAccountInfo() {
      return this.$getAppManager()
        .get(ProjectManager)
        .getCurrentAccountValueInProject();
    },
    displayingUserName() {
      const account_val = this.userAccountInfo;
      return account_val ? account_val.Name : '';
    },
    croppedUserName() {
      return this.displayingUserName?.substring(0, 2);
    },
    menuList(): MenuListItem[] {
      return [
        {
          title:
            this.$t('mainMenu.profile') +
            (this.displayingUserName !== this.userInfo.name
              ? ` (${this.userInfo.name})`
              : ''),
          icon: 'user',
          action: () => {
            window.location.replace('https://ims.cr5.space/app/account/personal');
          }
        },
        {
          type: 'separator',
        },
        {
          title: this.$t('desktop.settings.logout'),
          icon: 'exit',
          danger: true,
          action: this.logout,
        },
      ].filter((x) => x) as MenuListItem[];
    },
    lang: {
      get() {
        return this.$getAppManager().get(UiManager).getLanguage();
      },
      set(val: LangStr) {
        this.$getAppManager().get(UiManager).setLanguage(val);
      },
    },
  },
  methods: {
    async signIn(){
      await this.$getAppManager().get(AuthManager).ensureLoggedInDialog()
    },
    async logout() {
      await this.$getAppManager().get(AuthManager).logout();
    },
  },
});
</script>
<style lang="scss" scoped>
.AppUserInfo {
  margin: auto 5px;
}
.AppUserInfo-notification-count {
  background-color: var(--color-danger);
  color: #e9e9e9;
  min-width: var(--local-font-size);
  max-height: var(--local-font-size);
  padding: 2px 5px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.AppUserInfo-user {
  width: 32px;
  height: 32px;
  padding: 0;
}

.AppUserInfo-notifications {
  position: absolute;
  background-color: var(--color-danger);
  font-size: 8px;
  line-height: 8px;
  padding: 3px;
  border-radius: 100%;
  right: -3px;
  bottom: -3px;
  color: #e9e9e9;
}
</style>
