<template>
  <dialog-content
    class="SyncManageDialog"
    :loading="isLoading"
  >
    <div class="Dialog-header">{{$t('desktop.fsSync.header')}}</div>
    <div class="Dialog-content" v-if="syncErrors">
        <div v-if="syncErrors.error" class="SyncManageDialog-error">
          <i class="ri-error-warning-fill"></i>
          Error: {{ syncErrors.error }}
        </div>
        <div v-if="syncErrors.assets.length > 0">
          <div class="SyncManageDialog-content-title">
            {{$t('desktop.fsSync.notSyncedAssets')}}:
          </div>
          <ul>
            <li v-for="asset of syncErrors.assets"
                :key="asset.id">
              <div class="SyncManageDialog-content-item">
                {{asset.title ?? asset.id}}
                <div v-if="asset.conflict || asset.conflict_message"> 
                  ({{ asset.conflict_message ? asset.conflict_message : asset.conflict }})
                </div>
              </div>
            </li>
          </ul>
        </div>
        <div v-if="syncErrors.workspaces.length > 0">
          <div class="SyncManageDialog-content-title">
            {{$t('desktop.fsSync.notSyncedWorkspaces')}}:
          </div>
          <ul>
            <li v-for="workspace of syncErrors.workspaces"
              :key="workspace.id"
            >
              <div class="SyncManageDialog-content-item">
                {{workspace.title ?? workspace.id}}
                <div v-if="workspace.conflict || workspace.conflict_message"> 
                  ({{ workspace.conflict_message ? workspace.conflict_message : workspace.conflict }})
                </div>
              </div>
            </li>
          </ul>
        </div>
        <div v-if="noErrors" class="SyncManageDialog-no-errors">
          {{$t('desktop.fsSync.noErrors')}}
        </div>
    </div>
    <div class="Dialog-buttons use-buttons-action">
        <button class="is-button" @click="close">
          {{ $t('desktop.settings.close') }}
        </button>
        <button v-if="!noErrors" class="is-button accent" @click="runSync">
          {{ $t('desktop.fsSync.syncButton') }}
        </button>
    </div>
  </dialog-content>
</template>

<script lang="ts">
import DesktopSyncManager from '#logic/managers/DesktopSyncManager';
import type { SyncInfo } from '#logic/types/SyncTypes';
import { defineComponent, type PropType } from 'vue';

import DialogContent from '~ims-app-base/components/Dialog/DialogContent.vue';
import type { DialogInterface } from '~ims-app-base/logic/managers/DialogManager';
import UiManager from '~ims-app-base/logic/managers/UiManager';

type DialogProps = {
};

type DialogResult = undefined

export default defineComponent({
  name: 'SyncManageDialog',
  components: {
    DialogContent,
  }, 
  props: {
    dialog: {
      type: Object as PropType<DialogInterface<DialogProps, DialogResult>>,
      required: true,
    },
  },
  data(){
    return {
      isLoading: true,
      syncErrors: undefined as SyncInfo | undefined,
    }
  },
  async mounted() {
    this.isLoading = true;
    this.syncErrors = await this.$getAppManager().get(DesktopSyncManager).getSyncErrors();
    this.isLoading = false;
  },
  computed: {
    noErrors(){
      return !this.syncErrors || 
      ( !this.syncErrors.error &&
        this.syncErrors.assets.length === 0 &&
        this.syncErrors.workspaces.length === 0)
    }
  },
  methods: {
    close(){
      this.dialog.close();
    },
    async runSync(){
      await this.$getAppManager().get(DesktopSyncManager).runSync();
      this.$getAppManager().get(UiManager).showSuccess(this.$t('desktop.fsSync.menu.syncNowEnd'));
      this.close();
    },
    async resyncAssetsAndWorkspaces(){
      //await this.$getAppManager().get(DesktopSyncManager).resyncAssetsAndWorkspaces();
    },
  }
})
</script>
<style>
.SyncManageDialog{
  max-width: 600px;
}
.SyncManageDialog-no-errors{
  text-align: center;
  font-style: italic;
}
.SyncManageDialog-content-title{
  font-weight: 600;
}
.SyncManageDialog-content-item{
  display: flex;
}
.Dialog-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 20px;
  gap: 10px;
}
.SyncManageDialog-error{
  border: 1px solid var(--color-main-error);
  border-radius: 10px;
  padding: 10px 15px;
  margin-bottom: 10px;
}
</style>
