<template>
  <div
    v-if="
      inputParams.length > 0 || outputParams.length > 0 || exitParams.length > 0
    "
    class="NodeParametersGrid"
  >
    <ContextMenuZone
      v-for="param_gr of parametersGrid"
      :key="(param_gr.isOutput ? 'out-' : 'in-') + param_gr.variable.name"
      class="NodeParametersGrid-parameter"
      :class="param_gr.isOutput ? 'type-output' : 'type-input'"
      :menu-list="getParameterContextMenu(param_gr.variable, param_gr.isOutput)"
    >
      <DataField
        :in-id="
          !param_gr.isOutput
            ? generateDataPinId(false, param_gr.variable.name)
            : ''
        "
        :out-id="
          param_gr.isOutput
            ? generateDataPinId(true, param_gr.variable.name)
            : ''
        "
        :model-value="
          !param_gr.isOutput
            ? nodeDataController.values[param_gr.variable.name] === undefined
              ? param_gr.variable.default
              : nodeDataController.values[param_gr.variable.name]
            : null
        "
        :play-value="
          !param_gr.isOutput
            ? playingNodeData?.inputs
              ? playingNodeData?.inputs[param_gr.variable.name]
              : null
            : dialogPlayer.playGetCurrentNodeParam(param_gr.variable.name)
        "
        :caption="param_gr.variable.title"
        :node-data-controller="nodeDataController"
        :title="param_gr.variable.description ?? ''"
        :readonly="readonly"
        :play-value-set="param_gr.isOutput && playWaitUser"
        @update:play-value="
          dialogPlayer.playSetCurrentNodeParam(param_gr.variable.name, $event)
        "
        @update:model-value="
          setParamValue(param_gr.variable, param_gr.isOutput, $event)
        "
      ></DataField>
      <div
        v-if="
          wrongParameterNames.has(
            (param_gr.isOutput ? 'out-' : 'in-') + param_gr.variable.name,
          )
        "
        :title="$t('imsDialogEditor.trigger.wrongParameter')"
        class="NodeParametersGrid-badParam"
      >
        <i class="ri-error-warning-fill"></i>
      </div>
    </ContextMenuZone>
    <div
      v-for="exit_gr of exitParams"
      :key="'exit-' + exit_gr.name"
      class="NodeParametersGrid-parameter NodeParametersGrid-exit type-output"
    >
      <span class="NodeParametersGrid-exit-caption">
        <caption-string :value="exit_gr.name"></caption-string>
      </span>
      <ExecHandle
        :id="generateExitPinId(exit_gr.name)"
        type="source"
        :position="Position.Right"
      />
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { Position } from '@vue-flow/core';
import { generateDataPinId, generateExitPinId } from '../editor/DialogEditor';
import type { DialogVariable } from '../editor/DialogBlockController';
import type { ScriptBlockPlainPropValue } from '../logic/nodeStoring';
import type { NodeDataController } from '../editor/NodeDataController';
import type { DialogPlayer } from '../play/DialogPlayer';
import type { ScriptPlayNode } from '../play/ScriptPlayNode';
import type { MenuListItem } from '~ims-app-base/logic/types/MenuList';
import type { CallScriptExitParam } from '../logic/nodeParams';
import DataField from './DataField.vue';
import ExecHandle from './ExecHandle.vue';
import ContextMenuZone from '~ims-app-base/components/Common/ContextMenuZone.vue';
import CaptionString from '~ims-app-base/components/Common/CaptionString.vue';

export default defineComponent({
  name: 'NodeParametersGrid',
  components: {
    ContextMenuZone,
    DataField,
    ExecHandle,
    CaptionString,
  },
  props: {
    inputParams: {
      type: Array as PropType<DialogVariable[]>,
      default: () => [],
    },
    outputParams: {
      type: Array as PropType<DialogVariable[]>,
      default: () => [],
    },
    exitParams: {
      type: Array as PropType<CallScriptExitParam[]>,
      default: () => [],
    },
    wrongParameterNames: {
      type: Set as PropType<Set<string>>,
      default: () => new Set(),
    },
    nodeDataController: {
      type: Object as PropType<NodeDataController>,
      required: true,
    },
    playWaitUser: {
      type: Boolean,
      default: false,
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
    getParameterContextMenu: {
      type: Function as PropType<
        (variable: DialogVariable, isOut: boolean) => MenuListItem[]
      >,
      default: () => [],
    },
  },
  computed: {
    Position() {
      return Position;
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
        i < Math.max(this.inputParams.length, this.outputParams.length);
        i++
      ) {
        if (i < this.inputParams.length) {
          res.push({
            variable: this.inputParams[i],
            isOutput: false,
            index: i,
          });
        }
        if (i < this.outputParams.length) {
          res.push({
            variable: this.outputParams[i],
            isOutput: true,
            index: i,
          });
        }
      }
      return res;
    },
  },
  watch: {
    parametersGrid() {
      this.updatePins();
    },
  },
  mounted() {
    this.updatePins();
  },
  methods: {
    generateDataPinId,
    generateExitPinId,
    updatePins() {
      for (let i = 0; i < this.inputParams.length; i++) {
        this.nodeDataController.setPinDataType(
          generateDataPinId(false, this.inputParams[i].name),
          this.inputParams[i].type,
        );
      }
      for (let i = 0; i < this.outputParams.length; i++) {
        this.nodeDataController.setPinDataType(
          generateDataPinId(true, this.outputParams[i].name),
          this.outputParams[i].type,
        );
      }
    },
    setParamValue(
      param: DialogVariable,
      is_out: boolean,
      val: ScriptBlockPlainPropValue,
    ) {
      if (is_out) return;
      this.nodeDataController.setValue(param.name, val);
    },
  },
});
</script>
<style lang="scss" scoped>
.NodeParametersGrid {
  padding-bottom: 5px;
  display: grid;
  gap: 10px;
  align-items: center;
  border-top: 1px solid var(--imsde-node-content-inner-border-color);
  padding-top: 10px;
}
.NodeParametersGrid-parameter {
  margin-bottom: 5px;
  display: flex;
  align-items: baseline;
  &.type-input {
    grid-column: 1;
  }
  &.type-output {
    flex-direction: row-reverse;
    grid-column: 2;
    justify-self: flex-end;
  }
}
.NodeParametersGrid-badParam {
  display: inline-block;
  color: var(--color-warning);
}
.NodeParametersGrid-exit {
  position: relative;
  justify-content: flex-end;
  text-align: right;
}
.NodeParametersGrid-exit-caption {
  margin-left: 10px;
  margin-right: 10px;
}
</style>
