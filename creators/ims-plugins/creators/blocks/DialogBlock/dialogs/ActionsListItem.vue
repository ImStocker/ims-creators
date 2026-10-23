<template>
  <some-editor-list-item class="ActionsListItem" :item="action">
    <template #item-main>
      <div class="ActionsListItem-main">
        <menu-button
          class="ActionsListItem-type"
          :tooltip="currentTypeOption.title"
        >
          <template #button="{ toggle }">
            <button
              type="button"
              class="is-button is-button-icon ActionsListItem-iconButton"
              :title="currentTypeOption.title"
              @click.stop="toggle"
            >
              <i :class="currentTypeOption.icon"></i>
            </button>
          </template>
          <menu-list :menu-list="typeMenu" />
        </menu-button>
        <renamable-text
          :value="getActionTitle(action)"
          :title="getActionTitle(action)"
          class="ActionsListItem-title"
          @change="changeTitle"
        >
          <caption-string :value="getActionTitle(action)" />
        </renamable-text>
        <span class="ActionsListItem-paren">(</span>
        <div class="ActionsListItem-params input">
          <div
            v-for="param of getParams(false)"
            :key="getParamKey(param, false)"
            class="ActionsListItem-param"
          >
            <button
              type="button"
              class="ActionsListItem-paramType"
              :title="getParamTypeTitle(param)"
              @click.stop="openParameter(param, false, 'type')"
            >
              <span
                class="field-type-dot ActionsListItem-paramType-dot"
                :class="getParamTypeDotClass(param)"
              ></span>
            </button>
            <button
              type="button"
              class="ActionsListItem-paramTitle"
              :title="getParamTitle(param)"
              @click.stop="openParameter(param, false, 'title')"
            >
              {{ getParamTitle(param) }}
            </button>
            <action-parameter-dropdown
              v-if="openedParam && isOpenedParameter(param, false)"
              :key="openedParam.key"
              :param="param"
              :focus-field="openedParam.focus"
              @change="changeParameter(param, false, $event)"
              @close="closeParameter"
            />
          </div>
        </div>
        <span class="ActionsListItem-paren">)</span>
        <i class="ActionsListItem-arrow ri-arrow-right-line"></i>
        <div class="ActionsListItem-params output">
          <div
            v-for="param of getParams(true)"
            :key="getParamKey(param, true)"
            class="ActionsListItem-param"
          >
            <button
              type="button"
              class="ActionsListItem-paramType"
              :title="getParamTypeTitle(param)"
              @click.stop="openParameter(param, true, 'type')"
            >
              <span
                class="field-type-dot ActionsListItem-paramType-dot"
                :class="getParamTypeDotClass(param)"
              ></span>
            </button>
            <button
              type="button"
              class="ActionsListItem-paramTitle"
              :title="getParamTitle(param)"
              @click.stop="openParameter(param, true, 'title')"
            >
              {{ getParamTitle(param) }}
            </button>
            <action-parameter-dropdown
              v-if="openedParam && isOpenedParameter(param, true)"
              :key="openedParam.key"
              :param="param"
              :focus-field="openedParam.focus"
              @change="changeParameter(param, true, $event)"
              @close="closeParameter"
            />
          </div>
        </div>
        <div class="ActionsListItem-spacer"></div>
        <renamable-text
          :value="action.name"
          :title="$t('imsDialogEditor.actions.serviceName')"
          class="ActionsListItem-serviceName"
          @change="changeServiceName"
        >
          <span class="ActionsListItem-serviceName-text">
            <i class="ri-price-tag-3-fill"></i>
            {{ action.name }}
          </span>
          <template
            #editor="{
              modelValue,
              updateModelValue,
              applyRenaming,
              cancelRenaming,
            }"
          >
            <div class="ActionsListItem-serviceName-editor">
              <i
                class="ri-price-tag-3-fill ActionsListItem-serviceName-editor-icon"
              ></i>
              <ims-text-input
                class="ActionsListItem-serviceName-editor-input"
                :model-value="modelValue"
                :title="$t('imsDialogEditor.actions.serviceName')"
                @update:model-value="updateModelValue"
                @enter="applyRenaming"
                @blur="applyRenaming"
                @escape="cancelRenaming"
              />
            </div>
          </template>
        </renamable-text>
        <menu-button class="ActionsListItem-menu">
          <menu-list :menu-list="actionMenu" />
        </menu-button>
      </div>
    </template>
  </some-editor-list-item>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import type {
  ScriptBlockPlainActionTypes,
  ScriptBlockPlainAction,
  ScriptBlockPlainVariable,
} from '../logic/nodeStoring';
import { normalizeAssetPropPart } from '~ims-app-base/logic/types/Props';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import type { IDialogCollectionController } from '../editor/DialogVariableController';
import type { DialogAction } from '../editor/DialogBlockController';
import MenuButton from '~ims-app-base/components/Common/MenuButton.vue';
import MenuList from '~ims-app-base/components/Common/MenuList.vue';
import DialogManager from '~ims-app-base/logic/managers/DialogManager';
import ConfirmDialog from '~ims-app-base/components/Common/ConfirmDialog.vue';
import EnterActionDialog from './EnterActionDialog.vue';
import ActionParameterDropdown, {
  type ActionParameterDropdownFocus,
} from './ActionParameterDropdown.vue';
import {
  checkParamsExists,
  guessDuplicatedItemTitle,
} from '../logic/nodeVariables';
import SomeEditorListItem from '~ims-app-base/components/Asset/SpecialTypes/SomeEditorListItem.vue';
import RenamableText from '~ims-app-base/components/Common/RenamableText.vue';
import ImsTextInput from '~ims-app-base/components/Common/ImsTextInput.vue';
import CaptionString from '~ims-app-base/components/Common/CaptionString.vue';
import {
  getVariableTypeTitleKey,
  getVariableTypeDotClass,
} from '../logic/variableTypes';
import {
  getAvailableActionTypes,
  withFunctionOutParam,
} from '../logic/nodeActions';

type OpenedParameter = {
  index: number;
  is_output: boolean;
  focus: ActionParameterDropdownFocus;
  key: number;
};

export default defineComponent({
  name: 'ActionsListItem',
  components: {
    SomeEditorListItem,
    RenamableText,
    ImsTextInput,
    CaptionString,
    MenuButton,
    MenuList,
    ActionParameterDropdown,
  },
  props: {
    action: {
      type: Object as PropType<ScriptBlockPlainAction>,
      required: true,
    },
    actionsController: {
      type: Object as PropType<IDialogCollectionController<DialogAction>>,
      required: true,
    },
  },
  data() {
    return {
      openedParam: null as OpenedParameter | null,
      openedParamKey: 0,
    };
  },
  computed: {
    actionMenu() {
      return [
        {
          title: this.$t('imsDialogEditor.actions.duplicateAction'),
          icon: 'copy',
          action: async () => {
            await this.duplicateAction();
          },
        },
        ...(this.actionsController.canDeleteEntity(this.action.name)
          ? [
              {
                title: this.$t('imsDialogEditor.actions.deleteAction'),
                danger: true,
                icon: 'delete',
                action: async () => {
                  await this.deleteAction();
                },
              },
            ]
          : []),
      ];
    },
    actionsList() {
      return [...this.actionsController.getEntities()];
    },
    availableActionTypes() {
      return getAvailableActionTypes((key: string) => this.$t(key));
    },
    currentTypeOption() {
      return (
        this.availableActionTypes.find(
          (option) => option.value === this.action.type,
        ) ?? {
          title: this.action.type,
          icon: undefined,
          value: this.action.type,
        }
      );
    },
    typeMenu() {
      return this.availableActionTypes.map((option) => ({
        title: option.title,
        icon: option.icon,
        cssClass:
          option.value === this.action.type ? 'state-active' : undefined,
        action: () =>
          this.changeActionType(option.value as ScriptBlockPlainActionTypes),
      }));
    },
  },
  methods: {
    getActionTitle(action: DialogAction) {
      return action.title || action.name;
    },
    getParams(is_output: boolean): ScriptBlockPlainVariable[] {
      return (
        (is_output ? this.action.params?.out : this.action.params?.in) ?? []
      );
    },
    getParamTitle(param: ScriptBlockPlainVariable) {
      return param.title || param.name;
    },
    getParamKey(param: ScriptBlockPlainVariable, is_output: boolean) {
      return (is_output ? 'out:' : 'in:') + param.name;
    },
    getParamTypeTitle(param: ScriptBlockPlainVariable) {
      return this.$t(getVariableTypeTitleKey(param.type));
    },
    getParamTypeDotClass(param: ScriptBlockPlainVariable) {
      return getVariableTypeDotClass(param.type);
    },
    openParameter(
      param: ScriptBlockPlainVariable,
      is_output: boolean,
      focus: ActionParameterDropdownFocus,
    ) {
      const index = this.getParams(is_output).indexOf(param);
      if (index < 0) {
        return;
      }
      this.openedParamKey++;
      this.openedParam = {
        index,
        is_output,
        focus,
        key: this.openedParamKey,
      };
    },
    isOpenedParameter(param: ScriptBlockPlainVariable, is_output: boolean) {
      if (!this.openedParam) {
        return false;
      }
      return (
        this.openedParam.is_output === is_output &&
        this.getParams(is_output).indexOf(param) === this.openedParam.index
      );
    },
    closeParameter() {
      this.openedParam = null;
    },
    changeParameter(
      param: ScriptBlockPlainVariable,
      is_output: boolean,
      new_param: ScriptBlockPlainVariable,
    ) {
      const params = [...this.getParams(is_output)];
      const index = params.indexOf(param);
      if (index < 0) {
        return;
      }
      params[index] = new_param;
      this.changeAction({
        params: {
          in: is_output ? [...this.getParams(false)] : params,
          out: is_output ? params : [...this.getParams(true)],
        },
      });
    },
    changeAction(change: Partial<DialogAction>) {
      this.actionsController.changeEntity(this.action.name, {
        ...this.action,
        ...change,
      });
    },
    changeTitle(new_title: string) {
      this.changeAction({
        title: new_title.trim() ? new_title : null,
      });
    },
    async changeActionType(new_type: ScriptBlockPlainActionTypes) {
      if (this.action.type === new_type) {
        return;
      }
      await this.$getAppManager()
        .get(UiManager)
        .doTask(async () => {
          this.changeAction(
            withFunctionOutParam({
              ...this.action,
              type: new_type,
            }),
          );
        });
    },
    changeServiceName(new_name: string) {
      const normalized_name = normalizeAssetPropPart(new_name);
      if (normalized_name === this.action.name) {
        return;
      }
      if (!normalized_name) {
        this.$getAppManager()
          .get(UiManager)
          .showError(this.$t('imsDialogEditor.actions.nameIsEmpty'));
        return;
      }
      const exists = this.actionsList.some(
        (action) => action.name === normalized_name,
      );
      if (exists) {
        this.$getAppManager()
          .get(UiManager)
          .showError(this.$t('imsDialogEditor.actions.actionAlreadyExists'));
        return;
      }
      this.changeAction({ name: normalized_name });
    },
    async duplicateAction() {
      const guessed_title = guessDuplicatedItemTitle(
        this.getActionTitle(this.action),
        this.actionsList,
      );
      const guessed_name = normalizeAssetPropPart(guessed_title);

      const new_action = await this.$getAppManager()
        .get(DialogManager)
        .show(EnterActionDialog, {
          initial: {
            ...this.action,
            name: guessed_name,
            title: guessed_title,
          },
          validate: (action) => {
            const exists = checkParamsExists(action.name, this.actionsList);
            if (exists) {
              throw new Error(
                this.$t('imsDialogEditor.actions.actionAlreadyExists'),
              );
            }
          },
        });

      if (!new_action) return null;
      this.actionsController.addEntity(new_action);
    },
    async deleteAction() {
      const confirm = await this.$getAppManager()
        .get(DialogManager)
        .show(ConfirmDialog, {
          header: this.$t('imsDialogEditor.actions.deleteAction'),
          message: this.$t('imsDialogEditor.actions.deleteActionConfirm'),
          danger: true,
        });
      if (!confirm) return;
      this.actionsController.deleteEntity(this.action.name);
    },
  },
});
</script>
<style lang="scss" rel="stylesheet/scss" scoped>
@use '~ims-app-base/style/field-type-dot' as *;

.ActionsListItem-main {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.ActionsListItem-iconButton {
  color: var(--local-sub-text-color);
}

.ActionsListItem-title {
  flex: 1 1 30%;
  min-width: 100px;

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

.ActionsListItem-paren,
.ActionsListItem-arrow {
  flex: none;
  color: var(--local-sub-text-color);
}

.ActionsListItem-params {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  flex: 1 1 15%;
  min-width: 60px;
}

.ActionsListItem-param {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-width: 0;
  max-width: 100%;
  padding: 1px 5px;
  border: 1px solid var(--local-border-color);
  border-radius: 8px;
  background: color-mix(in srgb, var(--local-border-color) 12%, transparent);
}

.ActionsListItem-paramType {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}

.ActionsListItem-paramType-dot {
  flex: none;
}

.ActionsListItem-paramTitle {
  min-width: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;

  &:hover {
    color: var(--local-hl-text-color);
  }
}

.ActionsListItem-spacer {
  flex: 1 1 auto;
}

.ActionsListItem-serviceName {
  flex: 0 1 160px;
  min-width: 70px;
  color: var(--local-sub-text-color);

  :deep(.RenamableText-static) {
    min-width: 0;
  }

  :deep(.ImsTextInput) {
    max-width: 100%;
  }
}

.ActionsListItem-serviceName-text {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ActionsListItem-serviceName-editor {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  min-width: 0;
}

.ActionsListItem-serviceName-editor-icon {
  flex: none;
  color: var(--local-sub-text-color);
}

.ActionsListItem-serviceName-editor-input {
  flex: 1 1 auto;
  min-width: 0;
}

.ActionsListItem-menu {
  flex: none;
}

:deep(.MenuList-item-inner.state-active) {
  color: var(--color-accent);
}
</style>
