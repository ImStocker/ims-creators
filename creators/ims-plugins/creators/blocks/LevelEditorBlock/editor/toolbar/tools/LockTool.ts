import type { ToolSection } from '../ToolManager';
import Tool from './base/Tool';

/**
 * Тулз-переключатель блокировки. Работает с текущей селекцией:
 * - ничего не выбрано — разблокирует все заблокированные фигуры;
 * - в селекции есть заблокированные — разблокирует всю селекцию;
 * - вся селекция разблокирована — блокирует её.
 *
 * Иконка и подсказка кнопки реактивно отражают состояние селекции.
 */
export default class LockTool extends Tool {
  name = 'lock';
  component = async () =>
    (await import('../LevelEditorToolbarButton.vue')).default;
  section: ToolSection = 'lock';

  private get _selectedIds(): string[] {
    return this.controller.blockController.selectionManager.selectedObjectIds;
  }

  private get _actionIsUnlock(): boolean {
    const selected_ids = this._selectedIds;
    if (!selected_ids.length) return true;
    const shapes = this.controller.blockController.shapes;
    return selected_ids.some((id) => shapes[id]?.locked);
  }

  override get icon(): string {
    return this._actionIsUnlock ? 'ri-lock-unlock-line' : 'ri-lock-line';
  }

  override getTooltipName(): string {
    return this._actionIsUnlock ? 'unlock' : 'lock';
  }

  override onActivate(): void {
    const selected_ids = [...this._selectedIds];

    if (!selected_ids.length) {
      this._unlockAll();
      this.deactivate();
      return;
    }

    const target_locked = this._actionIsUnlock === false;
    const objects = this.controller.sortedCanvasObjects.filter((object) =>
      selected_ids.includes(object.id),
    );

    for (const object of objects) {
      object.set({
        selectable: !target_locked,
        evented: !target_locked,
      });
      this.controller.changeShape(object.id, { locked: target_locked });
    }

    if (target_locked) {
      this.controller.canvas.discardActiveObject();
      this.controller.canvas.requestRenderAll();
    }

    this.deactivate();
  }

  private _unlockAll(): void {
    const locked_objects = this.controller.sortedCanvasObjects.filter(
      (object) => !object.evented && !object.selectable,
    );
    for (const object of locked_objects) {
      object.set({
        evented: true,
        selectable: true,
      });
      this.controller.changeShape(object.id, { locked: false });
    }
  }
}
