import * as fabric from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import Tool from './base/Tool';
import { bindCanvasEvent } from '../../LevelEditor';
import type { ToolSection } from '../ToolManager';
import { DEFAULT_COLOR_PRESET } from '../../shapes/shapePropertyDescriptors';
import type { PencilShape } from '../../shapes/controllers/PencilController';

const DEFAULT_STROKE_WIDTH = 4;

/**
 * Минимальное расстояние между точками штриха (в единицах сцены).
 * Задано заметно больше fabric-дефолта (0.4): точки попадают в пропсы
 * блока, а блок хранит их как плоские ключи.
 */
const POINT_DECIMATE_DISTANCE = 3;

export default class PencilTool extends Tool {
  name = 'pencil';
  icon = 'ri-pencil-line';
  override exclusiveGroup: string = 'drawing';
  section: ToolSection = 'draw';
  component = async () =>
    (await import('../LevelEditorToolbarButton.vue')).default;

  private _brush: fabric.PencilBrush | null = null;
  private _pathCreatedDisposer: (() => void) | null = null;

  override onActivate() {
    const canvas = this.controller.canvas;

    this._brush = new fabric.PencilBrush(canvas);
    this._brush.color = DEFAULT_COLOR_PRESET.stroke;
    this._brush.width = DEFAULT_STROKE_WIDTH;
    this._brush.decimate = POINT_DECIMATE_DISTANCE;
    // Удержание shift рисует прямую линию (см. straightLineKey в PencilBrush).
    this._brush.straightLineKey = 'shiftKey';

    canvas.freeDrawingBrush = this._brush;
    canvas.freeDrawingCursor = 'crosshair';
    // isDrawingMode нужен не только для маршрутизации событий в кисть, но и
    // для того, чтобы renderAll не очищал contextTop с незавершённым штрихом.
    canvas.isDrawingMode = true;

    this._pathCreatedDisposer = canvas.on(
      'path:created',
      this._onPathCreated(),
    );
  }

  override onDeactivate() {
    const canvas = this.controller.canvas;

    if (this._pathCreatedDisposer) {
      this._pathCreatedDisposer();
      this._pathCreatedDisposer = null;
    }

    canvas.isDrawingMode = false;
    canvas.freeDrawingBrush = undefined;
    canvas.freeDrawingCursor = 'default';

    this._brush = null;
  }

  private _onPathCreated() {
    return bindCanvasEvent(
      (
        canvas: fabric.Canvas,
        eventParams: fabric.CanvasEvents['path:created'],
      ) => {
        const drawn_path = eventParams.path as fabric.Path;

        // Кисть добавила объект на canvas напрямую, минуя модель. Убираем его,
        // чтобы создать заново через контроллер — тогда индекс, декор и
        // undo/redo расставятся так же, как у остальных фигур.
        canvas.remove(drawn_path);

        if (!drawn_path.path.length) return;

        const shape: PencilShape = {
          id: uuidv4(),
          type: 'pencil',
          x: drawn_path.left,
          y: drawn_path.top,
          params: {
            path: fabric.util.joinPath(drawn_path.path),
            strokeWidth: drawn_path.strokeWidth,
            stroke:
              typeof drawn_path.stroke === 'string'
                ? drawn_path.stroke
                : DEFAULT_COLOR_PRESET.stroke,
          },
        };

        const created_object = this.controller.createShape(shape);

        canvas.requestRenderAll();

        if (created_object) {
          canvas.setActiveObject(created_object);
          created_object.setCoords();
        }

        this.deactivate();
      },
    );
  }
}
