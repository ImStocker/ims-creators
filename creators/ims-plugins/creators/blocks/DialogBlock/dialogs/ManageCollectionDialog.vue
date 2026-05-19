<template>
  <dialog-content
    class="ManageCollectionDialog"
    :loading="!dialogLoadDone"
    :loading-error="dialogLoadingError"
  >
    <template #header>{{ dialog.state.header }}</template>
    <template #content>
      <div class="ManageCollectionDialog-list">
        <component
          :is="dialog.state.viewComponent"
          v-if="collectionController && !controllerLoading"
          :collection-controller="collectionController"
          v-bind="dialog.state.viewComponentProps"
        >
          <template #prepend-filters>
            <ims-select
              v-if="currentAssetId && tabs.length > 1"
              v-model="currentAssetId"
              class="ManageCollectionDialog-assets"
              :options="tabs"
              label-prop="title"
              value-prop="id"
              :reduce="(opt) => opt.id"
            ></ims-select>
          </template>
        </component>
        <div
          v-else-if="controllerLoading"
          class="ManageCollectionDialog-loading"
        >
          <div class="loaderSpinner"></div>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="Form-row-buttons">
        <div class="Form-row-buttons-center use-buttons-action">
          <button
            type="button"
            class="is-button"
            :class="{ loading: creationLoading }"
            @click="addEntity"
          >
            {{ dialog.state.createButtonCaption }}
          </button>
          <button
            type="button"
            class="is-button accent"
            :class="{ loading: !saveDone }"
            @click="save"
          >
            {{ $t('common.dialogs.close') }}
          </button>
        </div>
      </div>
    </template>
  </dialog-content>
</template>
<script lang="ts">
import { defineComponent, type Component, type PropType } from 'vue';
import DialogContent from '~ims-app-base/components/Dialog/DialogContent.vue';
import type { IProjectContext } from '~ims-app-base/logic/types/IProjectContext';
import { DialogBlockController } from '../editor/DialogBlockController';
import type { DialogInterface } from '~ims-app-base/logic/managers/DialogManager';
import { SCRIPT_ASSET_ID } from '~ims-app-base/logic/constants';
import { convertTranslatedTitle } from '~ims-app-base/logic/utils/assets';
import CreatorAssetManager from '~ims-app-base/logic/managers/CreatorAssetManager';
import type { AssetShort } from '~ims-app-base/logic/types/AssetsType';
import { AssetBlockEditorVM } from '~ims-app-base/logic/vm/AssetBlockEditorVM';
import type { IDialogCollectionController } from '../editor/DialogVariableController';
import ValueSwitcher from '~ims-app-base/components/Common/ValueSwitcher.vue';
import { assert } from '~ims-app-base/logic/utils/typeUtils';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import ProjectManager from '~ims-app-base/logic/managers/ProjectManager';
import ImsSelect from '~ims-app-base/components/Common/ImsSelect.vue';
import FormSearch from '~ims-app-base/components/Form/FormSearch.vue';

type DialogProps = {
  header: string;
  createButtonCaption: string;
  dialogController: DialogBlockController;
  projectContext: IProjectContext;
  getCollectionController: (
    dialogController: DialogBlockController,
  ) => IDialogCollectionController;
  viewComponent: Component;
  viewComponentProps?: Record<string, any>;
};

type DialogResult = void;

export default defineComponent({
  name: 'ManageCollectionDialog',
  components: {
    DialogContent,
    ValueSwitcher,
    ImsSelect,
    FormSearch,
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
  data() {
    return {
      parentAssetShorts: [] as AssetShort[],
      currentAssetId: null as string | null,
      collectionController: null as null | IDialogCollectionController,
      dialogLoadDone: false,
      dialogLoadingError: null as string | null,
      externalAssetBlockEditor: null as null | AssetBlockEditorVM,
      saveDone: true,
      creationLoading: false,
      controllerLoading: false,
      needSaveBlockIds: [] as string[],
    };
  },
  computed: {
    projectInfo() {
      return this.$getAppManager().get(ProjectManager).getProjectInfo();
    },
    resolvedBlock() {
      return this.dialogController.resolvedBlock;
    },
    dialogController() {
      return this.dialog.state.dialogController;
    },
    tabs() {
      const default_option = {
        id: this.resolvedBlock.assetId,
        title: this.$t('imsDialogEditor.var.currentScript'),
      };

      const res = [default_option];
      for (const p_asset of this.parentAssetShorts) {
        res.push({
          id: p_asset.id,
          title:
            p_asset.id === SCRIPT_ASSET_ID
              ? this.$t('imsDialogEditor.var.baseScript')
              : convertTranslatedTitle(p_asset.title ?? '', (key: any) =>
                  this.$t(key),
                ),
        });
      }

      return res;
    },
  },
  watch: {
    async currentAssetId() {
      if (this.currentAssetId) {
        this.externalAssetBlockEditor?.saveChanges();
        this.$getAppManager()
          .get(CreatorAssetManager)
          .getAssetInstance(this.resolvedBlock.assetId, true);
        await this.createCollectionController(this.currentAssetId);
      }
    },
  },
  async mounted() {
    await this.loadDialog();
  },
  methods: {
    async save() {
      this.saveDone = false;
      await this.externalAssetBlockEditor?.saveChanges();
      this.$getAppManager()
        .get(CreatorAssetManager)
        .getAssetInstance(this.resolvedBlock.assetId, true);
      this.saveDone = true;
      this.dialog.close();
    },

    async addEntity() {
      this.creationLoading = true;
      await this.$getAppManager()
        .get(UiManager)
        .doTask(async () => {
          if (this.currentAssetId === SCRIPT_ASSET_ID) {
            const base_asset = await this.$getAppManager()
              .get(CreatorAssetManager)
              .getAssetInstance(this.currentAssetId);
            if (!base_asset) return;
            if (base_asset.projectId !== this.projectInfo?.id) {
              let target_workspace_id: string | null = null;
              const base_workspace = base_asset.workspaceId
                ? ((
                    await this.$getAppManager()
                      .get(CreatorAssetManager)
                      .getWorkspacesList({
                        where: {
                          ids: [base_asset.workspaceId],
                          isSystem: true,
                        },
                      })
                  ).list[0] ?? null)
                : null;

              if (base_workspace && base_workspace.name) {
                target_workspace_id = this.$getAppManager()
                  .get(ProjectManager)
                  .getWorkspaceIdByName(base_workspace.name);
              }

              if (!target_workspace_id) {
                target_workspace_id = this.$getAppManager()
                  .get(ProjectManager)
                  .getWorkspaceIdByName('settings');
              }
              const result = await this.$getAppManager()
                .get(CreatorAssetManager)
                .createAsset({
                  id: base_asset.id,
                  set: {
                    title: base_asset.ownTitle ?? undefined,
                    parentIds: base_asset.parentIds,
                    name: base_asset.name ?? undefined,
                    icon: base_asset.ownIcon ?? undefined,
                    workspaceId: target_workspace_id,
                    isAbstract: base_asset.isAbstract,
                  },
                });
              await this.createCollectionController(result.ids[0]);
            }
          }
          const new_variable = await this.collectionController?.createEntity();

          if (!new_variable) return;
          this.collectionController?.addEntity(new_variable);
        });
      this.creationLoading = false;
    },
    async createCollectionController(asset_id: string) {
      this.controllerLoading = true;
      if (asset_id === this.resolvedBlock.assetId) {
        this.collectionController = this.dialog.state.getCollectionController(
          this.dialogController,
        );
      } else {
        const asset_full = await this.$getAppManager()
          .get(CreatorAssetManager)
          .getAssetInstance(asset_id);
        if (!asset_full) return;
        asset_full.activate();
        const asset_block_editor = AssetBlockEditorVM.CreateInstance(
          this.$getAppManager(),
          asset_full,
        );
        const controller = new DialogBlockController(
          this.$getAppManager(),
          () =>
            asset_block_editor
              .resolveBlocks()
              .list.find(
                (b) =>
                  (b.name ? b.name === this.resolvedBlock.name : false) ||
                  b.id === this.resolvedBlock.id,
              ) ?? null,
        );
        controller.postCreate();

        controller.mountEditor(asset_block_editor);
        this.externalAssetBlockEditor = asset_block_editor as any;
        this.collectionController =
          this.dialog.state.getCollectionController(controller);
      }
      this.controllerLoading = false;
    },
    async loadDialog() {
      try {
        assert(this.resolvedBlock.assetId);
        this.currentAssetId = this.resolvedBlock.assetId;
        const asset_short = await this.$getAppManager()
          .get(CreatorAssetManager)
          .getAssetShortViaCache(this.resolvedBlock.assetId);
        assert(asset_short);
        const parent_assets: AssetShort[] = [];
        for (const type_id of asset_short.typeIds) {
          const parent_asset = await this.$getAppManager()
            .get(CreatorAssetManager)
            .getAssetShortViaCache(type_id);
          if (!parent_asset) continue;
          parent_assets.push(parent_asset);
        }
        this.parentAssetShorts = parent_assets;
        this.createCollectionController(this.resolvedBlock.assetId);
      } catch (err: any) {
        this.dialogLoadingError = err;
      } finally {
        this.dialogLoadDone = true;
      }
    },
  },
});
</script>
<style lang="scss" scoped>
.ManageCollectionDialog {
  width: 750px;
  height: 70vh;
  display: flex;
  flex-direction: column;

  :deep(.Dialog-content) {
    flex: 1;
    min-height: 0;
    margin-bottom: 20px;
  }
}
.ManageCollectionDialog-list {
  height: 100%;
}
.ManageCollectionDialog-filters {
  display: flex;
  align-items: center;
}
.ManageCollectionDialog-assets {
  min-width: 180px;
  flex-shrink: 0;
}
.ManageCollectionDialog-loading {
  margin-bottom: 20px;
}
</style>
