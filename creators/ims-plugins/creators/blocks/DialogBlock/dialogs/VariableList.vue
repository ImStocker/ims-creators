<template>
  <div class="VariableList">
    <form-search
      v-if="variableList && variableList.length"
      class="VariableList-search"
      :value="searchQuery"
      @change="searchQuery = $event"
    ></form-search>
    <div v-if="filteredVariables.length > 0" class="VariableList-grid">
      <div class="VariableList-grid-row">
        <div class="VariableList-grid-column"></div>
        <div class="VariableList-grid-column">
          {{ $t('imsDialogEditor.var.name') }}
        </div>
        <div class="VariableList-grid-column">
          {{ $t('imsDialogEditor.var.type') }}
        </div>
        <div class="VariableList-grid-column">
          {{ $t('imsDialogEditor.var.defaultValue') }}
        </div>
      </div>
      <sortable-list
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
          >
          </variable-list-item>
        </template>
      </sortable-list>
    </div>
    <div v-else class="VariableList-empty">
      {{
        $t(
          'imsDialogEditor.var.' +
            (searchQuery ? 'noVariablesFound' : 'noVariablesYet'),
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
import type { ScriptBlockPlainVariable } from '../logic/nodeStoring';
import FormSearch from '~ims-app-base/components/Form/FormSearch.vue';

export default defineComponent({
  name: 'VariableList',
  components: {
    VariableListItem,
    SortableList,
    FormSearch,
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
  },
  data() {
    return {
      searchQuery: '',
    };
  },
  computed: {
    variableList() {
      return this.collectionController.getEntities();
    },
    filteredVariables() {
      return this.variableList.filter((v) =>
        v.title.toLowerCase().includes(this.searchQuery.toLowerCase()),
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
.VariableList-search {
  margin-bottom: 10px;
}
.VariableList-grid {
  --variable-list-columns: 20px 200px 240px minmax(150px, 1fr) min-content;
  --variable-list-column-gap: 2px;

  margin-bottom: 20px;
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
