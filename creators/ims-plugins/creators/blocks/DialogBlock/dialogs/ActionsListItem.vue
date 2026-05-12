<template>
  <div class="ActionsListItem">
    <div class="ActionsListItem-column ActionsListItem-manage">
      <i class="ActionsListItem-drag ri-draggable"></i>
    </div>
    <div class="ActionsListItem-column ActionsListItem-name">
      <div
        class="ActionsListItem-name-input"
        @click="editMode = true"
        @focusout="editMode = false"
      >
        <ims-input
          v-if="editMode"
          :model-value="action.name"
          @change="renameAction(action, $event)"
        ></ims-input>
        <imc-presenter v-else :value="action.name"></imc-presenter>
      </div>
    </div>
    <div class="ActionsListItem-column ActionsListItem-type">
      <ims-select
        class="ActionsListItem-type-input"
        :model-value="action.type"
        :options="availableActionTypes"
        :append-to-body="true"
        :reduce="(o: any) => o.value"
        :get-option-key="(o: any) => o.value"
        :get-option-label="(o: any) => o.title"
        @update:model-value="changeActionType(action, $event)"
      >
        <template #option-content="{ option }">
          <div class="ActionsListItem-type-option">
            <i
              :class="option.icon"
              class="ActionsListItem-type-option-icon"
            ></i>
            <div class="ActionsListItem-type-option-title">
              {{ option.title }}
            </div>
          </div>
        </template>
      </ims-select>
    </div>
    <div class="ActionsListItem-column ActionsListItem-params input">
      <div
        v-if="action.params?.in && action.params.in.length"
        class="ActionsListItem-params-list"
      >
        <div
          v-for="param of action.params.in"
          :key="param.name"
          class="ActionsListItem-params-list-item"
        >
          <span class="ActionsListItem-params-list-item-title">
            {{ param.title }}
          </span>
          <template v-if="param.type?.Type">
            —
            <span class="ActionsListItem-params-list-item-type">
              <div
                class="ActionsListItem-params-list-item-type-ellipse"
                :class="'type-' + param.type.Type"
              ></div>
              {{
                $t('imsDialogEditor.var.types.' + param.type.Type.toString())
              }}
            </span>
          </template>
        </div>
      </div>
    </div>
    <div class="ActionsListItem-column ActionsListItem-params output">
      <div
        v-if="action.params?.out && action.params.out.length"
        class="ActionsListItem-params-list"
      >
        <div
          v-for="param of action.params.out"
          :key="param.name"
          class="ActionsListItem-params-list-item"
        >
          <span class="ActionsListItem-params-list-item-title">
            {{ param.title }}
          </span>
          <template v-if="param.type?.Type">
            —
            <span class="ActionsListItem-params-list-item-type">
              <div
                class="ActionsListItem-params-list-item-type-ellipse"
                :class="'type-' + param.type.Type"
              ></div>
              {{
                $t('imsDialogEditor.var.types.' + param.type.Type.toString())
              }}
            </span>
          </template>
        </div>
      </div>
    </div>
    <div class="ActionsListItem-column ActionsListItem-menu">
      <menu-button>
        <menu-list :menu-list="actionMenu" />
      </menu-button>
    </div>
  </div>
</template>
<script lang="ts">
import { defineComponent, type PropType } from 'vue';
import {
  ScriptBlockPlainActionTypes,
  type ScriptBlockPlainAction,
} from '../logic/nodeStoring';
import { normalizeAssetPropPart } from '~ims-app-base/logic/types/Props';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import type { IDialogCollectionController } from '../editor/DialogVariableController';
import type { DialogAction } from '../editor/DialogBlockController';
import ImsInput from '~ims-app-base/components/Common/ImsInput.vue';
import ImcPresenter from '~ims-app-base/components/ImcText/ImcPresenter.vue';
import ImsSelect from '~ims-app-base/components/Common/ImsSelect.vue';
import { getAvailableActionTypes } from '../logic/nodeActions';
import MenuButton from '~ims-app-base/components/Common/MenuButton.vue';
import MenuList from '~ims-app-base/components/Common/MenuList.vue';
import DialogManager from '../../../../../../ims-app-base/app/logic/managers/DialogManager';
import ConfirmDialog from '../../../../../../ims-app-base/app/components/Common/ConfirmDialog.vue';
import EnterActionDialog from './EnterActionDialog.vue';
import {
  checkParamsExists,
  guessDuplicatedItemTitle,
} from '../logic/nodeVariables';

export default defineComponent({
  name: 'ActionsListItem',
  components: {
    ImsInput,
    ImcPresenter,
    ImsSelect,
    MenuButton,
    MenuList,
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
      editMode: false,
    };
  },
  computed: {
    actionMenu() {
      return [
        {
          title: this.$t('imsDialogEditor.actions.editAction'),
          icon: 'edit',
          action: async () => {
            await this.editAction();
          },
        },
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
                title: this.$t('imsDialogEditor.var.deleteVariable'),
                danger: true,
                icon: 'delete',
                action: async () => {
                  const confirm = await this.$getAppManager()
                    .get(DialogManager)
                    .show(ConfirmDialog, {
                      header: this.$t('imsDialogEditor.actions.deleteAction'),
                      message: this.$t(
                        'imsDialogEditor.actions.deleteActionConfirm',
                      ),
                      danger: true,
                    });
                  if (!confirm) return;
                  this.actionsController.deleteEntity(this.action.name);
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
  },
  methods: {
    async duplicateAction() {
      const guessed_title = guessDuplicatedItemTitle(
        this.action.name,
        this.actionsList,
      );

      const new_action = await this.$getAppManager()
        .get(DialogManager)
        .show(EnterActionDialog, {
          initial: {
            ...this.action,
            name: guessed_title,
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
    async editAction() {
      const res = await this.$getAppManager()
        .get(DialogManager)
        .show(EnterActionDialog, {
          initial: {
            ...this.action,
          },
        });
      if (!res) return;
      this.actionsController.changeEntity(this.action.name, res);
    },
    async changeActionType(
      action: DialogAction,
      new_type: ScriptBlockPlainActionTypes,
    ) {
      await this.$getAppManager()
        .get(UiManager)
        .doTask(async () => {
          if (
            new_type === ScriptBlockPlainActionTypes.FUNCTION &&
            !action.params?.out?.length
          ) {
            throw new Error(
              this.$t('imsDialogEditor.actions.atLeastOneOutputParam'),
            );
          }
          this.actionsController.changeEntity(action.name, {
            ...action,
            type: new_type,
          });
        });
    },
    renameAction(action: DialogAction, new_name: string) {
      new_name = normalizeAssetPropPart(new_name);
      if (action.name === new_name) {
        return;
      }
      if (!new_name) {
        this.$getAppManager()
          .get(UiManager)
          .showError(this.$t('imsDialogEditor.actions.nameIsEmpty'));
        return;
      }
      const exists = this.actionsList.some((v) => v.name === new_name);
      if (exists) {
        this.$getAppManager()
          .get(UiManager)
          .showError(this.$t('imsDialogEditor.actions.actionAlreadyExists'));
        return;
      }
      this.actionsController.changeEntity(action.name, {
        ...action,
        name: new_name,
      });
    },
  },
});
</script>
<style lang="scss" scoped>
.ActionsListItem-params-list {
  width: 100%;
}
.ActionsListItem-params-list-item-type-ellipse {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  &.type-boolean {
    background-color: var(--imsde-type-boolean-fill);
  }
  &.type-float {
    background-color: var(--imsde-type-float-fill);
  }
  &.type-integer {
    background-color: var(--imsde-type-integer-fill);
  }
  &.type-string {
    background-color: var(--imsde-type-string-fill);
  }
  &.type-text {
    background-color: var(--imsde-type-text-fill);
  }
  &.type-asset {
    background-color: var(--imsde-type-asset-fill);
  }
}
.ActionsListItem {
  display: grid;
  grid-template-columns: var(--actions-list-columns);
  column-gap: var(--actions-list-column-gap);
}
.ActionsListItem-column {
  // border: 1px solid #eee;
  display: flex;
  align-items: center;
}
.ActionsListItem-drag {
  color: var(--local-sub-text-color);
}
.ActionsListItem-manage {
  grid-column: 1;
}
.ActionsListItem-name {
  grid-column: 2;
  gap: 5px;
}
.ActionsListItem-type {
  grid-column: 3;
}
.ActionsListItem-params {
  padding-left: 5px;
  font-size: 12px;
  &.input {
    grid-column: 4;
  }
  &.output {
    grid-column: 5;
  }
}
.ActionsListItem-menu {
  grid-column: 6;
}
.ActionsListItem-type-option {
  display: flex;
  gap: 5px;
}
.ActionsListItem-type-input {
  min-width: 100%;
}
.ActionsListItem-params-list-item {
  display: flex;
  gap: 5px;
}
.ActionsListItem-params-list-item-title {
  text-wrap: nowrap;
  text-overflow: ellipsis;
  max-width: 50%;
  overflow: hidden;
}
</style>
