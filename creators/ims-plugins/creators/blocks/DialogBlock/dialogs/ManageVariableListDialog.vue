<template>
  <dialog-content
    class="ManageVariableListDialog"
    :loading="!dialogLoadDone"
    :loading-error="dialogLoadingError"
  >
    <div class="Dialog-header">
      {{ $t('imsDialogEditor.var.manageVariables') }}
    </div>
    <div class="Dialog-body ManageVariableListDialog-content">
      <value-switcher
        v-if="currentAssetId && tabs.length > 1"
        v-model="currentAssetId"
        class="ManageVariableListDialog-tabs"
        :options="tabs"
        label-prop="title"
        value-prop="id"
      ></value-switcher>
      <div class="ManageVariableListDialog-list">
        <variable-list
          v-if="variableController && !controllerLoading"
          :variable-controller="variableController"
        ></variable-list>
        <div
          v-else-if="controllerLoading"
          class="ManageVariableListDialog-loading"
        >
          <div class="loaderSpinner"></div>
        </div>
      </div>
    </div>
    <div class="Form-row-buttons">
      <div class="Form-row-buttons-center use-buttons-action">
        <button
          type="button"
          class="is-button"
          :class="{ loading: creationLoading }"
          @click="addVariable"
        >
          {{ $t('imsDialogEditor.var.createVariable') }}
        </button>
        <button
          type="button"
          class="is-button accent ManageVariableListDialog-button-ok"
          @click="save"
        >
          {{ $t('common.dialogs.close') }}
        </button>
      </div>
    </div>
  </dialog-content>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import DialogContent from '~ims-app-base/components/Dialog/DialogContent.vue';
import type { DialogInterface } from '~ims-app-base/logic/managers/DialogManager';
import {
  DialogBlockController,
  type DialogVariable,
} from '../editor/DialogBlockController';
import VariableList from './VariableList.vue';
import { nodeVariableAdd } from '../logic/nodeVariables';
import type { IProjectContext } from '~ims-app-base/logic/types/IProjectContext';
import ValueSwitcher from '~ims-app-base/components/Common/ValueSwitcher.vue';
import CreatorAssetManager from '~ims-app-base/logic/managers/CreatorAssetManager';
import type { AssetShort } from '~ims-app-base/logic/types/AssetsType';
import { convertTranslatedTitle } from '~ims-app-base/logic/utils/assets';
import { SCRIPT_ASSET_ID } from '~ims-app-base/logic/constants';
import type { IDialogVariableController } from '../editor/DialogVariableController';
import { AssetBlockEditorVM } from '~ims-app-base/logic/vm/AssetBlockEditorVM';
import { assert } from '~ims-app-base/logic/utils/typeUtils';

import ProjectManager from '~ims-app-base/logic/managers/ProjectManager';
import UiManager from '../../../../../../ims-app-base/app/logic/managers/UiManager';

type DialogProps = {
  dialogController: DialogBlockController;
  projectContext: IProjectContext;
};

type DialogResult = void;

function getVariableController(dialogController: DialogBlockController) {
  return {
    getVariables: () => dialogController.getOwnVariables(),
    addVariable: (variable: DialogVariable) =>
      dialogController.addVariable(variable),
    changeVariable: (variable_name: string, variable: DialogVariable) =>
      dialogController.changeVariable(variable_name, variable),
    deleteVariable: (variable_name: string) =>
      dialogController.deleteVariable(variable_name),
    canDeleteVariable: (variable_name: string) =>
      dialogController.canDeleteVariable(variable_name),
    reorderVariables: (variables: DialogVariable[]) =>
      dialogController.reorderVariables(variables),
  };
}

export default defineComponent({
  name: 'ManageVariableListDialog',
  components: {
    DialogContent,
    VariableList,
    ValueSwitcher,
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
      variableController: null as null | IDialogVariableController,
      dialogLoadDone: false,
      dialogLoadingError: null as string | null,
      creationLoading: false,
      controllerLoading: false,
      externalAssetBlockEditor: null as null | AssetBlockEditorVM,
      needSaveBlockIds: [] as string[],
    };
  },
  computed: {
    projectInfo() {
      return this.$getAppManager().get(ProjectManager).getProjectInfo();
    },
    variableList() {
      return this.variableController?.getVariables() ?? [];
    },
    dialogController() {
      return this.dialog.state.dialogController;
    },
    resolvedBlock() {
      return this.dialogController.resolvedBlock;
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
        await this.createVariableController(this.currentAssetId);
      }
    },
  },
  async mounted() {
    await this.loadDialog();
  },
  methods: {
    async createVariableController(asset_id: string) {
      this.controllerLoading = true;
      if (asset_id === this.resolvedBlock.assetId) {
        this.variableController = getVariableController(this.dialogController);
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
        this.variableController = getVariableController(controller);
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
        this.createVariableController(this.resolvedBlock.assetId);
      } catch (err: any) {
        this.dialogLoadingError = err;
      } finally {
        this.dialogLoadDone = true;
      }
    },
    save() {
      this.externalAssetBlockEditor?.saveChanges();
      this.$getAppManager()
        .get(CreatorAssetManager)
        .getAssetInstance(this.resolvedBlock.assetId, true);
      this.dialog.close();
    },
    async addVariable() {
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
              await this.createVariableController(result.ids[0]);
            }
          }
          const new_variable = await nodeVariableAdd(
            this.$getAppManager(),
            this.variableList,
            {
              alreadyExist: this.$t(
                'imsDialogEditor.var.variableAlreadyExists',
              ),
            },
          );
          if (!new_variable) return;
          this.variableController?.addVariable(new_variable);
        });
      this.creationLoading = false;
    },
  },
});
</script>

<style lang="scss" rel="stylesheet/scss" scoped>
@use '~ims-app-base/style/Form';

.ManageVariableListDialog-row {
  display: flex;
  gap: 5px;
  align-items: center;
  margin-bottom: 5px;
}

.ManageVariableListDialog-empty {
  margin-bottom: 20px;
}

.ManageVariableListDialog-empty {
  text-align: center;
}

.ManageVariableListDialog {
  width: 700px;
}
.ManageVariableListDialog-tabs {
  --ValueSwitcher-border-radius: 8px;
  margin-bottom: 10px;
}
.ManageVariableListDialog-loading {
  margin-bottom: 20px;
}
</style>
