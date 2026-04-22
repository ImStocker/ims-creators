import { markRaw } from 'vue';
import type { LevelEditorShape } from '../../LevelEditor';
import BaseShapeController from '../BaseShapeController';
import * as fabric from 'fabric';
import {
  COLOR_PROPERTY_DESCRIPTORS,
  type ShapePropertyDescriptor,
} from '../shapePropertyDescriptors';
import type LevelEditorCanvasController from '../../LevelEditorCanvasController';

function distanceToSegment(pointer, a, b) {
  const ax = a.x,
    ay = a.y;
  const bx = b.x,
    by = b.y;
  const px = pointer.x,
    py = pointer.y;

  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby;

  // Если отрезок вырожден в точку
  if (len2 === 0) {
    return Math.hypot(px - ax, py - ay);
  }

  // Проекция точки на прямую (параметр t)
  let t = ((px - ax) * abx + (py - ay) * aby) / len2;

  // Ограничиваем t отрезком [0, 1]
  t = Math.max(0, Math.min(1, t));

  // Ближайшая точка на отрезке
  const closestX = ax + t * abx;
  const closestY = ay + t * aby;

  // Расстояние до ближайшей точки
  return Math.hypot(px - closestX, py - closestY);
}

// function distanceToSegment(pointer: fabric.XY, a: fabric.XY, b: fabric.XY) {
//   const num = Math.abs(
//     (b.y - a.y) * pointer.x - (b.x - a.x) * pointer.y + b.x * a.y - b.y * a.x,
//   );
//   const den = Math.hypot(b.x - a.x, b.y - a.y);
//   return den === 0 ? 0 : num / den;
// }

function findNearestEdge(
  points: fabric.XY[],
  pointer: fabric.Point,
  threshold = 15,
) {
  const n = points.length;
  if (n < 3) return null;

  let minDist = Infinity;
  let nearestEdgeIndex = -1;

  for (let i = 0; i < n; i++) {
    const A = points[i];
    const B = points[(i + 1) % n];
    const dist = distanceToSegment(pointer, A, B);
    if (dist < minDist) {
      minDist = dist;
      nearestEdgeIndex = i;
    }
  }

  if (minDist <= threshold) {
    return { index: nearestEdgeIndex, distance: minDist };
  }
  return null;
}

export type PolygonShape = Extract<LevelEditorShape, { type: 'polygon' }>;

export default class PolygonController extends BaseShapeController<PolygonShape> {
  name = 'polygon';
  icon = 'ri-shape-line';

  createFabricObject(shape: PolygonShape, readonly: boolean) {
    const origin = { x: shape.x, y: shape.y };
    const absolutePoints = shape.params.points.map((p) => ({
      x: p.x + origin.x,
      y: p.y + origin.y,
    }));
    const poly = markRaw(
      new fabric.Polygon(absolutePoints, {
        id: shape.id,
        index: shape.index,
        fill: shape.params.fill,
        stroke: shape.params.stroke,
        parentId: shape.parentId ?? undefined,

        selectable: !shape.locked,
        evented: !shape.locked,
      }),
    );
    if (!readonly) {
      this._handlePolygonControls(poly);
    }
    return poly;
  }

  private _handlePolygonControls(polygon: fabric.Polygon) {
    let editing = false;
    polygon.on('mousedblclick', () => {
      editing = !editing;
      if (editing) {
        polygon.cornerStyle = 'circle';
        polygon.hasBorders = false;
        polygon.controls = fabric.controlsUtils.createPolyControls(polygon);
      } else {
        polygon.cornerStyle = 'rect';
        polygon.hasBorders = true;
        polygon.controls = fabric.controlsUtils.createObjectDefaultControls();
      }
      polygon.setCoords();
      polygon.canvas?.requestRenderAll();
    });

    let tempVertexIndex: number | null = null;
    let isModifying = false;

    polygon.on('added', () => {
      const canvas = polygon.canvas as fabric.Canvas;

      function removeTempVertexIfExists() {
        if (tempVertexIndex === null) return;

        polygon.points.splice(tempVertexIndex, 1);
        polygon.controls = fabric.controlsUtils.createPolyControls(polygon);
        polygon.setCoords();
        canvas.requestRenderAll();

        tempVertexIndex = null;
      }

      polygon.on('modified', () => {
        removeTempVertexIfExists();
        isModifying = false;
        tempVertexIndex = null;
      });

      polygon.on('modifyPoly', () => {
        isModifying = true;
        tempVertexIndex = null;
      });

      canvas.on('mouse:move', (e) => {
        if (!editing) return;
        if (isModifying) return;

        const original_points = [...polygon.points];
        if (tempVertexIndex) {
          original_points.splice(tempVertexIndex, 1);
        }

        const result = findNearestEdge(original_points, e.scenePoint, 15);
        removeTempVertexIfExists();
        if (!result) return;

        const points = original_points;
        const a = points[result.index];
        const b = points[(result.index + 1) % points.length];

        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

        tempVertexIndex = result.index + 1;

        polygon.points.splice(tempVertexIndex, 0, mid);

        polygon.controls = fabric.controlsUtils.createPolyControls(polygon);
        polygon.setCoords();
        canvas.requestRenderAll();
      });
    });

    polygon.on('deselected', () => {
      editing = false;
      polygon.cornerStyle = 'rect';
      polygon.hasBorders = true;
      polygon.controls = fabric.controlsUtils.createObjectDefaultControls();
    });
  }

  protected override collectUpdates(
    existing_object: fabric.FabricObject,
    new_data: Partial<PolygonShape>,
    canvasController: LevelEditorCanvasController,
  ): Partial<fabric.Polygon> {
    const updates = super.collectUpdates(
      existing_object,
      new_data,
      canvasController,
    ) as Partial<fabric.Polygon>;

    if (new_data.params?.points !== undefined) {
      updates.points = new_data.params.points;
    }
    return updates;
  }

  override getSpecialPropertyDescriptors(): ShapePropertyDescriptor<
    PolygonShape,
    any
  >[] {
    return [...COLOR_PROPERTY_DESCRIPTORS];
  }

  protected override _afterFabricPropsSet(
    existing_object: fabric.Polygon,
  ): void {
    existing_object.setDimensions();
    existing_object.setCoords();
  }
}
