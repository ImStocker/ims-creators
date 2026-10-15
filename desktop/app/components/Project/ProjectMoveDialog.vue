<template>
  <dialog-content class="ProjectMoveDialog">
    <div class="Dialog-header">
      {{ $t('desktop.menu.moveProject') }}
    </div>
    <ProjectMoveForm
      ref="form"
      :local-path="localPath"
      :busy="busy"
      @submit="onSubmit"
      @update:canSubmit="canSubmit = $event"
    ></ProjectMoveForm>
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
          {{ $t('desktop.settings.project.moveButton') }}
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
import ProjectMoveForm from './ProjectMoveForm.vue';

type DialogProps = {
  localPath: string;
};

type DialogResult = boolean | undefined;

export default defineComponent({
  name: 'ProjectMoveDialog',
  components: {
    DialogContent,
    ProjectMoveForm,
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
    localPath(): string {
      return this.dialog.state.localPath ?? '';
    },
  },
  methods: {
    submit() {
      (this.$refs.form as any)?.submit();
    },
    async onSubmit(targetPath: string) {
      if (!this.localPath || !targetPath) return;
      this.busy = true;
      const res = await this.$getAppManager()
        .get(UiManager)
        .doTask(async () => {
          await this.$getAppManager()
            .get(DesktopCreatorManager)
            .moveProjectInList(this.localPath, targetPath);
        });
      this.busy = false;
      if (res.success) {
        this.dialog.close(true);
      }
    },
  },
});
</script>
