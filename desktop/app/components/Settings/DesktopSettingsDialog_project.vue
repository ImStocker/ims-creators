<template>
  <div class="Form">
    <div
      v-if="!projectInfo"
      class="DesktopSettingsDialog_project-empty"
    >
      {{ $t('desktop.settings.project.noProject') }}
    </div>
    <template v-else>
      <div
        v-if="showField"
        class="DesktopSettingsDialog_project-rename"
      >
        <ProjectRenameForm
          ref="renameForm"
          :title="originalTitle"
          :busy="saving"
          @submit="onRename"
          @update:canSubmit="canRename = $event"
        ></ProjectRenameForm>
        <div class="Form-row-buttons use-buttons-action">
          <button
            class="is-button accent"
            :class="{ loading: saving }"
            :disabled="!canRename || saving"
            @click="submitRename"
          >
            {{ $t('desktop.settings.project.renameButton') }}
          </button>
        </div>
      </div>
      <div
        v-if="showField"
        class="DesktopSettingsDialog_project-section"
      >
        <ProjectMoveForm
          ref="moveForm"
          :local-path="originalLocalPath"
          :busy="moving"
          @submit="onMove"
          @update:canSubmit="canMove = $event"
        ></ProjectMoveForm>
        <div class="Form-row-buttons use-buttons-action">
          <button
            class="is-button accent"
            :class="{ loading: moving }"
            :disabled="!canMove || moving"
            @click="submitMove"
          >
            {{ $t('desktop.settings.project.moveButton') }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import ProjectManager from '~ims-app-base/logic/managers/ProjectManager';
import DesktopCreatorManager from '#logic/managers/DesktopCreatorManager';
import ProjectRenameForm, {
  type ProjectRenameFormSubmit,
} from '../Project/ProjectRenameForm.vue';
import ProjectMoveForm from '../Project/ProjectMoveForm.vue';

export default defineComponent({
  name: 'DesktopSettingsDialogProject',
  components: {
    ProjectRenameForm,
    ProjectMoveForm,
  },
  props: {
    search: {
      type: String,
      default: '',
    },
    isEmpty: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:isEmpty'],
  data() {
    return {
      saving: false,
      moving: false,
      canRename: false,
      canMove: false,
    };
  },
  computed: {
    projectInfo() {
      return this.$getAppManager().get(ProjectManager).getProjectInfo();
    },
    originalTitle(): string {
      return this.projectInfo?.title ?? '';
    },
    originalLocalPath(): string {
      return this.projectInfo?.localPath ?? '';
    },
    allTabTexts(): string[] {
      return [
        this.$t('desktop.settings.project.name'),
        this.$t('desktop.settings.project.renameButton'),
        this.$t('desktop.settings.project.renameFolder'),
        this.$t('desktop.settings.project.location'),
        this.$t('desktop.settings.project.folderName'),
        this.$t('desktop.settings.project.moveButton'),
      ];
    },
    searchMatches(): boolean {
      if (!this.search) return true;
      const research = new RegExp('.*' + this.search + '.*', 'i');
      return this.allTabTexts.some((t) => research.test(t.valueOf()));
    },
    showField(): boolean {
      return this.searchMatches;
    },
    isEmptyComputed(): boolean {
      return !this.projectInfo || !this.searchMatches;
    },
  },
  watch: {
    isEmptyComputed() {
      this.$emit('update:isEmpty', this.isEmptyComputed);
    },
  },
  mounted() {
    this.$emit('update:isEmpty', this.isEmptyComputed);
  },
  methods: {
    submitRename() {
      (this.$refs.renameForm as any)?.submit();
    },
    submitMove() {
      (this.$refs.moveForm as any)?.submit();
    },
    async onRename(payload: ProjectRenameFormSubmit) {
      this.saving = true;
      await this.$getAppManager()
        .get(UiManager)
        .doTask(async () => {
          await this.$getAppManager()
            .get(DesktopCreatorManager)
            .renameCurrentProject(payload.title, payload.renameFolder);
        });
      this.saving = false;
    },
    async onMove(targetPath: string) {
      this.moving = true;
      await this.$getAppManager()
        .get(UiManager)
        .doTask(async () => {
          await this.$getAppManager()
            .get(DesktopCreatorManager)
            .moveCurrentProject(targetPath);
        });
      this.moving = false;
    },
  },
});
</script>

<style lang="scss" rel="stylesheet/scss" scoped>
.DesktopSettingsDialog_project-empty {
  color: var(--local-sub-text-color);
}
.DesktopSettingsDialog_project-section {
  margin-top: 20px;
  padding-top: 10px;
  border-top: 1px solid var(--local-border-color);
}
</style>
