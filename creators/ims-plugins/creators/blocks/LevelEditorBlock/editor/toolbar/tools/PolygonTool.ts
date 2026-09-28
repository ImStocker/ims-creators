import * as fabric from 'fabric';
import Tool from './base/Tool';
import { v4 as uuidv4 } from 'uuid';
import { bindCanvasEvent } from '../../LevelEditor';
import type { ToolSection } from '../ToolManager';
import { markRaw } from 'vue';

export default class PolygonTool extends Tool {
  name = 'polygon';
  icon = 'ri-shape-line';
  override exclusiveGroup: string = 'drawing';
  section: ToolSection = 'draw';
  component = async () =>
    (await import('../LevelEditorToolbarButton.vue')).default;

  private _points: fabric.Point[] = [];
  private _previewLine: fabric.Line | null = null;
  private _lines: fabric.Line[] = markRaw([]);
  private _circles: fabric.Circle[] = markRaw([]);
  private _isDrawing = false;
  private readonly VERTEX_RADIUS = 5;

  private _mouseMoveDisposer: (() => void) | null = null;
  private _mouseDownDisposer: (() => void) | null = null;
  private _mouseDownBeforeDisposer: (() => void) | null = null;

  override onActivate() {
    this.controller.canvas.defaultCursor = 'crosshair';
    this.controller.canvas.hoverCursor = 'crosshair';
    this.controller.canvas.selection = false;
    this.controller.canvas.skipTargetFind = true;
    this._mouseDownDisposer = this.controller.canvas.on(
      'mouse:down',
      this._onMouseDown(),
    );
    this._mouseDownBeforeDisposer = this.controller.canvas.on(
      'mouse:down:before',
      this._onMouseDownBefore(),
    );
  }

  override onDeactivate() {
    this.controller.canvas.defaultCursor = 'default';
    this.controller.canvas.hoverCursor = 'move';

    this.controller.canvas.selection = true;
    this.controller.canvas.skipTargetFind = false;

    this._previewLine = null;
    if (this._mouseDownDisposer) {
      this._mouseDownDisposer();
      this._mouseDownDisposer = null;
    }
    if (this._mouseMoveDisposer) {
      this._mouseMoveDisposer();
      this._mouseMoveDisposer = null;
    }
    if (this._mouseDownBeforeDisposer) {
      this._mouseDownBeforeDisposer();
      this._mouseDownBeforeDisposer = null;
    }
  }

  private _createCircle(center: fabric.Point) {
    const circle = new fabric.Circle({
      left: center.x,
      top: center.y,
      // radius: this.VERTEX_RADIUS,
      radius: fabric.FabricObject.ownDefaults.cornerSize
        ? fabric.FabricObject.ownDefaults.cornerSize / 2
        : 2,
      fill: fabric.FabricObject.ownDefaults.cornerColor,
      stroke: fabric.FabricObject.ownDefaults.cornerStrokeColor,
      selectable: false,
      evented: false,
      originX: 'center',
      originY: 'center',
    });
    this._circles.push(circle);
    this.controller.canvas.add(circle);
  }

  private _onMouseDownBefore() {
    return bindCanvasEvent(
      (canvas, event: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
        if (
          (event.e instanceof MouseEvent || event.e instanceof PointerEvent) &&
          event.e.button === 2
        ) {
          this._finishPolygon();
          return;
        }
      },
    );
  }

  private _onMouseDown() {
    return bindCanvasEvent(
      (canvas, event: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
        if (!this._mouseMoveDisposer) {
          this._mouseMoveDisposer = this.controller.canvas.on(
            'mouse:move',
            this._onMouseMove(),
          );
        }

        const pointer = event.scenePoint;

        const point = new fabric.Point(pointer.x, pointer.y);

        if (!this._isDrawing) {
          this._isDrawing = true;
        } else {
          const first = this._points[0];
          const dist = Math.hypot(pointer.x - first.x, pointer.y - first.y);

          if (dist < 10) {
            this._finishPolygon();
            return;
          }
        }
        this._createCircle(point);
        this._points.push(point);

        this.updatePreviewLine(pointer);
      },
    );
  }

  private _cleanUp() {
    this._isDrawing = false;
    if (this._previewLine) {
      this.controller.canvas.remove(this._previewLine);
      this._previewLine = null;
    }
    this._points = [];
    this._circles.forEach((c) => {
      this.controller.canvas.remove(c);
    });
    this._lines.forEach((l) => {
      this.controller.canvas.remove(l);
    });
  }

  private _onMouseMove() {
    return bindCanvasEvent(
      (canvas, event: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
        if (!this._isDrawing || !this._previewLine) return;

        const pointer = event.scenePoint;
        this._previewLine.set({ x2: pointer.x, y2: pointer.y });
        this._previewLine.setCoords();
        this.controller.canvas.requestRenderAll();
      },
    );
  }

  private updatePreviewLine(pointer: fabric.Point) {
    if (this._previewLine) {
      this._lines.push(this._previewLine);
      this._previewLine = null;
    }

    const last = this._points[this._points.length - 1];

    this._previewLine = new fabric.Line(
      [last.x, last.y, pointer.x, pointer.y],
      {
        selectable: false,
        evented: false,
        stroke: fabric.FabricObject.ownDefaults.cornerStrokeColor,
      },
    );

    this.controller.canvas.add(this._previewLine);
  }

  private _finishPolygon() {
    if (this._points.length >= 3) {
      const minX = Math.min(...this._points.map((p) => p.x));
      const minY = Math.min(...this._points.map((p) => p.y));
      const localPoints = this._points.map((p) => ({
        x: p.x - minX,
        y: p.y - minY,
      }));
      this._cleanUp();
      const polygon = this.controller.createShape({
        id: uuidv4(),
        type: 'polygon',
        params: {
          points: localPoints,
          fill: '#eed81133',
          stroke: '#eed811',
        },
        x: minX,
        y: minY,
      });
      if (polygon) {
        this.controller.canvas.setActiveObject(polygon);
        polygon.setCoords();
      }
    } else {
      this._cleanUp();
    }

    this.controller.canvas.requestRenderAll();

    this.deactivate();
  }
}
