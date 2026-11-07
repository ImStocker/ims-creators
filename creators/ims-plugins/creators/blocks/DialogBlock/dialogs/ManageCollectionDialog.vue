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
          :is="dialog.state.filtersComponent"
          v-if="dialog.state.filtersComponent"
          v-model:filters="filters"
          class="ManageCollectionDialog-filters"
        />
        <div class="ManageCollectionDialog-groups tiny-scrollbars">
          <section
            v-for="group of groups"
            :key="group.assetId"
            class="ManageCollectionDialog-group"
          >
            <div class="ManageCollectionDialog-group-header">
              <div class="ManageCollectionDialog-group-title">
                {{ group.title }}
              </div>
              <div
                v-if="group.loading"
                class="ManageCollectionDialog-groupSpinner loaderSpinner"
                role="status"
                :aria-label="$t('common.loading')"
              />
            </div>
            <div
              v-if="group.error"
              class="ManageCollectionDialog-groupError error-message-block"
            >
              {{ group.error }}
            </div>
            <component
              :is="dialog.state.viewComponent"
              v-model:filters="filters"
              :collection-controller="group.controller"
              :show-filters="false"
              :add-caption="createButtonCaption"
              :add-disabled="!group.controller"
              embedded
              v-bind="dialog.state.viewComponentProps"
              @add="addEntity(group)"
            />
          </section>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="Form-row-buttons">
        <div class="Form-row-buttons-center use-buttons-action">
          <button
            type="button"
            class="is-button accent"
            :class="{ loading: !saveDone }"
            :disabled="anyGroupLoading"
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
import { defineComponent, reactive, type Component, type PropType } from 'vue';
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
import { assert } from '~ims-app-base/logic/utils/typeUtils';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import ProjectManager from '~ims-app-base/logic/managers/ProjectManager';

type DialogProps = {
  header: string;
  createButtonCaption:
    | string
    | ((state: { filters: Record<string, any> }) => string);
  createEntityInitalVals?: (state: {
    filters: Record<string, any>;
  }) => Record<string, any>;
  dialogController: DialogBlockController;
  projectContext: IProjectContext;
  getCollectionController: (
    dialogController: DialogBlockController,
  ) => IDialogCollectionController;
  viewComponent: Component;
  viewComponentProps?: Record<string, any>;
  filtersComponent?: Component;
  initialFilters?: Record<string, any>;
};

type DialogResult = void;

type CollectionGroup = {
  assetId: string;
  controllerAssetId: string;
  title: string;
  controller: IDialogCollectionController | null;
  externalAssetBlockEditor: AssetBlockEditorVM | null;
  isLocalCopy: boolean;
  loading: boolean;
  error: string | null;
};

export default defineComponent({
  name: 'ManageCollectionDialog',
  components: {
    DialogContent,
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
      groups: [] as CollectionGroup[],
      dialogLoadDone: false,
      dialogLoadingError: null as string | null,
      saveDone: true,
      creatingGroupAssetId: null as string | null,
      filters: this.dialog.state.initialFilters
        ? { ...this.dialog.state.initialFilters }
        : ({} as Record<string, any>),
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
    createButtonCaption() {
      if (typeof this.dialog.state.createButtonCaption === 'function') {
        return this.dialog.state.createButtonCaption({ filters: this.filters });
      } else return this.dialog.state.createButtonCaption;
    },
    anyGroupLoading() {
      return this.groups.some((group) => group.loading);
    },
  },
  async mounted() {
    await this.loadDialog();
  },
  methods: {
    async save() {
      if (!this.resolvedBlock) {
        return;
      }

      this.saveDone = false;
      await this.saveExternalEditors();
      this.$getAppManager()
        .get(CreatorAssetManager)
        .getAssetInstance(this.resolvedBlock.assetId, true);
      this.saveDone = true;
      this.dialog.close();
    },

    async addEntity(group: CollectionGroup) {
      if (
        this.creatingGroupAssetId ||
        group.loading ||
        group.error ||
        !group.controller
      ) {
        return;
      }
      this.creatingGroupAssetId = group.assetId;
      await this.$getAppManager()
        .get(UiManager)
        .doTask(async () => {
          if (group.assetId === SCRIPT_ASSET_ID && !group.isLocalCopy) {
            const base_asset = await this.$getAppManager()
              .get(CreatorAssetManager)
              .getAssetInstance(group.controllerAssetId);
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
              const local_copy = await this.createGroup(result.ids[0]);
              if (!local_copy) return;
              group.controller = local_copy.controller;
              group.externalAssetBlockEditor =
                local_copy.externalAssetBlockEditor;
              group.controllerAssetId = local_copy.controllerAssetId;
              group.isLocalCopy = true;
            }
          }
          const controller = group.controller;
          if (!controller) return;
          const new_entity = await controller.createEntity(
            this.dialog.state.createEntityInitalVals
              ? this.dialog.state.createEntityInitalVals({
                  filters: this.filters,
                })
              : {},
          );

          if (!new_entity) return;
          controller.addEntity(new_entity);
        });
      this.creatingGroupAssetId = null;
    },

    async saveExternalEditors() {
      for (const group of this.groups) {
        if (!group.externalAssetBlockEditor) continue;
        await group.externalAssetBlockEditor.saveChanges();
        this.$getAppManager()
          .get(CreatorAssetManager)
          .getAssetInstance(group.controllerAssetId, true);
      }
    },

    async createGroup(
      asset_id: string,
      asset_short?: AssetShort,
    ): Promise<CollectionGroup | null> {
      const resolvedBlock = this.resolvedBlock;
      if (!resolvedBlock) {
        return null;
      }

      if (asset_id === resolvedBlock.assetId) {
        return {
          assetId: asset_id,
          controllerAssetId: asset_id,
          title: this.$t('imsDialogEditor.var.currentScript'),
          controller: this.dialog.state.getCollectionController(
            this.dialogController,
          ),
          externalAssetBlockEditor: null,
          isLocalCopy: false,
          loading: false,
          error: null,
        };
      }

      const asset_full = await this.$getAppManager()
        .get(CreatorAssetManager)
        .getAssetInstance(asset_id);
      if (!asset_full) return null;
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
                (b.name ? b.name === resolvedBlock.name : false) ||
                b.id === resolvedBlock.id,
            ) ?? null,
      );
      controller.postCreate();
      controller.mountEditor(asset_block_editor);

      return {
        assetId: asset_id,
        controllerAssetId: asset_id,
        title: this.getGroupTitle(asset_id, asset_short),
        controller: this.dialog.state.getCollectionController(controller),
        externalAssetBlockEditor: asset_block_editor,
        isLocalCopy: false,
        loading: false,
        error: null,
      };
    },

    getGroupTitle(asset_id: string, asset_short?: AssetShort) {
      if (asset_id === SCRIPT_ASSET_ID) {
        return this.$t('imsDialogEditor.var.baseScript');
      }
      return this.$t('imsDialogEditor.var.ofScript', {
        script: convertTranslatedTitle(asset_short?.title ?? '', (key: any) =>
          this.$t(key),
        ),
      });
    },

    createGroupPlaceholder(asset_id: string, title: string): CollectionGroup {
      // reactive(): заглушка должна лежать в this.groups как прокси,
      // иначе мутации полей в initGroup() (raw-объект) не триггеры ререндер
      return reactive({
        assetId: asset_id,
        controllerAssetId: asset_id,
        title,
        controller: null,
        externalAssetBlockEditor: null,
        isLocalCopy: false,
        loading: true,
        error: null,
      });
    },

    async initGroup(group: CollectionGroup, asset_short?: AssetShort) {
      try {
        const full_group = await this.createGroup(group.assetId, asset_short);
        if (!full_group) {
          group.error = this.$t('common.downloadError');
          return;
        }
        group.controller = full_group.controller;
        group.controllerAssetId = full_group.controllerAssetId;
        group.externalAssetBlockEditor = full_group.externalAssetBlockEditor;
        group.isLocalCopy = full_group.isLocalCopy;
      } catch {
        group.error = this.$t('common.downloadError');
      } finally {
        group.loading = false;
      }
    },

    async loadDialog() {
      try {
        assert(this.resolvedBlock?.assetId);

        // Phase A (behind the global dialog spinner): resolve group titles
        const current_group = this.createGroupPlaceholder(
          this.resolvedBlock.assetId,
          this.$t('imsDialogEditor.var.currentScript'),
        );
        this.groups.push(current_group);
        await this.initGroup(current_group);

        const asset_short = await this.$getAppManager()
          .get(CreatorAssetManager)
          .getAssetShortViaCache(this.resolvedBlock.assetId);
        const type_ids = asset_short ? [...asset_short.typeIds].reverse() : [];
        const parent_shorts = await Promise.all(
          type_ids.map((type_id) =>
            this.$getAppManager()
              .get(CreatorAssetManager)
              .getAssetShortViaCache(type_id),
          ),
        );
        const pending_groups: {
          group: CollectionGroup;
          short: AssetShort;
        }[] = [];
        type_ids.forEach((type_id, index) => {
          const parent_short = parent_shorts[index];
          if (!parent_short) return;
          const group = this.createGroupPlaceholder(
            type_id,
            this.getGroupTitle(type_id, parent_short),
          );
          this.groups.push(group);
          pending_groups.push({ group, short: parent_short });
        });

        this.dialogLoadDone = true;

        // Phase B: heavy per-group controller initialization, in parallel
        await Promise.all(
          pending_groups.map(({ group, short }) =>
            this.initGroup(group, short),
          ),
        );
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
@use '~ims-app-base/style/devices-mixins';

.ManageCollectionDialog {
  max-width: 100%;
  width: 750px;
  height: 80vh;
  display: flex;
  flex-direction: column;

  :deep(.Dialog-content) {
    flex: 1;
    min-height: 0;
    margin-bottom: 20px;
  }

  @include devices-mixins.device-type(not-pc) {
  }
}
.ManageCollectionDialog-list {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.ManageCollectionDialog-filters {
  flex-shrink: 0;
  padding-bottom: 10px;
}
.ManageCollectionDialog-groups {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.ManageCollectionDialog-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ManageCollectionDialog-group-header {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ManageCollectionDialog-group-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}
.ManageCollectionDialog-groupSpinner {
  flex-shrink: 0;
  font-size: 14px;
}
</style>
