import type * as fabric from 'fabric';
import Tool from './Tool';
import { bindCanvasEvent, type LevelEditorShape } from '../../../LevelEditor';
import { isSnapActiveForEvent, snapPoint } from '../../../../canvas/GridSnap';

type Coords = { x: number; y: number };

export type ShapeCreationParams = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export default abstract class ShapeCreationTool extends Tool {
  private _isDrawing: boolean = false;
  private _shape: fabric.FabricObject | null = null;
  private _start: Coords = { x: 0, y: 0 };
  private _hasMoved: boolean = false;
  protected defaultSize: number = 100;

  private _mouseUpDisposer: (() => void) | null = null;
  private _mouseDownDisposer: (() => void) | null = null;
  private _mouseMoveDisposer: (() => void) | null = null;

  abstract createShape(
    params: ShapeCreationParams,
    isDragMode?: boolean,
  ): LevelEditorShape;
  abstract updateShape(
    shape: fabric.FabricObject,
    from: Coords,
    to: Coords,
  ): void;

  protected onShapeCreated(_shape: fabric.FabricObject): void {}

  protected resetState() {
    this._isDrawing = false;
    this._hasMoved = false;
    this._shape = null;
  }

  override onActivate() {
    this._isDrawing = false;
    this._shape = null;

    this._start = { x: 0, y: 0 };

    this._mouseDownDisposer = this.controller.canvas.on(
      'mouse:down',
      this.onMouseDown(),
    );
    this._mouseUpDisposer = this.controller.canvas.on(
      'mouse:up',
      this.onMouseUp(),
    );
    this.controller.canvas.defaultCursor = 'crosshair';
  }

  override onDeactivate() {
    [
      this._mouseUpDisposer,
      this._mouseMoveDisposer,
      this._mouseDownDisposer,
    ].forEach((disposer) => {
      if (disposer) disposer();
    });
    this.controller.canvas.defaultCursor = 'default';
  }

  onMouseDown() {
    return bindCanvasEvent(
      (canvas, event: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
        const { x, y } = event.scenePoint;
        this._start = { x, y };

        this._isDrawing = true;
        this._hasMoved = false;
        canvas.selection = false;

        this._mouseMoveDisposer = canvas.on('mouse:move', this.onMouseMove());
      },
    );
  }

  onMouseMove() {
    return bindCanvasEvent(
      (canvas, event: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
        if (!this._isDrawing) return;
        if (!this._hasMoved) {
          this._hasMoved = true;
          this._shape = this.controller.convertLevelEditorShapeToFabricObject(
            this.createShape(
              {
                left: this._start.x,
                top: this._start.y,
                width: 1,
                height: 1,
              },
              this._hasMoved,
            ),
          );
          if (this._shape) {
            this._shape.__isTemp = true;
            canvas.add(this._shape);
          }
        }
        if (this._hasMoved && this._shape) {
          const from = this._maybeSnapPoint(this._start, event.e);
          const to = this._maybeSnapPoint(event.scenePoint, event.e);
          this.updateShape(this._shape, from, to);
          canvas.setActiveObject(this._shape);
          this._shape.setCoords();
          canvas.requestRenderAll();
        }
      },
    );
  }

  private _maybeSnapPoint(
    point: Coords,
    e: { ctrlKey?: boolean; metaKey?: boolean },
  ): Coords {
    const grid = this.controller.blockController.gridSettings;
    if (!grid || !isSnapActiveForEvent(grid, e)) return point;
    return snapPoint(point, grid);
  }

  onMouseUp() {
    return bindCanvasEvent(
      (canvas, event: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
        if (this._mouseMoveDisposer) {
          this._mouseMoveDisposer();
          this._mouseMoveDisposer = null;
        }

        if (this._shape) canvas.remove(this._shape);

        let params: ShapeCreationParams;

        if (!this._shape) {
          const { x: clickX, y: clickY } = event.scenePoint;

          const x = clickX;
          const y = clickY;
          params = {
            top: y,
            left: x,
            width: this.defaultSize,
            height: this.defaultSize,
          };
        } else {
          params = {
            top: this._shape.top,
            left: this._shape.left,
            width: this._shape.width,
            height: this._shape.height,
          };
        }
        const levelEditorShape = this.createShape(params, this._hasMoved);

        const grid = this.controller.blockController.gridSettings;
        const snap = grid ? isSnapActiveForEvent(grid, event.e) : undefined;

        this._shape = this.controller.createShape(levelEditorShape, { snap });

        canvas.selection = true;
        if (this._shape) {
          canvas.setActiveObject(this._shape);
          this.onShapeCreated(this._shape);
          canvas.requestRenderAll();
        }

        this.resetState();
        this.deactivate();
      },
    );
  }
}
