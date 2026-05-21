<template>
  <div class="VariableList">
    <div class="VariableList-filters">
      <slot name="prepend-filters"></slot>
      <variable-kind-selector
        v-if="showKindControl"
        v-model="filters.kind"
        class="VariableList-filters-kind"
      ></variable-kind-selector>
      <form-search
        v-if="filteredVariables && filteredVariables.length && showSearch"
        class="VariableList-filters-query"
        :value="filters.query"
        @change="filters.query = $event"
      ></form-search>
    </div>
    <div v-if="filteredVariables.length > 0" class="VariableList-grid">
      <div class="VariableList-grid-row">
        <div class="VariableList-grid-column"></div>
        <div class="VariableList-grid-column">
          {{ $t('imsDialogEditor.var.name') }}
        </div>
        <div class="VariableList-grid-column">
          {{ $t('imsDialogEditor.var.dataType') }}
        </div>
        <div class="VariableList-grid-column">
          {{ $t('imsDialogEditor.var.defaultValue') }}
        </div>
      </div>
      <sortable-list
        class="VariableList-content tiny-scrollbars"
        handle-selector=".VariableListItem-drag"
        id-key="name"
        :list="filteredVariables"
        @update:list="changeList($event)"
      >
        <template #default="{ item }">
          <variable-list-item
            class="VariableList-item"
            :variable-controller="collectionController"
            :variable="item"
            :show-auto-fill="showAutoFill"
            :show-kind-control="showKindControl"
          >
          </variable-list-item>
        </template>
      </sortable-list>
    </div>
    <div v-else class="VariableList-empty">
      {{
        $t(
          'imsDialogEditor.var.' +
            (filters.query ? 'noVariablesFound' : 'noVariablesYet'),
        )
      }}
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import isUUID from 'validator/es/lib/isUUID';
import CreatorAssetManager from '~ims-app-base/logic/managers/CreatorAssetManager';
import { AssetPropType } from '~ims-app-base/logic/types/Props';
import type { IDialogVariableController } from '../editor/DialogVariableController';
import VariableListItem from './VariableListItem.vue';
import SortableList from '~ims-app-base/components/Common/SortableList.vue';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import {
  ScriptBlockPlainVariableKinds,
  type ScriptBlockPlainVariable,
} from '../logic/nodeStoring';
import FormSearch from '~ims-app-base/components/Form/FormSearch.vue';
import VariableKindSelector from '../parts/VariableKindSelector.vue';

export default defineComponent({
  name: 'VariableList',
  components: {
    VariableListItem,
    SortableList,
    FormSearch,
    VariableKindSelector,
  },
  props: {
    collectionController: {
      type: Object as PropType<IDialogVariableController>,
      required: true,
    },
    showAutoFill: {
      type: Boolean,
      default: false,
    },
    showKindControl: {
      type: Boolean,
      default: false,
    },
    showSearch: {
      type: Boolean,
      default: true,
    },
  },
  data() {
    return {
      filters: {
        query: '',
        kind: ScriptBlockPlainVariableKinds.GLOBAL,
      },
    };
  },
  computed: {
    variableList() {
      return this.collectionController.getEntities();
    },
    filteredVariables() {
      return this.variableList.filter(
        (v) =>
          v.title.toLowerCase().includes(this.filters.query.toLowerCase()) &&
          (v.kind === this.filters.kind ||
            (this.filters.kind === ScriptBlockPlainVariableKinds.GLOBAL &&
              v.kind === undefined)),
      );
    },
  },
  async mounted() {
    await this.loadVariablesAssetKinds();
  },
  methods: {
    async changeList(reordered_variables: ScriptBlockPlainVariable[]) {
      await this.$getAppManager()
        .get(UiManager)
        .doTask(async () => {
          this.collectionController.reorderEntities(reordered_variables);
        });
    },
    async loadVariablesAssetKinds() {
      const asset_ids: string[] = [];
      for (const variable of this.variableList) {
        if (!variable.type || variable.type.Type !== AssetPropType.ASSET) {
          continue;
        }
        const asset_id = variable.type.Kind;
        if (!asset_id || !isUUID(asset_id)) {
          continue;
        }
        asset_ids.push(asset_id);
      }
      this.$getAppManager()
        .get(CreatorAssetManager)
        .requestAssetShortInCacheList(asset_ids);
    },
  },
});
</script>
<style lang="scss" rel="stylesheet/scss" scoped>
@use '~ims-app-base/style/Form';
.VariableList {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.VariableList-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;

  .VariableList-filters-kind {
    width: auto;
    --ValueSwitcher-border-radius: 8px;
  }
  .VariableList-filters-query {
    max-width: 150px;
  }
}
.VariableList-grid {
  --variable-list-columns: 20px 200px 240px minmax(150px, 1fr) min-content;
  --variable-list-column-gap: 2px;

  min-height: 0;
  display: flex;
  flex-direction: column;
}
.VariableList-content {
  overflow: auto;
  flex: 1;
}
.VariableList-grid-row {
  display: grid;
  grid-template-columns: var(--variable-list-columns);
  color: var(--local-sub-text-color);
  column-gap: var(--variable-list-column-gap);
}
:deep(.SortableList-item) {
  padding: 5px 0px;

  &:not(:last-child) {
    border-bottom: 1px dashed var(--local-border-color);
  }
}
.VariableList-empty {
  margin-bottom: 10px;
  font-style: italic;
  color: var(--local-sub-text-color);
}
</style>
