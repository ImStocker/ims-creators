<template>
  <dialog-content class="ProjectRenameDialog">
    <div class="Dialog-header">
      {{ $t('desktop.menu.renameProject') }}
    </div>
    <ProjectRenameForm
      ref="form"
      :title="title"
      :busy="busy"
      @submit="onSubmit"
      @update:canSubmit="canSubmit = $event"
    ></ProjectRenameForm>
    <div class="Form-row-buttons use-buttons-action">
      <div class="Form-row-buttons-center">
        <button
          type="button"
          class="is-button"
          :disabled="busy"
          @click="dialog.close()"
        >
          {{ $t('common.dialogs.cancelCaption') }}
        </button>
        <button
          type="button"
          class="is-button accent"
          :class="{ loading: busy }"
          :disabled="!canSubmit || busy"
          @click="submit"
        >
          {{ $t('desktop.settings.project.renameButton') }}
        </button>
      </div>
    </div>
  </dialog-content>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import DialogContent from '~ims-app-base/components/Dialog/DialogContent.vue';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import type { DialogInterface } from '~ims-app-base/logic/managers/DialogManager';
import DesktopCreatorManager from '#logic/managers/DesktopCreatorManager';
import ProjectRenameForm, {
  type ProjectRenameFormSubmit,
} from './ProjectRenameForm.vue';

type DialogProps = {
  localPath: string;
  title: string;
};

type DialogResult = boolean | undefined;

export default defineComponent({
  name: 'ProjectRenameDialog',
  components: {
    DialogContent,
    ProjectRenameForm,
  },
  props: {
    dialog: {
      type: Object as PropType<DialogInterface<DialogProps, DialogResult>>,
      required: true,
    },
  },
  data() {
    return {
      busy: false,
      canSubmit: false,
    };
  },
  computed: {
    title(): string {
      return this.dialog.state.title ?? '';
    },
    localPath(): string {
      return this.dialog.state.localPath ?? '';
    },
  },
  methods: {
    submit() {
      (this.$refs.form as any)?.submit();
    },
    async onSubmit(payload: ProjectRenameFormSubmit) {
      if (!this.localPath) return;
      this.busy = true;
      const res = await this.$getAppManager()
        .get(UiManager)
        .doTask(async () => {
          await this.$getAppManager()
            .get(DesktopCreatorManager)
            .renameProjectInList(
              this.localPath,
              payload.title,
              payload.renameFolder,
            );
        });
      this.busy = false;
      if (res.success) {
        this.dialog.close(true);
      }
    },
  },
});
</script>
