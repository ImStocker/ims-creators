<template>
  <div class="VariableListItem">
    <div class="VariableListItem-column VariableListItem-manage">
      <i class="VariableListItem-drag ri-draggable"></i>
    </div>
    <div class="VariableListItem-column VariableListItem-name">
      <FormCheckBox
        v-if="showAutoFill"
        :value="variable.autoFill"
        :icon="'ri-arrow-right-box-line'"
        :help-text="$t('imsDialogEditor.speech.autoSubstitutionHelpText')"
        @input="changeVariable(variable, { autoFill: $event })"
      />
      <i
        v-if="showKindControl"
        :class="kindIcon"
        class="VariableListItem-kind-icon"
      ></i>
      <div
        class="VariableListItem-name-input"
        @click="editMode = true"
        @focusout="editMode = false"
      >
        <ims-input
          v-if="editMode"
          :model-value="variable.title"
          @change="renameVariable(variable, $event)"
        ></ims-input>
        <imc-presenter v-else :value="variable.title"></imc-presenter>
      </div>
      <form-builder-field-tooltip
        v-if="variable.description"
        :message="variable.description"
      />
    </div>
    <div class="VariableListItem-column VariableListItem-type">
      <variable-type-selector
        class="VariableListItem-type-input"
        :model-value="variable.type"
        @update:model-value="
          changeVariable(variable, { type: $event, default: undefined })
        "
      ></variable-type-selector>
    </div>
    <div
      v-if="variable.type"
      class="VariableListItem-column VariableListItem-defaultValue"
    >
      <data-field-input
        :data-type="variable.type"
        :model-value="variable.default"
        class="VariableListItem-defaultValue-input"
        :has-border="true"
        @update:model-value="changeVariable(variable, { default: $event })"
      ></data-field-input>
    </div>
    <div class="VariableListItem-column VariableListItem-menu">
      <menu-button>
        <menu-list :menu-list="getVariableMenu(variable)" />
      </menu-button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { DialogVariable } from '../editor/DialogBlockController';
import DialogManager from '~ims-app-base/logic/managers/DialogManager';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import { normalizeAssetPropPart } from '~ims-app-base/logic/types/Props';
import {
  nodeVariableAdd,
  nodeVariableChange,
  nodeVariableDuplicate,
} from '../logic/nodeVariables';
import MenuButton from '~ims-app-base/components/Common/MenuButton.vue';
import MenuList from '~ims-app-base/components/Common/MenuList.vue';
import ImsInput from '~ims-app-base/components/Common/ImsInput.vue';
import VariableTypeSelector from '../parts/VariableTypeSelector.vue';
import FormBuilderFieldTooltip from '~ims-app-base/components/Form/FormBuilderFieldTooltip.vue';
import ConfirmDialog from '~ims-app-base/components/Common/ConfirmDialog.vue';
import type { IDialogVariableController } from '../editor/DialogVariableController';
import ImcPresenter from '~ims-app-base/components/ImcText/ImcPresenter.vue';
import {
  ScriptBlockPlainVariableKinds,
  type ScriptBlockPlainVariable,
} from '../logic/nodeStoring';
import FormCheckBox from '~ims-app-base/components/Form/FormCheckBox.vue';
import DataFieldInput from '../parts/DataFieldInput.vue';

export default defineComponent({
  name: 'VariableListItem',
  components: {
    MenuButton,
    MenuList,
    ImsInput,
    VariableTypeSelector,
    FormBuilderFieldTooltip,
    ImcPresenter,
    FormCheckBox,
    DataFieldInput,
  },
  props: {
    variableController: {
      type: Object as PropType<IDialogVariableController>,
      required: true,
    },
    variable: {
      type: Object as PropType<ScriptBlockPlainVariable>,
      required: true,
    },
    showAutoFill: {
      type: Boolean,
      default: false,
    },
    showKindControl: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      editMode: false,
    };
  },
  computed: {
    variableList() {
      return [...this.variableController.getEntities()];
    },
    kindIcon() {
      switch (this.variable.kind) {
        case ScriptBlockPlainVariableKinds.LOCAL:
          return 'ri-terminal-line';
        case ScriptBlockPlainVariableKinds.IN:
          return 'ri-contract-right-line';
        case ScriptBlockPlainVariableKinds.OUT:
          return 'ri-expand-right-line';
        case ScriptBlockPlainVariableKinds.INOUT:
          return 'ri-expand-horizontal-line';
        default:
          return 'ri-global-line';
      }
    },
  },
  methods: {
    async addVariable() {
      const new_variable = await nodeVariableAdd(
        this.$getAppManager(),
        this.variableList,
        {
          alreadyExist: this.$t('imsDialogEditor.var.variableAlreadyExists'),
        },
        this.showAutoFill,
        this.showKindControl,
      );
      if (!new_variable) return;
      this.variableController.addEntity(new_variable);
    },
    async editVariable(variable: DialogVariable) {
      const new_variable = await nodeVariableChange(
        this.$getAppManager(),
        this.variableList,
        variable,
        {
          alreadyExist: this.$t('imsDialogEditor.var.variableAlreadyExists'),
        },
        this.showAutoFill,
        this.showKindControl,
      );
      if (!new_variable) return;
      this.variableController.changeEntity(variable.name, new_variable);
    },
    async duplicateVariable(variable: DialogVariable) {
      const new_variable = await nodeVariableDuplicate(
        this.$getAppManager(),
        this.variableList,
        variable,
        {
          alreadyExist: this.$t('imsDialogEditor.var.variableAlreadyExists'),
        },
        this.showAutoFill,
        this.showKindControl,
      );
      if (!new_variable) return;
      this.variableController.addEntity(new_variable);
    },
    getVariableMenu(variable: DialogVariable) {
      return [
        {
          title: this.$t('imsDialogEditor.var.editVariable'),
          icon: 'edit',
          action: async () => {
            this.editVariable(variable);
          },
        },
        {
          title: this.$t('imsDialogEditor.var.duplicateVariable'),
          icon: 'copy',
          action: async () => {
            this.duplicateVariable(variable);
          },
        },
        ...(this.variableController.canDeleteEntity(variable.name)
          ? [
              {
                title: this.$t('imsDialogEditor.var.deleteVariable'),
                danger: true,
                icon: 'delete',
                action: async () => {
                  const confirm = await this.$getAppManager()
                    .get(DialogManager)
                    .show(ConfirmDialog, {
                      header: this.$t('imsDialogEditor.var.deleteVariable'),
                      message: this.$t(
                        'imsDialogEditor.var.deleteVariableConfirm',
                      ),
                      danger: true,
                    });
                  if (!confirm) return;
                  this.variableController.deleteEntity(variable.name);
                },
              },
            ]
          : []),
      ];
    },
    changeVariable(variable: DialogVariable, change: Partial<DialogVariable>) {
      this.variableController.changeEntity(variable.name, {
        ...variable,
        ...change,
      });
    },
    renameVariable(variable: DialogVariable, new_title: string) {
      const new_name = new_title ? normalizeAssetPropPart(new_title) : '';
      if (variable.name === new_name) {
        return;
      }
      if (!new_name) {
        this.$getAppManager()
          .get(UiManager)
          .showError(this.$t('imsDialogEditor.var.nameIsEmpty'));
        return;
      }
      const exists = this.variableList.some((v) => v.name === new_name);
      if (exists) {
        this.$getAppManager()
          .get(UiManager)
          .showError(this.$t('imsDialogEditor.var.variableAlreadyExists'));
        return;
      }
      this.variableController.changeEntity(variable.name, {
        ...variable,
        title: new_title,
        name: new_name,
      });
    },
  },
});
</script>
<style lang="scss" rel="stylesheet/scss" scoped>
@use '~ims-app-base/style/Form';
@use '~ims-app-base/style/devices-mixins';

.VariableListItem {
  display: grid;
  grid-template-columns: var(--variable-list-columns);
  column-gap: var(--variable-list-column-gap);
}

.VariableListItem-column {
  // border: 1px solid #eee;
  display: flex;
  align-items: center;
}

.VariableListItem-manage {
  grid-column: 1;
}

.VariableListItem-name {
  grid-column: 2;
  gap: 5px;
}

.VariableListItem-name-input {
  flex: 1;
  min-width: 0;

  :deep(.ImsInput) {
    max-width: 100%;
  }
}

.VariableListItem-type {
  grid-column: 3;

  .VariableListItem-type-input {
    display: flex;
    width: 100%;
  }
}
.VariableListItem-defaultValue {
  grid-column: 4;
  padding-left: 5px;
}
.VariableListItem-defaultValue-input {
  position: relative;
  display: flex;
  width: 100%;
  margin-top: 0px;
}
:deep(.DataFieldInput-text) {
  width: 100%;
}
:deep(.DataFieldInput-number) {
  max-width: 100%;
}
:deep(.DataFieldInput-string) {
  width: 100%;
  max-width: 100%;
}
.VariableListItem-menu {
  grid-column: 5;
}

.VariableListItem-drag {
  color: var(--local-sub-text-color);
  cursor: grab;
}
.VariableListItem-kind-icon {
  color: var(--local-sub-text-color);
  font-size: 14px;
  flex-shrink: 0;
}

.VariableListItem-list,
.VariableListItem-empty {
  margin-bottom: 20px;
}

.VariableListItem-empty {
  text-align: center;
}
</style>
