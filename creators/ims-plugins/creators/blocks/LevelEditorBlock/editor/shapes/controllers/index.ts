import type { IAppManager } from '~ims-app-base/logic/managers/IAppManager';
import type { LevelEditorShape } from '../../LevelEditor';
import type BaseShapeController from '../BaseShapeController';
import EllipseController from './EllipseController';
import GroupController from './GroupController';
import ImageController from './ImageController';
import PencilController from './PencilController';
import PointerController from './PointerController';
import PolygonController from './PolygonController';
import RectController from './RectController';
import TextboxController from './TextboxController';

export function getShapeControllers(appManager: IAppManager) {
  const list = [
    new RectController(appManager),
    new TextboxController(appManager),
    new EllipseController(appManager),
    new PolygonController(appManager),
    new ImageController(appManager),
    new PointerController(appManager),
    new PencilController(appManager),
    new GroupController(appManager),
  ] as BaseShapeController<LevelEditorShape>[];
  const map: { [name: string]: BaseShapeController<LevelEditorShape> } = {};
  for (const element of list) {
    map[element.name] = element;
  }
  return {
    list,
    map,
  };
}
