<template>
  <div
    v-if="filteredActions.length > 0 || !embedded || showAdd"
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
    <sortable-list
      v-if="filteredActions.length > 0"
      class="ActionsList-content tiny-scrollbars"
      handle-selector=".SomeEditorListItem-drag"
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
    <div v-else-if="!embedded" class="ActionsList-empty">
      {{
        $t(
          'imsDialogEditor.actions.' +
            (filters?.query ? 'noActionsFound' : 'noActionsYet'),
        )
      }}
    </div>
    <button
      v-if="showAdd"
      type="button"
      class="ActionsList-addButton"
      @click="$emit('add')"
    >
      <i class="ri-add-box-fill"></i>
      {{ addCaption || $t('common.dialogs.add') }}
    </button>
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
    showAdd: {
      type: Boolean,
      default: true,
    },
    addCaption: {
      type: String,
      default: '',
    },
  },
  emits: ['update:filters', 'add'],
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

    .ActionsList-content {
      flex: none;
      overflow: visible;
    }
  }
}
.ActionsList-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
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
.ActionsList-addButton {
  margin-top: 10px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1.5px dashed var(--local-border-color);
  border-radius: 12px;
  background: transparent;
  color: var(--local-sub-text-color);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition:
    color 0.15s ease,
    border-color 0.15s ease,
    background 0.15s ease;

  i {
    font-size: 16px;
  }

  &:hover {
    color: var(--local-text-color);
    border-color: var(--local-border-color);
    background: var(--button-bg-color-hover);
  }
}
:deep(.SortableList-item) {
  padding: 0;
}
</style>
