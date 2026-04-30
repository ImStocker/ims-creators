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
                  <div>
                    {{asset.title ?? asset.id}}
                    <div v-if="asset.conflict || asset.conflict_message" class="SyncManageDialog-content-item-error"> 
                      ({{ asset.conflict_message ? asset.conflict_message : asset.conflict }})
                    </div>
                  </div>
                  <button class="is-button is-button-icon"
                    @click="repeatAssetSync(asset.id)"
                    :disabled="!!repeatingAssetIds.find(id => id === asset.id)"
                    :title="$t('desktop.fsSync.menu.repeat')">
                    <i
                      class="ri-loop-right-line"
                      :class="{ 'spinning-icon': repeatingAssetIds.find(id => id === asset.id) }"></i>
                  </button>
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
                  <div>
                    {{workspace.title ?? workspace.id}}
                    <div v-if="workspace.conflict || workspace.conflict_message" class="SyncManageDialog-content-item-error"> 
                      ({{ workspace.conflict_message ? workspace.conflict_message : workspace.conflict }})
                    </div>
                  </div>
                  <button
                    class="is-button is-button-icon"
                    @click="repeatWorkspaceSync(workspace.id)"
                    :class="{ loading: repeatingWorkspaceIds.find(id => id === workspace.id)}"
                    :disabled="!!repeatingWorkspaceIds.find(id => id === workspace.id)"
                    :title="$t('desktop.fsSync.menu.repeat')"
                  >
                    <i class="ri-loop-right-line"></i>
                  </button>
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
      repeatingAssetIds: [] as string[],
      repeatingWorkspaceIds: [] as string[],
    }
  },
  async mounted() {
    await this.loadErrors();
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
    async loadErrors(){
      this.isLoading = true;
      this.syncErrors = await this.$getAppManager().get(DesktopSyncManager).getSyncErrors();
      this.isLoading = false;
    },
    close(){
      this.dialog.close();
    },
    async runSync(){
      await this.$getAppManager().get(DesktopSyncManager).runSync();
      this.$getAppManager().get(UiManager).showSuccess(this.$t('desktop.fsSync.menu.syncNowEnd'));
      this.close();
    },
    async repeatAssetSync(asset_id: string){
      this.repeatingAssetIds.push(asset_id)
      await this.$getAppManager().get(DesktopSyncManager).resyncAssetsAndWorkspaces([asset_id], []);
      let ind = this.repeatingAssetIds.findIndex(id => id === asset_id)
      if(ind > -1){
        this.repeatingAssetIds.splice(ind , 1);
      }
      await this.loadErrors();
    },
    async repeatWorkspaceSync(workspace_id: string){
      this.repeatingWorkspaceIds.push(workspace_id)
      await this.$getAppManager().get(DesktopSyncManager).resyncAssetsAndWorkspaces([], [workspace_id]);
            let ind = this.repeatingWorkspaceIds.findIndex(id => id === workspace_id)
      if(ind > -1){
        this.repeatingWorkspaceIds.splice(ind , 1);
      }
      await this.loadErrors();
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
  justify-content: space-between;
  align-items: center;
}
.SyncManageDialog-content-item-error{
  color: var(--color-main-error);
  display: inline;
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
