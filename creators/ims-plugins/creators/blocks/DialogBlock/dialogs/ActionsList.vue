<template>
  <div
    v-if="filteredActions.length > 0 || !embedded"
    class="ActionsList"
    :class="{ 'state-embedded': embedded }"
  >
    <actions-list-filters
      v-if="showFilters"
      :filters="filters"
      @update:filters="$emit('update:filters', $event)"
    >
      <template #prepend-filters>
        <slot name="prepend-filters"></slot>
      </template>
    </actions-list-filters>
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
    <div v-else-if="!embedded" class="ActionsList-empty">
      {{
        $t(
          'imsDialogEditor.actions.' +
            (filters?.query ? 'noActionsFound' : 'noActionsYet'),
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
import ActionsListFilters from './ActionsListFilters.vue';
import {
  isActionVisible,
  type ActionsListFilters as ActionsListFiltersType,
} from './collectionItemFilters';

export default defineComponent({
  name: 'ActionsList',
  components: {
    ActionsListItem,
    SortableList,
    ActionsListFilters,
  },
  props: {
    collectionController: {
      type: Object as PropType<IDialogCollectionController>,
      required: true,
    },
    filters: {
      type: [Object, null] as PropType<ActionsListFiltersType | null>,
      default: null,
    },
    showFilters: {
      type: Boolean,
      default: true,
    },
    embedded: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:filters'],
  computed: {
    actionsList() {
      return this.collectionController.getEntities();
    },
    filteredActions() {
      return this.actionsList.filter((a) => isActionVisible(a, this.filters));
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
@use '~ims-app-base/style/devices-mixins';

.ActionsList {
  height: 100%;
  display: flex;
  flex-direction: column;

  &.state-embedded {
    height: auto;

    .ActionsList-grid {
      flex: none;
      min-height: 0;
    }

    .ActionsList-content {
      flex: none;
      overflow: visible;
    }
  }
}
.ActionsList-grid {
  --actions-list-columns: 20px 150px 150px minmax(150px, 1fr) minmax(150px, 1fr)
    20px;
  --actions-list-column-gap: 2px;

  min-height: 0;
  display: flex;
  flex-direction: column;

  @include devices-mixins.device-type(not-pc) {
    flex: 1;
    overflow: auto;
  }
}
.ActionsList-content {
  overflow: auto;
  flex: 1;

  @include devices-mixins.device-type(not-pc) {
    overflow: visible;
  }
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
