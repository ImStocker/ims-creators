import { markRaw } from 'vue';
import * as fabric from 'fabric';
import type { LevelEditorShape } from '../../LevelEditor';
import BaseShapeController from '../BaseShapeController';
import {
  COLOR_PRESETS,
  DEFAULT_COLOR_PRESET,
  type ShapePropertyDescriptor,
} from '../shapePropertyDescriptors';
import ChangeColorDropdown from '../../side-panel/fields/ChangeColorDropdown.vue';
import NumberField from '../../side-panel/fields/NumberField.vue';
import type LevelEditorCanvasController from '../../LevelEditorCanvasController';

export type PencilShape = Extract<LevelEditorShape, { type: 'pencil' }>;

const MIN_STROKE_WIDTH = 1;

const STROKE_COLOR_DESCRIPTOR: ShapePropertyDescriptor<PencilShape, any> = {
  key: 'colorStroke',
  title: 'ColorStroke',
  group: 'color',
  section: 'color',
  editorComponent: ChangeColorDropdown,
  editorProps: {
    colors: COLOR_PRESETS,
    editProp: 'stroke',
  },
  get: (shape) => ({
    stroke: shape.params.stroke ?? DEFAULT_COLOR_PRESET.stroke,
  }),
  set: (shape, value, controller) => {
    controller.changeShape(
      shape.id,
      { params: { stroke: value.stroke } },
      { expectPropsChange: false },
    );
  },
};

const STROKE_WIDTH_DESCRIPTOR: ShapePropertyDescriptor<PencilShape, any> = {
  key: 'strokeWidth',
  title: 'StrokeWidth',
  group: 'size',
  section: 'main',
  index: 0,
  editorComponent: NumberField,
  editorProps: {
    icon: {
      type: 'text',
      value: 'SW',
    },
  },
  get: (shape) => shape.params.strokeWidth,
  set: (shape, value, controller) => {
    controller.changeShape(
      shape.id,
      { params: { strokeWidth: Math.max(MIN_STROKE_WIDTH, value) } },
      { expectPropsChange: false },
    );
  },
};

export default class PencilController extends BaseShapeController<PencilShape> {
  name = 'pencil';
  icon = 'ri-pencil-line';

  createFabricObject(shape: PencilShape) {
    return markRaw(
      new fabric.Path(shape.params.path, {
        id: shape.id,
        index: shape.index,
        left: shape.x,
        top: shape.y,
        skewX: shape.skew ?? 0,
        angle: shape.angle ?? 0,
        scaleX: shape.scaleX ?? 1,
        scaleY: shape.scaleY ?? 1,
        parentId: shape.parentId ?? undefined,

        fill: null,
        stroke: shape.params.stroke,
        strokeWidth: shape.params.strokeWidth,
        strokeUniform: true,

        selectable: !shape.locked,
        evented: !shape.locked,
      }),
    );
  }

  protected override collectUpdates(
    existing_object: fabric.FabricObject,
    new_data: Partial<PencilShape>,
    canvasController: LevelEditorCanvasController,
  ): Partial<fabric.Path> {
    const updates = super.collectUpdates(
      existing_object,
      new_data,
      canvasController,
    ) as Partial<fabric.Path>;

    if (
      new_data.params?.strokeWidth !== undefined &&
      existing_object.strokeWidth !== new_data.params.strokeWidth
    ) {
      updates.strokeWidth = new_data.params.strokeWidth;
    }

    return updates;
  }

  override updateFabricObject(
    existing_object: fabric.FabricObject,
    new_data: Partial<PencilShape>,
    canvasController: LevelEditorCanvasController,
  ): void {
    const new_path_data = new_data.params?.path;

    if (new_path_data !== undefined) {
      const path_object = existing_object as fabric.Path;
      if (fabric.util.joinPath(path_object.path) !== new_path_data) {
        path_object._setPath(new_path_data, false);
        path_object.setCoords();
      }
    }

    super.updateFabricObject(existing_object, new_data, canvasController);
  }

  protected override _afterFabricPropsSet(existing_object: fabric.Path): void {
    existing_object.setCoords();
  }

  override getSpecialPropertyDescriptors(): ShapePropertyDescriptor<
    PencilShape,
    any
  >[] {
    return [STROKE_WIDTH_DESCRIPTOR, STROKE_COLOR_DESCRIPTOR];
  }
}
