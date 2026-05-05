import * as fabric from 'fabric';
import { markRaw, watch } from 'vue';

import type { IAppManager } from '~ims-app-base/logic/managers/IAppManager';
import { INF_GRID_OBJECT_TYPE, InfiniteGrid } from '../canvas/InfiniteGrid';
import createDefaultToolManager from './toolbar/createDefaultToolManager';
import type ToolManager from './toolbar/ToolManager';
import type Image from '../canvas/Image';
import { getPreferenceKeyForBlock } from '~ims-app-base/logic/utils/assets';
import {
  bindCanvasEvent,
  type LevelEditorShape,
  type LevelEditorShapeParamsMap,
} from './LevelEditor';
import UiManager from '~ims-app-base/logic/managers/UiManager';
import {
  getNextIndexWithTimestamp,
  getPreviousIndexWithTimestamp,
} from '~ims-app-base/components/Asset/Editor/blockUtils';
import {
  clipboardCopyPlainText,
  clipboardReadPlainText,
} from '~ims-app-base/logic/utils/clipboard';

import { v4 as uuidv4 } from 'uuid';
import UiPreferenceManager from '~ims-app-base/logic/managers/UiPreferenceManager';
import { getShapeControllers } from './shapes/controllers';
import type LevelEditorBlockController from '../LevelEditorBlockController';

export function getPointerCoords(
  event: fabric.TPointerEventInfo<fabric.TPointerEvent>,
) {
  let clientX = 0;
  let clientY = 0;

  if (event.e instanceof MouseEvent || event.e instanceof PointerEvent) {
    clientX = event.e.clientX;
    clientY = event.e.clientY;
  } else if (event.e instanceof TouchEvent && event.e.touches.length > 0) {
    clientX = event.e.touches[0].clientX;
    clientY = event.e.touches[0].clientY;
  }

  return {
    clientX,
    clientY,
  };
}

export type LevelEditorBlockState = {
  [id: string]: LevelEditorShape;
};

export default class LevelEditorCanvasController {
  readonly toolManager: ToolManager;
  protected readonly appManager: IAppManager;
  readonly blockController: LevelEditorBlockController;
  private _sortedShapesCache: string[] | null = null;

  private _eventHandlers: {
    eventName: keyof fabric.CanvasEvents;
    handler: (...args: any[]) => void;
  }[] = [];

  private _expectPropsChange = false;

  readonly canvas: fabric.Canvas;
  private _panState = {
    lastX: 0,
    lastY: 0,
    active: false,
    cursorSavedState: 'default',
  };
  private _shiftDragState = {
    startX: 0,
    startY: 0,
    active: false,
    lockAxis: null as 'x' | 'y' | null,
  };
  public readonly MAX_ZOOM_SCALE = 2;
  public readonly MIN_ZOOM_SCALE = 0.1;

  constructor(
    appManager: IAppManager,
    blockController: LevelEditorBlockController,
    canvasInitData: {
      canvasEl: HTMLCanvasElement;
      canvasContainerEl: HTMLElement;
    },
    public readonly = false,
  ) {
    this.blockController = blockController;
    this.appManager = appManager;

    this.canvas = markRaw(
      new fabric.Canvas(canvasInitData.canvasEl, {
        preserveObjectStacking: true,
        width: canvasInitData.canvasContainerEl.clientWidth,
        height: canvasInitData.canvasContainerEl.clientHeight,
        viewportTransform: [
          1,
          0,
          0,
          1,
          -canvasInitData.canvasContainerEl.clientWidth / 2,
          -canvasInitData.canvasContainerEl.clientHeight / 2,
        ],
      }),
    );
    fabric.FabricObject.ownDefaults.fill = '#eed81133';
    fabric.FabricObject.ownDefaults.stroke = '#eed811';
    fabric.FabricObject.ownDefaults.strokeWidth = 1;
    fabric.FabricObject.ownDefaults.cornerStyle = 'rect';
    fabric.FabricObject.ownDefaults.cornerSize = 6;
    fabric.FabricObject.ownDefaults.cornerColor = 'rgb(255,255,255)';
    fabric.FabricObject.ownDefaults.cornerStrokeColor = 'rgb(83,139,226)';
    fabric.FabricObject.ownDefaults.borderColor = 'rgb(83,139,226)';
    fabric.FabricObject.ownDefaults.transparentCorners = false;
    fabric.FabricObject.ownDefaults.strokeUniform = true;

    if (readonly) {
      fabric.FabricObject.ownDefaults.lockMovementX = true;
      fabric.FabricObject.ownDefaults.lockMovementY = true;
      fabric.FabricObject.ownDefaults.hasControls = false;
    }

    this._drawGrid();

    this.updateCanvas();

    this.toolManager = createDefaultToolManager(
      this.canvas,
      this.appManager,
      this,
    ) as ToolManager;

    this._initEventHandlers();
    watch(
      () => this.blockController.shapes,
      () => this.updateCanvas(),
      {
        immediate: true,
      },
    );
  }

  private _createSortedShapesCache() {
    if (!this.blockController.shapes) return [];
    const shapes_array = Object.values(this.blockController.shapes);
    const parent_shapes: LevelEditorShape[] = [];

    const children_ids = new Map<string, string[]>();

    for (const shape of shapes_array) {
      if (shape.parentId) {
        if (!children_ids.has(shape.parentId)) {
          children_ids.set(shape.parentId, []);
        }
        children_ids.get(shape.parentId)!.push(shape.id);
      } else {
        parent_shapes.push(shape);
      }
    }

    const result: string[] = [];
    const processed_shape_ids = new Set<string>();

    const process_shape = (shape: LevelEditorShape) => {
      if (processed_shape_ids.has(shape.id)) return;
      processed_shape_ids.add(shape.id);

      const shape_children = children_ids.get(shape.id) ?? [];
      shape_children
        .sort(
          (a, b) =>
            (this.blockController.shapes[a].index ?? 0) -
            (this.blockController.shapes[b].index ?? 0),
        )
        .forEach((id) => process_shape(this.blockController.shapes[id]));
      result.push(shape.id);
    };

    parent_shapes
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .forEach(process_shape);

    return result;
  }

  private _invalidateSortedShapesCache() {
    this._sortedShapesCache = null;
  }

  copyShapesToClipboard() {
    if (!this.blockController.shapes) return;
    if (!this._sortedShapesCache) {
      this._sortedShapesCache = this._createSortedShapesCache();
    }

    const selected_ids = new Set<string>();

    const collect_selected_ids = (object: fabric.FabricObject) => {
      if (!object || !object.id) return;

      selected_ids.add(object.id);

      if (object.type === 'group') {
        const group = object as fabric.Group;
        group.forEachObject((child) => {
          collect_selected_ids(child);
        });
      }
    };

    const active_objects = this.canvas.getActiveObjects();

    active_objects.forEach(collect_selected_ids);

    const shapes_to_copy: LevelEditorShape[] = [];
    const viewport = this.canvas.viewportTransform;

    for (const id of this._sortedShapesCache) {
      if (selected_ids.has(id)) {
        const shape = this.blockController.shapes[id];

        if (!shape) continue;

        const shape_to_copy = { ...shape };

        if (!shape.parentId) {
          const screenX = shape.x * viewport[0] + viewport[4];
          const screenY = shape.y * viewport[3] + viewport[5];
          shape_to_copy._screenX = screenX;
          shape_to_copy._screenY = screenY;
        }

        shapes_to_copy.push(shape_to_copy);
      }
    }

    if (shapes_to_copy.length) {
      clipboardCopyPlainText(
        JSON.stringify({
          shapes: shapes_to_copy,
          viewportContext: this.canvas.viewportTransform,
        }),
      );
    }
  }

  async pasteShapesFromClipboard() {
    const clipboard_text = await clipboardReadPlainText();
    try {
      const parsed = JSON.parse(clipboard_text);
      if (!parsed.shapes) return;
      if (!parsed.viewportContext || !Array.isArray(parsed.viewportContext))
        return;
      if (!Array.isArray(parsed.shapes)) return;

      const viewport = this.canvas.viewportTransform;
      const opId = this.blockController.changer?.makeOpId();

      const is_parsed_item_valid = (parsed_item: any) =>
        parsed_item.type && parsed_item.id && parsed_item.x && parsed_item.y;

      const id_mapping: Record<string, string> = {};

      for (const item of parsed.shapes) {
        if (is_parsed_item_valid(item)) {
          const old_id = item.id;
          const new_id = uuidv4();
          id_mapping[old_id] = new_id;
        } else {
          // Do nothing
        }
      }

      for (const parsed_item of parsed.shapes) {
        if (is_parsed_item_valid(parsed_item)) {
          // item is valid

          try {
            const old_id = parsed_item.id;
            const new_id = id_mapping[old_id];
            const newX = (parsed_item._screenX - viewport[4]) / viewport[0];
            const newY = (parsed_item._screenY - viewport[5]) / viewport[3];

            let new_parent_id: string | undefined;
            if (parsed_item.parentId && id_mapping[parsed_item.parentId]) {
              new_parent_id = id_mapping[parsed_item.parentId];
            }
            delete parsed_item.index;

            const new_object_props = {
              ...parsed_item,
              id: new_id,
              parentId: new_parent_id,
            };

            if (newX && newY && !parsed_item.parentId) {
              new_object_props.x = newX;
              new_object_props.y = newY;
            }

            const new_object = this.createShape(new_object_props, {
              opId,
              expectPropsChange: false,
            });
            if (!new_object) return;

            if (new_object.type === 'group') {
              const child_objects = this.canvas
                .getObjects()
                .filter((obj) => obj.parentId === new_object.id);
              child_objects.forEach((obj) => {
                this.canvas.remove(obj);
              });
            }
          } catch (err: any) {
            this.appManager.get(UiManager).showError(err);
          }
        }
      }
    } catch {
      // Do nothing
    }
  }
  showShapes(
    object_ids: string[],
    options?: {
      zoomToFit?: boolean;
    },
  ) {
    const { zoomToFit = true } = options ?? {};
    const objects: fabric.FabricObject[] = this.sortedCanvasObjects.filter(
      (obj) => object_ids.includes(obj.id),
    );
    let min_x = Infinity;
    let min_y = Infinity;
    let max_x = -Infinity;
    let max_y = -Infinity;
    objects.forEach((obj) => {
      const boundingRect = obj.getBoundingRect();
      min_x = Math.min(min_x, boundingRect.left);
      min_y = Math.min(min_y, boundingRect.top);
      max_x = Math.max(max_x, boundingRect.left + boundingRect.width);
      max_y = Math.max(max_y, boundingRect.top + boundingRect.height);
    });

    const width = max_x - min_x;
    const height = max_y - min_y;
    const center_x = min_x + width / 2;
    const center_y = min_y + height / 2;

    const start_vpt = this.canvas.viewportTransform;
    const current_zoom = this.canvas.getZoom();

    const canvas_width = this.canvas.width / current_zoom;
    const canvas_height = this.canvas.height / current_zoom;

    const fit_padding = 150 / current_zoom;

    let end_zoom = current_zoom;
    let end_translate_x = -start_vpt[4];
    let end_translate_y = -start_vpt[5];

    // Setting zoom
    if (zoomToFit) {
      const scaleX = (this.canvas.width - fit_padding) / width;
      const scaleY = (this.canvas.height - fit_padding) / height;
      const zoom = Math.min(scaleX, scaleY);
      end_zoom = Math.max(
        this.MIN_ZOOM_SCALE,
        Math.min(this.MAX_ZOOM_SCALE, zoom),
      );
    } else {
      const fits_at_current_zoom =
        width <= canvas_width - fit_padding &&
        height <= canvas_height - fit_padding;

      if (!fits_at_current_zoom) {
        const scaleX = (this.canvas.width - fit_padding) / width;
        const scaleY = (this.canvas.height - fit_padding) / height;
        const needed_zoom = Math.min(current_zoom, Math.min(scaleX, scaleY));
        end_zoom = Math.max(this.MIN_ZOOM_SCALE, needed_zoom);
      }
    }

    const visible_left = -start_vpt[4] / current_zoom;
    const visible_top = -start_vpt[5] / current_zoom;
    const visible_right = visible_left + canvas_width;
    const visible_bottom = visible_top + canvas_height;

    const is_fully_visible =
      min_x >= visible_left + fit_padding / 2 &&
      min_y >= visible_top + fit_padding / 2 &&
      max_x <= visible_right - fit_padding / 2 &&
      max_y <= visible_bottom - fit_padding / 2;

    if (is_fully_visible && !zoomToFit) {
      return;
    }

    end_translate_x = this.canvas.width / 2 - center_x * end_zoom;
    end_translate_y = this.canvas.height / 2 - center_y * end_zoom;

    const end_vpt = [
      end_zoom,
      0,
      0,
      end_zoom,
      end_translate_x,
      end_translate_y,
    ];

    fabric.util.animate({
      startValue: 0,
      endValue: 1,
      duration: 1000,
      easing: fabric.util.ease.easeOutCubic,
      onChange: (value: number) => {
        const current_vpt = end_vpt.map(
          (end_val, i) => start_vpt[i] + (end_val - start_vpt[i]) * value,
        ) as fabric.TMat2D;
        this.canvas.setViewportTransform(current_vpt);
        this.canvas.requestRenderAll();
      },
      onComplete: () => {
        this.canvas.requestRenderAll();
      },
      abort: () => {
        return false;
      },
    });
  }

  makeOpId() {
    return this.blockController.changer?.makeOpId();
  }

  updateCanvas() {
    if (this._expectPropsChange) return;
    const shapes = this.blockController.shapes;
    let need_reorder = false;

    const fabric_objects = this.canvas.getObjects();
    const fabric_objects_map = new Map<string, fabric.FabricObject>();
    const current_shape_ids = new Set(shapes ? Object.keys(shapes) : []);

    const add_object_to_map = (obj: fabric.FabricObject) => {
      if (obj.type === INF_GRID_OBJECT_TYPE || obj.type === 'label') return;

      fabric_objects_map.set(obj.id, obj);
      if (obj.type === 'group') {
        const group = obj as fabric.Group;
        group.getObjects().forEach(add_object_to_map);
      }
    };
    fabric_objects.forEach(add_object_to_map);

    if (!this._sortedShapesCache) {
      this._sortedShapesCache = this._createSortedShapesCache();
      need_reorder = true;
    }

    for (const obj of fabric_objects_map.values()) {
      if (obj.type === INF_GRID_OBJECT_TYPE || obj.type === 'label') return;
      if (!current_shape_ids.has(obj.id)) {
        const collection = obj.parent ? obj.parent : this.canvas;
        if (obj.type === 'group') {
          const group = obj as fabric.Group;
          const ungrouped_objects = group.removeAll();
          ungrouped_objects.forEach((obj) => collection.add(obj));
          need_reorder = true;
        }
        collection.remove(obj);
      }
    }

    const previous_objects_stack: (fabric.FabricObject | null)[] = [null];

    for (const shape_id of this._sortedShapesCache) {
      if (!shape_id || !shapes) continue;

      const shape = shapes[shape_id];

      if (!shape) continue;

      if (shape.type === 'group') {
        previous_objects_stack.pop();
      }
      if (
        !previous_objects_stack
          .map((el) => el?.parentId ?? null)
          .includes(shape.parentId ?? null)
      ) {
        previous_objects_stack.push(null);
      }

      const previous_object = previous_objects_stack.pop();

      const shape_controller = getShapeControllers(this.appManager).map[
        shape.type
      ];

      let existing_object = fabric_objects_map.get(shape.id);
      if (existing_object) {
        // update existing object

        shape_controller.updateFabricObject(existing_object, shape, this);
        shape_controller.updateDecoration(existing_object, shape.value, this);

        if (need_reorder) {
          const collection = existing_object.parent
            ? existing_object.parent
            : this.canvas;

          let index: number;
          if (!previous_object) {
            index = collection === this.canvas ? 1 : 0; // Background grid has a 0 index;
          } else {
            index =
              collection.getObjects().indexOf(previous_object) +
              (previous_object?.decorationObject ? 2 : 1);
          }

          collection.moveObjectTo(existing_object, index);

          const object_label = existing_object.decorationObject;
          if (object_label) collection.moveObjectTo(object_label, index + 1);

          existing_object.__renderedIndex = shape.index;
        }
      } else {
        // create new object

        const new_fabric_object = shape_controller.createFabricObject(
          shape,
          this.readonly,
        );

        if (new_fabric_object.type === 'group') {
          const group_id = new_fabric_object.id;
          const child_objects = this.canvas
            .getObjects()
            .filter((obj) => obj.parentId === group_id);

          (new_fabric_object as fabric.Group).add(...child_objects);

          new_fabric_object.set({
            left: shape.x,
            top: shape.y,
            scaleX: shape.scaleX ?? 1,
            scaleY: shape.scaleY ?? 1,
            skewX: shape.skew ?? 0,
            angle: shape.angle ?? 0,
          });

          child_objects.forEach((obj) => {
            this.canvas.remove(obj);
          });
        }

        let target_collection: fabric.Canvas | fabric.Group | undefined =
          undefined;
        if (shape.parentId) {
          target_collection = fabric_objects_map.get(
            shape.parentId,
          ) as fabric.Group;
        }
        if (!target_collection) target_collection = this.canvas;
        target_collection.add(new_fabric_object);

        if (new_fabric_object.type === 'group') {
          const child_objects = (
            new_fabric_object as fabric.Group
          ).getObjects();
          child_objects.forEach((obj) => {
            const child_controller = getShapeControllers(this.appManager).map[
              obj.type
            ];
            child_controller.updateDecoration(obj, shapes[obj.id].value, this);
          });
        }

        new_fabric_object.__renderedIndex = new_fabric_object.index;

        shape_controller.updateDecoration(new_fabric_object, shape.value, this);

        existing_object = new_fabric_object;
      }

      previous_objects_stack.push(existing_object);
    }

    // const selected_object = this.canvas.getActiveObject();
    // if (selected_object?.type === 'activeselection') {
    //   const selection = selected_object as fabric.ActiveSelection;
    //   if (selection._objects.length > 1) {
    //     const new_selection = new fabric.ActiveSelection(
    //       selection.removeAll(),
    //       {
    //         canvas: this.canvas,
    //       },
    //     );

    //     this.canvas.setActiveObject(new_selection);
    //   }
    // }
    this.canvas.requestRenderAll();
  }

  sortObjects<T extends { index?: number }>(objects: T[]) {
    return objects.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  }

  get sortedCanvasObjects() {
    return this.sortObjects(
      this.canvas
        .getObjects()
        .filter((el) => el.type !== 'infgrid' && el.type !== 'label'),
    );
  }

  generateNewMaxIndex(collection?: fabric.Canvas | fabric.Group) {
    const filtered_objects = (collection ?? this.canvas)
      .getObjects()
      .filter(
        (obj) => obj.type !== INF_GRID_OBJECT_TYPE && obj.type !== 'label',
      );

    const max_index = filtered_objects[filtered_objects.length - 1]?.index ?? 0;
    return getNextIndexWithTimestamp(max_index);
  }

  generateNewMinIndex(collection?: fabric.Canvas | fabric.Group) {
    const filtered_objects = (collection ?? this.canvas)
      .getObjects()
      .filter(
        (obj) => obj.type !== INF_GRID_OBJECT_TYPE && obj.type !== 'label',
      );
    const min_index = filtered_objects[0]?.index ?? 0;
    return getPreviousIndexWithTimestamp(min_index);
  }

  createShape(
    shape: LevelEditorShape,
    params?: { opId?: number; expectPropsChange?: boolean },
  ) {
    this._invalidateSortedShapesCache();
    if (!shape.index) {
      shape.index = this.generateNewMaxIndex();
    }
    const new_object = this.convertLevelEditorShapeToFabricObject(shape);
    if (!new_object) {
      this.appManager
        .get(UiManager)
        .showError(`Canvas object type ${shape.type} isn't registered`);
      return null;
    }

    this.canvas.add(new_object);

    this._expectPropsChange =
      params?.expectPropsChange !== undefined ? params.expectPropsChange : true;

    try {
      this.blockController.createShape(shape, params);
    } finally {
      setTimeout(() => {
        this._expectPropsChange = false;
      }, 0);
    }

    return new_object;
  }

  removeShape(
    obj: fabric.FabricObject,
    params?: { opId?: number; expectPropsChange?: boolean },
  ) {
    this._invalidateSortedShapesCache();

    const op = params?.opId
      ? params.opId
      : this.blockController.changer?.makeOpId();

    const collection = obj.parent ?? this.canvas;

    if (obj.decorationObject)
      (obj.decorationObject.parent ?? this.canvas).remove(obj.decorationObject);

    if (obj.type === 'group') {
      (obj as fabric.Group).forEachObject((obj) => {
        this.removeShape(obj, { opId: op });
      });
    }

    collection.remove(obj);

    this._expectPropsChange =
      params?.expectPropsChange !== undefined ? params.expectPropsChange : true;

    try {
      this.blockController.removeShape(obj.id, params);
    } finally {
      setTimeout(() => {
        this._expectPropsChange = false;
      }, 0);
    }
  }

  changeShape(
    shapeId: string,
    data: Partial<LevelEditorShape>,
    params?: { opId?: number; expectPropsChange?: boolean },
  ) {
    if (data.index !== undefined) {
      this._invalidateSortedShapesCache();
    }
    this._expectPropsChange =
      params?.expectPropsChange !== undefined ? params.expectPropsChange : true;

    try {
      this.blockController.changeShape(shapeId, data, params);
    } finally {
      setTimeout(() => {
        this._expectPropsChange = false;
      }, 0);
    }
  }

  convertLevelEditorShapeToFabricObject(shape: LevelEditorShape) {
    const controller = getShapeControllers(this.appManager).map[shape.type];
    return controller.createFabricObject(shape, this.readonly) ?? null;
  }

  saveShapeState(obj: fabric.FabricObject) {
    const matrix = obj.calcTransformMatrix();
    const options = fabric.util.qrDecompose(matrix);

    // const skip_group_matrix = obj.calcTransformMatrix(true);
    // const skip_group_matrix_options =
    //   fabric.util.qrDecompose(skip_group_matrix);

    const matrix_with_anti_skew = fabric.util.composeMatrix({
      ...options,
      skewX: Math.abs(options.skewX),
      skewY: Math.abs(options.skewY),
    });
    let origin_coords: fabric.Point | fabric.XY;
    const changes: Partial<LevelEditorShape> = {};
    let params:
      | LevelEditorShapeParamsMap[keyof LevelEditorShapeParamsMap]
      | undefined;

    switch (obj.type) {
      case 'ellipse': {
        const ellipseObj = obj as unknown as fabric.Ellipse;
        origin_coords = new fabric.Point(0, 0).transform(matrix_with_anti_skew);

        params = {
          rx: ellipseObj.rx,
          ry: ellipseObj.ry,
        } as LevelEditorShapeParamsMap['ellipse'];
        break;
      }
      case 'textbox': {
        origin_coords = new fabric.Point(
          -obj.width / 2,
          -obj.height / 2,
        ).transform(matrix_with_anti_skew);
        params = {
          width: obj.width,
          height: obj.height,
        };
        break;
      }
      case 'polygon': {
        const polygonObj = obj as unknown as fabric.Polygon;
        const { x, y } = polygonObj.getXY();
        const relative_points = polygonObj.points.map((p) => ({
          x: p.x,
          y: p.y,
        }));
        origin_coords = { x, y };
        params = {
          points: relative_points,
        } as LevelEditorShapeParamsMap['polygon'];
        break;
      }
      case 'pointer': {
        origin_coords = new fabric.Point(0, obj.height / 2).transform(
          matrix_with_anti_skew,
        );

        break;
      }
      case 'image': {
        origin_coords = new fabric.Point(
          -obj.width / 2,
          -obj.height / 2,
        ).transform(matrix_with_anti_skew);
        const imageObj = obj as unknown as Image;
        params = {
          width: imageObj.displayingWidth ?? imageObj.width,
          height: imageObj.displayingHeight ?? imageObj.height,
        };
        break;
      }
      case 'group': {
        origin_coords = new fabric.Point(
          -obj.width / 2,
          -obj.height / 2,
        ).transform(matrix_with_anti_skew);
        break;
      }
      default: {
        origin_coords = new fabric.Point(
          -obj.width / 2,
          -obj.height / 2,
        ).transform(matrix_with_anti_skew);
        params = {
          width: obj.width,
          height: obj.height,
        } as LevelEditorShapeParamsMap['rect'];
      }
    }

    changes.x = origin_coords.x;
    changes.y = origin_coords.y;

    if (options.scaleX && obj.type !== 'image') {
      changes.scaleX = options.scaleX;
    }
    if (options.scaleY && obj.type !== 'image') {
      changes.scaleY = options.scaleY;
    }
    if (options.angle) {
      changes.angle = options.angle;
    }
    if (options.skewX) {
      changes.skew = options.skewX;
    }
    // if (skip_group_matrix_options.scaleX && obj.type !== 'image') {
    //   changes.scaleX = skip_group_matrix_options.scaleX;
    // }
    // if (skip_group_matrix_options.scaleY && obj.type !== 'image') {
    //   changes.scaleY = skip_group_matrix_options.scaleY;
    // }
    // if (skip_group_matrix_options.angle) {
    //   changes.angle = skip_group_matrix_options.angle;
    // }
    // if (skip_group_matrix_options.skewX) {
    //   changes.skew = skip_group_matrix_options.skewX;
    // }

    if (params) {
      return { ...changes, params };
    }

    return changes;
  }

  normalizeShapeTransform(
    obj: fabric.FabricObject,
    selectionMatrix?: fabric.TMat2D,
  ): void {
    let matrix = obj.calcTransformMatrix();
    const original_options = fabric.util.qrDecompose(matrix);

    if (selectionMatrix) {
      const inverted_matrix = fabric.util.invertTransform(selectionMatrix);
      matrix = fabric.util.multiplyTransformMatrices(matrix, inverted_matrix);
    }
    const options = fabric.util.qrDecompose(matrix);

    function normalizeSkew() {
      const defaultObj = obj as unknown as fabric.FabricObject;
      defaultObj.set({
        skewX:
          (Math.atan2(
            Math.tan((options.skewX * Math.PI) / 180) * options.scaleX,
            options.scaleY,
          ) /
            Math.PI) *
          180,
        skewY: 0,
      });
    }

    function normalizeScaleToWidthHeight(
      width_prop: 'width' | 'rx',
      height_prop: 'height' | 'ry',
    ) {
      const defaultObj = obj as unknown as fabric.FabricObject;
      defaultObj.set({
        [width_prop]: obj[width_prop] * options.scaleX,
        [height_prop]: obj[height_prop] * options.scaleY,
        scaleX: 1,
        scaleY: 1,
        angle: options.angle,
      });
      normalizeSkew();
      defaultObj.setXY(
        new fabric.Point(
          original_options.translateX,
          original_options.translateY,
        ),
        'center',
        'center',
      );
    }

    switch (obj.type) {
      case 'ellipse': {
        normalizeScaleToWidthHeight('rx', 'ry');
        break;
      }
      case 'pointer': {
        break;
      }
      case 'textbox': {
        break;
      }
      case 'group': {
        normalizeSkew();
        break;
      }
      case 'polygon': {
        const polygonObj = obj as unknown as fabric.Polygon;

        const points = polygonObj.points.map((p) => {
          const { x, y } = new fabric.Point(
            p.x - polygonObj.pathOffset.x,
            p.y - polygonObj.pathOffset.y,
          ).transform(matrix);

          return {
            x,
            y,
          };
        });

        if (!points.length) return;

        let max_x = points[0].x;
        let max_y = points[0].y;

        let min_x = points[0].x;
        let min_y = points[0].y;

        for (const point of points) {
          if (max_x < point.x) max_x = point.x;
          if (max_y < point.y) max_y = point.y;
          if (min_x > point.x) min_x = point.x;
          if (min_y > point.y) min_y = point.y;
        }

        polygonObj.set({
          points: points.map((p) => ({ x: p.x - min_x, y: p.y - min_y })),
          scaleX: 1,
          scaleY: 1,
          skewX: 0,
          skewY: 0,
          angle: 0,
          left: min_x,
          top: min_y,
        });

        polygonObj.setDimensions();

        break;
      }
      case 'image': {
        const imageObj = obj as unknown as Image;
        imageObj.displayingWidth = obj.width * options.scaleX;
        imageObj.displayingHeight = obj.height * options.scaleY;

        break;
      }
      default: {
        normalizeScaleToWidthHeight('width', 'height');
        break;
      }
    }

    obj.setCoords();
  }

  private _onKeyDown = (e: KeyboardEvent) => {
    if (this.readonly) {
      return;
    }

    const active_html_element = document.activeElement as HTMLElement | null;
    if (
      active_html_element &&
      (active_html_element.tagName === 'INPUT' ||
        active_html_element.tagName === 'TEXTAREA')
    ) {
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      const active = this.canvas.getActiveObject();
      if (active) {
        if (active instanceof fabric.Textbox && active.isEditing) return;
        const op = this.blockController.changer?.makeOpId();
        if (active instanceof fabric.ActiveSelection) {
          active.getObjects().forEach((obj) => {
            this.removeShape(obj, { opId: op });
          });
        } else {
          this.removeShape(active, { opId: op });
        }
      }
      this.canvas.discardActiveObject();
      this.canvas.requestRenderAll();
    }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC') {
      this.copyShapesToClipboard();
    } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV') {
      this.pasteShapesFromClipboard();
    }
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA') {
      e.preventDefault();

      this.canvas.discardActiveObject();

      const all_canvas_objects = this.sortedCanvasObjects.filter(
        (obj) => obj.evented && obj.selectable,
      );
      if (all_canvas_objects.length) {
        const selection = new fabric.ActiveSelection(all_canvas_objects, {
          canvas: this.canvas,
        });
        this.canvas.setActiveObject(selection);
      }

      this.canvas.requestRenderAll();
    }
  };

  private _drawGrid() {
    const bg = new InfiniteGrid();

    this.canvas.add(bg);
    this.canvas.renderAll();
  }

  public disposeEvents() {
    for (const { eventName, handler } of this._eventHandlers) {
      this.canvas.off(eventName, handler);
    }
    this._eventHandlers = [];
  }

  init() {
    this.toolManager.triggerTool('select');
    window.addEventListener('keydown', this._onKeyDown);
    const saved_viewport = this._getSavedViewportTransform();
    if (saved_viewport) {
      this.canvas.setViewportTransform(saved_viewport);
    } else {
      this.toolManager.triggerTool('viewAll');
    }
  }

  destroy() {
    this.canvas.dispose();
    this.disposeEvents();
    window.removeEventListener('keydown', this._onKeyDown);
  }

  private _addHandler = (
    eventName: keyof fabric.CanvasEvents,
    func: (canvas: fabric.Canvas, ...args: any[]) => void,
  ) => {
    const handler = bindCanvasEvent(func);
    this.canvas.on(eventName, handler);
    this._eventHandlers.push({ eventName, handler });
  };

  private _initEventHandlers() {
    // TODO: fix
    this._addHandler(
      'object:moving',
      (canvas, eventParams: fabric.ModifiedEvent) => {
        const obj = eventParams.target;
        if (!obj) return;
        obj.set({
          left: Math.round(obj.left ?? 0),
          top: Math.round(obj.top ?? 0),
        });
        obj.setCoords();
      },
    );
    // TODO: refactor axis lock
    this._addHandler(
      'object:moving',
      (canvas, eventParams: fabric.ModifiedEvent) => {
        const obj = eventParams.target;
        const e = eventParams.e as MouseEvent | undefined;
        if (!obj || !e) return;

        const { clientX, clientY } = e;

        if (e.shiftKey) {
          if (!this._shiftDragState.active) {
            this._shiftDragState.active = true;
            this._shiftDragState.startX = clientX;
            this._shiftDragState.startY = clientY;
            this._shiftDragState.lockAxis = null;
            obj.lockMovementX = false;
            obj.lockMovementY = false;
            return;
          }

          const dx = Math.abs(clientX - this._shiftDragState.startX);
          const dy = Math.abs(clientY - this._shiftDragState.startY);
          const threshold = 5;

          if (
            this._shiftDragState.lockAxis === null &&
            (dx > threshold || dy > threshold)
          ) {
            if (dy > dx) {
              this._shiftDragState.lockAxis = 'x';
              obj.set({
                lockMovementX: true,
              });
            } else {
              this._shiftDragState.lockAxis = 'y';
              obj.set({
                lockMovementY: true,
              });
            }
          }
        } else if (this._shiftDragState.active) {
          obj.set({
            lockMovementX: false,
            lockMovementY: false,
          });
          this._shiftDragState = {
            startX: 0,
            startY: 0,
            active: false,
            lockAxis: null,
          };
        }
      },
    );
    this._addHandler(
      'object:modified',
      (canvas, eventParams: fabric.ModifiedEvent) => {
        const obj = eventParams.target;
        if (this._shiftDragState.active) {
          obj.set({
            lockMovementX: false,
            lockMovementY: false,
          });
          this._shiftDragState = {
            startX: 0,
            startY: 0,
            active: false,
            lockAxis: null,
          };
        }
      },
    );

    this._addHandler(
      'mouse:wheel',
      (canvas, eventParams: fabric.TPointerEventInfo<WheelEvent>) => {
        const event = eventParams.e;

        let zoom = canvas.getZoom();
        zoom *= 0.999 ** event.deltaY;
        if (zoom > this.MAX_ZOOM_SCALE) zoom = this.MAX_ZOOM_SCALE;
        if (zoom < this.MIN_ZOOM_SCALE) zoom = this.MIN_ZOOM_SCALE;

        canvas.zoomToPoint(
          new fabric.Point({ x: event.offsetX, y: event.offsetY }),
          zoom,
        );
        event.preventDefault();
        event.stopPropagation();
      },
    );

    this._addHandler(
      'shape:content-changed',
      (
        canvas,
        eventParams: Partial<fabric.TEvent> & {
          target: fabric.FabricObject;
        },
      ) => {
        const target = eventParams.target;
        const existing_shape = this.blockController.shapes[target.id];
        const existing_object = canvas
          .getObjects()
          .find((obj) => obj.id === target.id);

        if (!existing_shape || !existing_object) return;

        const shape_controller = getShapeControllers(this.appManager).map[
          existing_shape.type
        ];

        shape_controller.updateDecoration(
          existing_object,
          existing_shape.value,
          this,
        );
      },
    );

    this._addHandler(
      'object:modified',
      (canvas, eventParams: fabric.ModifiedEvent) => {
        const shape = eventParams.target;
        if (!shape) return;

        let objects: fabric.FabricObject[] = [];
        let group_matrix: fabric.TMat2D | undefined = undefined;

        if (shape.type === 'activeselection') {
          const group = shape as fabric.ActiveSelection;
          group_matrix = group.calcTransformMatrix();
          const group_matrix_options = fabric.util.qrDecompose(group_matrix);
          group.set({
            skewX: group_matrix_options.skewX,
            skewY: 0,
            scaleX: group_matrix_options.scaleX,
            scaleY: group_matrix_options.scaleY,
            angle: group_matrix_options.angle,
          });
          group.setXY(
            new fabric.Point(
              group_matrix_options.translateX,
              group_matrix_options.translateY,
            ),
            'center',
            'center',
          );
          group.forEachObject((obj) => {
            objects.push(obj);
          });
        } else {
          objects = [shape];
        }
        const op = this.blockController.changer?.makeOpId();
        objects.forEach((obj) => {
          this.normalizeShapeTransform(obj, group_matrix);
          const changes = this.saveShapeState(obj);
          this.changeShape(obj.id, changes as any, { opId: op });
        });
        this.canvas.requestRenderAll();
      },
    );

    this._addHandler(
      'contextmenu',
      (_canvas, eventParams: fabric.MiscEvents['contextmenu']) => {
        eventParams.e.preventDefault();
      },
    );

    this._addHandler(
      'mouse:down:before',
      (canvas, eventParams: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
        if (
          (eventParams.e instanceof MouseEvent ||
            eventParams.e instanceof PointerEvent) &&
          eventParams.e.button !== 1 &&
          eventParams.e.button !== 2
        ) {
          return;
        }

        const { clientX, clientY } = getPointerCoords(eventParams);

        this._panState.lastX = clientX;
        this._panState.lastY = clientY;

        canvas.selection = false;
        this._panState.active = true;
        this._panState.cursorSavedState = canvas.defaultCursor;
        canvas.defaultCursor = 'grabbing';

        eventParams.e.preventDefault();
      },
    );

    this._addHandler('mouse:up:before', (canvas) => {
      if (this._panState.active) {
        canvas.setViewportTransform(canvas.viewportTransform);
        canvas.selection = true;

        this._panState.active = false;
        canvas.defaultCursor = this._panState.cursorSavedState;
        this._panState.lastX = 0;
        this._panState.lastY = 0;

        this._saveViewportTransform(canvas);
      }
    });

    this._addHandler(
      'mouse:move',
      (canvas, eventParams: fabric.TPointerEventInfo<fabric.TPointerEvent>) => {
        if (!this._panState.active) return;

        const { clientX, clientY } = getPointerCoords(eventParams);

        canvas.viewportTransform[4] += clientX - this._panState.lastX;

        canvas.viewportTransform[5] += clientY - this._panState.lastY;

        this._panState.lastX = clientX;
        this._panState.lastY = clientY;

        const activeObject = canvas.getActiveObject();
        if (activeObject) {
          activeObject.setCoords();
        }

        canvas.requestRenderAll();
      },
    );

    this._addHandler(
      'text:editing:exited',
      (canvas, { target }: { target: fabric.IText }) => {
        const new_value = target.text;
        if (!new_value) {
          this.removeShape(target);
        }
        const existing_shape = this.blockController.shapes[target.id];
        if (!existing_shape) return;

        if (new_value !== existing_shape.value) {
          this.changeShape(target.id, { value: new_value });
        }
      },
    );
  }

  private _saveViewportTransform(canvas: fabric.Canvas) {
    this.appManager
      .get(UiPreferenceManager)
      .setPreference(
        this.viewportTransformPreferenceKey,
        canvas.viewportTransform,
      );
  }

  private get viewportTransformPreferenceKey() {
    const preference_id = getPreferenceKeyForBlock(
      this.blockController.resolvedBlock,
    );
    return `LevelEditorBlock.viewportTransform.` + preference_id;
  }

  private _getSavedViewportTransform() {
    return this.appManager
      .get(UiPreferenceManager)
      .getPreference(this.viewportTransformPreferenceKey, null);
  }
}
