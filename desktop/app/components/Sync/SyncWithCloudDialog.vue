<template>
  <dialog-content class="SyncWithCloudDialog" :loading="isLoading">
    <div class="Form">
      <div class="Dialog-header">
        {{ $t('desktop.fsSync.menu.syncWithCloud') }}
      </div>
      <div class="Dialog-message SyncWithCloudDialog-roles">
        <ValueSwitcher
            v-model="openedTabName"
            class="FastCreateTasksWorkspaceDialog-Types"
            :options="tabs"
            value-prop="name"
            label-prop="title"
        />
        <div
          v-if="openedTabName === 'new'"
          class="SyncWithCloudDialog-item"
        >
            <div class="SyncWithCloudDialog-item-title">
                {{ $t('desktop.welcome.projectName') }}
            </div>
            <ims-input class="SyncWithCloudDialog-item-input" v-model="projectTitle"></ims-input>
        </div>
        <div v-else-if="openedTabName === 'exist'" class="SyncWithCloudDialog-item">
            <div class="SyncWithCloudDialog-item-title">
                {{ $t('desktop.welcome.selectProject') }}
            </div>
            <ims-select
                v-model="project"
                class="WelcomeFormContentCreateProject-Action-ImsSelect"
                :options="projects.list"
                :label-prop="'title'"
                :clearable="false"
                :placeholder="$t('desktop.welcome.selectProject')"
            >
            </ims-select>
        </div>
      </div>
      <div v-if="openedTabName === 'exist' && project && errorMessage"
        class="SyncWithCloudDialog-warning">
        <i class="ri-error-warning-fill"></i>
        {{ errorMessage }}
      </div>
      <div class="Form-row-buttons SyncWithCloudDialog-buttons">
        <div class="Form-row-buttons-center">
          <button
            type="button"
            :value="$t('common.dialogs.cancelCaption')"
            class="is-button"
            :disabled="isBusy"
            @click="dialog.close()"
          >
            {{ $t('common.dialogs.cancelCaption') }}
          </button>
          <button
            type="button"
            class="is-button is-button-action accent"
            :disabled="!canSync || isBusy"
            @click="save()"
          >
            {{ $t('common.dialogs.ok') }}
          </button>
        </div>
      </div>
    </div>
  </dialog-content>
</template>

<script lang="ts" type="text/ecmascript-6">
import DesktopCreatorManager from '#logic/managers/DesktopCreatorManager';
import DesktopProjectManager from '#logic/managers/DesktopProjectManager';
import DesktopSyncManager from '#logic/managers/DesktopSyncManager';
import { defineComponent, type PropType } from 'vue';
import ImsInput from '~ims-app-base/components/Common/ImsInput.vue';
import ImsSelect from '~ims-app-base/components/Common/ImsSelect.vue';
import ValueSwitcher from '~ims-app-base/components/Common/ValueSwitcher.vue';
import DialogContent from '~ims-app-base/components/Dialog/DialogContent.vue';
import ApiManager from '~ims-app-base/logic/managers/ApiManager';
import { Service, HttpMethods } from '~ims-app-base/logic/managers/ApiWorker';
import type { DialogInterface } from '~ims-app-base/logic/managers/DialogManager';
import ProjectManager from '~ims-app-base/logic/managers/ProjectManager';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import type { ProjectFullInfo, ProjectShortInfo } from '~ims-app-base/logic/types/ProjectTypes';


type DialogProps = {
  assetId?: string;
  workspaceId?: string;
};

type DialogResult = boolean | undefined | null;

export default defineComponent({
  name: 'SyncWithCloudDialog',
  components: {
    DialogContent,
    ValueSwitcher,
    ImsInput,
    ImsSelect,
  },
  props: {
    dialog: {
      type: Object as PropType<DialogInterface<DialogProps, DialogResult>>,
      required: true,
    },
  },
  emits: ['dialog-parameters'],
  data() {
    return {
      openedTabName: 'new' as string,
      projectTitle: '',
      project: null as ProjectShortInfo | null,
      projects: {
        list: [] as ProjectShortInfo[],
        total: 0,
      },
      isLoading: true,
      errorMessage: null as null | string,
      isBusy: false,
    };
  },
  computed: {
    tabs() {
      return [
        {
          name: 'new',
          title: this.$t('desktop.fsSync.createNew'),
        },
        {
          name: 'exist',
          title: this.$t('desktop.fsSync.selectExist'),
        },
      ];
    },
    projectInfo() {
      return this.$getAppManager().get(ProjectManager).getProjectInfo();
    },
    canSync(){
        if(this.openedTabName === 'new'){
            return this.projectTitle && this.projectTitle.trim().length > 0
        }
        else {
            return !!this.project;
        }
    }
  },
  async mounted() {
    this.isLoading = true;
    this.projectTitle = this.projectInfo?.title ?? '';
    try {
      this.projects = await this.$getAppManager()
              .get(ApiManager)
              .call(Service.CREATORS, HttpMethods.GET, 'app/projects', {});
      this.errorMessage = null;
    }
    catch(err: any){
      this.errorMessage = err.message;
    }
    finally {
      this.isLoading = false;
    }
  },
  methods: {
    async save(){
        this.isBusy = true;
        try {
            const project_info = this.projectInfo;
            if(!project_info){
                throw Error('Project is not set');
            }
            if(this.openedTabName === 'new'){
                if(!this.projectTitle || this.projectTitle.trim().length === 0){
                    throw Error('Project title is not set');
                }
                const new_project_info = await this.$getAppManager()
                    .get(DesktopProjectManager)
                    .createCloudProject(this.projectTitle);
                if(!project_info.localPath) {
                    throw Error('localPath is not set') ;
                }
                this.$getAppManager().get(DesktopCreatorManager).connectToCloudProject(new_project_info);
            }
            else {
                if(!this.project){
                    throw Error('Project is not selected');
                }
                const selected_project_full_info: ProjectFullInfo = await this.$getAppManager()
                    .get(ApiManager)
                    .call(Service.CREATORS, HttpMethods.GET, 'project/info', {
                        pid: this.project.id,
                    });
                if(!selected_project_full_info){
                    throw Error('Project is not founded');
                }
                this.$getAppManager().get(DesktopCreatorManager).connectToCloudProject(selected_project_full_info);
            }
            this.dialog.close(true);
        }
        catch(err: any) {
            this.$getAppManager().get(UiManager).showError(err.message);
        }
        finally {
            this.isBusy = false;
        }
    }
  },
});
</script>

<style lang="scss" rel="stylesheet/scss">
.SyncWithCloudDialog-roles-th {
  font-weight: 400 !important;
}
</style>

<style lang="scss" rel="stylesheet/scss" scoped>
@use '$style/Form';
.SyncWithCloudDialog-item {
  display: flex;
  gap: 5px;
  flex-direction: column;
}
.SyncWithCloudDialog-item {
  display: flex;
  gap: 10px;
}
.SyncWithCloudDialog-item-input{
    min-height: 40px;
}
.SyncWithCloudDialog-item-title {
  width: 260px;
}
.SyncWithCloudDialog-roles {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.SyncWithCloudDialog-role {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 25px;
}
.SyncWithCloudDialog-role-items-select {
  min-width: 180px;
}
.SyncWithCloudDialog-role-current {
  font-weight: bold;
}
.SyncWithCloudDialog-role-items {
  display: flex;
  align-items: center;
  gap: 5px;
}
.SyncWithCloudDialog-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}
.SyncWithCloudDialog-warning{
  border: 1px solid var(--color-main-error);
  border-radius: 10px;
  padding: 10px 15px;
  margin-bottom: 10px;
}
</style>