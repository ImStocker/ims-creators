<template>
  <div class="DialogTimerDemoPlay">
    <div class="DialogTimerDemoPlay-content">
      <div class="DialogTimerDemoPlay-header">
        <i class="ri-timer-line"></i>
        {{ $t('imsDialogEditor.nodes.timer.title') }}
      </div>
      <div class="DialogTimerDemoPlay-countdown">
        <div class="DialogTimerDemoPlay-countdown-bar">
          <div
            class="DialogTimerDemoPlay-countdown-bar-fill"
            :style="{ width: progressPct + '%' }"
          ></div>
        </div>
        <div class="DialogTimerDemoPlay-countdown-text">
          {{ timerDisplay }}
        </div>
      </div>
    </div>
    <div class="DialogTimerDemoPlay-options">
      <button
        class="PlayerDemoDialog-option-button"
        @click="dialogPlayer.resolveTimer()"
      >
        {{ $t('imsDialogEditor.play.continue') }}
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { DialogPlayer } from './DialogPlayer';

export default defineComponent({
  name: 'DialogTimerDemoPlay',
  props: {
    dialogPlayer: {
      type: Object as PropType<DialogPlayer>,
      required: true,
    },
  },
  data() {
    return {
      _timerTick: 0,
    };
  },
  computed: {
    timerDisplay(): string {
      this._timerTick;
      const remaining = this.dialogPlayer.timerRemaining;
      const total = this.dialogPlayer.timerDuration;
      const pct = total > 0 ? Math.round((remaining / total) * 100) : 0;
      return `${remaining.toFixed(1)}s (${pct}%)`;
    },
    progressPct(): number {
      this._timerTick;
      const remaining = this.dialogPlayer.timerRemaining;
      const total = this.dialogPlayer.timerDuration;
      if (total <= 0) return 0;
      return Math.round((remaining / total) * 100);
    },
  },
  mounted() {
    this._pollInterval = setInterval(() => {
      this._timerTick++;
    }, 100);
  },
  beforeUnmount() {
    clearInterval(this._pollInterval);
  },
});
</script>

<style lang="scss" rel="stylesheet/scss" scoped>
.DialogTimerDemoPlay-header {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 20px;
  text-align: center;
  color: var(--local-text-color);
  i {
    margin-right: 6px;
    color: var(--imsde-node-playing-color);
  }
}
.DialogTimerDemoPlay-countdown {
  margin-bottom: 20px;
  text-align: center;
}
.DialogTimerDemoPlay-countdown-bar {
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}
.DialogTimerDemoPlay-countdown-bar-fill {
  height: 100%;
  background: var(--imsde-node-playing-color);
  border-radius: 4px;
  transition: width 0.1s linear;
}
.DialogTimerDemoPlay-countdown-text {
  font-size: 24px;
  font-weight: bold;
  color: var(--imsde-node-playing-color);
}
</style>
