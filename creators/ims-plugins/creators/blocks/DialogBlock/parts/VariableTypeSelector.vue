<template>
  <div class="VariableTypeSelector">
    <ims-select
      class="VariableTypeSelector-type"
      :model-value="selectedTypeOption"
      :options="typeOptions"
      :get-option-label="(opt: VarTypeOpt) => opt.title"
      :get-option-key="(opt: VarTypeOpt) => opt.type"
      :clearable="true"
      :placeholder="$t('imsDialogEditor.var.types.any')"
      @update:model-value="setType($event)"
    >
      <template #option="{ option }">
        <button v-if="option" class="is-button is-button-dropdown-item">
          <span
            class="VariableTypeSelector-type-circle"
            :class="'type-' + option.type"
          ></span>
          {{ option.title }}
        </button>
      </template>
      <template #selected-option="{ option }">
        <div v-if="option" class="VariableTypeSelector-selected">
          <span
            class="VariableTypeSelector-type-circle"
            :class="'type-' + option.type"
          ></span>
          {{ option.title }}
        </div>
      </template>
    </ims-select>
    <div v-if="showKindSelector" class="VariableTypeSelector-kind">
      <select-asset-combo-box
        class="VariableTypeSelector-selectAsset"
        :model-value="kindAsset"
        :where="selectAssetWhere"
        :select-base-asset="true"
        @update:model-value="setKind"
      >
      </select-asset-combo-box>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import {
  type AssetPropValueType,
  AssetPropType,
} from '~ims-app-base/logic/types/Props';
import ImsSelect from '~ims-app-base/components/Common/ImsSelect.vue';
import SelectAssetComboBox from '~ims-app-base/components/Asset/SelectAssetComboBox.vue';
import CreatorAssetManager from '~ims-app-base/logic/managers/CreatorAssetManager';
import isUUID from 'validator/es/lib/isUUID';
import type { AssetForSelection } from '~ims-app-base/logic/types/AssetsType';
import ProjectManager from '~ims-app-base/logic/managers/ProjectManager';
import type { AssetPropWhere } from '~ims-app-base/logic/types/PropsWhere';

type VarTypeOpt = {
  type: AssetPropType;
  title: string;
};

export default defineComponent({
  name: 'VariableTypeSelector',
  components: {
    ImsSelect,
    SelectAssetComboBox,
  },
  props: {
    modelValue: {
      type: [Object, null] as PropType<AssetPropValueType | null>,
      default: null,
    },
  },
  emits: ['update:modelValue'],
  computed: {
    selectedTypeOption() {
      const model_value = this.modelValue;
      if (!model_value) return null;
      const opt = this.typeOptions.find((opt) => opt.type === model_value.Type);
      return opt ?? null;
    },
    typeOptions(): VarTypeOpt[] {
      return [
        AssetPropType.BOOLEAN,
        AssetPropType.INTEGER,
        AssetPropType.FLOAT,
        AssetPropType.TEXT,
        AssetPropType.STRING,
        AssetPropType.ASSET,
      ].map((type) => {
        return {
          type: type,
          title: this.$t('imsDialogEditor.var.types.' + type.toString()),
        };
      });
    },
    showKindSelector() {
      return this.modelValue?.Type === AssetPropType.ASSET;
    },
    kindAsset(): AssetForSelection | null {
      if (!this.modelValue) return null;
      if (this.modelValue.Type !== AssetPropType.ASSET) return null;
      if (!this.modelValue.Kind) return null;
      const asset_id = this.modelValue.Kind;
      if (!isUUID(asset_id)) return null;
      return (
        this.$getAppManager()
          .get(CreatorAssetManager)
          .getAssetShortViaCacheSync(asset_id) ?? null
      );
    },
    selectAssetWhere(): AssetPropWhere {
      const res: AssetPropWhere = {
        workspaceids:
          this.$getAppManager()
            .get(ProjectManager)
            .getWorkspaceIdByName('gdd') ?? null,
      };
      return res;
    },
  },
  methods: {
    setType(opt: VarTypeOpt) {
      if (this.modelValue?.Type !== opt?.type || (this.modelValue && !opt)) {
        this.$emit(
          'update:modelValue',
          opt
            ? {
                Type: opt.type,
              }
            : null,
        );
      }
    },
    setKind(opt: AssetForSelection) {
      const new_val = {
        Type: AssetPropType.ASSET,
      } as AssetPropValueType;
      if (opt) new_val.Kind = opt.id;
      this.$emit('update:modelValue', new_val);
    },
  },
});
</script>

<style lang="scss" scoped>
.VariableTypeSelector {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}
.VariableTypeSelector-type {
  min-width: 170px;
}

.VariableTypeSelector-type,
.VariableTypeSelector-kind {
  flex: 1;
  overflow: hidden;
  min-width: 120px;
}

.VariableTypeSelector-type-circle {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  &.type-boolean {
    background-color: var(--imsde-type-boolean-fill);
  }
  &.type-float {
    background-color: var(--imsde-type-float-fill);
  }
  &.type-integer {
    background-color: var(--imsde-type-integer-fill);
  }
  &.type-string {
    background-color: var(--imsde-type-string-fill);
  }
  &.type-text {
    background-color: var(--imsde-type-text-fill);
  }
  &.type-asset {
    background-color: var(--imsde-type-asset-fill);
  }
}

.VariableTypeSelector-selected {
  white-space: nowrap;
  .VariableTypeSelector-type-circle {
    margin-right: 5px;
  }
}
.VariableTypeSelector-selectAsset {
  --input-padding: 5px var(--input-padding-horizontal) 6px
    var(--input-padding-horizontal);
}
</style>
