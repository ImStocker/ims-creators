<template>
  <div class="ManageVariablesDropdown is-dropdown">
    <form-search
      v-if="variables && variables.length"
      :value="searchQuery"
      @change="searchQuery = $event"
    ></form-search>
    <template v-if="filteredVariables && filteredVariables.length">
      <div class="ManageVariablesDropdown-list-header">
        <div class="ManageVariablesDropdown-list-header-name">
          {{ $t('imsDialogEditor.var.name') }}
        </div>
        <div class="ManageVariablesDropdown-list-header-value">
          {{
            $t(
              'imsDialogEditor.var.' +
                (isDebugVariables ? 'currentValues' : 'defaultValue'),
            )
          }}
        </div>
      </div>
      <div class="ManageVariablesDropdown-list tiny-scrollbars">
        <div
          v-for="variable of filteredVariables"
          :key="variable.name"
          class="ManageVariablesDropdown-list-item"
          :class="{ 'state-debug': isDebugVariables }"
          :draggable="!readonly"
          @dragstart="onDragStart($event, variable)"
        >
          <div class="ManageVariablesDropdown-list-item-name">
            <i
              :class="kindIcon(variable.kind)"
              class="ManageVariablesDropdown-kind-icon"
            ></i>
            {{ variable.title }}
          </div>
          <div class="ManageVariablesDropdown-list-item-value">
            <DataFieldInput
              v-if="variable.type && (isDebugVariables || !readonly)"
              :data-type="variable.type"
              :model-value="getVariableValue(variable)"
              :readonly="false"
              :has-border="true"
              @update:model-value="setVariableValue(variable, $event)"
            ></DataFieldInput>
            <DataFieldDisplay
              v-else
              :data-type="variable.type"
              :model-value="getVariableValue(variable)"
              :readonly="true"
              :has-border="true"
            ></DataFieldDisplay>
          </div>
        </div>
      </div>
    </template>
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
import DataFieldInput from './DataFieldInput.vue';
import type {
  DialogBlockController,
  DialogVariable,
} from '../editor/DialogBlockController';
import type { DialogPlayer } from '../play/DialogPlayer';
import type { IProjectContext } from '~ims-app-base/logic/types/IProjectContext';
import { assert } from '~ims-app-base/logic/utils/typeUtils';
import FormSearch from '~ims-app-base/components/Form/FormSearch.vue';
import type { ScriptBlockPlainVariableKinds } from '../logic/nodeStoring';
import { getVariableKindIcon } from '../logic/variableKinds';
import type { AssetPropValue } from '~ims-app-base/logic/types/Props';

export default defineComponent({
  name: 'ManageVariablesDropdown',
  components: {
    DataFieldDisplay,
    DataFieldInput,
    FormSearch,
  },
  inject: ['projectContext'],
  props: {
    dialogController: {
      type: Object as PropType<DialogBlockController>,
      required: true,
    },
    dialogPlayer: {
      type: Object as PropType<DialogPlayer | null>,
      default: null,
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
    isDebugVariables(): boolean {
      const player = this.dialogPlayer;
      return !!player && player.isPlaying && player.isPlayDebug;
    },
  },
  methods: {
    kindIcon(kind?: ScriptBlockPlainVariableKinds) {
      return getVariableKindIcon(kind);
    },
    getVariableValue(variable: DialogVariable): AssetPropValue {
      if (this.isDebugVariables && this.dialogPlayer) {
        return (this.dialogPlayer.playVariables[variable.name] ??
          null) as AssetPropValue;
      }
      return variable.default;
    },
    setVariableValue(variable: DialogVariable, value: AssetPropValue) {
      if (this.isDebugVariables) {
        if (this.dialogPlayer) {
          this.dialogPlayer.setPlayVariable(variable.name, value);
        }
        return;
      }
      if (this.readonly) return;
      this.dialogController.changeVariable(variable.name, {
        ...variable,
        default: value,
      });
    },
    onDragStart(e: DragEvent, variable: DialogVariable) {
      e.dataTransfer?.setData('dialog-variable', variable.name);
    },
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
.ManageVariablesDropdown-list-header {
  display: flex;
  flex-wrap: nowrap;
  gap: 20px;
  padding: 0px 5px;
  color: var(--local-sub-text-color);
}
.ManageVariablesDropdown-list-header-name,
.ManageVariablesDropdown-list-header-value {
  flex: 1;
  flex-shrink: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  padding: 0px 5px;
  border-radius: 4px;
  cursor: grab;

  &[draggable] {
    &:hover {
      background-color: var(--local-hl-bg-color);
    }
  }

  &.state-debug {
    background-color: color-mix(
      in srgb,
      var(--imsde-node-playing-color) 8%,
      transparent
    );
    cursor: default;

    .ManageVariablesDropdown-kind-icon {
      color: var(--imsde-node-playing-color);
    }
  }
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
  display: flex;
  align-items: center;
  gap: 6px;
}
.ManageVariablesDropdown-kind-icon {
  color: var(--local-sub-text-color);
  font-size: 14px;
  flex-shrink: 0;
}
.ManageVariablesDropdown-list-item-value {
  min-width: 0;

  :deep(.is-input) {
    max-width: 100%;
    width: 100%;
    overflow: hidden;
  }
}

.ManageVariablesDropdown-list-item.state-debug {
  :deep(.DataFieldInput) {
    color: var(--imsde-node-playing-color);

    input,
    .ql-editor,
    .is-input {
      color: var(--imsde-node-playing-color);
    }
  }

  :deep(.DataFieldDisplay) {
    color: var(--imsde-node-playing-color);
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
