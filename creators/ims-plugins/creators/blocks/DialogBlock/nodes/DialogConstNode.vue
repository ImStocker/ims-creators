<template>
  <DialogBaseNode
    :node-id="id"
    :dialog-player="dialogPlayer"
    class="DialogConstNode DialogEditorNode"
  >
    <div
      class="DialogConstNode-header DialogNode-header DialogEditorNode-header"
      :title="$t(`imsDialogEditor.nodes.${nodeDescriptor.name}.description`)"
    >
      <i :class="nodeDescriptor.icon"></i>
      {{ $t(`imsDialogEditor.nodes.${nodeDescriptor.name}.title`) }}
    </div>
    <div class="DialogConstNode-body DialogEditorNode-body">
      <div class="DialogConstNode-content">
        <DataFieldInput
          v-model="value"
          class="DialogConstNode-input"
          :data-type="dataType"
          :readonly="readonly"
        ></DataFieldInput>
        <div
          v-if="dataType.Type === AssetPropType.BOOLEAN"
          class="DialogConstNode-caption"
        >
          {{ $t('imsDialogEditor.dataFields.value') }}
        </div>
      </div>
      <DataField
        class="DialogGonstNode-body-dataOut"
        :out-id="outPinId"
        :node-data-controller="nodeDataController"
      />
    </div>
  </DialogBaseNode>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { NodeDescriptor } from './NodeDescriptor';
import DataField from '../parts/DataField.vue';
import type { NodeDataController } from '../editor/NodeDataController';
import {
  AssetPropType,
  type AssetPropValue,
  type AssetPropValueAsset,
  type AssetPropValueType,
} from '~ims-app-base/logic/types/Props';
import DataFieldInput from '../parts/DataFieldInput.vue';
import { generateDataPinId } from '../editor/DialogEditor';
import type { ScriptBlockPlainPropValueBind } from '../logic/nodeStoring';
import DialogBaseNode from './DialogBaseNode.vue';
import type { DialogPlayer } from '../play/DialogPlayer';

export default defineComponent({
  name: 'DialogConstNode',
  components: {
    DataField,
    DataFieldInput,
    DialogBaseNode,
  },
  props: {
    id: {
      type: String,
      required: true,
    },
    dialogPlayer: {
      type: Object as PropType<DialogPlayer>,
      required: true,
    },
    nodeDescriptor: {
      type: Object as PropType<NodeDescriptor>,
      required: true,
    },
    selected: {
      type: Boolean,
      required: true,
    },
    readonly: {
      type: Boolean,
      required: false,
    },
    dataType: {
      type: Object as PropType<AssetPropValueType>,
      required: true,
    },
    nodeDataController: {
      type: Object as PropType<NodeDataController>,
      required: true,
    },
  },
  computed: {
    AssetPropType() {
      return AssetPropType;
    },
    inheritedOutType() {
      let res = this.dataType;
      if (
        res.Type === AssetPropType.ASSET &&
        this.value &&
        (this.value as AssetPropValueAsset).AssetId
      ) {
        res = {
          ...res,
          Kind: (this.value as AssetPropValueAsset).AssetId,
        };
      }
      return res;
    },
    outPinId() {
      return generateDataPinId(true, 'result');
    },
    value: {
      get(): AssetPropValue {
        const val = this.nodeDataController.values['value'];
        if (val && (val as ScriptBlockPlainPropValueBind).get !== undefined) {
          return null;
        }
        return (val as AssetPropValue) ?? null;
      },
      set(val: AssetPropValue) {
        this.nodeDataController.setValue('value', val);
      },
    },
  },
  watch: {
    inheritedOutType() {
      this.updatePins();
    },
  },
  mounted() {
    this.updatePins();
  },
  methods: {
    updatePins() {
      this.nodeDataController.setPinDataType(
        this.outPinId,
        this.inheritedOutType,
      );
    },
  },
});
</script>

<style lang="scss" scoped>
.DialogConstNode-header {
  padding: 7px 10px;
  font-size: 14px;
  position: relative;
}

.DialogConstNode-body {
  padding: 7px 10px;
  position: relative;
}
.DialogGonstNode-body-dataOut {
  position: absolute;
  top: 50%;
  right: 0;
  transform: translate(50%, -50%);
}
.DialogConstNode-input:first-child:last-child {
  flex: 1;
}
.DialogConstNode-input:deep(.DataFieldInput-number) {
  width: 120px;
}
.DialogConstNode-input:deep(.DataFieldInput-string) {
  min-width: 150px;
  max-width: 600px;
}

.DialogConstNode-input:deep(.DataFieldInput-text) {
  min-width: 150px;
  max-width: 600px;
}

.DialogConstNode-caption {
  margin-left: 10px;
}
.DialogConstNode-content {
  display: flex;
  align-items: center;
}
</style>
