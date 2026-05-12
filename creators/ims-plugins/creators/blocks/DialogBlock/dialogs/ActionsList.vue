<template>
  <div class="ActionsList">
    <form-search
      v-if="actionsList && actionsList.length"
      class="ActionsList-search"
      :value="searchQuery"
      @change="searchQuery = $event"
    ></form-search>
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
            (searchQuery ? 'noActionsFound' : 'noActionsYet'),
        )
      }}
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { IDialogCollectionController } from '../editor/DialogVariableController';
import ActionsListItem from './ActionsListItem.vue';
import type { ScriptBlockPlainAction } from '../logic/nodeStoring';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import SortableList from '~ims-app-base/components/Common/SortableList.vue';
import FormSearch from '~ims-app-base/components/Form/FormSearch.vue';

export default defineComponent({
  name: 'ActionsList',
  components: {
    ActionsListItem,
    SortableList,
    FormSearch,
  },
  props: {
    collectionController: {
      type: Object as PropType<IDialogCollectionController>,
      required: true,
    },
  },
  data() {
    return {
      searchQuery: '',
    };
  },
  computed: {
    actionsList() {
      return this.collectionController.getEntities();
    },
    filteredActions() {
      return this.actionsList.filter((a) =>
        a.name.toLowerCase().includes(this.searchQuery.toLowerCase()),
      );
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
.ActionsList-search {
  margin-bottom: 10px;
}
.ActionsList-grid {
  --actions-list-columns: 20px 150px 150px minmax(150px, 1fr) minmax(150px, 1fr)
    20px;
  --actions-list-column-gap: 2px;

  margin-bottom: 20px;
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
