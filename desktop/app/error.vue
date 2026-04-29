<template>
  <NuxtLoadingIndicator
    color="var(--color-accent)"
    error-color="var(--color-danger)"
  ></NuxtLoadingIndicator>
  <div class="ErrorPage">
    <h1 class="ErrorPage-statusCode">{{ error.statusCode }}</h1>
    <h2 class="ErrorPage-message">{{ error.message }}</h2>
    <button class="is-button is-button-action accent" @click="openNewWindow">
      {{ $t('common.goHome') }}
    </button>
  </div>
</template>
<script setup lang="ts">
import type { NuxtError } from '#app';
import { usePageHead } from '~ims-app-base/composables/usePageHead';

function openNewWindow() {
  window.imshost.window.close();
  window.imshost.window.openNew({ localPath: null });
}
defineProps({
  error: {
    type: Object as () => NuxtError,
    default: null,
  },
});

usePageHead(() => ({
  title: 'Error | IMS Creators',
}));
</script>
<style lang="scss" scoped>
@use '~ims-app-base/style/devices-mixins';

.ErrorPage {
  max-height: 100vh;
  max-width: 100vw;
  align-items: center;
  position: fixed;
  right: 0;
  left: 0;
  top: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  flex-direction: column;
  padding: 16px;
}
.ErrorPage-statusCode {
  font-size: 30vh;
  font-weight: 400;
  line-height: var(--local-line-height);
  margin: 0;

  @include devices-mixins.device-type(not-pc) {
    font-size: 15vh;
  }
}
.ErrorPage-message {
  text-align: center;
  font-size: 2.5rem;
  font-weight: 300;
  letter-spacing: -0.00833em;
  line-height: 1em;
  opacity: 0.4;
  margin: 0 0 40px;

  @include devices-mixins.device-type(not-pc) {
    font-size: 1.5rem;
    line-height: normal;
  }
}
</style>
