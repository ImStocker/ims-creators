<template>
  <div class="DialogPlayToolbar">
    <template v-if="!dialogPlayer.isPlaying">
      <button
        class="is-button is-button-icon"
        :title="$t('imsDialogEditor.play.playDemo')"
        @click="play(false)"
      >
        <i class="ri-play-fill"></i>
      </button>
      <button
        class="is-button is-button-icon"
        :title="$t('imsDialogEditor.play.playDebug')"
        @click="play(true)"
      >
        <i class="ri-bug-fill"></i>
      </button>
    </template>
    <template v-else>
      <button
        v-if="!dialogPlayer.isPaused"
        class="is-button is-button-icon"
        :title="$t('imsDialogEditor.play.pause')"
        @click="dialogPlayer.pause()"
      >
        <i class="ri-pause-fill"></i>
      </button>
      <button
        v-else
        :title="$t('imsDialogEditor.play.resume')"
        class="is-button is-button-icon"
        :disabled="!dialogPlayer.canResume"
        @click="dialogPlayer.resume()"
      >
        <i class="ri-play-fill"></i>
      </button>
      <button
        :title="$t('imsDialogEditor.play.stop')"
        class="is-button is-button-icon"
        @click="dialogPlayer.stop()"
      >
        <i class="ri-stop-fill"></i>
      </button>
      <button
        :title="$t('imsDialogEditor.play.restart')"
        class="is-button is-button-icon"
        @click="restart()"
      >
        <i class="ri-restart-line"></i>
      </button>
      <button
        :title="$t('imsDialogEditor.play.stepBack')"
        class="is-button is-button-icon"
        :disabled="!dialogPlayer.canHistoryBack"
        @click="dialogPlayer.goHistoryBack()"
      >
        <i class="ri-skip-back-fill"></i>
      </button>
      <button
        :title="$t('imsDialogEditor.play.stepForward')"
        class="is-button is-button-icon"
        :disabled="!dialogPlayer.canHistoryForward"
        @click="dialogPlayer.goHistoryForward()"
      >
        <i class="ri-skip-forward-fill"></i>
      </button>
      <button
        v-if="dialogPlayer.isPlayDebug"
        :title="$t('imsDialogEditor.play.switchDemo')"
        class="is-button is-button-icon"
        @click="dialogPlayer.setPlayMode(false)"
      >
        <i class="ri-slideshow-3-fill"></i>
      </button>
      <button
        v-else
        :title="$t('imsDialogEditor.play.switchDebug')"
        class="is-button is-button-icon"
        @click="dialogPlayer.setPlayMode(true)"
      >
        <i class="ri-bug-fill"></i>
      </button>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { DialogPlayer } from './DialogPlayer';
import UiManager from '~ims-app-base/logic/managers/UiManager';

export default defineComponent({
  name: 'DialogPlayToolbar',
  components: {},
  props: {
    dialogPlayer: {
      type: Object as PropType<DialogPlayer>,
      required: true,
    },
  },
  methods: {
    async play(debug: boolean) {
      await this.$getAppManager()
        .get(UiManager)
        .doTask(async () => {
          this.dialogPlayer.play(debug);
        });
    },
    async restart() {
      await this.$getAppManager()
        .get(UiManager)
        .doTask(async () => {
          this.dialogPlayer.restart();
        });
    },
  },
});
</script>

<style lang="scss" rel="stylesheet/scss" scoped>
.DialogPlayToolbar {
  background: var(--dropdown-bg-color);
  box-shadow: var(--dropdown-box-shadow);
  border-radius: var(--dropdown-border-radius);
  display: flex;
  padding: 2px 4px;
}
</style>
