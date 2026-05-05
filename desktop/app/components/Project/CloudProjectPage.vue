<template>
  <CenteredPage>
    <template #header>
      <div class="App-header">
        <h1>{{ $t('desktop.cloudOnlySection.cloudOnlySectionHeader') }}</h1>
      </div>
    </template>
    <div class="CloudProjectPage">
        {{ $t('desktop.cloudOnlySection.cloudOnlySectionBody') }}
    </div>
  </CenteredPage>
</template>
<script lang="ts">
import { defineComponent } from 'vue';
import CenteredPage from '~ims-app-base/components/Common/CenteredPage.vue';
import ProjectManager from '~ims-app-base/logic/managers/ProjectManager';

export default defineComponent({
  name: 'CloudProjectPage',
  components: {
    CenteredPage
  },
  computed: {
    projectInfo() {
      return this.$getAppManager().get(ProjectManager).getProjectInfo();
    },
  },
});
</script>
<style lang="scss">

</style>
