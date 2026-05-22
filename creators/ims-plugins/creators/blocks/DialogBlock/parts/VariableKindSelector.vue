<template>
  <value-switcher
    v-model="ownModelValue"
    class="VariableKindSelector"
    :options="visibleOptions"
    label-prop="title"
    value-prop="value"
  >
    <template #[moreSlotName]="{ option }">
      <menu-button class="VariableKindSelector-more">
        <template #button="{ toggle }">
          <button
            :title="option.title"
            class="VariableKindSelector-more-button is-button is-button-value-switcher"
            :class="{ selected: isMoreOptionsButtonSelected }"
            @click="toggle"
          >
            <i v-if="!isMoreOptionsButtonSelected" class="ri-more-2-fill"></i>
            <div v-else>
              {{ moreOptions.find((el) => el.name === ownModelValue)?.title }}
              <i class="ri-more-2-fill"></i>
            </div>
          </button>
        </template>
        <menu-list :menu-list="moreOptions"></menu-list>
      </menu-button>
    </template>
  </value-switcher>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import ValueSwitcher from '~ims-app-base/components/Common/ValueSwitcher.vue';
import MenuButton from '~ims-app-base/components/Common/MenuButton.vue';
import { ScriptBlockPlainVariableKinds } from '../logic/nodeStoring';
import MenuList from '~ims-app-base/components/Common/MenuList.vue';
import type { MenuListItem } from '~ims-app-base/logic/types/MenuList';

const MORE_KINDS = ['in', 'out', 'in-out'] as ScriptBlockPlainVariableKinds[];
const MORE_OPTION_KEY = '__more__';

export default defineComponent({
  name: 'VariableKindSelector',
  components: {
    ValueSwitcher,
    MenuButton,
    MenuList,
  },
  props: {
    modelValue: {
      type: String as PropType<ScriptBlockPlainVariableKinds>,
      default: ScriptBlockPlainVariableKinds.GLOBAL,
    },
  },
  emits: ['update:model-value'],
  computed: {
    ownModelValue: {
      get() {
        return this.modelValue ?? ScriptBlockPlainVariableKinds.GLOBAL;
      },
      set(val: ScriptBlockPlainVariableKinds) {
        this.$emit('update:model-value', val);
      },
    },
    moreSlotName() {
      return 'option-wrapper-' + MORE_OPTION_KEY;
    },
    visibleOptions() {
      return [
        {
          title: this.$t('imsDialogEditor.var.kinds.global'),
          value: ScriptBlockPlainVariableKinds.GLOBAL,
        },
        {
          title: this.$t('imsDialogEditor.var.kinds.local'),
          value: ScriptBlockPlainVariableKinds.LOCAL,
        },
        {
          title: this.$t('imsDialogEditor.var.kinds.more'),
          value: MORE_OPTION_KEY,
        },
      ];
    },
    isMoreOptionsButtonSelected() {
      return this.moreOptions.find((el) => el.name === this.ownModelValue);
    },
    moreOptions(): MenuListItem[] {
      return MORE_KINDS.map((k) => ({
        title: this.$t('imsDialogEditor.var.kinds.' + k),
        name: k,
        action:
          this.ownModelValue === k
            ? undefined
            : () => {
                this.ownModelValue = k;
              },
      }));
    },
  },
});
</script>
<style lang="scss" scoped>
.VariableKindSelector-more-button {
  --button-outline-color: transparent !important;
  border-radius: 0 var(--ValueSwitcher-border-radius)
    var(--ValueSwitcher-border-radius) 0;
}
</style>
