<template>
  <div class="WelcomeForm">
    <RecentlyOpened />
    <div class="WelcomeForm-Content">
      <div class="WelcomeForm-Content-Header">
        <div class="WelcomeForm-Content-Header-text">
          {{ $t('desktop.welcome.begin') }}
        </div>
        <div class="WelcomeForm-Content-Header-title">
          <div class="WelcomeForm-Content-Header-title-text">IMS</div>
          <svg
            class="AppNavigationSections-switcher-logo"
            xmlns="http://www.w3.org/2000/svg"
            width="128"
            height="128"
            viewBox="0 0 33.867 33.867"
          >
            <circle
              cx="16.933"
              cy="16.933"
              r="16.933"
              class="AppNavigationSections-switcher-logo-circle"
              style="fill-opacity: 1; stroke-width: 0.532436"
              :style="{
                fill: colorTheme === 'ims-light' ? '#FFD668' : '#eed811',
              }"
            />
            <path
              d="m26.303 9.912-4.457 1.505c.044 1.005.067 2.083.07 3.234a98.992 98.992 0 0 1-.063 3.42c.831-.251 1.547-.419 2.146-.503.608-.098 1.11-.123 1.508-.073.393.04.704.145.934.318.226.162.384.375.475.639.215.626.148 1.155-.201 1.588-.35.433-.95.778-1.805 1.035-.44.133-.917.21-1.433.233a6 6 0 0 1-1.516-.125l-.294 2.29c.318.05.654.075 1.008.077a8.656 8.656 0 0 0 1.077-.07c.367-.038.716-.09 1.047-.153a8.8 8.8 0 0 0 .872-.208c.855-.258 1.576-.579 2.164-.962.585-.395 1.037-.835 1.355-1.319.319-.484.498-1.01.538-1.58a4.266 4.266 0 0 0-.24-1.782 3.197 3.197 0 0 0-.662-1.128 3.142 3.142 0 0 0-1.117-.79c-.434-.197-.944-.31-1.53-.339-.579-.043-1.233.015-1.964.175.012-.307.016-.678.01-1.112.003-.45-.004-.89-.021-1.321l3.58-1.242m-18.713.442c-.708 0-1.365.108-1.97.324a4.3 4.3 0 0 0-1.566.96 4.372 4.372 0 0 0-1.034 1.54c-.251.603-.377 1.291-.377 2.066 0 1.558.41 2.76 1.23 3.606.829.847 2.03 1.27 3.604 1.27.736 0 1.384-.072 1.943-.216.559-.144.992-.306 1.3-.486l-.601-2.218c-.121.054-.256.113-.406.176a4.222 4.222 0 0 1-.517.175c-.195.045-.419.086-.67.122a6.051 6.051 0 0 1-.853.054c-.503 0-.931-.076-1.285-.23a2.399 2.399 0 0 1-.866-.648c-.694-.924-.697-2.484.195-3.413.251-.243.536-.419.853-.527.326-.108.656-.162.992-.162.503 0 .95.054 1.34.162.401.108.75.239 1.049.392l.629-2.231a3.994 3.994 0 0 0-.992-.419 6.008 6.008 0 0 0-.88-.202 6.071 6.071 0 0 0-1.118-.095zm6.677.108c-.4 0-.857.018-1.37.054-.503.036-.992.1-1.467.19v9.225h2.18V18.32h1.076c.186.216.372.459.558.729.187.26.373.54.56.837.195.298.382.604.559.92.186.314.367.625.544.93h2.446a22.33 22.33 0 0 0-.545-1.04c-.196-.36-.4-.701-.615-1.026a15.52 15.52 0 0 0-.629-.945c-.214-.306-.42-.576-.615-.81.587-.235 1.034-.554 1.342-.96.316-.414.475-.95.475-1.607 0-1.054-.387-1.828-1.16-2.324-.773-.504-1.886-.756-3.34-.756zm.125 1.797c.699 0 1.226.099 1.58.297.363.189.544.513.544.972 0 .478-.177.815-.53 1.014-.355.198-.941.297-1.761.297h-.615v-2.54l.35-.027c.13-.009.274-.013.432-.013z"
              style="fill: #222; fill-opacity: 1; stroke-width: 1.38022"
            />
            <circle
              cx="28.089"
              cy="9.655"
              r="2.646"
              style="fill: #222; fill-opacity: 1; stroke-width: 0.995842"
            />
          </svg>
          <div class="WelcomeForm-Content-Header-title-text">Desktop</div>
          <!-- <beta-badge class="WelcomeForm-Content-Header-title-badge"></beta-badge> -->
        </div>
        <div class="WelcomeForm-Content-Header-title-subtext selectable-text">
          {{ $t('desktop.welcome.version') }} {{ appVersion }}
        </div>
      </div>
      <div
        class="WelcomeForm-Content-Actions use-buttons-action tiny-scrollbars"
      >
        <WelcomeFormContentStart
          v-if="pageName === 'start'"
          class="WelcomeForm-Content-Actions-item-one"
          :class="{ hidden: pageName !== 'start' }"
          @create-project="pageName = 'createProject'"
          @sign-in="pageName = 'signIn'"
          @select-projects="pageName = 'selectProject'"
        />
        <WelcomeFormContentCreateProject
          v-if="pageName === 'createProject'"
          class="WelcomeForm-Content-Actions-item-two"
          :class="{ hidden: pageName !== 'createProject' }"
          @back="pageName = 'start'"
          :create-project-params="createProjectParams"
        />
        <WelcomeFormContentSignIn
          v-if="pageName === 'signIn'"
          class="WelcomeForm-Content-Actions-item-two"
          :class="{ hidden: pageName !== 'signIn' }"
          @back="pageName = 'start'"
          @success-login="pageName = 'selectProject'"
        />
        <WelcomeFormContentSelectProject
          v-if="pageName === 'selectProject'"
          class="WelcomeForm-Content-Actions-item-two"
          :class="{ hidden: pageName !== 'selectProject' }"
          @back="pageName = 'start'"
          @create-project="openCreateProjectForm"
        />
      </div>
      <div id="WelcomeForm-Content-Actions-teleport" class="WelcomeForm-Content-Actions-teleport"></div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import RecentlyOpened from './RecentlyOpened.vue';
import pkg from '../../../package.json';
import WelcomeFormContentStart from './WelcomeFormContentStart.vue';
import WelcomeFormContentCreateProject from './WelcomeFormContentCreateProject.vue';
import WelcomeFormContentSelectProject from './WelcomeFormContentSelectProject.vue';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import BetaBadge from '../Common/BetaBadge.vue';
import WelcomeFormContentSignIn from './WelcomeFormContentSignIn.vue';

export default defineComponent({
  name: 'WelcomeForm',
  components: {
    RecentlyOpened,
    WelcomeFormContentStart,
    WelcomeFormContentCreateProject,
    WelcomeFormContentSelectProject,
    BetaBadge,
    WelcomeFormContentSignIn
  },
  data() {
    return {
      pageName: 'start',
      createProjectParams: {},
    };
  },
  computed: {
    appVersion() {
      return pkg.version;
    },
    colorTheme() {
      return this.$getAppManager().get(UiManager).getColorTheme();
    },
  },
  methods: {
    openCreateProjectForm(){
      this.pageName = 'createProject';
      this.createProjectParams = { projectType: 'cloud'}
    }
  }
});
</script>

<style lang="scss" scoped>
.WelcomeForm {
  display: flex;
  height: 100%;
}
.WelcomeForm-Content {
  padding: 20px;
  background-color: var(--local-box-color);
  flex: 1;
  display: flex;
  flex-direction: column;
}
.WelcomeForm-Content-Header {
  text-align: center;
  margin-bottom: 40px;
}
.WelcomeForm-Content-Header-text,
.WelcomeForm-Content-Header-title-text {
  font-size: 30px;
  font-weight: 500;
}
.WelcomeForm-Content-Header-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  position: relative;
  width: fit-content;
  margin: 0 auto;
  
  .WelcomeForm-Content-Header-title-badge {
    position: absolute;
    right: -30px;
    top: 0;
  }
}
.WelcomeForm-Content-Header-title-subtext {
  margin-top: 10px;
  color: var(--local-sub-text-color);
}
.WelcomeForm-Content-Actions {
  overflow-x: hidden;
  overflow-y: auto;
  position: relative;
  flex: 1;
  padding-bottom: 20px;
}
.WelcomeForm-Content-Actions-teleport {
  display: flex;
  flex-direction: column;
}
.WelcomeForm-Content-Actions-item-one,
.WelcomeForm-Content-Actions-item-two {
  position: absolute;
  width: 100%;
  transition:
    transform 0.5s,
    opacity 0.5s ease;

  &.hidden {
    opacity: 0;
    transition:
      transform 0.5s,
      opacity 0.5s ease;
  }
}
.WelcomeForm-Content-Actions-item-one.hidden {
  transform: translateX(-100%);
}
.WelcomeForm-Content-Actions-item-two.hidden {
  transform: translateX(+100%);
}
.AppNavigationSections-switcher-logo {
  min-width: 40px;
  display: inline-block;
  width: 60px;
  height: 60px;
}
</style>
