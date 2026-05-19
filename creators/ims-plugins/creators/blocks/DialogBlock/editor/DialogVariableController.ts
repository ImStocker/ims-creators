import type { DialogVariable } from './DialogBlockController';

export type DialogCollectionItem = {
  name: string;
  index?: number;
  [key: string]: any;
};

export interface IDialogVariableController
  extends IDialogCollectionController<DialogVariable> {}
export interface IDialogCollectionController<
  T extends DialogCollectionItem = any,
> {
  getEntities(): T[];
  addEntity(entity: T): void;
  changeEntity(entity_name: string, entity: T): void;
  deleteEntity(entity_name: string): void;
  canDeleteEntity(entity_name: string): boolean;
  reorderEntities(entities: T[]): void;
  createEntity: () => Promise<T | null>;
}
