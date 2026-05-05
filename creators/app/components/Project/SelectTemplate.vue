<template>
  <div v-if="projectTemplatesError" class="is-input SelectTemplate-error">
    {{ projectTemplatesError }}
    <button class="is-button is-button-icon" @click="reloadTemplates">
      <i class="ri-refresh-line"></i>
    </button>
  </div>
  <ims-select
    v-else-if="projectTemplatesLoaded"
    v-model="currentProjectTemplateId"
    :reduce="(o: any) => o.id"
    :get-option-key="(o: any) => o.id"
    :label-prop="'title'"
    :clearable="true"
    :options="projectTemplates"
    class="SelectTemplate"
  >
    <template #option-content="{ option }">
      <div class="SelectTemplate-option use-buttons-icon-small">
        <div>
          <div>{{ option.title }}</div>
          <div class="SelectTemplate-option-description">
            {{ option.description }}
          </div>
        </div>
        <a
          :href="getOpenLink(option.id)"
          target="_blank"
          class="is-button"
          @click.stop
        >
          <i class="ri-eye-fill"></i>
        </a>
      </div>
    </template>
    <template #selected-option="{ option }">
      {{ option.title }}
    </template>
  </ims-select>
  <div v-else class="is-input SelectTemplate-load">
    <div class="loaderSpinner"></div>
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue';
import ImsSelect from '~ims-app-base/components/Common/ImsSelect.vue';
import ProjectManager from '~ims-app-base/logic/managers/ProjectManager';
import UiManager from '~ims-app-base/logic/managers/UiManager';

export default defineComponent({
  name: 'SelectTemplate',
  components: {
    ImsSelect,
  },
  props: {
    value: {
      type: String,
      default: () => null,
    },
  },
  emits: ['update'],
  data() {
    return {
      projectTemplatesLoaded: false,
      projectTemplatesError: null as string | null,
      currentProjectTemplateId: null as string | null,
      projectTemplates: [] as {
        title: string;
        id: string;
        description: string;
        lang: string;
      }[],
    };
  },
  computed: {
    currentLang() {
      return this.$getAppManager().get(UiManager).getLanguage();
    },
  },
  watch: {
    currentProjectTemplateId(new_val: string | null) {
      this.$emit('update', new_val);
    },
  },
  async mounted() {
    if (this.value) {
      this.currentProjectTemplateId = this.value;
    }
    await this.reloadTemplates();
  },
  methods: {
    getOpenLink(project_id: string) {
      return `https://ims.cr5.space/app/p/${project_id}/project`;
    },
    async reloadTemplates() {
      this.projectTemplatesLoaded = false;
      this.projectTemplatesError = null;

      try {
        this.projectTemplates = await this.$getAppManager()
          .get(ProjectManager)
          .loadProjectTemplates();
        this.projectTemplates = this.projectTemplates.filter(
          (p) => p.lang === this.currentLang,
        );
        if (this.projectTemplates.length > 0) {
          this.currentProjectTemplateId = this.projectTemplates[0].id;
        }
      } catch (err: any) {
        this.projectTemplatesError = err.message;
      } finally {
        this.projectTemplatesLoaded = true;
      }
    },
  },
});
</script>

<style>
.SelectTemplate {
  width: 100%;
}
.SelectTemplate-load,
.SelectTemplate-error {
  text-align: center;
  width: 250px;
}
.SelectTemplate-error,
.SelectTemplate-error > button {
  color: var(--color-main-error);
}
.SelectTemplate-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.SelectTemplate-option:first-child {
  width: 100%;
}
.SelectTemplate-option-description {
  font-size: 12px;
  color: var(--local-sub-text-color);
  margin-top: 5px;
}
</style>
