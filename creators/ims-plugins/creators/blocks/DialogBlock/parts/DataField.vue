<template>
  <div
    class="DataField"
    :class="{
      'type-in': inId && !outId,
      'type-out': outId && !inId,
      'type-in-out': inId && outId,
    }"
  >
    <DataHandle
      v-if="inId"
      :id="inId"
      class="DataField-in"
      :class="{
        ['type-' + (dataType ? dataType.Type : 'any')]: true,
        'state-connected': isInConnected,
      }"
      type="target"
      :position="Position.Left"
    />
    <DataHandle
      v-if="outId"
      :id="outId"
      class="DataField-out"
      :class="{
        ['type-' + (dataType ? dataType.Type : 'any')]: true,
        'state-connected': isOutConnected,
      }"
      type="source"
      :position="Position.Right"
    />
    <template v-if="caption || (!outId && isInConnected)">
      <span class="DataField-caption">
        <caption-string :value="caption"></caption-string
        >{{
          (!isInConnected && dataType && inId) ||
          (playValue !== null && playValueType !== undefined)
            ? ':'
            : ''
        }}
      </span>
    </template>
    <DataFieldInput
      v-if="!isInConnected && (preferInputType || dataType) && inId"
      ref="input"
      v-model="valueForInput"
      class="DataField-input"
      :data-type="preferInputType ? preferInputType : dataType"
      :placeholder="placeholder"
      :readonly="readonly"
    ></DataFieldInput>
    <DataFieldInput
      v-else-if="(playValue !== null || playValueSet) && playValueType"
      :model-value="playValue"
      class="DataField-input DataField-playValue"
      :data-type="playValueType"
      :readonly="!playValueSet"
      @update:model-value="$emit('update:playValue', $event)"
    ></DataFieldInput>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import { Position } from '@vue-flow/core';
import DataHandle from './DataHandle.vue';
import type { NodeDataController } from '../editor/NodeDataController';
import {
  AssetPropType,
  getAssetPropType,
  type AssetPropValue,
  type AssetPropValueType,
} from '~ims-app-base/logic/types/Props';
import DataFieldInput from './DataFieldInput.vue';
import CaptionString from '~ims-app-base/components/Common/CaptionString.vue';
import type {
  ScriptBlockPlainPropValue,
  ScriptBlockPlainPropValueBind,
} from '../logic/nodeStoring';

export default defineComponent({
  name: 'DataField',
  components: {
    DataHandle,
    DataFieldInput,
    CaptionString,
  },
  props: {
    inId: { type: String, default: '' },
    outId: { type: String, default: '' },
    caption: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    modelValue: {
      type: [
        Boolean,
        String,
        Object,
        Number,
        null,
      ] as PropType<ScriptBlockPlainPropValue>,
      default: null,
    },
    nodeDataController: {
      type: Object as PropType<NodeDataController>,
      required: true,
    },
    readonly: {
      type: Boolean,
      default: false,
    },
    playValue: {
      type: [Boolean, String, Object, Number, null] as PropType<AssetPropValue>,
      default: null,
    },
    playValueSet: {
      type: Boolean,
      default: false,
    },
    preferInputType: {
      type: [Object, null] as PropType<AssetPropValueType | null>,
      default: null,
    },
  },
  emits: ['update:modelValue', 'update:playValue'],
  computed: {
    playValueType() {
      if (this.playValueSet) {
        return this.dataType ?? undefined;
      }
      const type = getAssetPropType(this.playValue);
      if (type === undefined) return undefined;
      return {
        Type: type,
      };
    },
    Position() {
      return Position;
    },
    AssetPropType() {
      return AssetPropType;
    },
    isInConnected() {
      return this.nodeDataController.isPinConnected(this.inId);
    },
    isOutConnected() {
      return this.nodeDataController.isPinConnected(this.outId);
    },
    dataType() {
      const in_types = this.inId
        ? this.nodeDataController.getPinDataType(this.inId)
        : null;
      const out_types = this.outId
        ? this.nodeDataController.getPinDataType(this.outId)
        : null;
      if (in_types && in_types.length === 1) return in_types[0];
      if (out_types && out_types.length === 1) return out_types[0];
      return null;
    },
    valueForInput: {
      get(): AssetPropValue {
        const val = this.modelValue;
        if (val && (val as ScriptBlockPlainPropValueBind).get !== undefined) {
          return null;
        }
        return (val as AssetPropValue) ?? null;
      },
      set(val: AssetPropValue) {
        this.$emit('update:modelValue', val);
      },
    },
  },
  methods: {
    focus() {
      if (!this.$refs['input']) return;
      (this.$refs['input'] as any).focus();
    },
  },
});
</script>

<style lang="scss" scoped>
.DataField {
  display: flex;
  align-items: center;
  position: relative;
}
.DataField-caption,
.DataField-input {
  margin-left: 10px;
  &:last-child {
    margin-right: 10px;
  }
}
.DataField-input {
  flex: 1;
}
.DataField-input:deep(.DataFieldInput-number) {
  width: 80px;
}
.DataField-input:deep(.DataFieldInput-asset) {
  width: 200px;
}
.DataField-input:deep(.DataFieldInput-text),
.DataField-input:deep(.DataFieldInput-string) {
  min-width: 100px;
}

.DataField-playValue {
  color: var(--imsde-node-playing-color);
  --local-text-color: var(--imsde-node-playing-color);
  --input-text-color: var(--imsde-node-playing-color);
}

.DataField.type-out {
  justify-content: flex-end;
  text-align: right;
}

.DataField-in,
.DataField-out {
  transition: opacity 0.25s;
}
</style>
