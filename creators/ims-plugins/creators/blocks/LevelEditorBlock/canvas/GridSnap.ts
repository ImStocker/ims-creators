import type * as fabric from 'fabric';
import type { LevelEditorShape } from '../editor/LevelEditor';
import type Image from './Image';

export type GridMode = 'strict' | 'snap-only';

export type GridSettings = {
  width: number;
  height: number;
  mode: GridMode;
};

export type LevelSize = {
  width?: number;
  height?: number;
};

export const DEFAULT_GRID_SETTINGS: GridSettings = {
  width: 20,
  height: 20,
  mode: 'snap-only',
};

type RawGridSettings = Partial<GridSettings> | null | undefined;
type RawLevelSize = Partial<LevelSize> | null | undefined;

function toPositiveNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function normalizeGridSettings(raw: RawGridSettings): GridSettings {
  return {
    width: toPositiveNumber(raw?.width, DEFAULT_GRID_SETTINGS.width),
    height: toPositiveNumber(raw?.height, DEFAULT_GRID_SETTINGS.height),
    mode: raw?.mode === 'strict' ? 'strict' : 'snap-only',
  };
}

export function normalizeLevelSize(raw: RawLevelSize): LevelSize | null {
  // Каждое измерение независимо: 0/пусто = без ограничения. Раньше
  // отсутствие любой из сторон давало null, и введённая в одном поле
  // ширина «исчезала» до тех пор, пока не была введена и высота.
  const width = Number(raw?.width);
  const height = Number(raw?.height);
  const size: LevelSize = {};
  if (Number.isFinite(width) && width > 0) {
    size.width = width;
  }
  if (Number.isFinite(height) && height > 0) {
    size.height = height;
  }
  return size.width === undefined && size.height === undefined ? null : size;
}

/**
 * Снап активен, если режим strict, либо (для snap-only) зажат Ctrl/Cmd.
 */
export function isSnapActiveForEvent(
  grid: GridSettings,
  e?: { ctrlKey?: boolean; metaKey?: boolean } | null,
): boolean {
  if (grid.mode === 'strict') return true;
  if (!e) return false;
  return !!(e.ctrlKey || e.metaKey);
}

export function snapValue(value: number, cell: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(cell) || cell <= 0) {
    return value;
  }
  return Math.round(value / cell) * cell;
}

/**
 * Привязка размера к кратности ячейки. Минимальный размер — одна ячейка,
 * чтобы фигура не вырождалась в нулевую.
 */
export function snapSizeValue(value: number, cell: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(cell) || cell <= 0) {
    return value;
  }
  const snapped = snapValue(value, cell);
  return snapped <= 0 ? cell : snapped;
}

/**
 * Округление длины/координат/угла до 6 знаков: убирает FP-мусор вида
 * 499.99999999999994 от матричных операций fabric, сохраняя любую
 * осмысленную точность сцены.
 */
export function roundCoord(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Math.round(value * 1e6) / 1e6;
}

/**
 * Округление масштаба до 12 знаков: матричный qrDecompose даёт погрешность
 * ~1e-16 (0.9999999999999999 вместо 1), реальные же масштабы пользователь
 * задаёт не точнее 1e-9.
 */
export function roundScale(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Math.round(value * 1e12) / 1e12;
}

const NUMERIC_PARAM_KEYS = ['width', 'height', 'rx', 'ry'] as const;

/**
 * Округляет числовые поля фигуры (позиция, масштаб, угол, размеры),
 * не касаясь index (дробный индекс с меткой времени) и строковых
 * полей (path, цвета). Мутирует и возвращает shape.
 */
export function roundShapePrecision<T extends LevelEditorShape>(shape: T): T {
  shape.x = roundCoord(shape.x);
  shape.y = roundCoord(shape.y);
  if (shape.scaleX !== undefined) shape.scaleX = roundScale(shape.scaleX);
  if (shape.scaleY !== undefined) shape.scaleY = roundScale(shape.scaleY);
  if (shape.angle !== undefined) shape.angle = roundCoord(shape.angle);
  if (shape.skew !== undefined) shape.skew = roundCoord(shape.skew);

  const params = shape.params as unknown as Record<string, unknown> | undefined;
  if (params) {
    for (const key of NUMERIC_PARAM_KEYS) {
      const value = params[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        params[key] = roundCoord(value);
      }
    }
    const points = params['points'];
    if (Array.isArray(points)) {
      for (const point of points) {
        if (point && typeof point === 'object') {
          const p = point as { x?: unknown; y?: unknown };
          if (typeof p.x === 'number') p.x = roundCoord(p.x);
          if (typeof p.y === 'number') p.y = roundCoord(p.y);
        }
      }
    }
  }
  return shape;
}

export function snapPoint(
  point: { x: number; y: number },
  grid: GridSettings,
): { x: number; y: number } {
  return {
    x: snapValue(point.x, grid.width),
    y: snapValue(point.y, grid.height),
  };
}

type ModelAnchor = 'topleft' | 'center' | 'bottomcenter';

/**
 * Точка привязки модели x/y относительно bbox фигуры.
 * rect/polygon/textbox/image/pencil/group — левый верх;
 * ellipse — центр; pointer — низ по центру (originX: center, originY: bottom).
 */
const MODEL_ANCHORS: Record<LevelEditorShape['type'], ModelAnchor> = {
  rect: 'topleft',
  textbox: 'topleft',
  polygon: 'topleft',
  image: 'topleft',
  pencil: 'topleft',
  group: 'topleft',
  ellipse: 'center',
  pointer: 'bottomcenter',
};

/**
 * Типы, у которых размер по сетке не привязываем: произвольная геометрия
 * (polygon, pencil), группы (масштабирование меняет содержимое детей)
 * и pointer — он лишь указывает на точку, его размер — постоянный
 * маркер, который сетка не должна растягивать.
 */
const SIZE_SNAP_SKIP_MODEL_TYPES = new Set<LevelEditorShape['type']>([
  'polygon',
  'pencil',
  'group',
  'pointer',
]);

function readNumericParam(
  shape: LevelEditorShape,
  key: 'width' | 'height' | 'rx' | 'ry',
): number | null {
  const params = shape.params as Record<string, unknown> | undefined;
  const value = params ? Number(params[key]) : NaN;
  return Number.isFinite(value) ? value : null;
}

function modelBBoxSize(shape: LevelEditorShape): {
  width: number;
  height: number;
} {
  if (shape.type === 'ellipse') {
    return {
      width: (readNumericParam(shape, 'rx') ?? 0) * 2,
      height: (readNumericParam(shape, 'ry') ?? 0) * 2,
    };
  }
  return {
    width: readNumericParam(shape, 'width') ?? 0,
    height: readNumericParam(shape, 'height') ?? 0,
  };
}

function snapModelSize(shape: LevelEditorShape, grid: GridSettings): void {
  if (SIZE_SNAP_SKIP_MODEL_TYPES.has(shape.type)) return;
  if ((shape.scaleX ?? 1) !== 1 || (shape.scaleY ?? 1) !== 1) return;
  if (shape.angle) return;

  const params = shape.params as Record<string, unknown> | undefined;
  if (!params) return;

  if (shape.type === 'ellipse') {
    const rx = readNumericParam(shape, 'rx');
    const ry = readNumericParam(shape, 'ry');
    if (rx !== null) {
      params['rx'] = snapSizeValue(rx * 2, grid.width) / 2;
    }
    if (ry !== null) {
      params['ry'] = snapSizeValue(ry * 2, grid.height) / 2;
    }
    return;
  }

  const width = readNumericParam(shape, 'width');
  const height = readNumericParam(shape, 'height');
  if (width !== null) {
    params['width'] = snapSizeValue(width, grid.width);
  }
  if (height !== null) {
    params['height'] = snapSizeValue(height, grid.height);
  }
}

/**
 * Привязка модели фигуры к сетке: сначала размер (кратность ячейке,
 * минимум одна ячейка), затем позиция — левый верх bbox на пересечение
 * сетки (для ellipse/pointer с поправкой на якорь).
 *
 * Мутирует shape. Размер пропускается для polygon/pencil/group,
 * повёрнутых и масштабированных фигур.
 */
export function snapShapeToGrid(
  shape: LevelEditorShape,
  grid: GridSettings,
): void {
  if (grid.width <= 0 || grid.height <= 0) return;

  snapModelSize(shape, grid);

  const anchor = MODEL_ANCHORS[shape.type] ?? 'topleft';
  const size = modelBBoxSize(shape);
  const scale_x = shape.scaleX ?? 1;
  const scale_y = shape.scaleY ?? 1;
  const bbox_width = size.width * scale_x;
  const bbox_height = size.height * scale_y;

  let offset_x = 0;
  let offset_y = 0;
  if (anchor === 'center') {
    offset_x = -bbox_width / 2;
    offset_y = -bbox_height / 2;
  } else if (anchor === 'bottomcenter') {
    offset_x = -bbox_width / 2;
    offset_y = -bbox_height;
  }

  const bbox_x = shape.x + offset_x;
  const bbox_y = shape.y + offset_y;
  // Присваиванием, а не `shape.x += snap - bbox_x`: вычитание и сложение
  // с FP-мусором исходных координат даёт в итоге 499.99999999999994
  // вместо ровного 500, а запись вида snapped - offset — это точный
  // результат (snapValue и так возвращает кратное cell значение).
  shape.x = snapValue(bbox_x, grid.width) - offset_x;
  shape.y = snapValue(bbox_y, grid.height) - offset_y;
}

export type FabricSnapOptions = {
  /** Привязать позицию (левый верх bbox к пересечению сетки). По умолчанию true. */
  position?: boolean;
  /** Привязать размер (bbox кратен ячейке). По умолчанию false. */
  size?: boolean;
  /** Учитывать ось X. По умолчанию true. */
  axisX?: boolean;
  /** Учитывать ось Y. По умолчанию true. */
  axisY?: boolean;
};

/**
 * Типы fabric-объектов, у которых размер по сетке не привязываем.
 * Соответствует модельным polygon/pencil/group; pointer — постоянный
 * маркер точки, его геометрия (высота линии, картинка) не кратна
 * ячейке и растягивать её нельзя.
 */
const SIZE_SNAP_SKIP_FABRIC_TYPES = new Set<string>([
  'polygon',
  'path',
  'group',
  'activeselection',
  'pointer',
]);

/**
 * Привязка fabric-объекта к сетке: позиция — по якорю модели
 * (left/top с поправкой origin, без strokeWidth), размер — по
 * геометрии width × scale (без strokeWidth). Обе величины совпадают
 * с тем, что считает модельный snapShapeToGrid, поэтому create и move
 * привязывают один и тот же угол.
 *
 * Вызывать только для объектов верхнего уровня: локальные координаты
 * детей группы считаются в системе координат родителя.
 */
export function snapFabricObject(
  obj: fabric.FabricObject,
  grid: GridSettings,
  options: FabricSnapOptions = {},
): boolean {
  if (grid.width <= 0 || grid.height <= 0) return false;

  const position = options.position !== false;
  const size = options.size === true;
  const axis_x = options.axisX !== false;
  const axis_y = options.axisY !== false;
  let changed = false;

  if (size) {
    const rotated = !!obj.angle;
    const scaled = (obj.scaleX ?? 1) !== 1 || (obj.scaleY ?? 1) !== 1;
    // Размер привязываем по геометрии (width × scale), а НЕ по
    // getBoundingRect(): bbox включает strokeWidth (strokeUniform),
    // поэтому честный 100×100 давал bbox 101, снап выставлял
    // scale 100/101, а normalizeShapeTransform (fold scale → width,
    // вызывается до снапа в object:modified) каскадом превращал это в
    // params.width 99.00990099009901 / scale 0.9999009999010009 при
    // каждом жесте. Геометрия совпадает с модельными params.width —
    // после снапа size кратен ячейке, scale остаётся 1.
    // image: params.width модели — отображаемый размер (width × scale),
    // внутренние же размеры менять нельзя, поэтому image снапим через
    // scaleX/scaleY (даже если сейчас он масштабирован).
    const allow_size = !rotated && (obj.type === 'image' || !scaled);
    if (allow_size && !SIZE_SNAP_SKIP_FABRIC_TYPES.has(obj.type)) {
      const geom_width = (obj.width ?? 0) * (obj.scaleX ?? 1);
      const geom_height = (obj.height ?? 0) * (obj.scaleY ?? 1);

      const target_width =
        geom_width > 0 ? snapSizeValue(geom_width, grid.width) : 0;
      const target_height =
        geom_height > 0 ? snapSizeValue(geom_height, grid.height) : 0;

      if (target_width > 0 && target_width !== geom_width && obj.width) {
        if (obj.type === 'ellipse') {
          obj.set('rx', target_width / 2);
        } else if (obj.type === 'image') {
          const image = obj as unknown as Image;
          obj.set('scaleX', target_width / (obj.width || 1));
          image.displayingWidth = target_width;
        } else {
          obj.set('width', target_width);
        }
        changed = true;
      }
      if (target_height > 0 && target_height !== geom_height && obj.height) {
        if (obj.type === 'ellipse') {
          obj.set('ry', target_height / 2);
        } else if (obj.type === 'image') {
          const image = obj as unknown as Image;
          obj.set('scaleY', target_height / (obj.height || 1));
          image.displayingHeight = target_height;
        } else {
          obj.set('height', target_height);
        }
        changed = true;
      }
      if (changed) obj.setCoords();
    }
  }

  if (position) {
    obj.setCoords();
    // Якорь повторяет snapShapeToGrid (модельную привязку): left/top —
    // для origin left/top, иначе смещение на половину геометрии
    // (ellipse: center/center) либо на её высоту (pointer: bottom).
    // Геометрия (width × scale) берётся без strokeWidth — так create
    // (модель) и move (canvas) привязывают одну и ту же точку, а снап
    // по самому left/top не проходит через FP-круговой обмен
    // getBoundingRect (center ± dim/2), дававший мусор
    // 499.99999999999994; для левого верхнего anchor_x === left,
    // и dx = snap(left) - left применяется по Sterbenz точно.
    const geom_width = (obj.width ?? 0) * Math.abs(obj.scaleX ?? 1);
    const geom_height = (obj.height ?? 0) * Math.abs(obj.scaleY ?? 1);

    let anchor_x = obj.left ?? 0;
    let anchor_y = obj.top ?? 0;
    if (obj.originX === 'center') anchor_x -= geom_width / 2;
    else if (obj.originX === 'right') anchor_x -= geom_width;
    if (obj.originY === 'center') anchor_y -= geom_height / 2;
    else if (obj.originY === 'bottom') anchor_y -= geom_height;

    const target_x = axis_x ? snapValue(anchor_x, grid.width) : anchor_x;
    const target_y = axis_y ? snapValue(anchor_y, grid.height) : anchor_y;
    const dx = target_x - anchor_x;
    const dy = target_y - anchor_y;
    if (dx !== 0 || dy !== 0) {
      obj.set({
        left: (obj.left ?? 0) + dx,
        top: (obj.top ?? 0) + dy,
      });
      obj.setCoords();
      changed = true;
    }
  }

  return changed;
}
