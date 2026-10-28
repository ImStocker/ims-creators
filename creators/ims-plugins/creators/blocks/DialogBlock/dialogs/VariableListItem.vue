<template>
  <some-editor-list-item class="VariableListItem" :item="variable">
    <template #item-main>
      <div class="VariableListItem-main">
        <span
          class="VariableListItem-typeDot field-type-dot"
          :class="typeDotClass"
          :title="$t('imsDialogEditor.var.type')"
        ></span>
        <renamable-text
          v-model:is-renaming-mode-state="isMainEditMode"
          class="VariableListItem-title"
          :class="{ 'is-editing': isMainEditMode }"
        >
          <caption-string
            :value="variable.title"
            class="VariableListItem-title-text"
          />
          <template #editor="{ applyRenaming }">
            <div
              ref="mainEdit"
              class="VariableListItem-main-editor"
              @vue:mounted="_editMainMounted"
              @focusout="_mainEditFocusOut($event, applyRenaming)"
            >
              <ims-text-input
                ref="mainEditTitle"
                class="VariableListItem-main-editor-title"
                :model-value="mainEditItem.title"
                @update:model-value="mainEditSetTitle($event)"
              />
              <variable-type-selector
                ref="mainEditType"
                class="VariableListItem-main-editor-type"
                :model-value="variable.type"
                @update:model-value="changeType($event)"
              />
              <div class="VariableListItem-main-editor-serviceName">
                <div
                  class="VariableListItem-main-editor-serviceName-icon"
                  :title="$t('imsDialogEditor.var.serviceName')"
                >
                  <i class="ri-price-tag-3-fill"></i>
                </div>
                <ims-text-input
                  ref="mainEditName"
                  class="VariableListItem-main-editor-serviceName-input"
                  :model-value="mainEditItem.name"
                  :title="$t('imsDialogEditor.var.serviceName')"
                  @update:model-value="mainEditSetName($event)"
                />
              </div>
            </div>
          </template>
        </renamable-text>
        <div v-if="!isMainEditMode" class="VariableListItem-type">
          <variable-type-presenter
            class="VariableListItem-type-presenter"
            :model-value="variable.type"
            :title="$t('imsDialogEditor.var.type')"
            @dblclick="editType"
          />
        </div>
        <div
          v-if="!isMainEditMode"
          class="VariableListItem-serviceName"
          :title="$t('imsDialogEditor.var.serviceName')"
          @dblclick="editServiceName"
        >
          <i class="ri-price-tag-3-fill"></i>
          <span class="VariableListItem-serviceName-text">
            {{ variable.name }}
          </span>
        </div>
        <menu-button
          v-if="showKindControl"
          class="VariableListItem-kind"
          :tooltip="currentKindOption.title"
        >
          <template #button="{ toggle }">
            <button
              type="button"
              class="is-button is-button-icon VariableListItem-kindButton"
              :title="currentKindOption.title"
              @click.stop="toggle"
            >
              <i :class="currentKindOption.icon"></i>
            </button>
          </template>
          <menu-list :menu-list="kindMenu" />
        </menu-button>
        <menu-button class="VariableListItem-menu">
          <menu-list :menu-list="getVariableMenu(variable)" />
        </menu-button>
      </div>
    </template>
    <template #item-advanced>
      <div class="VariableListItem-advanced">
        <div class="VariableListItem-advanced-field">
          <div class="VariableListItem-advanced-caption">
            {{ $t('imsDialogEditor.var.defaultValue') }}
          </div>
          <data-field-input
            v-if="variable.type"
            :data-type="variable.type"
            :model-value="variable.default"
            class="VariableListItem-advanced-default"
            :has-border="true"
            @update:model-value="changeVariable(variable, { default: $event })"
          ></data-field-input>
          <div v-else class="VariableListItem-advanced-empty">
            {{ $t('imsDialogEditor.common.noValue') }}
          </div>
        </div>
        <div class="VariableListItem-advanced-field">
          <div class="VariableListItem-advanced-caption">
            {{ $t('imsDialogEditor.var.description') }}
          </div>
          <ims-input
            class="VariableListItem-advanced-hint"
            type="textarea"
            :auto-extend="true"
            :model-value="variable.description ?? ''"
            :placeholder="$t('imsDialogEditor.var.enterDescription')"
            @update:model-value="changeDescription"
          ></ims-input>
        </div>
        <form-check-box
          v-if="showAutoFill"
          :value="variable.autoFill"
          :caption="$t('imsDialogEditor.speech.autoSubstitutionHelpText')"
          @input="changeVariable(variable, { autoFill: $event })"
        />
        <div class="VariableListItem-advanced-actions">
          <button
            v-if="variableController.canDeleteEntity(variable.name)"
            type="button"
            class="is-button is-button-action danger"
            @click="deleteVariable(variable)"
          >
            {{ $t('imsDialogEditor.var.deleteVariableShort') }}
          </button>
          <button
            type="button"
            class="is-button is-button-action"
            @click="duplicateVariable(variable)"
          >
            {{ $t('imsDialogEditor.var.duplicateVariableShort') }}
          </button>
        </div>
      </div>
    </template>
  </some-editor-list-item>
</template>

<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type { DialogVariable } from '../editor/DialogBlockController';
import DialogManager from '~ims-app-base/logic/managers/DialogManager';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import { normalizeAssetPropPart } from '~ims-app-base/logic/types/Props';
import { guessDuplicatedItemTitle } from '../logic/nodeVariables';
import MenuButton from '~ims-app-base/components/Common/MenuButton.vue';
import MenuList from '~ims-app-base/components/Common/MenuList.vue';
import ImsInput from '~ims-app-base/components/Common/ImsInput.vue';
import ImsTextInput from '~ims-app-base/components/Common/ImsTextInput.vue';
import ConfirmDialog from '~ims-app-base/components/Common/ConfirmDialog.vue';
import type { IDialogVariableController } from '../editor/DialogVariableController';
import {
  ScriptBlockPlainVariableKinds,
  type ScriptBlockPlainVariable,
} from '../logic/nodeStoring';
import FormCheckBox from '~ims-app-base/components/Form/FormCheckBox.vue';
import DataFieldInput from '../parts/DataFieldInput.vue';
import SomeEditorListItem from '~ims-app-base/components/Asset/SpecialTypes/SomeEditorListItem.vue';
import RenamableText from '~ims-app-base/components/Common/RenamableText.vue';
import CaptionString from '~ims-app-base/components/Common/CaptionString.vue';
import VariableTypeSelector from '../parts/VariableTypeSelector.vue';
import VariableTypePresenter from '../parts/VariableTypePresenter.vue';
import { getVariableTypeDotClass } from '../logic/variableTypes';
import { VARIABLE_KINDS } from '../logic/variableKinds';

type VariableKindOption = {
  value: ScriptBlockPlainVariableKinds;
  title: string;
  icon: string;
};

export default defineComponent({
  name: 'VariableListItem',
  components: {
    SomeEditorListItem,
    RenamableText,
    CaptionString,
    MenuButton,
    MenuList,
    ImsInput,
    ImsTextInput,
    FormCheckBox,
    DataFieldInput,
    VariableTypeSelector,
    VariableTypePresenter,
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
      mainEditItem: { ...this.variable },
      isMainEditMode: false,
    };
  },
  computed: {
    typeDotClass(): string {
      return getVariableTypeDotClass(this.variable.type);
    },
    variableList(): DialogVariable[] {
      return [...this.variableController.getEntities()];
    },
    kindOptions(): VariableKindOption[] {
      return VARIABLE_KINDS.map((option) => ({
        value: option.kind,
        title: this.$t(option.titleKey),
        icon: option.icon,
      }));
    },
    currentKind(): ScriptBlockPlainVariableKinds {
      return this.variable.kind ?? ScriptBlockPlainVariableKinds.GLOBAL;
    },
    currentKindOption(): VariableKindOption {
      return (
        this.kindOptions.find((option) => option.value === this.currentKind) ??
        this.kindOptions[0]
      );
    },
    kindMenu() {
      return this.kindOptions.map((option) => ({
        title: option.title,
        icon: option.icon,
        cssClass:
          option.value === this.currentKind ? 'state-active' : undefined,
        action: () => this.changeKind(option.value),
      }));
    },
  },
  watch: {
    isMainEditMode(mode: boolean) {
      if (!mode) {
        this.applyMainEdit();
      }
    },
  },
  methods: {
    _editMainMounted() {
      const mainEditTitle = this.$refs['mainEditTitle'] as InstanceType<
        typeof ImsTextInput
      > | null;
      if (!mainEditTitle) {
        return;
      }
      this.mainEditItem = { ...this.variable };
      (mainEditTitle as any).selectAll?.();
    },
    _mainEditFocusOut(event: FocusEvent, applyRenaming: () => void) {
      const mainEdit = this.$refs['mainEdit'] as HTMLDivElement | null;
      if (!mainEdit) {
        return;
      }
      if (
        event.relatedTarget &&
        !mainEdit.contains(event.relatedTarget as HTMLElement)
      ) {
        applyRenaming();
      }
    },
    mainEditSetTitle(val: string) {
      this.mainEditItem.title = val;
      const old_auto_name = normalizeAssetPropPart(this.variable.title ?? '');
      const new_auto_name = normalizeAssetPropPart(val);
      const service_name_is_auto =
        !this.variable.name || this.variable.name === old_auto_name;
      if (service_name_is_auto && new_auto_name) {
        const name_is_busy = this.variableList.some(
          (variable) =>
            variable.name !== this.variable.name &&
            variable.name === new_auto_name,
        );
        if (!name_is_busy) {
          this.mainEditItem.name = new_auto_name;
        }
      }
    },
    mainEditSetName(val: string) {
      this.mainEditItem.name = normalizeAssetPropPart(val);
    },
    applyMainEdit() {
      const change: Partial<DialogVariable> = {};
      if (this.mainEditItem.title !== this.variable.title) {
        change.title = this.mainEditItem.title;
      }
      if (this.mainEditItem.name !== this.variable.name) {
        const normalized_name = normalizeAssetPropPart(this.mainEditItem.name);
        if (!normalized_name) {
          this.$getAppManager()
            .get(UiManager)
            .showError(this.$t('imsDialogEditor.var.nameIsEmpty'));
          this.mainEditItem = { ...this.variable };
          return;
        }
        const exists = this.variableList.some(
          (variable) => variable.name === normalized_name,
        );
        if (exists) {
          this.$getAppManager()
            .get(UiManager)
            .showError(this.$t('imsDialogEditor.var.variableAlreadyExists'));
          this.mainEditItem = { ...this.variable };
          return;
        }
        change.name = normalized_name;
      }
      if (Object.keys(change).length > 0) {
        this.changeVariable(this.variable, change);
      }
      this.mainEditItem = { ...this.variable };
    },
    duplicateVariable(variable: DialogVariable) {
      const guessed_title = guessDuplicatedItemTitle(
        variable.title,
        this.variableList,
      );
      const guessed_name = normalizeAssetPropPart(guessed_title);
      const max_index = this.variableList.reduce(
        (acc, v) => Math.max(acc, v.index ?? 0),
        -1,
      );
      this.variableController.addEntity({
        ...variable,
        name: guessed_name,
        title: guessed_title,
        index: max_index + 1,
      });
    },
    async deleteVariable(variable: DialogVariable) {
      const confirm = await this.$getAppManager()
        .get(DialogManager)
        .show(ConfirmDialog, {
          header: this.$t('imsDialogEditor.var.deleteVariable'),
          message: this.$t('imsDialogEditor.var.deleteVariableConfirm'),
          danger: true,
        });
      if (!confirm) return;
      this.variableController.deleteEntity(variable.name);
    },
    getVariableMenu(variable: DialogVariable) {
      return [
        {
          title: this.$t('imsDialogEditor.var.duplicateVariable'),
          icon: 'copy',
          action: async () => {
            await this.duplicateVariable(variable);
          },
        },
        ...(this.variableController.canDeleteEntity(variable.name)
          ? [
              {
                title: this.$t('imsDialogEditor.var.deleteVariable'),
                danger: true,
                icon: 'delete',
                action: async () => {
                  await this.deleteVariable(variable);
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
    changeType(type: DialogVariable['type']) {
      this.changeVariable(this.variable, { type, default: undefined });
    },
    async editType() {
      if ((this as any).readonly || this.isMainEditMode) {
        return;
      }
      this.isMainEditMode = true;
      await this.$nextTick();
      const mainEditType = this.$refs['mainEditType'] as
        | { $el?: HTMLElement }
        | undefined;
      const input = mainEditType?.$el?.querySelector('input');
      (input as HTMLInputElement | null)?.focus();
    },
    async editServiceName() {
      if ((this as any).readonly || this.isMainEditMode) {
        return;
      }
      this.isMainEditMode = true;
      await this.$nextTick();
      const mainEditName = this.$refs['mainEditName'] as InstanceType<
        typeof ImsTextInput
      > | null;
      if (!mainEditName) {
        return;
      }
      (mainEditName as any).selectAll?.();
    },
    changeTitle(new_title: string) {
      const change: Partial<DialogVariable> = { title: new_title };
      const old_auto_name = normalizeAssetPropPart(this.variable.title ?? '');
      const new_auto_name = normalizeAssetPropPart(new_title);
      const service_name_is_auto =
        !this.variable.name || this.variable.name === old_auto_name;
      if (service_name_is_auto && new_auto_name) {
        const name_is_busy = this.variableList.some(
          (variable) =>
            variable.name !== this.variable.name &&
            variable.name === new_auto_name,
        );
        if (!name_is_busy) {
          change.name = new_auto_name;
        }
      }
      this.changeVariable(this.variable, change);
    },
    changeServiceName(new_name: string) {
      const normalized_name = normalizeAssetPropPart(new_name);
      if (normalized_name === this.variable.name) {
        return;
      }
      if (!normalized_name) {
        this.$getAppManager()
          .get(UiManager)
          .showError(this.$t('imsDialogEditor.var.nameIsEmpty'));
        return;
      }
      const exists = this.variableList.some(
        (variable) => variable.name === normalized_name,
      );
      if (exists) {
        this.$getAppManager()
          .get(UiManager)
          .showError(this.$t('imsDialogEditor.var.variableAlreadyExists'));
        return;
      }
      this.variableController.changeEntity(this.variable.name, {
        ...this.variable,
        name: normalized_name,
      });
    },
    changeKind(kind: ScriptBlockPlainVariableKinds) {
      if (this.currentKind === kind) {
        return;
      }
      this.changeVariable(this.variable, { kind });
    },
    changeDescription(description: string) {
      this.changeVariable(this.variable, {
        description: description ? description : null,
      });
    },
  },
});
</script>
<style lang="scss" rel="stylesheet/scss" scoped>
@use '~ims-app-base/style/Form';
@use '~ims-app-base/style/field-type-dot' as *;

.VariableListItem-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: calc(55px - 16px);
}

.VariableListItem-typeDot {
  flex: none;
  align-self: center;
}

.VariableListItem-title {
  min-width: 0;

  &:not(.is-editing) {
    flex: 1 1 40%;
  }

  &.is-editing {
    flex: 1;
  }

  :deep(.RenamableText-static) {
    min-width: 0;
  }

  :deep(.CaptionString) {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.VariableListItem-title-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.VariableListItem-main-editor {
  display: flex;
  gap: 8px;
  align-items: center;
  min-height: 1.8em;
}

.VariableListItem-main-editor-title {
  flex: 1 1 40%;
  min-width: 0;
}

.VariableListItem-main-editor-type {
  flex: 1 1 40%;
  min-width: 0;

  :deep(.VariableTypeSelector-type) {
    min-width: 0;
  }

  :deep(.is-select) {
    --input-padding-vertical: 0.1em;
    --input-padding-horizontal: 0.5em;
  }
}

.VariableListItem-main-editor-serviceName {
  display: flex;
  flex: 1 1 20%;
  gap: 4px;
  align-items: center;
  min-width: 0;
}

.VariableListItem-main-editor-serviceName-icon {
  flex: none;
  color: var(--local-sub-text-color);
}

.VariableListItem-main-editor-serviceName-input {
  flex: 1 1 auto;
  min-width: 0;
}

.VariableListItem-type {
  flex: 1 1 40%;
  min-width: 0;
}

.VariableListItem-type-presenter {
  width: 100%;
  min-width: 0;
}

.VariableListItem-serviceName {
  display: flex;
  flex: 1 1 20%;
  gap: 4px;
  align-items: center;
  min-width: 0;
  color: var(--local-sub-text-color);
  overflow: hidden;
}

.VariableListItem-serviceName-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.VariableListItem-kind {
  flex: none;
}

.VariableListItem-kindButton {
  color: var(--button-text-color);
}

.VariableListItem-menu {
  flex: none;
}

.VariableListItem-advanced {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.VariableListItem-advanced-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.VariableListItem-advanced-caption {
  font-weight: bold;
}

.VariableListItem-advanced-default {
  position: relative;
  display: flex;
  width: 100%;
  margin-top: 0;
}

.VariableListItem-advanced-hint {
  width: 100%;
  align-items: flex-start;

  :deep(.ImsInput-inner) {
    min-height: 60px;
  }
}

.VariableListItem-advanced-empty {
  color: var(--local-sub-text-color);
  font-style: italic;
}

.VariableListItem-advanced-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

:deep(.DataFieldInput-text),
:deep(.DataFieldInput-string) {
  width: 100%;
  max-width: 100%;
}

:deep(.MenuList-item-inner.state-active) {
  color: var(--color-accent);
}
</style>
