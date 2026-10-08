import type { ToolSection } from '../ToolManager';
import Tool from './base/Tool';

/**
 * Кнопка «настройки сетки»: открывает поповер с размером ячейки,
 * режимом привязки и размером уровня. Сам инструмент не активируется —
 * только рендерит поповер.
 */
export default class GridSettingsTool extends Tool {
  name = 'gridSettings';
  icon = 'ri-grid-line';
  section: ToolSection = 'view';
  component = async () =>
    (await import('../LevelEditorToolbarGridSettingsButton.vue')).default;
}
