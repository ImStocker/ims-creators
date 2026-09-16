<template>
  <div class="Form DesktopSettingsDialog_sync">
    <form-builder
        :form-schema="formSchemaFiltered"
        :form-model="formModel"
    ></form-builder>
    <div v-if="isCloudProject" class="DesktopSettingsDialog_sync-status" :class="syncStatusClass">
      <i :class="syncStatusIcon"></i>
      <span>{{ syncStatusText }}</span>
    </div>
    <div class="DesktopSettingsDialog_sync-actionsHeader">
      {{ $t('desktop.fsSync.actionsHeader') }}
    </div>
    <div class="Form-row DesktopSettingsDialog_sync-actions use-buttons-action">
      <div class="DesktopSettingsDialog_sync-actions-group">
        <button v-if="!isCloudProject" class="is-button is-button-action-outlined success" @click="connectToCloud">
          <i class="ri-refresh-line"></i>
          <span>{{ $t('desktop.fsSync.menu.syncWithCloud') }}</span>
        </button>
        <button v-else-if="!userInfo" class="is-button is-button-action-outlined success" @click="loginAndResume">
          <i class="ri-refresh-line"></i>
          <span>{{ $t('desktop.fsSync.menu.resume') }}</span>
        </button>
        <template v-else>
          <button v-if="!inProcess && !onPause" class="is-button is-button-action-outlined success" :disabled="inProcess" @click="syncNow">
            <i class="ri-refresh-line"></i>
            <span>{{ $t('desktop.fsSync.menu.syncNow') }}</span>
          </button>
          <button v-if="!inProcess && onPause" class="is-button is-button-action-outlined success" @click="resumeSync">
            <i class="ri-play-fill"></i>
            <span>{{ $t('desktop.fsSync.menu.resume') }}</span>
          </button>
          <button v-if="!onPause" class="is-button is-button-action-outlined warning" :disabled="inProcess" @click="pauseSyncing">
            <i class="ri-pause-circle-line"></i>
            <span>{{ $t('desktop.fsSync.menu.pauseSyncing') }}</span>
          </button>
        </template>
      </div>
      <div v-if="isCloudProject" class="DesktopSettingsDialog_sync-actions-group">
        <button class="is-button is-button-action-outlined" @click="openSyncManageDialog">
          <i class="ri-error-warning-line"></i>
          <span>{{ $t('desktop.fsSync.menu.errors') }}</span>
        </button>
        <button class="is-button is-button-action-outlined" @click="resyncAll">
          <i class="ri-loop-right-line"></i>
          <span>{{ $t('desktop.fsSync.menu.resyncAll') }}</span>
        </button>
        <button class="is-button is-button-action-outlined" @click="openInCloud">
          <i class="ri-cloud-line"></i>
          <span>{{ $t('desktop.fsSync.menu.openInCloud') }}</span>
        </button>
        <button class="is-button is-button-action-outlined danger" @click="unlinkCloudProject">
          <i class="ri-link-unlink-m"></i>
          <span>{{ $t('desktop.fsSync.menu.unlinkFromCloud') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import type { FormSchema } from "~ims-app-base/components/Form/FormBuilderTypes"
import ImsSelect from '~ims-app-base/components/Common/ImsSelect.vue';
import FormBuilder from '~ims-app-base/components/Form/FormBuilder.vue';
import FormBuilderModelBindObject from "~ims-app-base/components/Form/FormBuilderModelBindObject"
import ProjectManager from '~ims-app-base/logic/managers/ProjectManager';
import DesktopSyncManager from '#logic/managers/DesktopSyncManager';
import DesktopCreatorManager from '#logic/managers/DesktopCreatorManager';
import { assert } from '~ims-app-base/logic/utils/typeUtils';
import DialogManager from '~ims-app-base/logic/managers/DialogManager';
import AuthManager from '~ims-app-base/logic/managers/AuthManager';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import SyncManageDialog from '../Sync/SyncManageDialog.vue';
import SyncWithCloudDialog from '../Sync/SyncWithCloudDialog.vue';
import BuyLicenseDialog from '../Sync/BuyLicenseDialog.vue';
import type DesktopAuthManager from '#logic/managers/DesktopAuthManager';
import ConfirmDialog from '~ims-app-base/components/Common/ConfirmDialog.vue';
import { SyncCurrentStateStatus, type SyncCurrentState } from '#bridge/types/SyncTypes';

export default defineComponent({
  name: 'DesktopSettingsDialog_sync',
  components: {
    FormBuilder
  },
  props:{
    search: {},
    isEmpty: {}
  },
  data(){
    return {
        syncWithCloud: 60,
    }
  },
  async mounted(){
    const project_path = this.projectInfo?.localPath;
    assert(project_path, 'Need project path')
    this.syncWithCloud = await window.imshost.settings.getKey(project_path, 'syncWithCloud', 60)
  },
  computed: {
    formSchema(): FormSchema {
        const schema: FormSchema = [];
        if(this.projectInfo?.id){
            schema.push({
                caption: this.$t('desktop.settings.fields.syncWithCloud'),
                prop: 'syncWithCloud',
                editor: ImsSelect,
                editorProps: {
                    getOptionLabel: (opt: any) => opt.title,
                    reduce: (opt: any) => opt.value,
                    options: [30, 60, 300, -1].map(value => 
                        {
                            return {
                                value: value as any,
                                title: this.$t('desktop.settings.fields.syncWithCloudTime.every' + value)
                            }
                        }
                    )
                }
            })
        }
        return schema;
    },
    formSchemaFiltered(){
        if(this.search)
        {
            const search = new RegExp(".*"+this.search+".*",'i');
            return [...this.formSchema].filter(field => {
                const caption = field ? (field.caption ? field.caption : "") : "";
                if (search.test(caption)) return true;
                const options = field.editorProps && field.editorProps.options;
                if (options) {
                    for (const opt of options) {
                        const label = opt.title || opt.label || '';
                        if (search.test(label)) return true;
                    }
                }
                return false;
            })
        }
        else return [...this.formSchema];
    },
    formModel(){
        return new FormBuilderModelBindObject(this);
    },
    projectInfo() {
      return this.$getAppManager().get(ProjectManager).getProjectInfo();
    },
    syncInfo(): SyncCurrentState | undefined {
      return this.$getAppManager().get(DesktopSyncManager).getCurrentSyncState();
    },
    userInfo() {
      return this.$getAppManager().get(AuthManager).getUserInfo();
    },
    isCloudProject(){
      return !!this.projectInfo?.id
    },
    inProcess(){
      return this.syncInfo ? this.syncInfo.status === SyncCurrentStateStatus.IN_PROCESS : false;
    },
    onPause(){
      return !this.userInfo || (this.syncInfo ? this.syncInfo.status === SyncCurrentStateStatus.PAUSE : false);
    },
    hasSyncError(){
       return this.syncInfo ? this.syncInfo.error : null;
    },
    syncStatusText(){
        if (this.hasSyncError) return this.$t('desktop.fsSync.menu.errors') + ': ' + this.hasSyncError;
        if (this.inProcess) return this.$t('desktop.fsSync.menu.syncNow') + '...';
        if (this.onPause) return this.$t('desktop.fsSync.menu.pauseEnd');
        if (this.isCloudProject && this.syncInfo?.hasChanges) return this.$t('desktop.fsSync.notSyncedAssets');
        if (this.syncWithCloud === -1) return this.$t('desktop.fsSync.status.disabled');
        return this.$t('desktop.fsSync.status.active');
    },
    syncStatusIcon(){
        if (this.hasSyncError) return 'ri-error-warning-line';
        if (this.inProcess) return 'ri-loop-right-line spinning-icon';
        if (this.onPause) return 'ri-pause-circle-line';
        if (this.isCloudProject && this.syncInfo?.hasChanges) return 'ri-circle-fill';
        if (this.syncWithCloud === -1) return 'ri-cloud-off-line';
        return 'ri-check-line';
    },
    syncStatusClass(){
        if (this.hasSyncError) return 'state-error';
        if (this.inProcess) return 'state-in-process';
        if (this.onPause) return 'state-pause';
        if (this.isCloudProject && this.syncInfo?.hasChanges) return 'state-warning';
        if (this.syncWithCloud === -1) return 'state-disabled';
        return 'state-ok';
    },
    visibleActionTitles(): string[] {
        const titles: string[] = [];
        if (!this.isCloudProject){
            titles.push(this.$t('desktop.fsSync.menu.syncWithCloud'));
        }
        else if (!this.userInfo){
            titles.push(this.$t('desktop.fsSync.menu.resume'));
        }
        else {
            if (!this.inProcess && !this.onPause){
                titles.push(this.$t('desktop.fsSync.menu.syncNow'));
            }
            if (!this.inProcess && this.onPause){
                titles.push(this.$t('desktop.fsSync.menu.resume'));
            }
            if (!this.onPause){
                titles.push(this.$t('desktop.fsSync.menu.pauseSyncing'));
            }
            titles.push(this.$t('desktop.fsSync.menu.errors'));
            titles.push(this.$t('desktop.fsSync.menu.resyncAll'));
            titles.push(this.$t('desktop.fsSync.menu.openInCloud'));
            titles.push(this.$t('desktop.fsSync.menu.unlinkFromCloud'));
        }
        return titles;
    },
    isEmptyValue(){
        if (!this.search) return false;
        const search = new RegExp(".*"+this.search+".*",'i');
        const anyFormMatch = [...this.formSchema].some(field => {
            const caption = field ? (field.caption ? field.caption : "") : "";
            if (search.test(caption)) return true;
            const options = field.editorProps && field.editorProps.options;
            if (options) {
                for (const opt of options) {
                    const label = opt.title || opt.label || '';
                    if (search.test(label)) return true;
                }
            }
            return false;
        })
        const anyActionMatch = this.visibleActionTitles.some(t => search.test(t));
        const otherTexts = [this.$t('desktop.fsSync.actionsHeader')];
        if (this.isCloudProject){
            otherTexts.push(this.syncStatusText);
        }
        const anyOtherMatch = otherTexts.some(t => search.test(t));
        return !(anyFormMatch || anyActionMatch || anyOtherMatch);
    }
  },
  watch:{
    isEmptyValue(){
        this.$emit('update:isEmpty', this.isEmptyValue)
    },
    async syncWithCloud(new_val: number){
        await this.$getAppManager().get(DesktopSyncManager).changeAutoSynchronization(new_val);
    },
  },
  methods: {
    async loginAndResume(){
      const logged = await this.$getAppManager()
        .get(AuthManager)
        .ensureLoggedInDialog(this.$t('desktop.fsSync.menu.loginToSync'));
      if (!logged){
        return;
      }
      await this.$getAppManager().get(DesktopSyncManager).resumeSyncProject()
      this.$getAppManager().get(UiManager).showSuccess(this.$t('desktop.fsSync.menu.resumeEnd'));
    },
    async syncNow(){
      await this.$getAppManager().get(DesktopSyncManager).runSync()
      const sync_status = this.$getAppManager().get(DesktopSyncManager).getCurrentSyncState();
      if(sync_status?.error){
        this.$getAppManager().get(UiManager).showError(this.$t('desktop.fsSync.menu.syncNowEndWithErrors'));
      }
      else {
        this.$getAppManager().get(UiManager).showSuccess(this.$t('desktop.fsSync.menu.syncNowEnd'));
      }
    },
    async resumeSync(){
      await this.$getAppManager().get(DesktopSyncManager).resumeSyncProject()
      this.$getAppManager().get(UiManager).showSuccess(this.$t('desktop.fsSync.menu.resumeEnd'));
    },
    async pauseSyncing(){
      await this.$getAppManager().get(DesktopSyncManager).pauseSyncProject();
      this.$getAppManager().get(UiManager).showSuccess(this.$t('desktop.fsSync.menu.pauseEnd'));
    },
    async resyncAll(){
      await this.$getAppManager().get(DesktopSyncManager).resyncAll()
      this.$getAppManager().get(UiManager).showSuccess(this.$t('desktop.fsSync.menu.syncNowEnd'));
    },
    openInCloud(){
      window.open(this.$getAppManager().$env.CREATORS_HOST + 'app/p/' +
              encodeURIComponent(this.projectInfo?.id ?? '') + '/' + this.projectInfo?.title)
    },
    async openSyncManageDialog() {
      if(this.projectInfo?.id) {
        await this.$getAppManager().get(DialogManager).show(SyncManageDialog, {});
      }
      else {
        await this.connectToCloud();
      }
    },
    async connectToCloud(){
      const logged_in = await this.$getAppManager()
        .get(AuthManager)
        .ensureLoggedInDialog(this.$t('desktop.fsSync.menu.loginToSync'));
      if (!logged_in){
        return;
      }
    
      try {
        const user_licenses = await this.$getAppManager()
          .get<DesktopAuthManager>(AuthManager)
          .getUserLicense();
        const has_license = user_licenses.list.find(license => license.features.desktopSync);
        const project_info = this.projectInfo;
        if(project_info && (project_info.license?.features.desktopSync || has_license)){
          const res = await this.$getAppManager().get(DialogManager).show(SyncWithCloudDialog, {});
          if(res){
            this.$getAppManager().get(UiManager).showSuccess(this.$t('desktop.fsSync.menu.syncWithCloudConnectSuccess'));
          }
        }
        else {
          await this.$getAppManager().get(DialogManager).show(BuyLicenseDialog, {});
        }
      }
      catch(err: any) {
        this.$getAppManager().get(UiManager).showError(err.message);
      }
    },
    async unlinkCloudProject(){
      const answer = await this.$getAppManager()
        .get(DialogManager)
        .show(ConfirmDialog, {
          header: this.$t('desktop.fsSync.unlinkFromCloudHeader'),
          message: this.$t('desktop.fsSync.unlinkFromCloudConfirm'),
          yesCaption: this.$t('desktop.fsSync.menu.unlinkFromCloud'),
          danger: true,
        });
      if (!answer) return;
      this.$getAppManager().get(UiManager).showSuccess(this.$t('desktop.fsSync.unlinkFromCloudEnd'));
      await this.$getAppManager().get(DesktopCreatorManager).unlinkCloudProject();
    },
  }
});
</script>

<style lang="scss" rel="stylesheet/scss" scoped>
.DesktopSettingsDialog_sync-status {
  margin-top: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #666666;
  &.state-error {
    color: var(--color-main-error);
  }
  &.state-pause,
  &.state-warning,
  &.state-disabled {
    color: var(--color-main-yellow);
  }
  &.state-ok {
    color: var(--color-success);
  }
}
.DesktopSettingsDialog_sync-actionsHeader {
  margin-top: 20px;
  font-weight: bold;
  color: #666666;
}
.DesktopSettingsDialog_sync-actions {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
}
.DesktopSettingsDialog_sync-actions-group {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.DesktopSettingsDialog_sync-actions .is-button.success {
  --button-bg-color: transparent;
  --button-border-color: var(--color-success);
  --button-text-color: var(--color-success);

  &:hover {
    --button-bg-color: var(--color-success);
    --button-text-color: #222222;
  }

  &:focus {
    --button-bg-color: var(--color-success);
    --button-text-color: #222222;
    --button-outline-color: var(--color-success);
  }

  &:disabled,
  &.disabled {
    --button-bg-color: #60605E;
    --button-border-color: #60605E;
    --button-text-color: #222222;
  }
}
.DesktopSettingsDialog_sync-actions .is-button.warning {
  --button-bg-color: transparent;
  --button-border-color: var(--color-main-yellow);
  --button-text-color: var(--color-main-yellow);

  &:hover {
    --button-bg-color: var(--color-main-yellow);
    --button-text-color: #222222;
  }

  &:focus {
    --button-bg-color: var(--color-main-yellow);
    --button-text-color: #222222;
    --button-outline-color: var(--color-main-yellow);
  }

  &:disabled,
  &.disabled {
    --button-bg-color: #60605E;
    --button-border-color: #60605E;
    --button-text-color: #222222;
  }
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