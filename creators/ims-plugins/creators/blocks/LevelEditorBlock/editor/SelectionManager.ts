import type LevelEditorBlockController from '../LevelEditorBlockController';
import type LevelEditorCanvasController from './LevelEditorCanvasController';
import * as fabric from 'fabric';

export default class SelectionManager {
  protected canvasController: LevelEditorCanvasController | null = null;

  public selectedObjectIds: string[] = [];

  constructor(public blockController: LevelEditorBlockController) {}

  init(canvasController: LevelEditorCanvasController) {
    this.canvasController = canvasController;
    this._initSelectionEvents();

    if (this.selectedObjectIds.length) {
      this.selectShapes(this.selectedObjectIds);
    }
  }

  destroy() {
    this.canvasController = null;
  }

  selectShapes(shapeIds: string[]) {
    if (!this.canvasController) {
      this.selectedObjectIds = shapeIds;
      return;
    }

    if (!shapeIds.length) {
      this.canvasController.canvas.discardActiveObject();
      this.canvasController.canvas.requestRenderAll();
      return;
    }
    const objects_to_select = this.canvasController.canvas
      .getObjects()
      .filter((obj) => shapeIds.includes(obj.id));
    const sel = new fabric.ActiveSelection(objects_to_select);

    const all_locked =
      objects_to_select.length > 0 &&
      objects_to_select.every((o) => this.blockController.shapes[o.id]?.locked);
    if (all_locked) {
      sel.set({
        hasControls: false,
      });
    }

    this.canvasController.canvas.setActiveObject(sel);
    this.canvasController.canvas.requestRenderAll();
  }

  private _initSelectionEvents() {
    if (!this.canvasController) return;

    const canvas = this.canvasController.canvas;

    const selection_change = (
      selected: fabric.FabricObject[],
      deselected: fabric.FabricObject[],
      reset: boolean,
    ) => {
      selected = selected.filter((obj) => !obj.__isTemp);
      const new_selection: string[] = [
        ...(reset ? [] : this.selectedObjectIds),
        ...selected.map((s) => s.id),
      ];
      for (const deselect of deselected) {
        const ind = new_selection.findIndex((s_id) => s_id === deselect.id);
        if (ind >= 0) new_selection.splice(ind, 1);
      }
      this.selectedObjectIds = new_selection;
      if (this.selectedObjectIds.length) {
        this.blockController.revealBlockContentItems(
          this.selectedObjectIds.map((id) => 'shape-' + id),
        );
      }
    };

    canvas.on('selection:created', (event) => {
      selection_change(event.selected, [], true);
    });

    canvas.on('selection:updated', (event) => {
      selection_change(event.selected, event.deselected, false);
    });

    canvas.on('selection:cleared', () => {
      this.selectedObjectIds = [];
    });
  }
}
