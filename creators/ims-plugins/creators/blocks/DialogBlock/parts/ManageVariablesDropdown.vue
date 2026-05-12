<template>
  <div class="ManageVariablesDropdown is-dropdown">
    <form-search
      v-if="variables && variables.length"
      :value="searchQuery"
      @change="searchQuery = $event"
    ></form-search>
    <div
      v-if="filteredVariables && filteredVariables.length"
      class="ManageVariablesDropdown-list tiny-scrollbars"
    >
      <div
        v-for="variable of filteredVariables"
        :key="variable.name"
        class="ManageVariablesDropdown-list-item"
      >
        <div class="ManageVariablesDropdown-list-item-name">
          {{ variable.title }}
        </div>
        <div class="ManageVariablesDropdown-list-item-value">
          <DataFieldDisplay
            :data-type="variable.type"
            :model-value="variable.default"
            :readonly="true"
            :has-border="true"
          ></DataFieldDisplay>
        </div>
      </div>
    </div>
    <div v-else class="ManageVariablesDropdown-list-empty">
      {{
        $t(
          'imsDialogEditor.var.' +
            (searchQuery ? 'noVariablesFound' : 'noVariablesYet'),
        )
      }}
    </div>
    <button
      v-if="!readonly"
      class="is-button is-button-action ManageVariablesDropdown-button"
      @click="manageVariables"
    >
      {{ $t('imsDialogEditor.var.manageVariables') }}
    </button>
  </div>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import DataFieldDisplay from './DataFieldDisplay.vue';
import type { DialogBlockController } from '../editor/DialogBlockController';
import type { IProjectContext } from '~ims-app-base/logic/types/IProjectContext';
import { assert } from '~ims-app-base/logic/utils/typeUtils';
import FormSearch from '~ims-app-base/components/Form/FormSearch.vue';

export default defineComponent({
  name: 'ManageVariablesDropdown',
  components: {
    DataFieldDisplay,
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
    variables() {
      return this.dialogController.getVariables();
    },
    filteredVariables() {
      return this.variables.filter((v) =>
        v.title.toLowerCase().includes(this.searchQuery.toLowerCase()),
      );
    },
  },
  methods: {
    manageVariables() {
      assert(this.projectContext, 'Project context is not provided');
      this.dialogController.manageVariables(
        this.projectContext as IProjectContext,
      );
    },
  },
});
</script>
<style lang="scss" scoped>
.ManageVariablesDropdown {
  width: 350px;
  max-height: 400px;
  padding: 10px 15px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ManageVariablesDropdown-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-height: 0;
  overflow: auto;
}
.ManageVariablesDropdown-list-item {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 20px;
}
.ManageVariablesDropdown-list-item-name,
.ManageVariablesDropdown-list-item-value {
  flex: 1;
  flex-shrink: 0;
  position: relative;
}
.ManageVariablesDropdown-list-item-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ManageVariablesDropdown-list-item-value {
  min-width: 0;

  :deep(.is-input) {
    max-width: 100%;
    width: 100%;
    overflow: hidden;
  }
}

.ManageVariablesDropdown-button {
  margin: 0 auto;
}

.ManageVariablesDropdown-list-empty {
  color: var(--local-sub-text-color);
  font-style: italic;
}
</style>
