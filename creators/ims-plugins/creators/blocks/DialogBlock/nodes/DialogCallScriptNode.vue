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
            :model-value="callScriptForSelection"
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
        :play-wait-user="false"
        :output-params="outputParameters"
        :input-params="inputParameters"
        :playing-node-data="playingNodeData"
      ></node-parameters-grid>
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { NodeDescriptor } from './NodeDescriptor';
import type { NodeDataController } from '../editor/NodeDataController';
import type {
  DialogBlockController,
  DialogVariable,
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
import { generateDataPinId } from '../editor/DialogEditor';
import {
  castAssetPropValueToAsset,
  type AssetPropValueAsset,
} from '~ims-app-base/logic/types/Props';

import { loadCallScriptController } from '../logic/callScriptLoader';
import { getCallScriptNodeParams } from '../logic/nodeParams';
import NodeParametersGrid from '../parts/NodeParametersGrid.vue';
import UiManager from '~ims-app-base/logic/managers/UiManager';

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
    };
  },
  computed: {
    callScriptNodeParams() {
      return getCallScriptNodeParams(
        this.nodeDataController.params,
        this.calledScriptController as DialogBlockController | null,
        this.nodeDataController.values,
      );
    },
    inputParameters(): DialogVariable[] {
      return this.callScriptNodeParams.inputParameters;
    },
    outputParameters(): DialogVariable[] {
      return this.callScriptNodeParams.outputParameters;
    },
    callScriptForSelection() {
      if (!this.callScript) return null;
      return {
        id: this.callScript.AssetId,
        name: this.callScript.Name,
        title: this.callScript.Title,
        icon: null,
      };
    },
    callScript: {
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
    callScript: {
      async handler(val: AssetPropValueAsset | null) {
        if (val) {
          await this.loadExternalScript(val);
        } else {
          this.callScript = null;
          this.calledScriptController = null;
        }
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
      this.callScript = val
        ? {
            AssetId: val.id,
            Title: val.title ?? '',
            Name: val.name,
          }
        : null;
    },
    async loadExternalScript(val: AssetPropValueAsset) {
      this.loading = true;
      try {
        this.calledScriptController = await loadCallScriptController(
          this.$getAppManager(),
          val.AssetId,
        );
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
.DialogCallScriptNode-play {
  text-align: center;
  padding-top: 10px;
  padding-bottom: 10px;
  border-top: 1px solid var(--imsde-node-playing-color);
  & > .is-button {
    --button-border-color: var(--imsde-node-playing-color);
    &:not(:hover) {
      --button-text-color: var(--imsde-node-playing-color);
    }
    &:hover {
      --button-bg-color: var(--imsde-node-playing-color);
    }
  }
}
</style>
