import type {
  AssetPropValueAsset,
  AssetPropValueFile,
} from '~ims-app-base/logic/types/Props';
import type * as fabric from 'fabric';

export function bindCanvasEvent<T extends any[]>(
  func: (canvas: fabric.Canvas, ...args: T) => void,
) {
  return function (this: fabric.Canvas, ...args: T) {
    return func(this, ...args);
  };
}

export function findInCollection(
  id: string,
  collection: fabric.Canvas | fabric.Group,
) {
  const objects = collection.getObjects();
  for (const obj of objects) {
    if (obj.id === id) return obj;

    if (obj.type === 'group' || obj.type === 'activeselection') {
      const founded_object = findInCollection(id, obj as fabric.Group);
      if (founded_object) return founded_object;
    }
  }
  return null;
}

export type LevelEditorShapeParamsMap = {
  rect: {
    width: number;
    height: number;
    fill?: string;
    stroke?: string;
  };
  textbox: {
    width?: number;
    fill?: string;
    stroke?: string;
    textAlign?: 'left' | 'right' | 'center' | 'justify';
  };
  ellipse: {
    rx: number;
    ry: number;
    fill?: string;
    stroke?: string;
  };
  polygon: {
    points: { x: number; y: number }[];
    fill?: string;
    stroke?: string;
  };
  image: {
    file: AssetPropValueFile;
    width?: number;
    height?: number;
    fill?: string;
    stroke?: string;
    pixelated?: boolean;
  };
  pointer: {
    width: number;
    height: number;
  };
  pencil: {
    /**
     * SVG path data (атрибут "d") в абсолютных координатах сцены.
     * Хранится строкой, а не массивом команд: пропсы блока — плоский
     * key-value стор, и массив развернулся бы в тысячи отдельных ключей.
     */
    path: string;
    strokeWidth: number;
    stroke?: string;
  };
  group: {};
};

type LevelEditorShapeBase = {
  id: string;
  x: number;
  y: number;
  scaleX?: number;
  scaleY?: number;
  angle?: number;
  skew?: number;
  value?: AssetPropValueAsset | string;
  index?: number;
  locked?: boolean;
  parentId?: string | null;
};

export type LevelEditorShape = {
  [K in keyof LevelEditorShapeParamsMap]: LevelEditorShapeBase & {
    type: K;
    params: LevelEditorShapeParamsMap[K];
  };
}[keyof LevelEditorShapeParamsMap];
