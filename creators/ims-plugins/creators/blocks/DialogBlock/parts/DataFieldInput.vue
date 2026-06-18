<template>
  <div
    class="DataFieldInput nodrag nopan"
    :class="{
      'DataFieldInput-active-with-counter':
        dataType.Type === AssetPropType.TEXT,
      hasBorder,
    }"
  >
    <template v-if="dataType.Type === AssetPropType.BOOLEAN">
      <input
        v-if="!readonly"
        ref="input"
        v-model="modeValueComp"
        class="DataFieldInput-boolean"
        type="checkbox"
      />
      <i v-else-if="modeValueComp" class="ri-checkbox-line"></i>
      <i v-else class="ri-checkbox-blank-line"></i>
    </template>
    <input
      v-else-if="
        dataType.Type === AssetPropType.INTEGER ||
        dataType.Type === AssetPropType.FLOAT
      "
      ref="input"
      v-model="modeValueComp"
      type="number"
      class="is-input DataFieldInput-number"
      :step="dataType.Type === AssetPropType.INTEGER ? '1' : '0.001'"
      :disabled="readonly"
    />
    <template v-else-if="dataType.Type === AssetPropType.TEXT">
      <imc-editor
        v-if="!readonly"
        ref="input"
        v-model="modeValueComp"
        class="DataFieldInput-text"
        :class="{ focus: elementInFocus }"
        :placeholder="
          placeholder ? placeholder : $t('imsDialogEditor.common.noValue')
        "
        :multiline="true"
        @input-value="modeValueComp = $event"
        @focus="elementInFocus = true"
        @blur="elementInFocus = false"
      ></imc-editor>
      <imc-presenter
        v-else
        :value="modeValueComp"
        class="DataFieldInput-text"
        :class="{ disabled: readonly }"
      ></imc-presenter>
      <div class="DataFieldInput-counter" :class="{ hidden: !elementInFocus }">
        {{ textLength }}
      </div>
    </template>
    <ims-input
      v-else-if="dataType.Type === AssetPropType.STRING"
      ref="input"
      :model-value="modeValueCompString"
      class="DataFieldInput-string"
      :placeholder="
        placeholder ? placeholder : $t('imsDialogEditor.common.noValue')
      "
      :auto-extend="true"
      :disabled="readonly"
      @update:model-value="modeValueComp = $event"
    ></ims-input>
    <template v-else-if="dataType.Type === AssetPropType.ASSET">
      <asset-selector-prop-editor
        v-if="!readonly"
        ref="input"
        v-model="modeValueComp"
        class="DataFieldInput-asset"
        :where="selectAssetWhere"
      ></asset-selector-prop-editor>
      <asset-link-prop-presenter
        v-else
        :model-value="modeValueComp"
      ></asset-link-prop-presenter>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import {
  type AssetPropValueType,
  type AssetPropValue,
  AssetPropType,
  castAssetPropValueToString,
  type AssetPropValueText,
  castAssetPropValueToInt,
} from '~ims-app-base/logic/types/Props';
import isUUID from 'validator/es/lib/isUUID';
import ProjectManager from '~ims-app-base/logic/managers/ProjectManager';
import type { AssetPropWhere } from '~ims-app-base/logic/types/PropsWhere';
import AssetSelectorPropEditor from '~ims-app-base/components/Props/AssetSelectorPropEditor.vue';
import ImcEditor from '~ims-app-base/components/ImcText/ImcEditor.vue';
import ImsInput from '~ims-app-base/components/Common/ImsInput.vue';
import AssetLinkPropPresenter from '~ims-app-base/components/Props/AssetLinkPropPresenter.vue';
import ImcPresenter from '~ims-app-base/components/ImcText/ImcPresenter.vue';
import Delta from 'quill-delta';

export default defineComponent({
  name: 'DataFieldInput',
  components: {
    AssetSelectorPropEditor,
    AssetLinkPropPresenter,
    ImcEditor,
    ImcPresenter,
    ImsInput,
  },
  props: {
    readonly: {
      type: Boolean,
      default: false,
    },
    hasBorder: {
      type: Boolean,
      default: false,
    },
    modelValue: {
      type: [Object, String, Boolean, Number, null] as PropType<AssetPropValue>,
      default: null,
    },
    dataType: {
      type: Object as PropType<AssetPropValueType>,
      required: true,
    },
    placeholder: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  data() {
    return {
      elementInFocus: false,
    };
  },
  computed: {
    AssetPropType() {
      return AssetPropType;
    },
    modeValueComp: {
      get() {
        return this.modelValue;
      },
      set(val: AssetPropValue) {
        if (this.dataType && this.dataType.Type === AssetPropType.INTEGER) {
          val = castAssetPropValueToInt(val);
        }
        this.$emit('update:modelValue', val);
      },
    },
    modeValueCompString() {
      return castAssetPropValueToString(this.modeValueComp);
    },
    selectAssetWhere(): AssetPropWhere {
      const res: AssetPropWhere = {
        workspaceids:
          this.$getAppManager()
            .get(ProjectManager)
            .getWorkspaceIdByName('gdd') ?? null,
      };
      if (this.dataType.Kind && isUUID(this.dataType.Kind, 'loose')) {
        res.typeids = this.dataType.Kind;
      }
      return res;
    },
    textLength() {
      if (
        this.modeValueComp &&
        (this.modeValueComp as AssetPropValueText).Ops
      ) {
        const delta = new Delta((this.modeValueComp as AssetPropValueText).Ops);
        return delta.length() - 1;
      }
      return castAssetPropValueToString(this.modeValueComp).length;
    },
  },
  methods: {
    focus() {
      if (!this.$refs['input']) return;
      if (!(this.$refs['input'] as any).focus) return;
      (this.$refs['input'] as any).focus();
    },
  },
});
</script>

<style lang="scss" scoped>
@use '~ims-app-base/style/new-vars-mixins.scss';

.DataFieldInput-text {
  padding-bottom: 10px;
}
.DataFieldInput {
  &:hover {
    .DataFieldInput-counter.hidden {
      display: block;
    }
  }

  &.hasBorder {
    margin-top: 0;

    .DataFieldInput-text {
      @include new-vars-mixins.is-input;

      :deep(.ql-editor.ql-blank::before) {
        display: none;
      }
    }
  }
}
.DataFieldInput-active-with-counter {
  margin-top: 10px;
}
.DataFieldInput-counter {
  position: absolute;
  color: var(--input-placeholder-color);
  right: 11px;
  bottom: 0px;
  font-size: 10px;
  &.hidden {
    display: none;
  }
}
</style>
