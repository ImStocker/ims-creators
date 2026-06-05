<template>
  <dialog-content
    v-if="dialogController"
    class="PlayerDemoDialog tiny-scrollbars"
  >
    <div class="PlayerDemoDialog-toolbar">
      <dialog-play-toolbar :dialog-player="dialogPlayer"></dialog-play-toolbar>
    </div>
    <div class="PlayerDemoDialog-body">
      <template v-if="dialogPlayer.scriptEnded">
        <div class="PlayerDemoDialog-scriptEnded">
          <div class="PlayerDemoDialog-scriptEnded-text">
            {{ $t('imsDialogEditor.play.scriptCompleted') }}
          </div>
          <button
            class="PlayerDemoDialog-option-button"
            @click="dialogPlayer.stop()"
          >
            {{ $t('imsDialogEditor.play.finishExecution') }}
          </button>
        </div>
      </template>
      <template v-else-if="currentPlayingNode">
        <dialog-speech-demo-play
          v-if="currentPlayingNode.node.type === 'speech'"
          :dialog-player="dialogPlayer"
          :playing-node-data="currentPlayingNode"
          :dialog-controller="dialogController"
        ></dialog-speech-demo-play>
        <dialog-trigger-demo-play
          v-else-if="currentPlayingNode.node.type === 'trigger'"
          :dialog-player="dialogPlayer"
          :playing-node-data="currentPlayingNode"
          :dialog-controller="dialogController"
        ></dialog-trigger-demo-play>
        <dialog-call-script-demo-play
          v-else-if="currentPlayingNode.node.type === 'callScript'"
          :dialog-player="dialogPlayer"
          :playing-node-data="currentPlayingNode"
          :dialog-controller="dialogController"
        ></dialog-call-script-demo-play>
        <div v-else class="PlayerDemoDialog-customNode">
          <div class="PlayerDemoDialog-customNode-content">
            {{
              $t(
                'imsDialogEditor.nodes.' +
                  currentPlayingNode.node.type +
                  '.title',
              )
            }}
          </div>
          <button
            class="PlayerDemoDialog-option-button"
            @click="dialogPlayer.playChoose(null)"
          >
            {{ $t('imsDialogEditor.play.continue') }}
          </button>
        </div>
      </template>
    </div>
  </dialog-content>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import DialogContent from '~ims-app-base/components/Dialog/DialogContent.vue';
import type { DialogInterface } from '~ims-app-base/logic/managers/DialogManager';
import type { DialogPlayer } from './DialogPlayer';
import DialogPlayToolbar from './DialogPlayToolbar.vue';
import DialogSpeechDemoPlay from './DialogSpeechDemoPlay.vue';
import DialogTriggerDemoPlay from './DialogTriggerDemoPlay.vue';
import type { IProjectContext } from '~ims-app-base/logic/types/IProjectContext';
import DialogCallScriptDemoPlay from './DialogCallScriptDemoPlay.vue';

type DialogProps = {
  dialogPlayer: DialogPlayer;
  projectContext: IProjectContext;
};

type DialogResult = void;

export default defineComponent({
  name: 'PlayerDemoDialog',
  components: {
    DialogContent,
    DialogPlayToolbar,
    DialogSpeechDemoPlay,
    DialogTriggerDemoPlay,
    DialogCallScriptDemoPlay,
  },
  provide() {
    return {
      projectContext: this.dialog.state.projectContext,
    };
  },
  props: {
    dialog: {
      type: Object as PropType<DialogInterface<DialogProps, DialogResult>>,
      required: true,
    },
  },
  emits: ['dialog-parameters'],
  computed: {
    dialogController() {
      return this.dialogPlayer.currentPlayingDialogController;
    },
    dialogPlayer() {
      return this.dialog.state.dialogPlayer;
    },
    currentPlayingNode() {
      return this.dialogPlayer.currentPlayingNode;
    },
  },
  mounted() {
    this.$emit('dialog-parameters', {
      forbidClose: true,
    });
  },
});
</script>

<style lang="scss" rel="stylesheet/scss" scoped>
@use '~ims-app-base/style/Form';

.PlayerDemoDialog {
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 10px 20px;
  overflow: auto;
}

.PlayerDemoDialog-body {
  margin: 0 auto;
  font-size: 18px;
  width: 800px;
  max-width: 100%;
  margin-bottom: 20px;
  margin-top: 60px;
}
.PlayerDemoDialog-toolbar {
  display: flex;
  justify-content: center;
  position: fixed;
  top: 0;
  z-index: 100;
  padding-top: 10px;
  width: 100%;
  left: 0;
}
.PlayerDemoDialog-customNode-content {
  margin-bottom: 20px;
  text-align: center;
}
.PlayerDemoDialog-scriptEnded {
  text-align: center;
  margin-top: 100px;
}
.PlayerDemoDialog-scriptEnded-text {
  font-size: 24px;
  font-weight: bold;
  color: var(--local-text-color);
  margin-bottom: 30px;
}
</style>
<style lang="scss" rel="stylesheet/scss">
.DialogHost-component-PlayerDemoDialog {
  .DialogHostDialog-content {
    margin: 0;
  }
  .DialogHostDialog-center {
    padding: 0;
  }
}
.DialogHost-one.state-prev-same {
  .DialogHostDialog-content {
    position: relative;
  }
  .DialogHost-component-PlayerDemoDialog .DialogHostDialog-content {
    top: 0;
  }
}
.PlayerDemoDialog-option-button {
  width: 100%;
  margin-bottom: 10px;
  text-align: left;
  cursor: pointer;
  color: var(--local-text-color);
  background: var(--panel-bg-color);
  border-radius: var(--panel-border-radius);
  border: none;
  padding: var(--panel-padding);
  &:disabled {
    cursor: not-allowed;
  }
  &:not(:disabled):hover {
    background: var(--local-hl-bg-color);
  }
}
</style>
