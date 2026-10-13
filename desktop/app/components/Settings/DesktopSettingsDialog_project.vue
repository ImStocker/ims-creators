<template>
  <div class="Form">
    <div
      v-if="!projectInfo"
      class="DesktopSettingsDialog_project-empty"
    >
      {{ $t('desktop.settings.project.noProject') }}
    </div>
    <template v-else>
      <div v-if="showField" class="Form-row">
        <div class="Form-row-caption">
          {{ $t('desktop.settings.project.name') }}
        </div>
        <div class="Form-row-value">
          <FormInput
            :value="projectTitle"
            :disabled="saving"
            :create-with-enter="true"
            @input="projectTitle = $event"
          ></FormInput>
        </div>
      </div>
      <div class="Form-row">
        <form-check-box
          :value="renameFolder"
          :caption="$t('desktop.settings.project.renameFolder')"
          :disabled="saving"
          @input="renameFolder = $event"
        ></form-check-box>
      </div>
      <div class="Form-row-buttons use-buttons-action">
        <button
          class="is-button accent"
          :class="{ loading: saving }"
          :disabled="!canSave || saving"
          @click="save"
        >
          {{ $t('desktop.settings.project.renameButton') }}
        </button>
      </div>
      <div v-if="showField" class="DesktopSettingsDialog_project-section">
        <div class="Form-row">
          <div class="Form-row-caption">
            {{ $t('desktop.settings.project.location') }}
          </div>
          <div class="Form-row-value">
            <SelectFolderForm
              :value="location"
              :placeholder="$t('desktop.settings.project.location')"
              @update="location = $event"
            ></SelectFolderForm>
          </div>
        </div>
        <div class="Form-row">
          <div class="Form-row-caption">
            {{ $t('desktop.settings.project.folderName') }}
          </div>
          <div class="Form-row-value">
            <FormInput
              :value="folderName"
              :disabled="moving"
              @input="folderName = $event"
            ></FormInput>
          </div>
        </div>
        <div
          v-if="targetExistsWarning"
          class="DesktopSettingsDialog_project-warning"
        >
          <i class="ri-error-warning-fill"></i>
          {{ $t('desktop.settings.project.targetExists') }}
        </div>
        <div class="Form-row-buttons use-buttons-action">
          <button
            class="is-button accent"
            :class="{ loading: moving }"
            :disabled="!canMove || moving"
            @click="move"
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
import FormInput from '~ims-app-base/components/Form/FormInput.vue';
import FormCheckBox from '~ims-app-base/components/Form/FormCheckBox.vue';
import SelectFolderForm from '../Common/SelectFolderForm.vue';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import UiPreferenceManager from '~ims-app-base/logic/managers/UiPreferenceManager';
import ProjectManager from '~ims-app-base/logic/managers/ProjectManager';
import DesktopCreatorManager from '#logic/managers/DesktopCreatorManager';
import { debounceForThis } from '~ims-app-base/components/utils/ComponentUtils';

// Renderer `path` is a POSIX polyfill, so it cannot handle Windows separators.
// Use separator-agnostic helpers for OS paths instead.
function splitOsPath(p: string): { dir: string; name: string } {
  if (!p) return { dir: '', name: '' };
  const normalized = p.replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/');
  if (idx < 0) return { dir: '', name: p };
  return { dir: p.slice(0, idx), name: p.slice(idx + 1) };
}

function joinOsPath(dir: string, name: string): string {
  if (!dir) return name;
  const sep = dir.includes('\\') ? '\\' : '/';
  return dir.replace(/[\\/]+$/, '') + sep + name;
}

function pathKey(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

export default defineComponent({
  name: 'DesktopSettingsDialogProject',
  components: {
    FormInput,
    FormCheckBox,
    SelectFolderForm,
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
      projectTitle: '',
      saving: false,
      location: '',
      folderName: '',
      moving: false,
      targetExists: false,
      checkPathDebounce: null as any,
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
    originalLocation(): string {
      return splitOsPath(this.originalLocalPath).dir;
    },
    originalFolderName(): string {
      return splitOsPath(this.originalLocalPath).name;
    },
    targetPath(): string {
      if (!this.location || !this.folderName) return '';
      return joinOsPath(this.location, this.folderName);
    },
    targetChanged(): boolean {
      return (
        !!this.targetPath &&
        pathKey(this.targetPath) !== pathKey(this.originalLocalPath)
      );
    },
    targetExistsWarning(): boolean {
      return this.targetChanged && this.targetExists;
    },
    canMove(): boolean {
      return (
        !!this.location &&
        !!this.folderName &&
        this.targetChanged &&
        !this.targetExists
      );
    },
    renameFolder: {
      get(): boolean {
        return this.$getAppManager()
          .get(UiPreferenceManager)
          .getPreference('settings.project.renameFolder', true);
      },
      set(val: boolean) {
        this.$getAppManager()
          .get(UiPreferenceManager)
          .setPreference('settings.project.renameFolder', val);
      },
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
    canSave(): boolean {
      const title = this.projectTitle.trim();
      return !!title && title !== this.originalTitle;
    },
  },
  watch: {
    isEmptyComputed() {
      this.$emit('update:isEmpty', this.isEmptyComputed);
    },
    originalTitle: {
      immediate: true,
      handler(val: string) {
        this.projectTitle = val;
      },
    },
    originalLocation: {
      immediate: true,
      handler(val: string) {
        this.location = val;
      },
    },
    originalFolderName: {
      immediate: true,
      handler(val: string) {
        this.folderName = val;
      },
    },
    targetPath(new_val: string) {
      if (this.checkPathDebounce) {
        this.checkPathDebounce(new_val);
      }
    },
  },
  mounted() {
    this.projectTitle = this.originalTitle;
    this.location = this.originalLocation;
    this.folderName = this.originalFolderName;
    this.$emit('update:isEmpty', this.isEmptyComputed);
    this.checkPathDebounce = debounceForThis(async function (
      this: any,
      val: string,
    ) {
      this.targetExists = !!val && (await window.imshost.fs.exists(val));
    }, 200);
  },
  methods: {
    async save() {
      const title = this.projectTitle.trim();
      if (!title || title === this.originalTitle) return;
      this.saving = true;
      await this.$getAppManager()
        .get(UiManager)
        .doTask(async () => {
          await this.$getAppManager()
            .get(DesktopCreatorManager)
            .renameCurrentProject(title, this.renameFolder);
        });
      this.saving = false;
    },
    async move() {
      if (!this.canMove) return;
      this.moving = true;
      await this.$getAppManager()
        .get(UiManager)
        .doTask(async () => {
          await this.$getAppManager()
            .get(DesktopCreatorManager)
            .moveCurrentProject(this.targetPath);
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
.DesktopSettingsDialog_project-warning {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-main-error);
  margin-bottom: 10px;
}
</style>
