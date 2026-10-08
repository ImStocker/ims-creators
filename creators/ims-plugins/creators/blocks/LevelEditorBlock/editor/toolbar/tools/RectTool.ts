import type * as fabric from 'fabric';
import ShapeCreationTool, {
  type ShapeCreationParams,
} from './base/ShapeCreationTool';
import { v4 as uuidv4 } from 'uuid';
import type { LevelEditorShape } from '../../LevelEditor';
import type { ToolSection } from '../ToolManager';

export default class RectTool extends ShapeCreationTool {
  name = 'rect';
  icon = 'ri-rectangle-line';
  override exclusiveGroup: string = 'drawing';
  override supportsMultiInsert = true;
  section: ToolSection = 'draw';
  component = async () =>
    (await import('../LevelEditorToolbarButton.vue')).default;

  override createShape(
    params: ShapeCreationParams,
    isDragMode?: boolean,
  ): LevelEditorShape {
    return {
      id: uuidv4(),
      type: 'rect',
      x: params.left - (isDragMode ? 0 : this.defaultSize / 2),
      y: params.top - (isDragMode ? 0 : this.defaultSize / 2),
      index: 0,
      params: {
        width: params.width,
        height: params.height,
      },
    };
  }
  override updateShape(
    shape: fabric.FabricObject,
    from: { x: number; y: number },
    to: { x: number; y: number },
  ): void {
    const left = Math.min(from.x, to.x);
    const top = Math.min(from.y, to.y);
    const width = Math.abs(to.x - from.x);
    const height = Math.abs(to.y - from.y);
    shape.set({
      width: width,
      height: height,
      left: left,
      top: top,
    });
  }
}
