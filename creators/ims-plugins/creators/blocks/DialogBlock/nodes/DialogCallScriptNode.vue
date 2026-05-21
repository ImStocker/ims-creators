<template>
  <div class="DialogCallScriptNode DialogEditorNode">
    <div
      class="DialogCallScriptNode-header DialogNode-header DialogEditorNode-header"
      :title="$t(`imsDialogEditor.nodes.${nodeDescriptor.name}.description`)"
    >
      <i :class="nodeDescriptor.icon"></i>
      {{ $t(`imsDialogEditor.nodes.${nodeDescriptor.name}.title`) }}
    </div>
    <div class="DialogCallScriptNode-body DialogEditorNode-body">
      <div v-if="loading" class="DialogCallScriptNode-loading">
        <div class="loaderSpinner"></div>
      </div>
      <div class="DialogCallScriptNode-body-main">
        <ExecHandle id="in" type="target" :position="Position.Left" />
        <div class="DialogCallScriptNode-content">
          <select-asset-combo-box
            class="VariableTypeSelector-selectAsset"
            :model-value="externalScriptForSelection"
            :where="selectAssetWhere"
            @update:model-value="selectExternalAsset"
          >
          </select-asset-combo-box>
        </div>
        <ExecHandle id="out" type="source" :position="Position.Right" />
      </div>
      <node-parameters-grid
        :dialog-player="dialogPlayer"
        :node-data-controller="nodeDataController"
        :readonly="readonly"
        :output-params="outputParameters"
        :input-params="inputParameters"
        :playing-node-data="playingNodeData"
        :wrong-parameter-names="wrongParameterNames"
      ></node-parameters-grid>
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { NodeDescriptor } from './NodeDescriptor';
import type { NodeDataController } from '../editor/NodeDataController';
import {
  DialogBlockController,
  type DialogVariable,
} from '../editor/DialogBlockController';
import type { ScriptPlayNode } from '../play/ScriptPlayNode';
import type { DialogPlayer } from '../play/DialogPlayer';
import type { ScriptBlockPlainPropValue } from '../logic/nodeStoring';
import { Position } from '@vue-flow/core';
import ExecHandle from '../parts/ExecHandle.vue';
import SelectAssetComboBox from '~ims-app-base/components/Asset/SelectAssetComboBox.vue';
import ProjectManager from '~ims-app-base/logic/managers/ProjectManager';
import type { AssetPropWhere } from '~ims-app-base/logic/types/PropsWhere';
import { SCRIPT_ASSET_ID } from '~ims-app-base/logic/constants';
import type { AssetForSelection } from '~ims-app-base/logic/types/AssetsType';
import CreatorAssetManager from '~ims-app-base/logic/managers/CreatorAssetManager';
import { AssetBlockEditorVM } from '~ims-app-base/logic/vm/AssetBlockEditorVM';
import { generateDataPinId } from '../editor/DialogEditor';
import {
  castAssetPropValueToAsset,
  type AssetPropValueAsset,
} from '~ims-app-base/logic/types/Props';

import UiManager from '~ims-app-base/logic/managers/UiManager';
import NodeParametersGrid from '../parts/NodeParametersGrid.vue';

export default defineComponent({
  name: 'DialogCallScriptNode',
  components: {
    ExecHandle,
    SelectAssetComboBox,
    NodeParametersGrid,
  },
  props: {
    id: {
      type: String,
      required: true,
    },
    nodeDescriptor: {
      type: Object as PropType<NodeDescriptor>,
      required: true,
    },
    nodeDataController: {
      type: Object as PropType<NodeDataController>,
      required: true,
    },
    selected: {
      type: Boolean,
      required: true,
    },
    dialogController: {
      type: Object as PropType<DialogBlockController>,
      required: true,
    },
    readonly: {
      type: Boolean,
      default: false,
    },
    playingNodeData: {
      type: [Object, null] as PropType<ScriptPlayNode> | null,
      default: null,
    },
    dialogPlayer: {
      type: Object as PropType<DialogPlayer>,
      required: true,
    },
  },
  data() {
    return {
      calledScript: null as AssetForSelection | null,
      calledScriptController: null as null | DialogBlockController,
      loading: false,
      wrongParameterNames: new Set<string>(),
    };
  },
  computed: {
    externalScriptForSelection() {
      if (!this.externalScript) return null;
      return {
        id: this.externalScript.AssetId,
        name: this.externalScript.Name,
        title: this.externalScript.Title,
        icon: null,
      };
    },
    externalScript: {
      get(): AssetPropValueAsset | null {
        return this.nodeDataController.subject
          ? castAssetPropValueToAsset(this.nodeDataController.subject)
          : null;
      },
      set(val: AssetPropValueAsset) {
        this.nodeDataController.setSubject(val);
      },
    },
    Position() {
      return Position;
    },
    inputParameters(): DialogVariable[] {
      const res: DialogVariable[] = [];

      if (this.calledScriptController) {
        const variables = this.calledScriptController.getVariables();
        const in_params = variables.filter(
          (el) => el.kind && ['in', 'in-out'].includes(el.kind),
        );
        if (in_params) {
          for (const param of in_params) {
            res.push(param);
            if (this.wrongParameterNames.has('in-' + param.name)) {
              this.wrongParameterNames.delete(param.name);
            }
          }
        }
      }
      if (this.nodeDataController.values) {
        for (const value of Object.keys(this.nodeDataController.values)) {
          if (
            !res.find((v) => v.name === value) &&
            this.nodeDataController.values[value] &&
            this.nodeDataController.values[value]['get']
          ) {
            res.push({
              name: value,
              title: value,
              default: null,
              description: null,
              type: null,
            });
            this.wrongParameterNames.add('in-' + value);
          }
        }
      }
      return res;
    },
    outputParameters(): DialogVariable[] {
      const res: DialogVariable[] = [];

      if (this.calledScriptController) {
        const variables = this.calledScriptController.getVariables();
        const out_params = Object.values(variables).filter(
          (el) => el.kind && ['out', 'in-out'].includes(el.kind),
        );
        if (out_params) {
          for (const param of out_params) {
            res.push(param);
            if (this.wrongParameterNames.has('out-' + param.name)) {
              this.wrongParameterNames.delete(param.name);
            }
          }
        }
      }
      return res;
    },
    selectAssetWhere(): AssetPropWhere {
      const res: AssetPropWhere = {
        workspaceids:
          this.$getAppManager()
            .get(ProjectManager)
            .getWorkspaceIdByName('gdd') ?? null,
        typeids: [SCRIPT_ASSET_ID],
      };
      return res;
    },
  },
  watch: {
    externalScript: {
      async handler(val: AssetPropValueAsset | null) {
        if (val) {
          await this.loadExternalScript(val);
        } else {
          this.externalScript = null;
          this.calledScriptController = null;
        }
        this.wrongParameterNames = new Set();
      },
      immediate: true,
    },
  },
  methods: {
    generateDataPinId,
    setParamValue(
      param: DialogVariable,
      is_out: boolean,
      val: ScriptBlockPlainPropValue,
    ) {
      if (is_out) return;
      this.nodeDataController.setValue(param.name, val);
    },
    selectExternalAsset(val: AssetForSelection | null) {
      this.externalScript = val
        ? {
            AssetId: val.id,
            Title: val.title ?? '',
            Name: val.name,
          }
        : null;
    },
    async loadExternalScript(val: AssetPropValueAsset) {
      try {
        this.loading = true;
        const asset_full = await this.$getAppManager()
          .get(CreatorAssetManager)
          .getAssetInstance(val.AssetId);
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
              .list.find((el) => el.name === 'content') ?? null,
        );
        controller.postCreate();
        controller.mountEditor(asset_block_editor);

        this.calledScriptController = controller;
      } catch (err: any) {
        this.$getAppManager().get(UiManager).showError(err);
      } finally {
        this.loading = false;
      }
    },
  },
});
</script>
<style lang="scss" scoped>
.DialogCallScriptNode-content {
  &:deep(.ImsSelect) {
    min-width: 150px;
  }
  &:not(:hover):deep(
      .DataField-in:not(.state-connected),
      .DataField-out:not(.state-connected)
    ) {
    opacity: 0;
  }
}
.DialogCallScriptNode-header {
  padding: 7px 10px;
  font-size: 14px;
}
.DialogCallScriptNode-body {
  position: relative;
}
.DialogCallScriptNode-loading {
  position: absolute;
  z-index: 2;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
}
.DialogCallScriptNode-body-main {
  padding: 7px 10px;
  position: relative;
  --local-text-color: var(--imsde-node-content-text-color);
  --input-text-color: var(--imsde-node-content-text-color);
}
</style>
