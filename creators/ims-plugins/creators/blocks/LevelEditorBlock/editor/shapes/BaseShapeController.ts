import type { IAppManager } from '~ims-app-base/logic/managers/IAppManager';
import * as fabric from 'fabric';
import type { LevelEditorShape } from '../LevelEditor';
import type LevelEditorCanvasController from '../LevelEditorCanvasController';
import {
  getCommonPropertiesDescriptors,
  LOCK_PROPERTY_DESCRIPTORS,
  type ShapePropertyDescriptor,
} from './shapePropertyDescriptors';
import DecorationLabel, {
  shapeValueToString,
} from '../../canvas/DecorationLabel';

export default abstract class BaseShapeController<
  TShape extends LevelEditorShape,
> {
  protected readonly appManager: IAppManager;
  abstract readonly name: string;
  abstract readonly icon: string | null;

  constructor(appManager: IAppManager) {
    this.appManager = appManager;
  }
  abstract createFabricObject(
    shape: TShape,
    readonly: boolean,
  ): fabric.FabricObject;

  protected collectUpdates(
    existing_object: fabric.FabricObject,
    new_data: Partial<TShape>,
    canvasController: LevelEditorCanvasController,
  ): Partial<fabric.FabricObject> {
    const updates: Partial<fabric.FabricObject> = {};

    let selection_local: { x: number; y: number } | undefined;
    const selected_object = canvasController.canvas.getActiveObject();

    if (
      selected_object?.type === 'activeselection' &&
      (new_data.x !== undefined || new_data.y !== undefined)
    ) {
      const selection = selected_object as fabric.ActiveSelection;

      const selected_objects = selection.getObjects();
      if (selected_objects.find((obj) => obj.id === existing_object.id)) {
        const model_shape =
          canvasController.blockController.shapes?.[existing_object.id];
        const target_x = new_data.x ?? model_shape?.x ?? existing_object.left;
        const target_y = new_data.y ?? model_shape?.y ?? existing_object.top;
        const selection_matrix = selection.calcTransformMatrix();
        const inverted_selection_matrix =
          fabric.util.invertTransform(selection_matrix);
        const { x, y } = new fabric.Point(target_x, target_y).transform(
          inverted_selection_matrix,
        );
        selection_local = { x, y };
      }
    }

    if (
      new_data.index !== undefined &&
      existing_object.index !== new_data.index
    ) {
      updates.index = new_data.index;
    }

    if (existing_object.parentId !== new_data.parentId) {
      updates.parentId = new_data.parentId ?? undefined;
    }

    if (selection_local) {
      if (existing_object.left !== selection_local.x) {
        updates.left = selection_local.x;
      }
      if (existing_object.top !== selection_local.y) {
        updates.top = selection_local.y;
      }
    } else {
      if (new_data.x !== undefined && existing_object.left !== new_data.x) {
        updates.left = new_data.x;
      }

      if (new_data.y !== undefined && existing_object.top !== new_data.y) {
        updates.top = new_data.y;
      }
    }
    if (
      new_data.angle !== undefined &&
      existing_object.angle !== new_data.angle
    ) {
      updates.angle = new_data.angle;
    }
    if (
      new_data.skew !== undefined &&
      existing_object.skewX !== new_data.skew
    ) {
      updates.skewX = new_data.skew;
    }
    if (
      new_data.scaleX !== undefined &&
      existing_object.scaleX !== new_data.scaleX
    ) {
      updates.scaleX = new_data.scaleX;
    }
    if (
      new_data.scaleY !== undefined &&
      existing_object.scaleY !== new_data.scaleY
    ) {
      updates.scaleY = new_data.scaleY;
    }

    if (new_data.locked !== undefined) {
      updates.selectable = !new_data.locked;
      updates.evented = !new_data.locked;
    }

    if (
      new_data.params &&
      new_data.params['fill'] !== undefined &&
      existing_object.fill !== new_data.params['fill']
    ) {
      updates.fill = new_data.params['fill'];
    }
    if (
      new_data.params &&
      new_data.params['stroke'] !== undefined &&
      existing_object.stroke !== new_data.params['stroke']
    ) {
      updates.stroke = new_data.params['stroke'];
    }

    return updates;
  }

  updateFabricObject(
    existing_object: fabric.FabricObject,
    new_data: Partial<TShape>,
    canvasController: LevelEditorCanvasController,
  ): void {
    const updates = this.collectUpdates(
      existing_object,
      new_data,
      canvasController,
    );

    if (Object.keys(updates).length > 0) {
      existing_object.set(updates);
      this._afterFabricPropsSet(existing_object);
    }
  }

  protected _afterFabricPropsSet(existing_object: fabric.FabricObject) {
    existing_object.setCoords();
  }

  getSpecialPropertyDescriptors(): ShapePropertyDescriptor<TShape, any>[] {
    return [];
  }

  getPropertyDescriptors() {
    const common_property_descriptors = getCommonPropertiesDescriptors();
    const special_property_descriptors = this.getSpecialPropertyDescriptors();
    const descriptors = [
      ...common_property_descriptors,
      ...special_property_descriptors,
      ...LOCK_PROPERTY_DESCRIPTORS,
    ];
    return descriptors;
  }

  updateDecoration(
    owner_object: fabric.FabricObject,
    value: TShape['value'],
    canvasController: LevelEditorCanvasController,
  ) {
    const existing_label = owner_object.decorationObject;

    if (!value) {
      if (owner_object.decorationObject) {
        if (existing_label)
          (existing_label.parent
            ? existing_label.parent
            : canvasController.canvas
          ).remove(existing_label);
        delete owner_object.decorationObject;
      }
      return;
    }

    if (existing_label) {
      if (owner_object.parentId !== existing_label.parentId) {
        const label_collection = existing_label.parent
          ? existing_label.parent
          : canvasController.canvas;

        if (existing_label.parentId) {
          existing_label.parentId = undefined;
          const group = existing_label.parent;
          if (group) group.remove(existing_label);
        }
        if (owner_object.parentId) {
          const group = owner_object.parent;
          if (group) {
            label_collection.remove(existing_label);
            group.insertAt(
              group.getObjects().indexOf(owner_object) + 1,
              existing_label,
            );
          }
        }
      }

      existing_label.updatePosition();

      const new_text = shapeValueToString(value);
      if (existing_label.textbox.text !== new_text) {
        existing_label.setValue(value);
      }
    } else {
      const label = this._createObjectLabel(value, owner_object);

      if (label) {
        let target_collection;
        if (owner_object.parent) {
          target_collection = owner_object.parent;
        }
        if (!target_collection) {
          target_collection = canvasController.canvas;
        }
        target_collection.add(label);

        const owner_object_index = target_collection
          .getObjects()
          .indexOf(owner_object);
        target_collection.moveObjectTo(label, owner_object_index + 1);
      }
    }
  }

  protected _createObjectLabel(
    value: TShape['value'],
    fabric_object: fabric.FabricObject,
  ) {
    if (value === undefined) return undefined;

    const label = new DecorationLabel(value, fabric_object, this.appManager, {
      hasBackground: false,
    });

    return label;
  }
}
