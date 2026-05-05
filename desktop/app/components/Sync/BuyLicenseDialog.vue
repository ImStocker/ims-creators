<template>
  <dialog-content class="BuyLicenseDialog">
    <div class="Dialog-header">{{$t('desktop.fsSync.header')}}</div>
    <div class="Dialog-content">
      {{ $t('desktop.welcome.needLicense') }}
    </div>
    <div class="Dialog-buttons use-buttons-action">
        <button class="is-button" @click="close">
          {{ $t('desktop.settings.close') }}
        </button>
        <button class="is-button accent" @click="buyLicense()">
          {{$t('desktop.welcome.buy')}}
        </button>
    </div>
  </dialog-content>
</template>

<script lang="ts" type="text/ecmascript-6">
import { defineComponent, type PropType } from 'vue';
import DialogContent from '~ims-app-base/components/Dialog/DialogContent.vue';
import type { DialogInterface } from '~ims-app-base/logic/managers/DialogManager';

type DialogProps = {
  message?: string;
};

type DialogResult = boolean | undefined | null;

export default defineComponent({
  name: 'BuyLicenseDialog',
  components: {
    DialogContent,
  },
  props: {
    dialog: {
      type: Object as PropType<DialogInterface<DialogProps, DialogResult>>,
      required: true,
    },
  },
  data() {
    return {
      showType: 'login' as 'login' | 'register',
    };
  },
  methods: {
    buyLicense(){
      window.location.replace(`https://ims.cr5.space/app/prices`)
    },
    close(){
      this.dialog.close();
    }
  }
});
</script>

<style lang="scss" rel="stylesheet/scss" scoped>
</style>
