<template>
    <div class="NewVersionBox accent is-button" v-if="status !== UpdateStatus.NONE" @click="openStatus">
        <i class="ri-arrow-up-double-fill"></i>
        <template v-if="status === UpdateStatus.AVAILABLE">
            {{ $t('desktop.about.updateBoxAvail') }}
        </template>
        <template v-else-if="status === UpdateStatus.DOWNLOADING">
            {{ downloadPercent }} %
        </template>
        <template v-else-if="status === UpdateStatus.DOWNLOADED">
            {{ $t('desktop.about.updateBoxReady') }}
        </template>
        <template v-else-if="status === UpdateStatus.DOWNLOAD_ERROR">
            {{ $t('desktop.about.updateBoxError') }}
        </template>
    </div>
</template>

<script lang="ts">
import DesktopUpdateManager from '#logic/managers/DesktopUpdateManager';
import { UpdateStatus } from '#logic/types/AutoUpdateTypes';
import { defineComponent } from 'vue';

export default defineComponent({
  name: "NewVersionBox",
  computed: {
    UpdateStatus(){
        return UpdateStatus
    },
    status(): UpdateStatus{
        return this.$getAppManager().get(DesktopUpdateManager).getStatus();
    },
    downloadPercent(): number{
        return Math.round(this.$getAppManager().get(DesktopUpdateManager).getDownloadPercent())
    }
    
  },
  methods:{
    openStatus(){
        this.$getAppManager().get(DesktopUpdateManager).showDialogOfUpdateStatus();
    }
  }
});
</script>

<style lang="scss" scoped>
.NewVersionBox{
    white-space: nowrap;
    /*
    border: 1px solid var(--local-border-color);
    border-radius: 8px;
    display: flex
;
    align-items: center;*/
}
</style>
