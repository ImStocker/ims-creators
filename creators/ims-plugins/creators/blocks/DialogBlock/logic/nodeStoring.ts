import type {
  AssetPropValue,
  AssetPropValueType,
} from '~ims-app-base/logic/types/Props';
import type { DialogVariable } from '../editor/DialogBlockController';

export type ScriptBlockPlainPropValueBind = { get: string; param: string };

export type ScriptBlockPlainPropValue =
  | AssetPropValue
  | ScriptBlockPlainPropValueBind;

export type ScriptBlockPlainProps = {
  [prop: string]: ScriptBlockPlainPropValue;
};

export enum ScriptBlockPlainActionTypes {
  FUNCTION = 'function',
  TRIGGER = 'trigger',
}

export type ScriptBlockPlainAction = {
  name: string;
  type: ScriptBlockPlainActionTypes;
  params?: {
    in: ScriptBlockPlainVariable[];
    out: ScriptBlockPlainVariable[];
  };
  index?: number;
};

export type ScriptBlockPlainVariable = {
  name: string;
  title: string;
  type: AssetPropValueType | null;
  description: string | null;
  default: AssetPropValue;
  autoFill?: boolean;
  index?: number;
};

export type ScriptBlockPlainNode = {
  type: string;
  subject?: string;
  values?: ScriptBlockPlainProps;
  next?: string | null;
  options?: {
    values?: ScriptBlockPlainProps;
    next: string | null;
  }[];
  params?: {
    in: ScriptBlockPlainVariable[];
    out: ScriptBlockPlainVariable[];
  };
  pos: {
    x: number;
    y: number;
  };
  index: number;
};

export type ScriptBlockPlain = {
  start: string | null;
  nodes: {
    [id: string]: ScriptBlockPlainNode;
  };
  variables: {
    own: {
      [name: string]: ScriptBlockPlainVariable;
    };
  };
  actions: {
    own: {
      [name: string]: ScriptBlockPlainAction;
    };
  };
  __settings: {
    speech: {
      main: {
        [name: string]: DialogVariable;
      };
      option: {
        [name: string]: DialogVariable;
      };
    };
  };
};
