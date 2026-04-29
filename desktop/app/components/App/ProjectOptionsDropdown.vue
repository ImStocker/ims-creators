<template>
  <menu-button class="ProjectOptionsDropdown">
    <template #button="{ toggle }">
      <button
        class="is-button is-button-icon-outlined ProjectOptionsDropdown-button"
        @click="toggle"
      >
        <i class="ri-menu-line"></i>
      </button>
    </template>
    <menu-list :menu-list="menuAdditionalOptions"></menu-list>
  </menu-button>
</template>
<script lang="ts">
import { defineComponent } from 'vue';
import MenuButton from '~ims-app-base/components/Common/MenuButton.vue';
import MenuList from '~ims-app-base/components/Common/MenuList.vue';
import ProjectContentManager from '~ims-app-base/logic/managers/ProjectContentManager';
import ProjectManager from '~ims-app-base/logic/managers/ProjectManager';
import { openProjectLink } from '~ims-app-base/logic/router/routes-helpers';
import type { MenuListItem } from '~ims-app-base/logic/types/MenuList';
import { MIN_WORKSPACE_RIGHTS_TO_ADD_CONTENT, MIN_WORKSPACE_RIGHTS_TO_READ } from '~ims-app-base/logic/types/Rights';

// TODO: добавить проверку на desktop

export default defineComponent({
  name: 'ProjectOptionsDropdown',
  components: {
    MenuButton,
    MenuList,
  },
  computed: {
    projectInfo() {
      return this.$getAppManager().get(ProjectManager).getProjectInfo();
    },
    isDesktop() {
      return this.$getAppManager().$appConfiguration.isDesktop;
    },
    menuAdditionalOptions(): MenuListItem[] {
      const project_info = this.projectInfo;
      if (!project_info) return [];
      const user_role = this.$getAppManager()
        .get(ProjectManager)
        .getUserRoleInProject();

      const project_local_path = this.projectInfo?.localPath;
      return [
        this.isDesktop && project_local_path
          ? {
              title: this.$t(
                'mainMenu.' +
                  (process.platform === 'darwin'
                    ? 'openInFinder'
                    : 'openInExplorer'),
              ),
              icon: 'ri-folder-open-line',
              action: async () => {
                await window.imshost.shell.showFolder(project_local_path);
              },
            }
          : null,
        ...this.getImportExportMenuItems(),
      ].filter((x) => x) as MenuListItem[];
    },
    gddWorkspace() {
      return this.$getAppManager()
        .get(ProjectManager)
        .getWorkspaceByName('gdd');
    },
  },
  methods: {
    getImportExportMenuItems(): MenuListItem[] {
      if (!this.gddWorkspace) return [];
      const gdd_workspace = this.gddWorkspace;
      return [
        this.gddWorkspace.rights >= MIN_WORKSPACE_RIGHTS_TO_ADD_CONTENT &&
        !this.isDesktop
          ? {
              title: this.$t('gddPage.import'),
              action: () =>
                this.$getAppManager()
                  .get(ProjectContentManager)
                  .importAsset(gdd_workspace),
              icon: 'import',
            }
          : null,
        this.gddWorkspace.rights >= MIN_WORKSPACE_RIGHTS_TO_READ
          ? {
              title: this.$t('gddPage.export'),
              icon: 'export',
              children: [
                {
                  title: this.$t('gddPage.exportToMD'),
                  action: () =>
                    this.$getAppManager()
                      .get(ProjectContentManager)
                      .exportWorkspaceToDocument(gdd_workspace, 'md'),
                },
                {
                  title: this.$t('gddPage.exportToPDF'),
                  action: () =>
                    this.$getAppManager()
                      .get(ProjectContentManager)
                      .exportWorkspaceToDocument(gdd_workspace, 'pdf'),
                },
                {
                  title: this.$t('gddPage.exportToJSON'),
                  action: () =>
                    this.$getAppManager()
                      .get(ProjectContentManager)
                      .exportWorkspaceToJSON(gdd_workspace),
                },
                {
                  title: this.$t('gddPage.exportWithCustomFormat'),
                  action: () =>
                    this.$getAppManager()
                      .get(ProjectContentManager)
                      .exportCollectionWithCustomFormat(gdd_workspace)
                },
                {
                  type: 'separator'
                },
                {
                  title: this.$t('autoExport.setupAutoExport'),
                  action: () => {
                    openProjectLink(this.$getAppManager(), this.projectInfo!, {
                      name: 'project-autoexport',
                    })
                  },
                }
              ],
            }
          : null,
      ].filter((x) => x) as MenuListItem[];
    },
  },
});
</script>
<style lang="scss" scoped>
.ProjectOptionsDropdown-button.is-button {
  height: 100%;
  --button-border-color: var(--input-border-color);
}
</style>
