<template>
  <div class="ActionsList-filters">
    <div class="ActionsList-filters-group">
      <slot name="prepend-filters"></slot>
      <action-type-selector
        :model-value="filters?.type ?? null"
        class="ActionsList-filters-type"
        @update:model-value="changeFilters('type', $event)"
      ></action-type-selector>
    </div>
    <form-search
      v-if="showSearch"
      class="ActionsList-filters-query"
      :value="filters?.query ?? ''"
      @change="changeFilters('query', $event)"
    ></form-search>
  </div>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import FormSearch from '~ims-app-base/components/Form/FormSearch.vue';
import type { ActionsListFilters } from './collectionItemFilters';
import ActionTypeSelector from '../parts/ActionTypeSelector.vue';

export type { ActionsListFilters } from './collectionItemFilters';

export default defineComponent({
  name: 'ActionsListFilters',
  components: {
    FormSearch,
    ActionTypeSelector,
  },
  props: {
    filters: {
      type: [Object, null] as PropType<ActionsListFilters | null>,
      default: null,
    },
    showSearch: {
      type: Boolean,
      default: true,
    },
  },
  emits: ['update:filters'],
  methods: {
    changeFilters<N extends keyof ActionsListFilters>(
      name: N,
      val: ActionsListFilters[N],
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

.ActionsList-filters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
  flex-wrap: nowrap;

  .ActionsList-filters-group {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .ActionsList-filters-type {
    --ValueSwitcher-border-radius: 8px;
  }

  .ActionsList-filters-query {
    flex: 1 1 auto;
    min-width: 0;
  }

  @include devices-mixins.device-type(not-pc) {
    flex-wrap: wrap;

    .ActionsList-filters-group {
      flex-wrap: wrap;
    }
  }

  @include devices-mixins.device-type(mb) {
    .ActionsList-filters-query {
      flex: 1 1 100%;
    }
  }
}
</style>
