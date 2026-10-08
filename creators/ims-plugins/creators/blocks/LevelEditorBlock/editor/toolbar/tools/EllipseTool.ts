import type * as fabric from 'fabric';
import { v4 as uuidv4 } from 'uuid';

import ShapeCreationTool, {
  type ShapeCreationParams,
} from './base/ShapeCreationTool';
import type { LevelEditorShape } from '../../LevelEditor';
import type { ToolSection } from '../ToolManager';

export default class EllipseTool extends ShapeCreationTool {
  name = 'ellipse';
  icon = 'ri-circle-line';
  override exclusiveGroup: string = 'drawing';
  override supportsMultiInsert = true;
  section: ToolSection = 'draw';
  component = async () =>
    (await import('../LevelEditorToolbarButton.vue')).default;

  override createShape(params: ShapeCreationParams): LevelEditorShape {
    return {
      id: uuidv4(),
      type: 'ellipse',
      x: params.left,
      y: params.top,
      params: {
        rx: params.width / 2,
        ry: params.height / 2,
      },
    };
  }

  override updateShape(
    shape: fabric.Ellipse,
    from: { x: number; y: number },
    to: { x: number; y: number },
  ): void {
    const radiusX = Math.abs(to.x - from.x) / 2;
    const radiusY = Math.abs(to.y - from.y) / 2;
    const centerX = (from.x + to.x) / 2;
    const centerY = (from.y + to.y) / 2;

    shape.set({
      rx: radiusX,
      ry: radiusY,
      left: centerX,
      top: centerY,
    });
  }
}
