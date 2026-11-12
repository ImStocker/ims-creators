<template>
  <dialog-content
    class="PromptDialog"
    @escape-press="choose(false)"
    @enter-press="choose(true)"
  >
    <div class="AboutProgramDialog">
      <div class="Form">
        <div class="Dialog-header">
          {{ $t('desktop.mainMenu.about') }}
        </div>
        <div class="Dialog-message">
          <div class="AboutProgramDialog-item">
            <div class="AboutProgramDialog-item-title">
                {{ $t('desktop.welcome.version') }}:
            </div>
            {{ appVersion }}
          </div>
          <div class="AboutProgramDialog-item">
            <div class="AboutProgramDialog-item-title">
                {{ $t('desktop.mainMenu.website') }}:
            </div>
            <a href="https://imsc.space/">https://imsc.space/</a>
          </div>
          <div class="AboutProgramDialog-item" v-if="userInfo">
            <div class="AboutProgramDialog-item-title">
                {{ $t('desktop.mainMenu.user') }}:
            </div>
                {{ userInfo.email }}
          </div>
        </div>
        <div class="Form-row-buttons">
          <div class="Form-row-buttons-center use-buttons-action">
            <button
              ref="input"
              type="button"
              class="is-button accent"
              @click="choose(true)"
            >
              {{ $t('common.dialogs.close') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </dialog-content>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import DialogContent from '~ims-app-base/components/Dialog/DialogContent.vue';
import type { DialogInterface } from '~ims-app-base/logic/managers/DialogManager';
import CaptionString from '~ims-app-base/components/Common/CaptionString.vue';
import pkg from '../../../package.json';
import AuthManager from '~ims-app-base/logic/managers/AuthManager';
import type { AuthTokenInfo } from '~ims-app-base/logic/managers/ApiWorker';

type DialogProps = {
};

type DialogResult = boolean | null;

export default defineComponent({
  name: 'AboutProgramDialog',
  components: {
    DialogContent,
    CaptionString,
  },
  props: {
    dialog: {
      type: Object as PropType<DialogInterface<DialogProps, DialogResult>>,
      required: true,
    },
  },
  computed: {
    appVersion() {
      return pkg.version;
    },
    userInfo(): AuthTokenInfo | undefined {
        return this.$getAppManager().get(AuthManager).getUserInfo();
    },
  },
  mounted() {
    (this.$refs['input'] as any).focus();
  },
  methods: {
    choose(val: boolean | null) {
      this.dialog.close(val);
    },
  },
});
</script>

<style lang="scss" rel="stylesheet/scss" scoped>
@use '~ims-app-base/style/Form';
.AboutProgramDialog-item{
    display: flex;
    gap: 5px;
}
.AboutProgramDialog-item-title{
    font-weight: bold;
}
</style>
