import {
  sameAssetPropValues,
  type AssetPropValue,
  type AssetPropValueType,
} from '~ims-app-base/logic/types/Props';
import type {
  ScriptBlockPlainProps,
  ScriptBlockPlainPropValue,
  ScriptBlockPlainPropValueBind,
  ScriptBlockPlainVariable,
} from '../logic/nodeStoring';
import type { DialogVariable } from './DialogBlockController';

export type NodeDataOption = {
  values: ScriptBlockPlainProps;
  next: string | null;
};

export type NodeData = {
  subject: string;
  values: ScriptBlockPlainProps;
  options: NodeDataOption[];
  params: {
    in: ScriptBlockPlainVariable[];
    out: ScriptBlockPlainVariable[];
  };
  index: number;
};

export function samePinDataTypes(
  pin1: AssetPropValueType | AssetPropValueType[] | null,
  pin2: AssetPropValueType | AssetPropValueType[] | null,
): boolean {
  if (!pin1 && !pin2) return true;
  else if (!pin1 && pin2) return false;
  else if (pin1 && !pin2) return false;
  else if (pin1 && pin2) {
    if (!Array.isArray(pin1)) pin1 = [pin1];
    if (!Array.isArray(pin2)) pin2 = [pin2];
    if (pin1.length !== pin2.length) return false;
    for (let i = 0; i < pin1.length; i++) {
      if (!sameAssetPropValues(pin1[i], pin2[i], true)) {
        return false;
      }
    }
    return true;
  } else return false;
}

export type NodeDataController = {
  get values(): ScriptBlockPlainProps;
  get options(): NodeDataOption[];
  get params(): {
    in: ScriptBlockPlainVariable[];
    out: ScriptBlockPlainVariable[];
  };
  get subject(): AssetPropValue;
  setSubject(val: AssetPropValue): void;
  setValues(vals: ScriptBlockPlainProps): void;
  setValue(prop: string, val: ScriptBlockPlainPropValue): void;
  deleteValue(prop: string): void;
  addOption(): number;
  deleteOption(index: number): void;
  moveOption(index: number, dir: -1 | 1): void;
  getOptionValue(index: number, prop: string): ScriptBlockPlainPropValue;
  setOptionValue(
    index: number,
    prop: string,
    value: ScriptBlockPlainPropValue | undefined,
  ): void;
  setOptionValues(index: number, value: ScriptBlockPlainProps): void;
  deleteOptionValue(index: number, prop: string): void;
  isPinConnected(pin_id: string): boolean;
  getPinBind(pin_id: string): ScriptBlockPlainPropValueBind | null;
  getPinDataType(pin_id: string): AssetPropValueType[] | null;
  setPinDataType(
    pin_id: string,
    type: AssetPropValueType | AssetPropValueType[] | null,
  ): void;
  addParam(scope: 'in' | 'out', variable: DialogVariable): void;
  changeParam(
    scope: 'in' | 'out',
    variable_name: string,
    variable: DialogVariable,
  ): void;
  deleteParam(scope: 'in' | 'out', variable_name: string): void;
};
