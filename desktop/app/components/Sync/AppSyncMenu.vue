<template>
    <div class="AppSyncMenu">       
      <menu-button class="AboutGameConfigurePage-manage-languages">
        <template #button="{ toggle }">
          <button
            class="is-button is-button-icon AppSyncMenu-button"
            :title="$t('desktop.fsSync.synchronization')"
            @click="toggle"
          >
              <i 
                :class="{ 'spinning-icon': syncIsRunning && !onPause }"
                class="ri-loop-right-line"
              ></i>
          </button>
          <i v-if="hasSyncError" 
            class="ri-error-warning-line AppSyncMenu-additionalIcon AppSyncMenu-hasError"
            :title="'Error: ' + hasSyncError"
          ></i>
          <i v-else-if="onPause" class="ri-pause-circle-line AppSyncMenu-additionalIcon"></i>
          <i v-else-if="syncInfo && !inProcess && syncInfo.hasChanges" 
            class="AppSyncMenu-additionalIcon AppSyncMenu-hasNotSyncedFiles ri-circle-fill"></i>
        </template>
        <menu-list :menu-list="syncMenuList"></menu-list>
      </menu-button>
    </div>
</template>

<script lang="ts">
import DesktopSyncManager from '#logic/managers/DesktopSyncManager';
import type { SyncInfo } from '#logic/types/SyncTypes';
import { defineComponent } from 'vue';
import DialogManager from '~ims-app-base/logic/managers/DialogManager';
import SyncManageDialog from './SyncManageDialog.vue';
import AuthManager from '~ims-app-base/logic/managers/AuthManager';
import ProjectManager from '~ims-app-base/logic/managers/ProjectManager';
import BuyLicenseDialog from './BuyLicenseDialog.vue';
import type { MenuListItem } from '~ims-app-base/logic/types/MenuList';
import DesktopProjectManager from '#logic/managers/DesktopProjectManager';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import MenuButton from '~ims-app-base/components/Common/MenuButton.vue';
import MenuList from '~ims-app-base/components/Common/MenuList.vue';
import DesktopCreatorManager from '#logic/managers/DesktopCreatorManager';
import type DesktopAuthManager from '#logic/managers/DesktopAuthManager';
import { SyncCurrentStateStatus, type SyncCurrentState } from '#bridge/types/SyncTypes';

export default defineComponent({
  name: 'AppSyncMenu',
  components: {
    MenuButton,
    MenuList,
  },
  computed: {
    syncIsRunning(){
      return this.syncInfo ? this.inProcess : false;
    },
    hasSyncError(){
       return this.syncInfo ? this.syncInfo.error : null;
    },
    inProcess(){
      return this.syncInfo ? this.syncInfo.status === SyncCurrentStateStatus.IN_PROCESS : false;
    },
    onPause(){
      return this.syncInfo ? this.syncInfo.status === SyncCurrentStateStatus.PAUSE : false;
    },
    syncInfo(): SyncCurrentState | undefined {
      return this.$getAppManager().get(DesktopSyncManager).getCurrentSyncState();
    },
    userInfo() {
      return this.$getAppManager().get(AuthManager).getUserInfo();
    },
    projectInfo() {
      return this.$getAppManager().get(ProjectManager).getProjectInfo();
    },
    syncMenuList() {
      const list: MenuListItem[] = [];
      if(!this.projectInfo?.id){
        list.push({
          title: this.$t('desktop.fsSync.menu.syncWithCloud'),
          action: async () => {
              await this.syncWithCloud();
              this.$getAppManager().get(UiManager).showSuccess(this.$t('desktop.fsSync.menu.syncWithCloudEnd'));
            }
        });
      }
      else {
        if(this.projectInfo?.id && !this.inProcess && !this.onPause){
          list.push({
            title: this.$t('desktop.fsSync.menu.syncNow'),
            action: async () => {
                await this.$getAppManager().get(DesktopSyncManager).resumeSyncProject()
                const sync_status = this.$getAppManager().get(DesktopSyncManager).getCurrentSyncState();
                if(sync_status?.error){
                  this.$getAppManager().get(UiManager).showError(this.$t('desktop.fsSync.menu.syncNowEndWithErrors'));
                }
                else {
                  this.$getAppManager().get(UiManager).showSuccess(this.$t('desktop.fsSync.menu.syncNowEnd'));
                }
              }
          });
        }
        if(this.inProcess && !this.onPause) {
          list.push({
            title: this.$t('desktop.fsSync.menu.pause'),
            action: async () => {
              await this.$getAppManager().get(DesktopSyncManager).pauseSyncProject();
              this.$getAppManager().get(UiManager).showSuccess(this.$t('desktop.fsSync.menu.pauseEnd'));
            }
          });
        }
        else if(this.projectInfo?.id && this.onPause){
          list.push({
            title: this.$t('desktop.fsSync.menu.resume'),
            action: async () => {
              await this.$getAppManager().get(DesktopSyncManager).resumeSyncProject()
              this.$getAppManager().get(UiManager).showSuccess(this.$t('desktop.fsSync.menu.resumeEnd'));
            }
          });
        }
        list.push({
          title: this.$t('desktop.fsSync.menu.errors'),
          action: async () => await this.openSyncManageDialog(),
        });
        // list.push({
        //   title: this.$t('desktop.fsSync.menu.openInCloud'),
        //   action: async () => await this.openSyncManageDialog(),
        // });
      }
      return list;
    },
  },
  methods: {
    async syncWithCloud(){
      if(!this.userInfo){
        await this.$getAppManager()
          .get(AuthManager)
          .ensureLoggedInDialog(this.$t('auth.needLoginForAction'));
      }
      else {
        const user_licenses = await this.$getAppManager()
          .get<DesktopAuthManager>(AuthManager)
          .getUserLicense();
        const has_license = user_licenses.list.find(license => license.features.desktopSync);
        const project_info = this.projectInfo;
        if(project_info && (project_info.license?.features.desktopSync || has_license)){
            try {
              const new_project_info = await this.$getAppManager()
              .get(DesktopProjectManager)
              .createProject({
                title: project_info.title,
                template_ids: [],
                menu_settings: {
                  'menu-about': false,
                  'menu-gamedesign': true,
                  'menu-team': true,
                },
              })
              if(!project_info.localPath) {
                throw Error('localPath is not set') ;
              }
              await this.$getAppManager().get(DesktopCreatorManager).connectToCloudProject(new_project_info);
              await this.$getAppManager().get(DesktopSyncManager).runSync();
            }
            catch(err: any) {
              this.$getAppManager().get(UiManager).showError(err.message);
            }
        }
        else {
          await this.$getAppManager().get(DialogManager).show(BuyLicenseDialog, {});
        }
      }
    },
    async openSyncManageDialog() {
      if(this.projectInfo?.id) {
        await this.$getAppManager().get(DialogManager).show(SyncManageDialog, {});
      }
      else {
        await this.syncWithCloud();
      }
    }
  }
})

</script>

<style lang="scss" scoped>
.AppSyncMenu {
  margin: auto 5px;
  position: relative;
}
.AppSyncMenu-button {
  --button-font-size: 24px;
}
.AppSyncMenu-additionalIcon{
  position: absolute;
  bottom: -4px;
  right: -3px;
}
.AppSyncMenu-hasError{
  color: var(--color-main-error);
}
.AppSyncMenu-hasNotSyncedFiles{
  color: var(--color-main-yellow);
  font-size: 8px;
  bottom: 4px;
  right: 4px;
}
.spinning-icon {
  animation: spin 1.5s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>