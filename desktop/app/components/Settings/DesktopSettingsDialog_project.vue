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
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import FormInput from '~ims-app-base/components/Form/FormInput.vue';
import FormCheckBox from '~ims-app-base/components/Form/FormCheckBox.vue';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import UiPreferenceManager from '~ims-app-base/logic/managers/UiPreferenceManager';
import ProjectManager from '~ims-app-base/logic/managers/ProjectManager';
import DesktopCreatorManager from '#logic/managers/DesktopCreatorManager';

export default defineComponent({
  name: 'DesktopSettingsDialogProject',
  components: {
    FormInput,
    FormCheckBox,
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
    };
  },
  computed: {
    projectInfo() {
      return this.$getAppManager().get(ProjectManager).getProjectInfo();
    },
    originalTitle(): string {
      return this.projectInfo?.title ?? '';
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
  },
  mounted() {
    this.projectTitle = this.originalTitle;
    this.$emit('update:isEmpty', this.isEmptyComputed);
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
  },
});
</script>

<style lang="scss" rel="stylesheet/scss" scoped>
.DesktopSettingsDialog_project-empty {
  color: var(--local-sub-text-color);
}
</style>
