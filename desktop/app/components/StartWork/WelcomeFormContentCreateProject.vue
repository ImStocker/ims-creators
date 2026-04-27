<template>
  <div class="WelcomeFormContentCreateProject">
    <div
      class="WelcomeFormContentCreateProject-back use-buttons-without-border"
    >
      <button class="is-button" @click="$emit('back')">
        <i class="ri-arrow-left-line"></i>
        {{ $t('desktop.welcome.back') }}
      </button>
    </div>
    <div class="WelcomeFormContentCreateProject-Other">
      <div class="WelcomeFormContentCreateProject-Action">
        <div class="WelcomeFormContentStart-Action-left">
          <div class="WelcomeFormContentStart-Action-title">{{$t('desktop.welcome.type')}}</div>
          <!-- <div class="WelcomeFormContentStart-Action-subtext">{{$t('desktop.welcome.typeTooltip')}}</div> -->
        </div>
        <ValueSwitcher
          v-model="params.projectType"
          :options="projectTypes"
          label-prop="title"
          value-prop="id"
        >
          <template #option="{ option }">
            <div class="WelcomeFormContentStart-TypeOption">
              <i :class="option.icon"></i>
              {{ option.title }}
            </div>
          </template>
        </ValueSwitcher>
      </div>
      <div v-if="needAuth || needLicense">
        <div class="WelcomeFormContentCreateProject-message">
          {{ $t('desktop.welcome.' + (needLicense ? 'needLicense' : 'needAuth')) }}
          <button v-if="needLicense" 
            class="is-button accent" 
            @click="buyLicense()">
            {{$t('desktop.welcome.buy')}}
          </button>
        </div>
        <login-form v-if="needAuth"
            class="WelcomeFormContentStart-login"
            :open-external="true"
        />
      </div>
      <template v-else>
        <div class="WelcomeFormContentCreateProject-Action">
          <div class="WelcomeFormContentStart-Action-left">
            <div class="WelcomeFormContentStart-Action-title">{{$t('desktop.welcome.name')}}</div>
            <!-- <div class="WelcomeFormContentStart-Action-subtext">{{$t('desktop.welcome.nameTooltip')}}</div> -->
          </div>
          <ims-input
            ref="inputName"
            v-model="params.projectName"
            class="WelcomeFormContentStart-Action-right"
            placeholder="Name"
            type="text"
          ></ims-input>
        </div>
        <div class="WelcomeFormContentCreateProject-Action">
          <div class="WelcomeFormContentStart-Action-left">
            <div class="WelcomeFormContentStart-Action-title">{{$t('desktop.welcome.location')}}</div>
            <!-- <div class="WelcomeFormContentStart-Action-subtext">{{$t('desktop.welcome.locationTooltip')}}</div> -->
          </div>
          <SelectFolderForm 
            :value="params.projectLocation"
            :placeholder="$t('desktop.welcome.location')"
            @update="params.projectLocation = $event">
          </SelectFolderForm>
        </div>
        <div class="WelcomeFormContentCreateProject-Action">
          <div class="WelcomeFormContentStart-Action-left">
            <div class="WelcomeFormContentStart-Action-title">{{$t('desktop.welcome.template')}}</div>
          </div>
          <select-template
            :value="currentProjectTemplateId"
            @update="currentProjectTemplateId = $event"
            class="WelcomeFormContentStart-Action-right">
          </select-template>
        </div>
      </template>
    </div>
    <div v-if="params.projectName && hasWarning" class="WelcomeFormContentCreateProject-warning">
      <i class="ri-error-warning-fill"></i>
      {{ $t('desktop.welcome.sameProjectTitle') }}
    </div>
    <AdvancedForm v-if="!needAuth && !needLicense" :project-folder-name="params.projectFolderName" @update:folder-name="params.projectFolderName = $event"></AdvancedForm>
    <div class="WelcomeFormContentCreateProject-create" v-if="!needAuth && !needLicense">
      <button class="is-button accent" 
        :class="{ loading }" @click="createProject" 
        :disabled="!canCreate || hasWarning">
        {{$t('desktop.welcome.create')}}
      </button>
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue';
import ValueSwitcher from '~ims-app-base/components/Common/ValueSwitcher.vue';
import ImsInput from '~ims-app-base/components/Common/ImsInput.vue';
import SelectFolderForm from '../Common/SelectFolderForm.vue';
import AdvancedForm from './AdvancedForm.vue';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import type { PropType } from 'vue';
import * as node_path from 'path';
import ImsSelect from '~ims-app-base/components/Common/ImsSelect.vue';
import SelectTemplate from '~ims-creators/components/Project/SelectTemplate.vue';
import DesktopProjectManager from '#logic/managers/DesktopProjectManager';
import DesktopCreatorManager from '#logic/managers/DesktopCreatorManager';
import AuthManager from '~ims-app-base/logic/managers/AuthManager';
import LoginForm from './LoginForm.vue';
import type { Workspace } from '~ims-app-base/logic/types/Workspaces';
import { forbiddenFilenameCharsRegexp } from '#bridge/utils/regex';
import { debounceForThis } from '~ims-app-base/components/utils/ComponentUtils';
import ApiManager from '~ims-app-base/logic/managers/ApiManager';
import { HttpMethods, Service } from '~ims-app-base/logic/managers/ApiWorker';
import type { ProjectLicense } from '~ims-app-base/logic/types/ProjectTypes';
import type DesktopAuthManager from '#logic/managers/DesktopAuthManager';

export type CreateProjectParams = {
  projectLocation?: string,
  projectName?: string,
  projectType?: 'local' | 'cloud',
  projectFolderName?: string,
}

export default defineComponent({
  name: 'WelcomeFormContentCreateProject',
  components: {
    ValueSwitcher,
    ImsInput,
    SelectFolderForm,
    AdvancedForm,
    ImsSelect,
    SelectTemplate,
    LoginForm,
  },
  emits: ['back'],
  props: {
    createProjectParams: {
      type: Object as PropType<CreateProjectParams>,
      default: () => {},
    }
  },
  data() {
    return {
      params: {
        projectLocation: '',
        projectName: '',
        projectType: 'local',
        projectFolderName: '',
      },
      currentProjectTemplateId: '',
      loading: false,
      hasWarning: false,
      checkPathDebounce: null as any,
      userLicenses: {
        list: [] as ProjectLicense[],
        total: 0,
      }
    };
  },
  watch: {
    async projectPath(new_val: string){
      if(this.checkPathDebounce){
        this.checkPathDebounce(this);
      }
    },
    projectName(new_val: string){
      this.params.projectFolderName = new_val.trim().replace(forbiddenFilenameCharsRegexp, '_');
    }
  },
  async mounted(){
    this.params.projectLocation = await window.imshost.shell.getDocumentsFolder();
    this.userLicenses = await this.$getAppManager()
        .get<DesktopAuthManager>(AuthManager)
        .getUserLicense();
    this.params = {
      ...this.params,
      ...this.createProjectParams
    }
    if (this.$refs['inputName']) {
      (this.$refs['inputName'] as HTMLButtonElement).focus();
    }
    this.checkPathDebounce = debounceForThis(async function (this: any) {
      await this.checkExistsProject(this.projectPath);
    }, 200);
  },
  computed: {
    needAuth(){
      return this.params.projectType === 'cloud' && !this.userInfo;
    },
    needLicense(){
      return this.params.projectType === 'cloud' && !this.userLicenses.list.find(license => license.features.desktopSync);
    },
    userInfo(){
      return this.$getAppManager().get(AuthManager).getUserInfo();
    },
    projectName(){
      return this.params.projectName;
    },
    projectPath(){
      return node_path.join(this.params.projectLocation, this.params.projectFolderName);
    },
    projectTypes(){
      return [
        {
          id: 'local',
          name: 'local',
          title: this.$t('desktop.welcome.local'),
          icon: 'ri-computer-fill',
        },
        {
          id: 'cloud',
          name: 'cloud',
          title: this.$t('desktop.welcome.cloud'),
          icon: 'ri-cloud-fill',
        },
      ]
    },
    canCreate(){
      return this.params.projectName && this.params.projectFolderName && this.params.projectLocation;
    },
    lang() {
      return this.$getAppManager().get(UiManager).getLanguage();
    }
  },
  methods: {
    async checkExistsProject(val: string){
      this.hasWarning = await window.imshost.fs.exists(val);
    },
    buyLicense(){
      window.location.replace(`https://ims.cr5.space/app/prices`)
    },
    async createProject() {
      this.loading = true;
      await this.$getAppManager()
        .get(UiManager)
        .doTask(async () => {
          if(!this.canCreate){
            throw new Error(this.$t('fields.allFieldsMustBeFulled'));
          }
          
          const new_project_info =this.params.projectType === 'cloud' ? await this.$getAppManager()
            .get(DesktopProjectManager)
            .createProject({
              title: this.params.projectName,
              template_ids: [this.currentProjectTemplateId],
              menu_settings: {
                'menu-about': false,
                'menu-gamedesign': true,
                'menu-team': true,
              },
              init_script: 'starter',
            }) : null;
          let rootWorkspaceId = null
          if (new_project_info){
            rootWorkspaceId = new_project_info.rootWorkspaces.find((w: Workspace) => w.name === 'gdd')?.id;
          }

          await this.$getAppManager().get(DesktopProjectManager).initializeLocalProject(this.projectPath, {
            id: new_project_info?.id ?? null,
            title: this.params.projectName,
            rootWorkspaceId: rootWorkspaceId ?? null,
          });
          if(this.currentProjectTemplateId){
            await this.$getAppManager().get(DesktopProjectManager).importTemplateProject(this.currentProjectTemplateId);
          }
          await this.$getAppManager().get(DesktopCreatorManager).openProjectWindow(this.projectPath);          
        })
        this.loading = false;
      
    },
  },
});
</script>

<style lang="scss">
.WelcomeFormContentCreateProject-Action-subtext {
  font-size: 12px;
  color: var(--local-sub-text-color);
}
.WelcomeFormContentCreateProject-back {
  display: flex;
  color: var(--local-sub-text-color);
  padding-left: 10px;
  padding-top: 5px;
}
.WelcomeFormContentCreateProject {
  display: flex;
  flex-direction: column;
}
.WelcomeFormContentCreateProject-Action {
  display: flex;
  gap: 10px;
  padding: 10px 0;
  align-items: center;
  justify-content: space-between;
  &:first-child {
    padding-top: 0;
  }
  &:not(:last-child) {
    border-bottom: 1px solid var(--local-border-color);
  }
  .ValueSwitcher{
    width: auto;
  }
}
.WelcomeFormContentCreateProject-Action-left,
.WelcomeFormContentCreateProject-Action-title,
.WelcomeFormContentCreateProject-Action-select {
  flex: 1;
}
.WelcomeFormContentCreateProject-Main {
  padding: 10px 15px;
  background-color: var(--app-menu-bg-color);
  border: 1px solid var(--app-menu-bg-color);
  border-radius: 10px;
}
.WelcomeFormContentCreateProject-Other {
  padding: 10px 15px;
}
.WelcomeFormContentStart-Action-right {
  &.ImsInput{
    --ImsInput-autoWidth: 60%;
  }
  &.ImsSelect{
    width: 60%;
  }
}
.WelcomeFormContentCreateProject-create {
  text-align: center;
}
.WelcomeFormContentCreateProject-warning{
  border: 1px solid var(--color-main-error);
  border-radius: 10px;
  padding: 10px 15px;
  margin-bottom: 10px;
}

.WelcomeFormContentStart-TypeOption {
  display: flex;
  align-items: center;
  gap: 5px;
}

.WelcomeFormContentCreateProject-message{
  background-color: var(--app-menu-bg-color);
  border: 1px solid var(--app-menu-bg-color);
  border-radius: 10px;
  padding: 10px 15px;
  margin: 10px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.WelcomeFormContentStart-login{
  padding: 0 !important;
  & > .AuthForm-header{
    display: none;
  }
}
</style>
