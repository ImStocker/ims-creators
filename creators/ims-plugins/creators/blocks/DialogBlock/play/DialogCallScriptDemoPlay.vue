<template>
  <div class="DialogCallScriptDemoPlay">
    <div class="DialogCallScriptDemoPlay-content">
      <div class="DialogCallScriptDemoPlay-asset">
        <div class="DialogCallScriptDemoPlay-asset-header">
          <i class="ri-file-paper-2-line"></i>
        </div>
        <div v-if="callScript" class="DialogCallScriptDemoPlay-asset-value">
          {{ callScript.Title }}
        </div>
      </div>
    </div>
    <div v-if="loading" class="DialogCallScriptDemoPlay-loading">
      <div class="loaderSpinner"></div>
    </div>
    <div
      v-else-if="inputParameters.length > 0 || outputParameters.length > 0"
      class="DialogCallScriptDemoPlay-parameters"
    >
      <div
        v-for="param_gr of parametersGrid"
        :key="(param_gr.isOutput ? 'out-' : 'in-') + param_gr.variable.name"
        class="DialogCallScriptDemoPlay-parameters-one"
        :class="param_gr.isOutput ? 'type-output' : 'type-input'"
      >
        <div class="DialogCallScriptDemoPlay-parameters-one-caption">
          <caption-string :value="param_gr.variable.title"></caption-string>
        </div>
        <div class="DialogCallScriptDemoPlay-parameters-one-field">
          <data-field-input
            v-if="param_gr.isOutput"
            :data-type="param_gr.variable.type ?? StringAssetPropType"
            :model-value="
              dialogPlayer.playGetCurrentNodeParam(param_gr.variable.name)
            "
            :title="param_gr.variable.description ?? ''"
            @update:model-value="
              dialogPlayer.playSetCurrentNodeParam(
                param_gr.variable.name,
                $event,
              )
            "
          ></data-field-input>
          <data-field-display
            v-else
            :data-type="param_gr.variable.type"
            :model-value="
              playingNodeData?.inputs
                ? playingNodeData?.inputs[param_gr.variable.name]
                : null
            "
            :title="param_gr.variable.description ?? ''"
          ></data-field-display>
        </div>
      </div>
    </div>
    <div class="DialogCallScriptDemoPlay-options">
      <button
        class="PlayerDemoDialog-option-button"
        @click="dialogPlayer.playChoose(null)"
      >
        {{ $t('imsDialogEditor.play.continue') }}
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { ScriptPlayNode } from './ScriptPlayNode';
import type { DialogPlayer } from './DialogPlayer';
import type {
  DialogBlockController,
  DialogVariable,
} from '../editor/DialogBlockController';
import DataFieldInput from '../parts/DataFieldInput.vue';
import DataFieldDisplay from '../parts/DataFieldDisplay.vue';
import CaptionString from '~ims-app-base/components/Common/CaptionString.vue';
import {
  AssetPropType,
  castAssetPropValueToAsset,
  type AssetPropValue,
} from '~ims-app-base/logic/types/Props';
import { getCallScriptNodeParams } from '../logic/nodeParams';
import { loadCallScriptController } from '../logic/callScriptLoader';
import UiManager from '~ims-app-base/logic/managers/UiManager';

export default defineComponent({
  name: 'DialogCallScriptDemoPlay',
  components: { DataFieldDisplay, DataFieldInput, CaptionString },
  props: {
    playingNodeData: {
      type: Object as PropType<ScriptPlayNode>,
      required: true,
    },
    dialogPlayer: {
      type: Object as PropType<DialogPlayer>,
      required: true,
    },
    dialogController: {
      type: Object as PropType<DialogBlockController>,
      required: true,
    },
  },
  data() {
    return {
      callScriptController: null as null | DialogBlockController,
      loading: false,
      error: null as any,
    };
  },
  computed: {
    StringAssetPropType() {
      return {
        Type: AssetPropType.STRING,
      };
    },
    callScript() {
      return this.playingNodeData.subject
        ? castAssetPropValueToAsset(
            this.playingNodeData.subject as AssetPropValue,
          )
        : null;
    },
    callScriptNodeParams() {
      return getCallScriptNodeParams(
        (this.playingNodeData.node as any).params ?? { in: [], out: [] },
        this.callScriptController as DialogBlockController | null,
        (this.playingNodeData.node as any).values,
      );
    },
    inputParameters(): DialogVariable[] {
      return this.callScriptNodeParams.inputParameters;
    },
    outputParameters(): DialogVariable[] {
      return this.callScriptNodeParams.outputParameters;
    },
    parametersGrid(): {
      variable: DialogVariable;
      isOutput: boolean;
      index: number;
    }[] {
      const res: {
        variable: DialogVariable;
        isOutput: boolean;
        index: number;
      }[] = [];
      for (
        let i = 0;
        i < Math.max(this.inputParameters.length, this.outputParameters.length);
        i++
      ) {
        if (i < this.inputParameters.length) {
          res.push({
            variable: this.inputParameters[i],
            isOutput: false,
            index: i,
          });
        }
        if (i < this.outputParameters.length) {
          res.push({
            variable: this.outputParameters[i],
            isOutput: true,
            index: i,
          });
        }
      }
      return res;
    },
  },
  watch: {
    async callScript() {
      await this.loadCallScript();
    },
  },
  async mounted() {
    await this.loadCallScript();
  },
  methods: {
    async loadCallScript() {
      if (!this.callScript) return;
      this.loading = true;
      try {
        this.callScriptController = await loadCallScriptController(
          this.$getAppManager(),
          this.callScript.AssetId,
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
.DialogCallScriptDemoPlay-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}
.DialogCallScriptDemoPlay-prop-line-caption,
.DialogCallScriptDemoPlay-options-one-param-caption {
  font-weight: bold;
  font-size: 12px;
  color: var(--local-sub-text-color);
}
.DialogCallScriptDemoPlay-content {
  margin-bottom: 20px;
}
.DialogCallScriptDemoPlay-options-one {
  &.state-unavailable {
    opacity: 0.5;
  }
}
.DialogCallScriptDemoPlay-asset {
  text-align: center;
}
.DialogCallScriptDemoPlay-asset-header {
  font-size: 24px;
  color: #afc8ff;
}

.DialogCallScriptDemoPlay-parameters {
  display: grid;
  gap: 10px;
  align-items: center;
  border-top: 1px solid var(--imsde-node-content-inner-border-color);
  margin-bottom: 20px;
}

.DialogCallScriptDemoPlay-parameters-one {
  margin-bottom: 5px;
  &.type-input {
    grid-column: 1;
  }
  &.type-output {
    grid-column: 2;
    justify-self: flex-end;
  }
}
.DialogCallScriptDemoPlay-parameters-one-caption {
  font-weight: bold;
  font-size: 12px;
  color: var(--local-sub-text-color);
}
</style>
