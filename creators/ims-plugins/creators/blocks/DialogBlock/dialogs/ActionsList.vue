<template>
  <div class="ActionsList">
    <div class="ActionsList-filters">
      <div class="ActionsList-filters-group">
        <slot name="prepend-filters"></slot>
        <action-type-selector
          v-model="filters.type"
          class="ActionsList-filters-type"
          nullable
        ></action-type-selector>
      </div>
      <form-search
        v-if="actionsList && actionsList.length"
        class="ActionsList-filters-query"
        :value="filters.query"
        @change="filters.query = $event"
      ></form-search>
    </div>
    <div v-if="filteredActions.length > 0" class="ActionsList-grid">
      <div class="ActionsList-grid-row">
        <div class="ActionsList-grid-column"></div>
        <div class="ActionsList-grid-column">
          {{ $t('imsDialogEditor.actions.name') }}
        </div>
        <div class="ActionsList-grid-column">
          {{ $t('imsDialogEditor.actions.type') }}
        </div>
        <div class="ActionsList-grid-column">
          {{ $t('imsDialogEditor.actions.inputParameters') }}
        </div>
        <div class="ActionsList-grid-column">
          {{ $t('imsDialogEditor.actions.outputParameters') }}
        </div>
        <div class="ActionsList-grid-column"></div>
      </div>
      <sortable-list
        class="ActionsList-content tiny-scrollbars"
        handle-selector=".ActionsListItem-drag"
        id-key="name"
        :list="filteredActions"
        @update:list="changeList($event)"
      >
        <template #default="{ item }">
          <actions-list-item
            class="ActionsList-item"
            :actions-controller="collectionController"
            :action="item"
          >
          </actions-list-item>
        </template>
      </sortable-list>
    </div>
    <div v-else class="ActionsList-empty">
      {{
        $t(
          'imsDialogEditor.actions.' +
            (filters.query ? 'noActionsFound' : 'noActionsYet'),
        )
      }}
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { IDialogCollectionController } from '../editor/DialogVariableController';
import ActionsListItem from './ActionsListItem.vue';
import type {
  ScriptBlockPlainAction,
  ScriptBlockPlainActionTypes,
} from '../logic/nodeStoring';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import SortableList from '~ims-app-base/components/Common/SortableList.vue';
import FormSearch from '~ims-app-base/components/Form/FormSearch.vue';
import { getAvailableActionTypes } from '../logic/nodeActions';
import ActionTypeSelector from '../parts/ActionTypeSelector.vue';

type ActionsListFilters = {
  query: string;
  type: ScriptBlockPlainActionTypes;
};

export default defineComponent({
  name: 'ActionsList',
  components: {
    ActionsListItem,
    SortableList,
    FormSearch,
    ActionTypeSelector,
  },
  props: {
    collectionController: {
      type: Object as PropType<IDialogCollectionController>,
      required: true,
    },
    initialFilters: {
      type: Object as PropType<ActionsListFilters>,
      default: null,
    },
  },
  data() {
    return {
      filters: {
        query: this.initialFilters?.query ?? '',
        type: this.initialFilters?.type ?? null,
      },
    };
  },
  computed: {
    actionsList() {
      return this.collectionController.getEntities();
    },
    filteredActions() {
      return this.actionsList.filter(
        (a) =>
          a.name.toLowerCase().includes(this.filters.query.toLowerCase()) &&
          (this.filters.type ? a.type === this.filters.type : true),
      );
    },
    availableActionTypes() {
      return getAvailableActionTypes((key: string) => this.$t(key));
    },
  },
  methods: {
    async changeList(reordered_actions: ScriptBlockPlainAction[]) {
      await this.$getAppManager()
        .get(UiManager)
        .doTask(async () => {
          this.collectionController.reorderEntities(reordered_actions);
        });
    },
  },
});
</script>
<style lang="scss" scoped>
.ActionsList {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.ActionsList-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;

  .ActionsList-filters-group {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .ActionsList-filters-type {
    --ValueSwitcher-border-radius: 8px;
  }

  .ActionsList-filters-query {
    max-width: 180px;
  }
}
.ActionsList-grid {
  --actions-list-columns: 20px 150px 150px minmax(150px, 1fr) minmax(150px, 1fr)
    20px;
  --actions-list-column-gap: 2px;

  min-height: 0;
  display: flex;
  flex-direction: column;
}
.ActionsList-content {
  overflow: auto;
  flex: 1;
}
.ActionsList-empty {
  margin-bottom: 10px;
  font-style: italic;
  color: var(--local-sub-text-color);
}
:deep(.SortableList-item) {
  padding: 5px 0px;

  &:not(:last-child) {
    border-bottom: 1px dashed var(--local-border-color);
  }
}
.ActionsList-grid-row {
  display: grid;
  grid-template-columns: var(--actions-list-columns);
  color: var(--local-sub-text-color);
  column-gap: var(--actions-list-column-gap);
}
</style>
