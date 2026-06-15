<template>
  <DialogBaseNode
    :node-id="id"
    :dialog-player="dialogPlayer"
    class="DialogGetPropsNode DialogEditorNode"
  >
    <div
      class="DialogGetPropsNode-header DialogNode-header DialogEditorNode-header"
      :title="$t(`imsDialogEditor.nodes.${nodeDescriptor.name}.description`)"
    >
      <i :class="nodeDescriptor.icon"></i>
      {{ $t(`imsDialogEditor.nodes.${nodeDescriptor.name}.title`) }}
    </div>
    <div class="DialogGetPropsNode-body DialogEditorNode-body">
      <div class="DialogGetPropsNode-body-main">
        <select-asset-prop-fields
          v-model="fields"
          :asset-id="assetType?.Kind"
          :show-filter="!assetType?.Kind"
        ></select-asset-prop-fields>
      </div>
      <div class="DialogGetPropsNode-params">
        <DataField
          v-model="valueVal"
          class="DialogGetPropsNode-parameter type-input"
          :in-id="valuePinId"
          :play-value="valuePlayVal"
          :node-data-controller="nodeDataController"
          :readonly="readonly"
        ></DataField>
        <DataField
          v-for="out_param of outputParameters"
          :key="'out-' + out_param.name"
          class="DialogGetPropsNode-parameter type-output"
          :out-id="generateDataPinId(true, out_param.name)"
          :play-value="dialogPlayer.playGetCurrentNodeParam(out_param.name)"
          :caption="out_param.name"
          :title="
            convertTranslatedTitle(out_param.title ?? '', (key: string) =>
              $t(key),
            )
          "
          :node-data-controller="nodeDataController"
          :readonly="readonly"
          @update:play-value="
            dialogPlayer.playSetCurrentNodeParam(out_param.name, $event)
          "
        ></DataField>
      </div>
    </div>
  </DialogBaseNode>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { DialogPlayer } from '../play/DialogPlayer';
import type { ScriptBlockPlainPropValue } from '../logic/nodeStoring';
import type { ScriptPlayNode } from '../play/ScriptPlayNode';
import type {
  DialogBlockController,
  DialogVariable,
} from '../editor/DialogBlockController';
import type { NodeDataController } from '../editor/NodeDataController';
import type { NodeDescriptor } from './NodeDescriptor';
import { generateDataPinId } from '../editor/DialogEditor';
import DataField from '../parts/DataField.vue';
import {
  AssetPropType,
  type AssetPropValueAsset,
} from '~ims-app-base/logic/types/Props';
import SelectAssetPropFields from '~ims-app-base/components/Asset/SelectAssetPropFields.vue';
import type { AssetPropField } from '~ims-app-base/components/Asset/SelectAssetPropFields';
import { convertTranslatedTitle } from '../../../../../../ims-app-base/app/logic/utils/assets';
import DialogBaseNode from '../parts/DialogBaseNode.vue';

export default defineComponent({
  name: 'DialogGetPropsNode',
  components: {
    DataField,
    SelectAssetPropFields,
    DialogBaseNode,
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
  computed: {
    fields: {
      get(): AssetPropField[] {
        const res: AssetPropField[] = [];
        const out_params = this.nodeDataController.params['out'];
        for (const param of out_params) {
          res.push({
            name: param.name,
            title: param.title,
            ref: param.name.split('.').join('|'),
          });
        }
        return res;
      },
      set(val: AssetPropField[]) {
        const prevNames = this.nodeDataController.params['out'].map(
          (p) => p.name,
        );
        const nextNames = new Set(val.map((f) => f.name));

        for (const name of prevNames) {
          if (!nextNames.has(name)) {
            this.nodeDataController.deleteParam('out', name);
          }
        }

        for (const field of val) {
          const prev = this.nodeDataController.params['out'].find(
            (p) => p.name === field.name,
          );
          const variable: DialogVariable = {
            name: field.ref.split('|').join('.'),
            title: field.title,
            default: null,
            description: null,
            type: field.type?.length
              ? field.type?.length === 1
                ? field.type[0]
                : null
              : null,
          };
          if (prev) {
            this.nodeDataController.changeParam('out', field.name, variable);
          } else {
            this.nodeDataController.addParam('out', variable);
          }
        }
      },
    },
    valuePinId() {
      return generateDataPinId(false, 'value');
    },
    valuePlayVal() {
      return this.playingNodeData?.inputs?.value ?? null;
    },
    assetType() {
      return this.nodeDataController
        .getPinDataType(this.valuePinId)
        ?.find((el) => el.Type === 'asset');
    },
    valueVal: {
      get(): ScriptBlockPlainPropValue | null {
        return this.nodeDataController.values['value'] ?? null;
      },
      set(val: ScriptBlockPlainPropValue) {
        this.nodeDataController.setValue('value', val);
      },
    },
    outputParameters(): DialogVariable[] {
      const res: DialogVariable[] = [];

      for (const param of this.nodeDataController.params['out'] ?? []) {
        res.push(param);
      }
      return res;
    },
  },
  watch: {
    valueVal: {
      handler(val) {
        this.syncPinTypeFromValue(val);
      },
      immediate: true,
    },
    outputParameters() {
      for (let i = 0; i < this.outputParameters.length; i++) {
        this.nodeDataController.setPinDataType(
          generateDataPinId(true, this.outputParameters[i].name),
          this.outputParameters[i].type,
        );
      }
    },
  },
  methods: {
    convertTranslatedTitle,
    generateDataPinId,
    syncPinTypeFromValue(val: ScriptBlockPlainPropValue | null) {
      if (val && typeof val === 'object' && 'AssetId' in val) {
        this.nodeDataController.setPinDataType(this.valuePinId, {
          Type: AssetPropType.ASSET,
          Kind: (val as AssetPropValueAsset).AssetId,
        });
      } else {
        this.nodeDataController.setPinDataType(this.valuePinId, {
          Type: AssetPropType.ASSET,
        });
      }
    },
  },
});
</script>
<style lang="scss" scoped>
.DialogGetPropsNode-header {
  padding: 7px 10px;
  font-size: 14px;
}
.DialogGetPropsNode-body-main {
  padding: 7px 10px;
  position: relative;
}
.DialogGetPropsNode-params {
  padding-bottom: 5px;
  display: grid;
  gap: 10px;
  align-items: center;
  border-top: 1px solid var(--imsde-node-content-inner-border-color);
  padding-top: 10px;
}
.DialogGetPropsNode-parameter {
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
</style>
