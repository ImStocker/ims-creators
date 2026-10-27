<template>
  <some-editor-list-item
    v-model:opened="opened"
    class="ActionsListItem"
    :item="action"
  >
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
          v-model:is-renaming-mode-state="isTitleEditing"
          class="ActionsListItem-title"
          :class="{ 'is-editing': isTitleEditing }"
          :value="getActionTitle(action)"
          :title="getActionTitle(action)"
        >
          <caption-string :value="getActionTitle(action)" />
          <template #editor>
            <div
              ref="mainEditTitleBox"
              class="ActionsListItem-main-editor"
              @vue:mounted="_editMainMounted"
              @focusout="_mainEditFocusOut"
            >
              <ims-input
                ref="mainEditTitle"
                class="ActionsListItem-main-editor-title"
                :auto-extend="true"
                :model-value="mainEditItem.title ?? ''"
                @update:model-value="mainEditSetTitle"
              />
            </div>
          </template>
        </renamable-text>
        <div class="ActionsListItem-paramsGroup">
          <span class="ActionsListItem-paren">(</span>
          <div
            class="ActionsListItem-paramsBlock ActionsListItem-paramsBlock-in"
          >
            <template
              v-for="(param, idx) of getParams(false)"
              :key="getParamKey(param, false)"
            >
              <menu-button
                class="ActionsListItem-paramMenuButton"
                :shown="isOpenedParameter(param, false)"
                @update:shown="onParamMenuShown"
              >
                <template #button>
                  <button
                    type="button"
                    class="ActionsListItem-param"
                    @click.stop.prevent="openParameter(param, false, 'title')"
                  >
                    <span
                      class="ActionsListItem-paramType"
                      :title="getParamTypeTitle(param)"
                      @click.stop.prevent="openParameter(param, false, 'type')"
                    >
                      <span
                        class="field-type-dot ActionsListItem-paramType-dot"
                        :class="getParamTypeDotClass(param)"
                      ></span>
                    </span>
                    <span
                      class="ActionsListItem-paramTitle"
                      :title="getParamTitle(param)"
                      @click.stop.prevent="openParameter(param, false, 'title')"
                    >
                      {{ getParamTitle(param) }}
                    </span>
                  </button>
                </template>
                <action-parameter-dropdown
                  class="ActionsListItem-paramDropdown is-dropdown"
                  :param="param"
                  :focus-field="openedParam?.focus ?? 'title'"
                  @change="changeParameter(param, false, $event)"
                  @close="closeParameter"
                />
              </menu-button>
              <span
                v-if="idx < getParams(false).length - 1"
                class="ActionsListItem-paramComma"
                >,</span
              >
            </template>
          </div>
          <span class="ActionsListItem-paren">)</span>
          <template v-if="getParams(true).length > 0">
            <i class="ActionsListItem-arrow ri-arrow-right-line"></i>
            <div
              class="ActionsListItem-paramsBlock ActionsListItem-paramsBlock-out"
            >
              <template
                v-for="(param, idx) of getParams(true)"
                :key="getParamKey(param, true)"
              >
                <menu-button
                  class="ActionsListItem-paramMenuButton"
                  :shown="isOpenedParameter(param, true)"
                  @update:shown="onParamMenuShown"
                >
                  <template #button>
                    <button
                      type="button"
                      class="ActionsListItem-param"
                      @click.stop.prevent="openParameter(param, true, 'title')"
                    >
                      <span
                        class="ActionsListItem-paramType"
                        :title="getParamTypeTitle(param)"
                        @click.stop.prevent="openParameter(param, true, 'type')"
                      >
                        <span
                          class="field-type-dot ActionsListItem-paramType-dot"
                          :class="getParamTypeDotClass(param)"
                        ></span>
                      </span>
                      <span
                        class="ActionsListItem-paramTitle"
                        :title="getParamTitle(param)"
                        @click.stop.prevent="
                          openParameter(param, true, 'title')
                        "
                      >
                        {{ getParamTitle(param) }}
                      </span>
                    </button>
                  </template>
                  <action-parameter-dropdown
                    class="ActionsListItem-paramDropdown is-dropdown"
                    :param="param"
                    :focus-field="openedParam?.focus ?? 'title'"
                    @change="changeParameter(param, true, $event)"
                    @close="closeParameter"
                  />
                </menu-button>
                <span
                  v-if="idx < getParams(true).length - 1"
                  class="ActionsListItem-paramComma"
                  >,</span
                >
              </template>
            </div>
          </template>
        </div>
        <div
          v-if="!isServiceNameEditing"
          class="ActionsListItem-serviceName"
          :title="$t('imsDialogEditor.actions.serviceName')"
          @dblclick="editServiceName"
        >
          <span class="ActionsListItem-serviceName-text">
            <i class="ri-price-tag-3-fill"></i>
            {{ action.name }}
          </span>
        </div>
        <div
          v-else
          ref="mainEditNameBox"
          class="ActionsListItem-serviceName ActionsListItem-serviceName-editor"
          @focusout="_mainEditFocusOut"
        >
          <i
            class="ri-price-tag-3-fill ActionsListItem-main-editor-serviceName-icon"
          ></i>
          <ims-text-input
            ref="mainEditName"
            class="ActionsListItem-main-editor-serviceName-input"
            :model-value="mainEditItem.name ?? ''"
            :title="$t('imsDialogEditor.actions.serviceName')"
            @update:model-value="mainEditSetName"
            @blur="stopMainEdit"
            @enter="stopMainEdit"
            @escape="cancelMainEdit"
          />
        </div>
        <menu-button class="ActionsListItem-menu">
          <menu-list :menu-list="actionMenu" />
        </menu-button>
      </div>
    </template>
    <template #item-advanced>
      <div class="ActionsListItem-advanced">
        <div class="ActionsListItem-advanced-section">
          <div class="ActionsListItem-advanced-caption">
            {{ $t('imsDialogEditor.actions.inputParameters') }}
          </div>
          <variable-list
            v-if="getParams(false).length > 0"
            class="ActionsListItem-advanced-list"
            :collection-controller="inputParametersController"
            :show-filters="false"
            :show-search="false"
            :embedded="true"
          ></variable-list>
          <button
            type="button"
            class="is-button is-button-action ActionsListItem-advanced-add"
            @click="addParameter('in')"
          >
            {{ $t('common.dialogs.add') }}
          </button>
        </div>
        <div class="ActionsListItem-advanced-spacer"></div>
        <div class="ActionsListItem-advanced-section">
          <div class="ActionsListItem-advanced-caption">
            {{ $t('imsDialogEditor.actions.outputParameters') }}
          </div>
          <variable-list
            v-if="getParams(true).length > 0"
            class="ActionsListItem-advanced-list"
            :collection-controller="outputParametersController"
            :show-filters="false"
            :show-search="false"
            :embedded="true"
          ></variable-list>
          <button
            type="button"
            class="is-button is-button-action ActionsListItem-advanced-add"
            @click="addParameter('out')"
          >
            {{ $t('common.dialogs.add') }}
          </button>
        </div>
        <div class="ActionsListItem-advanced-divider"></div>
        <div class="ActionsListItem-advanced-actions">
          <button
            type="button"
            class="is-button is-button-action danger"
            @click="deleteAction"
          >
            {{ deleteItemLabel }}
          </button>
          <button
            type="button"
            class="is-button is-button-action"
            @click="duplicateAction"
          >
            {{ duplicateItemLabel }}
          </button>
        </div>
      </div>
    </template>
  </some-editor-list-item>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import {
  ScriptBlockPlainActionTypes,
  type ScriptBlockPlainAction,
  type ScriptBlockPlainVariable,
} from '../logic/nodeStoring';
import { normalizeAssetPropPart } from '~ims-app-base/logic/types/Props';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import type {
  IDialogCollectionController,
  IDialogVariableController,
} from '../editor/DialogVariableController';
import type {
  DialogAction,
  DialogVariable,
} from '../editor/DialogBlockController';
import MenuButton from '~ims-app-base/components/Common/MenuButton.vue';
import MenuList from '~ims-app-base/components/Common/MenuList.vue';
import DialogManager from '~ims-app-base/logic/managers/DialogManager';
import ConfirmDialog from '~ims-app-base/components/Common/ConfirmDialog.vue';
import EnterActionDialog from './EnterActionDialog.vue';
import EnterVariableDialog from './EnterVariableDialog.vue';
import VariableList from './VariableList.vue';
import ActionParameterDropdown, {
  type ActionParameterDropdownFocus,
} from './ActionParameterDropdown.vue';
import {
  checkParamsExists,
  guessDuplicatedItemTitle,
} from '../logic/nodeVariables';
import SomeEditorListItem from '~ims-app-base/components/Asset/SpecialTypes/SomeEditorListItem.vue';
import {
  setImsClickOutside,
  type SetClickOutsideCancel,
} from '~ims-app-base/components/utils/ui';
import RenamableText from '~ims-app-base/components/Common/RenamableText.vue';
import ImsInput from '~ims-app-base/components/Common/ImsInput.vue';
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
};

type MainEditTarget = 'title' | 'name';

// Module-level set preserving which action items have their advanced panel open across remounts (e.g. on rename).
const openedActions = new Set<string>();

export default defineComponent({
  name: 'ActionsListItem',
  components: {
    SomeEditorListItem,
    RenamableText,
    ImsInput,
    ImsTextInput,
    CaptionString,
    MenuButton,
    MenuList,
    ActionParameterDropdown,
    VariableList,
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
      mainEditItem: { ...this.action } as DialogAction,
      mainEditTarget: null as MainEditTarget | null,
      serviceNameClickOutside: null as SetClickOutsideCancel | null,
      opened: openedActions.has(this.action.name),
    };
  },
  computed: {
    isTitleEditing: {
      get(): boolean {
        return this.mainEditTarget === 'title';
      },
      set(value: boolean) {
        if (value) {
          this.startMainEdit('title');
        } else {
          this.stopMainEdit();
        }
      },
    },
    isServiceNameEditing(): boolean {
      return this.mainEditTarget === 'name';
    },
    isFunctionAction(): boolean {
      return this.action.type === ScriptBlockPlainActionTypes.FUNCTION;
    },
    deleteItemLabel(): string {
      return this.isFunctionAction
        ? this.$t('imsDialogEditor.actions.deleteFunction')
        : this.$t('imsDialogEditor.actions.deleteAction');
    },
    deleteItemConfirmLabel(): string {
      return this.isFunctionAction
        ? this.$t('imsDialogEditor.actions.deleteFunctionConfirm')
        : this.$t('imsDialogEditor.actions.deleteActionConfirm');
    },
    duplicateItemLabel(): string {
      return this.isFunctionAction
        ? this.$t('imsDialogEditor.actions.duplicateFunction')
        : this.$t('imsDialogEditor.actions.duplicateAction');
    },
    inputParametersController(): IDialogVariableController {
      return this._createParametersController(
        'in',
        this.$t('imsDialogEditor.actions.inputParamsAlreadyExists'),
      );
    },
    outputParametersController(): IDialogVariableController {
      return this._createParametersController(
        'out',
        this.$t('imsDialogEditor.actions.outputParamsAlreadyExists'),
      );
    },
    actionMenu() {
      return [
        {
          title: this.duplicateItemLabel,
          icon: 'copy',
          action: async () => {
            await this.duplicateAction();
          },
        },
        ...(this.actionsController.canDeleteEntity(this.action.name)
          ? [
              {
                title: this.deleteItemLabel,
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
  watch: {
    opened(value: boolean) {
      if (value) {
        openedActions.add(this.action.name);
      } else {
        openedActions.delete(this.action.name);
      }
    },
  },
  methods: {
    startMainEdit(target: MainEditTarget) {
      if (this.mainEditTarget === target) {
        return;
      }
      if (this.mainEditTarget !== null) {
        this.stopMainEdit();
      }
      this.mainEditItem = { ...this.action };
      this.mainEditTarget = target;
    },
    stopMainEdit() {
      if (this.mainEditTarget === null) {
        return;
      }
      if (this.serviceNameClickOutside) {
        this.serviceNameClickOutside();
        this.serviceNameClickOutside = null;
      }
      this.mainEditTarget = null;
      this.applyMainEdit();
    },
    cancelMainEdit() {
      if (this.mainEditTarget === null) {
        return;
      }
      if (this.serviceNameClickOutside) {
        this.serviceNameClickOutside();
        this.serviceNameClickOutside = null;
      }
      this.mainEditItem = { ...this.action };
      this.mainEditTarget = null;
    },
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
      this.openedParam = {
        index,
        is_output,
        focus,
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
    onParamMenuShown(shown: boolean) {
      if (!shown) {
        this.closeParameter();
      }
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
    _createParametersController(
      scope: 'in' | 'out',
      alreadyExistsCaption: string,
    ): IDialogVariableController {
      const getList = (): ScriptBlockPlainVariable[] =>
        (scope === 'in' ? this.action.params?.in : this.action.params?.out) ??
        [];
      const setList = (list: ScriptBlockPlainVariable[]) => {
        this.changeAction({
          params: {
            in: scope === 'in' ? list : [...this.getParams(false)],
            out: scope === 'out' ? list : [...this.getParams(true)],
          },
        });
      };
      return {
        getEntities: () => [...getList()],
        addEntity: (variable: ScriptBlockPlainVariable) => {
          if (getList().some((el) => el.name === variable.name)) {
            throw new Error(alreadyExistsCaption);
          }
          setList([...getList(), variable]);
        },
        canDeleteEntity: () => true,
        changeEntity: (variable_name: string, variable: DialogVariable) => {
          const index = getList().findIndex((el) => el.name === variable_name);
          if (index < 0) {
            return;
          }
          const list = [...getList()];
          list[index] = variable;
          setList(list);
        },
        createEntity: async () => {
          const res = await this.$getAppManager()
            .get(DialogManager)
            .show(EnterVariableDialog, {
              validate: (variable: DialogVariable) => {
                if (getList().some((el) => el.name === variable.name)) {
                  throw new Error(alreadyExistsCaption);
                }
              },
            });
          return res ?? null;
        },
        deleteEntity: (variable_name: string) => {
          setList(getList().filter((el) => el.name !== variable_name));
        },
        reorderEntities: (variables: ScriptBlockPlainVariable[]) => {
          setList(variables);
        },
      };
    },
    async addParameter(scope: 'in' | 'out') {
      const controller =
        scope === 'in'
          ? this.inputParametersController
          : this.outputParametersController;
      const res = await controller.createEntity();
      if (!res) return;
      controller.addEntity(res);
    },
    _editMainMounted() {
      const mainEditTitle = this.$refs['mainEditTitle'] as InstanceType<
        typeof ImsInput
      > | null;
      if (!mainEditTitle) {
        return;
      }
      this.mainEditItem = { ...this.action };
      mainEditTitle.focus?.();
      this.$nextTick(() => {
        mainEditTitle.select?.();
      });
    },
    _mainEditFocusOut(event: FocusEvent) {
      const title_box = this.$refs['mainEditTitleBox'] as
        | HTMLDivElement
        | undefined;
      const name_box = this.$refs['mainEditNameBox'] as
        | HTMLDivElement
        | undefined;
      const target = event.relatedTarget as HTMLElement | null;
      if (
        target &&
        ((title_box && title_box.contains(target)) ||
          (name_box && name_box.contains(target)))
      ) {
        return;
      }
      this.stopMainEdit();
    },
    mainEditSetTitle(val: string) {
      this.mainEditItem.title = val;
      const old_auto_name = normalizeAssetPropPart(this.action.title ?? '');
      const new_auto_name = normalizeAssetPropPart(val);
      const service_name_is_auto =
        !this.action.name || this.action.name === old_auto_name;
      if (service_name_is_auto && new_auto_name) {
        const name_is_busy = this.actionsList.some(
          (action) =>
            action.name !== this.action.name && action.name === new_auto_name,
        );
        if (!name_is_busy) {
          this.mainEditItem.name = new_auto_name;
        }
      }
    },
    mainEditSetName(val: string) {
      this.mainEditItem.name = normalizeAssetPropPart(val ?? '');
    },
    applyMainEdit() {
      const change: Partial<DialogAction> = {};
      const new_title = this.mainEditItem.title?.trim()
        ? this.mainEditItem.title
        : null;
      if (new_title !== (this.action.title ?? null)) {
        change.title = new_title;
      }
      if (this.mainEditItem.name !== this.action.name) {
        const normalized_name = normalizeAssetPropPart(
          this.mainEditItem.name ?? '',
        );
        if (!normalized_name) {
          this.$getAppManager()
            .get(UiManager)
            .showError(this.$t('imsDialogEditor.actions.nameIsEmpty'));
          this.mainEditItem = { ...this.action };
          return;
        }
        const exists = this.actionsList.some(
          (action) => action.name === normalized_name,
        );
        if (exists) {
          this.$getAppManager()
            .get(UiManager)
            .showError(this.$t('imsDialogEditor.actions.actionAlreadyExists'));
          this.mainEditItem = { ...this.action };
          return;
        }
        change.name = normalized_name;
      }
      if (change.name && this.opened) {
        openedActions.delete(this.action.name);
        openedActions.add(change.name);
      }
      if (Object.keys(change).length > 0) {
        this.changeAction(change);
      }
      this.mainEditItem = { ...this.action };
    },
    async editServiceName() {
      if (this.isServiceNameEditing) {
        return;
      }
      this.closeParameter();
      this.startMainEdit('name');
      await this.$nextTick();
      const mainEditName = this.$refs['mainEditName'] as InstanceType<
        typeof ImsTextInput
      > | null;
      const nameBox = this.$refs['mainEditNameBox'] as HTMLDivElement | null;
      if (!mainEditName) {
        return;
      }
      (mainEditName as any).focus?.();
      this.$nextTick(() => {
        (mainEditName as any).selectAll?.();
      });
      window.setTimeout(() => {
        if (!this.isServiceNameEditing) return;
        if (nameBox) {
          this.serviceNameClickOutside = setImsClickOutside(
            () => nameBox,
            () => {
              this.stopMainEdit();
            },
          );
        }
      }, 1);
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
          header: this.deleteItemLabel,
          message: this.deleteItemConfirmLabel,
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

.ActionsListItem-type {
  flex: none;
}

.ActionsListItem-iconButton {
  color: var(--local-text-color);
}

.ActionsListItem-title {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 40%;

  :deep(.CaptionString) {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.ActionsListItem-main-editor {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
  min-height: 1.8em;
}

.ActionsListItem-main-editor-title {
  flex: 0 1 auto;
  min-width: 2ch;
  max-width: 100%;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  outline: none;

  :deep(.ImsInput-inner) {
    width: 100%;
    min-width: 0;
  }

  :deep(.ImsInput-shadow) {
    padding: 0;
    font: inherit;
    line-height: inherit;
  }
}

.ActionsListItem-main-editor-serviceName-icon {
  flex: none;
  color: var(--local-sub-text-color);
}

.ActionsListItem-main-editor-serviceName-input {
  flex: 1 1 auto;
  min-width: 0;
}

.ActionsListItem-paren,
.ActionsListItem-arrow,
.ActionsListItem-paramComma {
  flex: none;
  color: var(--local-sub-text-color);
}

.ActionsListItem-paramsGroup {
  display: flex;
  flex: 1 1 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.ActionsListItem-paramsBlock {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0px;
  min-width: 0;
  max-width: 145px;
  vertical-align: middle;
}

.ActionsListItem-param {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  max-width: 100%;
  padding: 2px 5px;
  border: none;
  border-radius: 6px;
  background: transparent;
  transition: background-color 0.16s ease;

  &:hover {
    background: color-mix(in srgb, var(--local-border-color) 20%, transparent);
  }
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

.ActionsListItem-serviceName {
  flex: 0 1 160px;
  min-width: 70px;
  color: var(--local-sub-text-color);
}

.ActionsListItem-serviceName-editor {
  display: flex;
  align-items: center;
  gap: 4px;
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

.ActionsListItem-menu {
  flex: none;
}

.ActionsListItem-advanced {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ActionsListItem-advanced-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ActionsListItem-advanced-caption {
  font-weight: bold;
}

.ActionsListItem-advanced-list {
  display: flex;
  flex-direction: column;
}

.ActionsListItem-advanced-add {
  align-self: flex-start;
}

.ActionsListItem-advanced-spacer {
  height: 8px;
}

.ActionsListItem-advanced-divider {
  height: 1px;
  margin: 4px 0;
  border: none;
  background: var(--local-border-color);
}

.ActionsListItem-advanced-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

:deep(.MenuList-item-inner.state-active) {
  color: var(--color-accent);
}

.ActionsListItem-paramMenuButton {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  max-width: 100%;
}

.ActionsListItem-paramDropdown {
  min-width: 240px;
}
</style>
