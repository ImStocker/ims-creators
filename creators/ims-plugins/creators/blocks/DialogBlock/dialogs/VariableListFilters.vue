<template>
  <div class="VariableList-filters">
    <div class="VariableList-filters-group">
      <slot name="prepend-filters"></slot>
      <variable-kind-selector
        :model-value="filters?.kind ?? null"
        class="VariableList-filters-kind"
        @update:model-value="changeFilters('kind', $event)"
      ></variable-kind-selector>
    </div>
    <form-search
      v-if="showSearch"
      class="VariableList-filters-query"
      :value="filters?.query ?? ''"
      @change="changeFilters('query', $event)"
    ></form-search>
  </div>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import FormSearch from '~ims-app-base/components/Form/FormSearch.vue';
import type { VariableListFilters } from './collectionItemFilters';
import VariableKindSelector from '../parts/VariableKindSelector.vue';

export type { VariableListFilters } from './collectionItemFilters';

export default defineComponent({
  name: 'VariableListFilters',
  components: {
    FormSearch,
    VariableKindSelector,
  },
  props: {
    filters: {
      type: [Object, null] as PropType<VariableListFilters | null>,
      default: null,
    },
    showSearch: {
      type: Boolean,
      default: true,
    },
  },
  emits: ['update:filters'],
  methods: {
    changeFilters<N extends keyof VariableListFilters>(
      name: N,
      val: VariableListFilters[N],
    ) {
      this.$emit('update:filters', {
        ...this.filters,
        [name]: val,
      });
    },
  },
});
</script>
<style lang="scss" scoped>
@use '~ims-app-base/style/devices-mixins';

.VariableList-filters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
  flex-wrap: nowrap;

  .VariableList-filters-group {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .VariableList-filters-kind {
    width: auto;
    --ValueSwitcher-border-radius: 8px;
  }

  .VariableList-filters-query {
    flex: 1 1 auto;
    min-width: 0;
  }

  @include devices-mixins.device-type(not-pc) {
    flex-wrap: wrap;

    .VariableList-filters-group {
      flex: 1;
      flex-wrap: wrap;
    }
  }

  @include devices-mixins.device-type(mb) {
    .VariableList-filters-query {
      flex: 1 1 100%;
    }
  }
}
</style>
