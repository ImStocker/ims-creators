<template>
  <div class="Form ProjectRenameForm">
    <div class="Form-row">
      <div class="Form-row-caption">
        {{ $t('desktop.settings.project.name') }}
      </div>
      <div class="Form-row-value">
        <FormInput
          :value="projectTitle"
          :disabled="busy"
          :create-with-enter="true"
          @input="projectTitle = $event"
        ></FormInput>
      </div>
    </div>
    <div v-if="showFolderToggle" class="Form-row">
      <form-check-box
        :value="renameFolder"
        :caption="$t('desktop.settings.project.renameFolder')"
        :disabled="busy"
        @input="renameFolder = $event"
      ></form-check-box>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import FormInput from '~ims-app-base/components/Form/FormInput.vue';
import FormCheckBox from '~ims-app-base/components/Form/FormCheckBox.vue';
import UiPreferenceManager from '~ims-app-base/logic/managers/UiPreferenceManager';

export type ProjectRenameFormSubmit = {
  title: string;
  renameFolder: boolean;
};

export default defineComponent({
  name: 'ProjectRenameForm',
  components: {
    FormInput,
    FormCheckBox,
  },
  props: {
    title: {
      type: String,
      default: '',
    },
    busy: {
      type: Boolean,
      default: false,
    },
    showFolderToggle: {
      type: Boolean,
      default: true,
    },
  },
  emits: ['submit', 'update:canSubmit'],
  data() {
    return {
      projectTitle: '',
    };
  },
  computed: {
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
    canSave(): boolean {
      const title = this.projectTitle.trim();
      return !!title && title !== this.title;
    },
  },
  watch: {
    title: {
      immediate: true,
      handler(val: string) {
        this.projectTitle = val ?? '';
      },
    },
    canSave: {
      immediate: true,
      handler(val: boolean) {
        this.$emit('update:canSubmit', val);
      },
    },
  },
  methods: {
    submit() {
      const title = this.projectTitle.trim();
      if (!title || title === this.title) return;
      this.$emit('submit', {
        title,
        renameFolder: this.renameFolder,
      } as ProjectRenameFormSubmit);
    },
  },
});
</script>
