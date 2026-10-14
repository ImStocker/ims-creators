<template>
  <div class="RecentlyOpened tiny-scrollbars" :class="{'RecentlyOpened-empty': recentProjectList.length === 0}">
    <div
      v-for="project of recentProjectList"
      :key="project.localPath"
      class="RecentlyOpened-Item"
    >
      <block-with-menu
        :menu-list="getMenuList(project)"
      >
        <div class="RecentlyOpened-Item-Project" @click="openProject(project)">
          <div class="RecentlyOpened-Item-Project-title" :title="project.title">
            {{ project.title }}
          </div>
          <div class="RecentlyOpened-Item-Project-subtext" :title="project.localPath">
            {{ project.localPath }}
          </div>
        </div>
      </block-with-menu>
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent } from 'vue';
import type { MenuListItem } from '~ims-app-base/logic/types/MenuList';
import MenuList from '~ims-app-base/components/Common/MenuList.vue';
import MenuButton from '~ims-app-base/components/Common/MenuButton.vue';
import BlockWithMenu from '~ims-app-base/components/Common/BlockWithMenu.vue';
import DialogManager from '~ims-app-base/logic/managers/DialogManager';
import DesktopCreatorManager from '#logic/managers/DesktopCreatorManager';
import ProjectRenameDialog from '../Project/ProjectRenameDialog.vue';
import ProjectMoveDialog from '../Project/ProjectMoveDialog.vue';
import type { LocalProjectInitInfo } from '#bridge/api/ImsHostProject';
export default defineComponent({
  name: 'RecentlyOpened',
  components: {
    MenuList,
    MenuButton,
    BlockWithMenu,
  },
  emits: ['reveal','rename','move','remove'],
  computed: {
    recentProjectList(){
      return this.$getAppManager().get(DesktopCreatorManager).getRecentProjectList();
    }
  },
  methods: {
    getMenuList(project: LocalProjectInitInfo): MenuListItem[] {
      return [
        {
          title: process.platform === "darwin" ? this.$t('desktop.menu.revealInFinder') : this.$t('desktop.menu.revealInFileExplorer'),
          name: 'reveal',
          icon: 'ri-folder-open-line',
          action: async () => await window.imshost.shell.showFolder(project.localPath),
        },
        {
          title: this.$t('desktop.menu.renameProject') + '...',
          name: 'rename',
          icon: 'edit',
          action: () => this.openRenameDialog(project),
        },
        {
          title: this.$t('desktop.menu.moveProject'),
          name: 'move',
          icon: 'ri-send-plane-fill',
          action: () => this.openMoveDialog(project),
        },
        {
          title: this.$t('desktop.menu.removeProject'),
          name: 'remove',
          icon: 'delete',
          danger: true,
          action: () => this.$getAppManager().get(DesktopCreatorManager).removeFromProjectList(project.localPath),
        },
      ];
    },
    async openRenameDialog(project: LocalProjectInitInfo){
      await this.$getAppManager().get(DialogManager).show(ProjectRenameDialog, {
        localPath: project.localPath,
        title: project.title ?? '',
      });
    },
    async openMoveDialog(project: LocalProjectInitInfo){
      await this.$getAppManager().get(DialogManager).show(ProjectMoveDialog, {
        localPath: project.localPath,
      });
    },
    async openProject(project: LocalProjectInitInfo){
      await this.$getAppManager().get(DesktopCreatorManager).openProjectWindow(project.localPath);
    }
  }
});
</script>
<style lang="scss">
.RecentlyOpened {
  max-width: 200px;
  width: 100%;
  padding: 10px;
  max-height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  background-color: var(--app-menu-bg-color);
}
.RecentlyOpened-empty{
  display: none;
}
.RecentlyOpened-Item {
  display: flex;
  padding-bottom: 10px;
  align-items: center;
  &:not(:last-child) {
    border-bottom: 1px solid var(--local-border-color);
  }
}
.RecentlyOpened-Item-Project {
  width: 162px;
  cursor: pointer;
}
.RecentlyOpened-Item-Project-title,
.RecentlyOpened-Item-Project-subtext {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.RecentlyOpened-Item-Project-subtext {
  font-size: 12px;
  color: var(--local-sub-text-color)
}
</style>
