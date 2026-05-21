<template>
  <div class="DialogTriggerDemoPlay">
    <div class="DialogTriggerDemoPlay-content">
      <div class="DialogTriggerDemoPlay-trigger">
        <div class="DialogTriggerDemoPlay-trigger-header">
          <i class="ri-flashlight-line"></i>
        </div>
        <div class="DialogTriggerDemoPlay-trigger-value">
          {{ triggerVal }}
        </div>
      </div>
    </div>
    <div
      v-if="inputParameters.length > 0 || outputParameters.length > 0"
      class="DialogTriggerDemoPlay-parameters"
    >
      <div
        v-for="param_gr of parametersGrid"
        :key="(param_gr.isOutput ? 'out-' : 'in-') + param_gr.variable.name"
        class="DialogTriggerDemoPlay-parameters-one"
        :class="param_gr.isOutput ? 'type-output' : 'type-input'"
      >
        <div class="DialogTriggerDemoPlay-parameters-one-caption">
          <caption-string :value="param_gr.variable.title"></caption-string>
        </div>
        <div class="DialogTriggerDemoPlay-parameters-one-field">
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
              playingNodeData?.values
                ? playingNodeData?.values[param_gr.variable.name]
                : null
            "
            :title="param_gr.variable.description ?? ''"
          ></data-field-display>
        </div>
      </div>
    </div>
    <div class="DialogTriggerDemoPlay-options">
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
import { AssetPropType } from '~ims-app-base/logic/types/Props';
import { getActionNodeParams } from '../logic/nodeParams';

export default defineComponent({
  name: 'DialogTriggerDemoPlay',
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
  computed: {
    StringAssetPropType() {
      return {
        Type: AssetPropType.STRING,
      };
    },
    triggerVal() {
      return this.playingNodeData.subject ?? null;
    },
    actionNodeParams() {
      return getActionNodeParams(
        this.playingNodeData?.params ?? { in: [], out: [] },
        this.triggerVal,
        this.dialogController.getActions(),
        this.playingNodeData.values,
      );
    },
    inputParameters(): DialogVariable[] {
      return this.actionNodeParams.inputParameters;
    },
    outputParameters(): DialogVariable[] {
      return this.actionNodeParams.outputParameters;
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
  methods: {},
});
</script>

<style lang="scss" scoped>
.DialogTriggerDemoPlay-prop-line-caption,
.DialogTriggerDemoPlay-options-one-param-caption {
  font-weight: bold;
  font-size: 12px;
  color: var(--local-sub-text-color);
}
.DialogTriggerDemoPlay-content {
  margin-bottom: 20px;
}
.DialogTriggerDemoPlay-options-one {
  &.state-unavailable {
    opacity: 0.5;
  }
}
.DialogTriggerDemoPlay-trigger {
  text-align: center;
}
.DialogTriggerDemoPlay-trigger-header {
  font-size: 24px;
  color: #ea9595;
}

.DialogTriggerDemoPlay-parameters {
  display: grid;
  gap: 10px;
  align-items: center;
  border-top: 1px solid var(--imsde-node-content-inner-border-color);
  margin-bottom: 20px;
}

.DialogTriggerDemoPlay-parameters-one {
  margin-bottom: 5px;
  &.type-input {
    grid-column: 1;
  }
  &.type-output {
    grid-column: 2;
    justify-self: flex-end;
  }
}
.DialogTriggerDemoPlay-parameters-one-caption {
  font-weight: bold;
  font-size: 12px;
  color: var(--local-sub-text-color);
}
</style>
