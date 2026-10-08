import { markRaw } from 'vue';
import type { LevelEditorShape } from '../../LevelEditor';
import BaseShapeController from '../BaseShapeController';
import Image from '../../../canvas/Image';
import type * as fabric from 'fabric';
import { SIZE_PROPERTY_DESCRIPTORS } from '../shapePropertyDescriptors';
import type LevelEditorCanvasController from '../../LevelEditorCanvasController';

export type ImageShape = Extract<LevelEditorShape, { type: 'image' }>;

export default class ImageController extends BaseShapeController<ImageShape> {
  name = 'image';
  icon = 'ri-image-add-line';

  createFabricObject(shape: ImageShape) {
    return markRaw(
      new Image(this.appManager, shape.params.file, {
        id: shape.id,
        index: shape.index,
        left: shape.x,
        top: shape.y,
        scaleX: shape.scaleX ?? 1,
        scaleY: shape.scaleY ?? 1,
        skewX: shape.skew ?? 0,
        angle: shape.angle ?? 0,
        parentId: shape.parentId ?? undefined,
        ...shape.params,

        selectable: !shape.locked,
        evented: !shape.locked,
        imageSmoothing: !shape.params.pixelated,
      }),
    );
  }
  protected override collectUpdates(
    existing_object: fabric.FabricObject,
    new_data: Partial<ImageShape>,
    canvasController: LevelEditorCanvasController,
  ): Partial<fabric.FabricObject> {
    const updates = super.collectUpdates(
      existing_object,
      new_data,
      canvasController,
    );

    if (new_data.params?.width !== undefined) {
      const scaleX = new_data.params.width / existing_object.width;
      updates.scaleX = scaleX;
    }

    if (new_data.params?.height !== undefined) {
      const scaleY = new_data.params.height / existing_object.height;
      updates.scaleY = scaleY;
    }

    return updates;
  }

  override getSpecialPropertyDescriptors() {
    return [...SIZE_PROPERTY_DESCRIPTORS];
  }
}
