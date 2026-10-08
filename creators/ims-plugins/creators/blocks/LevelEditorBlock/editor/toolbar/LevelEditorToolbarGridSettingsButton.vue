<template>
  <menu-button class="LevelEditorToolbarGridSettingsButton">
    <template #button="{ toggle }">
      <level-editor-toolbar-button-base
        :tool="tool"
        :tool-manager="toolManager"
        @click="toggle"
      ></level-editor-toolbar-button-base>
    </template>
    <div class="LevelEditorToolbarGridSettingsButton-form">
      <div class="LevelEditorToolbarGridSettingsButton-group">
        <div class="LevelEditorToolbarGridSettingsButton-title">
          {{ $t('levelEditor.grid.title') }}
        </div>
        <label class="LevelEditorToolbarGridSettingsButton-field">
          <span>{{ $t('levelEditor.grid.width') }}</span>
          <input
            v-model="draftWidth"
            class="is-input"
            type="number"
            min="1"
            step="1"
            @blur="commitGridWidth"
            @keydown.enter.prevent="commitGridWidth"
            @keydown.esc="revertGrids"
          />
        </label>
        <label class="LevelEditorToolbarGridSettingsButton-field">
          <span>{{ $t('levelEditor.grid.height') }}</span>
          <input
            v-model="draftHeight"
            class="is-input"
            type="number"
            min="1"
            step="1"
            @blur="commitGridHeight"
            @keydown.enter.prevent="commitGridHeight"
            @keydown.esc="revertGrids"
          />
        </label>
        <label class="LevelEditorToolbarGridSettingsButton-field">
          <span>{{ $t('levelEditor.grid.mode') }}</span>
          <select
            class="is-input"
            :value="gridSettings.mode"
            @change="onGridModeChange"
          >
            <option value="snap-only">
              {{ $t('levelEditor.grid.modeSnapOnly') }}
            </option>
            <option value="strict">
              {{ $t('levelEditor.grid.modeStrict') }}
            </option>
          </select>
        </label>
        <div class="LevelEditorToolbarGridSettingsButton-snap-holder">
          <button
            type="button"
            class="is-button LevelEditorToolbarGridSettingsButton-snap"
            @click="onSnapClick"
          >
            {{ snapButtonLabel }}
          </button>
        </div>
      </div>
      <div class="LevelEditorToolbarGridSettingsButton-group">
        <div class="LevelEditorToolbarGridSettingsButton-title">
          {{ $t('levelEditor.level.title') }}
        </div>
        <label class="LevelEditorToolbarGridSettingsButton-field">
          <span>{{ $t('levelEditor.level.width') }}</span>
          <input
            class="is-input"
            type="number"
            min="0"
            step="1"
            :value="levelWidth"
            :placeholder="$t('levelEditor.level.unlimited')"
            @change="onLevelWidthChange"
          />
        </label>
        <label class="LevelEditorToolbarGridSettingsButton-field">
          <span>{{ $t('levelEditor.level.height') }}</span>
          <input
            class="is-input"
            type="number"
            min="0"
            step="1"
            :value="levelHeight"
            :placeholder="$t('levelEditor.level.unlimited')"
            @change="onLevelHeightChange"
          />
        </label>
      </div>
    </div>
  </menu-button>
</template>
<script lang="ts">
import { defineComponent, type PropType, type UnwrapRef } from 'vue';
import MenuButton from '~ims-app-base/components/Common/MenuButton.vue';
import type Tool from './tools/base/Tool';
import type ToolManager from './ToolManager';
import LevelEditorToolbarButtonBase from './LevelEditorToolbarButtonBase.vue';
import {
  normalizeGridSettings,
  type GridMode,
  type GridSettings,
} from '../../canvas/GridSnap';

export default defineComponent({
  name: 'LevelEditorToolbarGridSettingsButton',
  components: {
    MenuButton,
    LevelEditorToolbarButtonBase,
  },
  props: {
    tool: {
      type: Object as PropType<Tool>,
      required: true,
    },
    toolManager: {
      type: Object as PropType<UnwrapRef<ToolManager>>,
      required: true,
    },
  },
  data() {
    const grid = normalizeGridSettings(
      this.tool.controller.blockController.gridSettings,
    );
    return {
      // Черновики значений: в модель попадают только по blur/Enter,
      // пока пользователь редактирует — ничего не отправляется.
      draftWidth: String(grid.width),
      draftHeight: String(grid.height),
    };
  },
  computed: {
    canvasController() {
      return this.tool.controller;
    },
    blockController() {
      return this.tool.controller.blockController;
    },
    gridSettings(): GridSettings {
      return normalizeGridSettings(this.blockController.gridSettings);
    },
    levelWidth(): number | '' {
      return this.blockController.levelSize?.width ?? '';
    },
    levelHeight(): number | '' {
      return this.blockController.levelSize?.height ?? '';
    },
    hasSelection(): boolean {
      return this.blockController.selectionManager.selectedObjectIds.length > 0;
    },
    snapButtonLabel(): string {
      return this.hasSelection
        ? this.$t('levelEditor.grid.snapSelected')
        : this.$t('levelEditor.grid.snapAll');
    },
  },
  watch: {
    gridSettings(value: GridSettings) {
      this.draftWidth = String(value.width);
      this.draftHeight = String(value.height);
    },
  },
  methods: {
    _parseNonNegativeInput(event: Event, fallback: number): number {
      const input = event.target as HTMLInputElement;
      const parsed = Number.parseInt(input.value, 10);
      const value = Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
      input.value = String(value);
      return value;
    },
    commitGridWidth() {
      const parsed = Number.parseInt(this.draftWidth, 10);
      const width =
        Number.isFinite(parsed) && parsed > 0
          ? parsed
          : this.gridSettings.width;
      this.draftWidth = String(width);
      if (width !== this.gridSettings.width) {
        this.applyGridChange({ width });
      }
    },
    commitGridHeight() {
      const parsed = Number.parseInt(this.draftHeight, 10);
      const height =
        Number.isFinite(parsed) && parsed > 0
          ? parsed
          : this.gridSettings.height;
      this.draftHeight = String(height);
      if (height !== this.gridSettings.height) {
        this.applyGridChange({ height });
      }
    },
    revertGrids() {
      this.draftWidth = String(this.gridSettings.width);
      this.draftHeight = String(this.gridSettings.height);
    },
    onGridModeChange(event: Event) {
      const select = event.target as HTMLSelectElement;
      const mode = select.value as GridMode;
      if (mode !== this.gridSettings.mode) {
        this.applyGridChange({ mode });
      }
    },
    applyGridChange(data: Partial<GridSettings>) {
      const next_grid = normalizeGridSettings({
        ...this.gridSettings,
        ...data,
      });

      this.blockController.changeGridSettings(next_grid);
    },
    onSnapClick() {
      const selected_ids =
        this.blockController.selectionManager.selectedObjectIds;
      this.canvasController.applyGridSnapToAllShapes(
        this.gridSettings,
        selected_ids.length ? { objectIds: [...selected_ids] } : undefined,
      );
    },
    onLevelWidthChange(event: Event) {
      const width = this._parseNonNegativeInput(event, this.levelWidth || 0);
      this.blockController.changeLevelSize({ width });
    },
    onLevelHeightChange(event: Event) {
      const height = this._parseNonNegativeInput(event, this.levelHeight || 0);
      this.blockController.changeLevelSize({ height });
    },
  },
});
</script>
<style lang="scss" scoped>
@use '~ims-app-base/components/ImcText/Toolbar/ImcEditorToolbar.scss';
@use '../side-panel/LevelEditorSidePanel';

.LevelEditorToolbarGridSettingsButton {
  display: inline-flex;
}

.LevelEditorToolbarGridSettingsButton-form {
  @include ImcEditorToolbar.ImcEditorToolbar-dropdown;
  min-width: 290px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.LevelEditorToolbarGridSettingsButton-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.LevelEditorToolbarGridSettingsButton-title {
  @include LevelEditorSidePanel.LevelEditorSidePanel-property;
  font-weight: 600;
}

.LevelEditorToolbarGridSettingsButton-field {
  @include LevelEditorSidePanel.LevelEditorSidePanel-property;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;

  span {
    flex: 1;
  }

  input,
  select {
    width: 150px;
    font-size: 12px;
  }
}
.LevelEditorToolbarGridSettingsButton-snap-holder {
  padding-top: 10px;
}
.LevelEditorToolbarGridSettingsButton-snap {
  padding: 6px 8px;
  font-size: 12px;
  cursor: pointer;
}
</style>
