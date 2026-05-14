<template>
  <div class="ManageActionsDropdown is-dropdown">
    <form-search
      v-if="actions && actions.length"
      :value="searchQuery"
      @change="searchQuery = $event"
    ></form-search>
    <div
      v-if="filteredActions && filteredActions.length"
      class="ManageActionsDropdown-list tiny-scrollbars"
    >
      <div
        v-for="action of filteredActions"
        :key="action.name"
        class="ManageActionsDropdown-list-item"
        :draggable="!readonly"
        @dragstart="onDragStart($event, action)"
      >
        <div class="ManageActionsDropdown-list-item-name">
          {{ action.name }}
        </div>
        <div class="ManageActionsDropdown-list-item-type">
          <i
            v-if="getActionType(action)?.icon"
            :class="getActionType(action)?.icon"
            class="ManageActionsDropdown-list-item-type-icon"
          ></i>
          <span class="ManageActionsDropdown-list-item-type-caption">
            {{ getActionType(action)?.title }}
          </span>
        </div>
      </div>
    </div>
    <div v-else class="ManageActionsDropdown-list-empty">
      {{
        $t(
          'imsDialogEditor.actions.' +
            (searchQuery ? 'noActionsFound' : 'noActionsYet'),
        )
      }}
    </div>
    <button
      v-if="!readonly"
      class="is-button is-button-action ManageActionsDropdown-button"
      @click="manageActions"
    >
      {{ $t('imsDialogEditor.actions.manageActions') }}
    </button>
  </div>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type {
  DialogAction,
  DialogBlockController,
} from '../editor/DialogBlockController';
import type { IProjectContext } from '~ims-app-base/logic/types/IProjectContext';
import { assert } from '~ims-app-base/logic/utils/typeUtils';
import { getAvailableActionTypes } from '../logic/nodeActions';
import FormSearch from '~ims-app-base/components/Form/FormSearch.vue';

export default defineComponent({
  name: 'ManageActionsDropdown',
  components: {
    FormSearch,
  },
  inject: ['projectContext'],
  props: {
    dialogController: {
      type: Object as PropType<DialogBlockController>,
      required: true,
    },
    readonly: {
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
    actions() {
      return this.dialogController.getActions();
    },
    filteredActions() {
      return this.actions.filter((el) =>
        el.name.toLowerCase().includes(this.searchQuery.toLowerCase()),
      );
    },
    availableActionTypes() {
      return getAvailableActionTypes((key: string) => this.$t(key));
    },
  },
  methods: {
    onDragStart(e: DragEvent, action: DialogAction) {
      e.dataTransfer?.setData('dialog-action', action.name);
    },
    getActionType(action: DialogAction) {
      return this.availableActionTypes.find((el) => el.value === action.type);
    },
    manageActions() {
      assert(this.projectContext, 'Project context is not provided');
      this.dialogController.manageActions(
        this.projectContext as IProjectContext,
      );
    },
  },
});
</script>
<style lang="scss" scoped>
.ManageActionsDropdown {
  width: 350px;
  max-height: 400px;
  padding: 10px 15px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ManageActionsDropdown-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-height: 0;
  overflow: auto;
}
.ManageActionsDropdown-list-item {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 20px;
  padding: 0px 5px;
  border-radius: 4px;
  cursor: grab;

  &[draggable] {
    &:hover {
      background-color: var(--local-hl-bg-color);
    }
  }
}
.ManageActionsDropdown-list-item-name,
.ManageActionsDropdown-list-item-type {
  flex: 1;
  flex-shrink: 0;
  position: relative;
}
.ManageActionsDropdown-list-item-type {
  display: flex;
  gap: 5px;
}
.ManageActionsDropdown-button {
  margin: 0 auto;
}
.ManageActionsDropdown-list-empty {
  color: var(--local-sub-text-color);
  font-style: italic;
}
</style>
