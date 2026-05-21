import {
  AssetPropType,
  castAssetPropValueToBoolean,
  castAssetPropValueToFloat,
  castAssetPropValueToInt,
  castAssetPropValueToString,
  castAssetPropValueToText,
  compareAssetPropValues,
  getAssetPropType,
  sameAssetPropValues,
  type AssetPropValue,
  type AssetPropValueAsset,
} from '~ims-app-base/logic/types/Props';
import type { NodeDescriptorOp } from '../nodes/getNodeDescriptiors';
import {
  getScriptPlayContextNodeParam,
  type ScriptPlayContext,
} from './ScriptPlayContext';
import type { ScriptPlayNode } from './ScriptPlayNode';

export function playDataComputeTrigger(
  context: ScriptPlayContext,
  playNode: ScriptPlayNode,
  param: string,
): AssetPropValue {
  return getScriptPlayContextNodeParam(context, playNode.id, param);
}

// export function playDataComputeGetProps(
//   context: ScriptPlayContext,
//   playNode: ScriptPlayNode,
//   param: string,
// ): AssetPropValue {}

export function playDataComputeGetVar(
  context: ScriptPlayContext,
  playNode: ScriptPlayNode,
  param: string,
): AssetPropValue {
  if (param !== 'result') return null;
  const var_name = playNode.values?.variable;
  if (!var_name) return null;
  return context.variables.get(castAssetPropValueToString(var_name)) ?? null;
}

export function playDataComputeOpFabric(op: NodeDescriptorOp) {
  return (
    context: ScriptPlayContext,
    playNode: ScriptPlayNode,
    param: string,
  ): AssetPropValue => {
    if (param !== 'result') return null;
    const arg1 = playNode.values?.arg1 ?? null;
    const arg2 = playNode.values?.arg2 ?? null;
    switch (op) {
      case 'opEqual':
        return sameAssetPropValues(arg1, arg2, true);
      case 'opNotEqual':
        return !sameAssetPropValues(arg1, arg2, true);
      case 'opLess':
        return compareAssetPropValues(arg1, arg2, true) < 0;
      case 'opLessEqual':
        return compareAssetPropValues(arg1, arg2, true) <= 0;
      case 'opMore':
        return compareAssetPropValues(arg1, arg2, true) > 0;
      case 'opMoreEqual':
        return compareAssetPropValues(arg1, arg2, true) >= 0;
      case 'opDiv':
      case 'opMinus':
      case 'opMod':
      case 'opMult':
      case 'opPlus': {
        const arg1_num = castAssetPropValueToFloat(arg1) ?? 0;
        const arg2_num = castAssetPropValueToFloat(arg2) ?? 0;
        switch (op) {
          case 'opDiv':
            if (Number.isInteger(arg1_num) && Number.isInteger(arg2_num)) {
              return Math.trunc(arg1_num / arg2_num);
            } else {
              return arg1_num / arg2_num;
            }
          case 'opMinus':
            return arg1_num - arg2_num;
          case 'opMod':
            return arg1_num % arg2_num;
          case 'opMult':
            return arg1_num * arg2_num;
          case 'opPlus':
            return arg1_num + arg2_num;
        }
        break;
      }
      case 'opAnd':
        return arg1 && arg2;
      case 'opNot':
        return !arg1;
      case 'opOr':
        return arg1 || arg2;
    }
  };
}

export function playDataComputeConstBoolean(
  _context: ScriptPlayContext,
  playNode: ScriptPlayNode,
  param: string,
): AssetPropValue {
  if (param !== 'result') return null;
  return castAssetPropValueToBoolean(playNode.values?.value ?? null);
}

export function playDataComputeConstFloat(
  _context: ScriptPlayContext,
  playNode: ScriptPlayNode,
  param: string,
): AssetPropValue {
  if (param !== 'result') return null;
  return castAssetPropValueToFloat(playNode.values?.value ?? null);
}

export function playDataComputeConstInteger(
  _context: ScriptPlayContext,
  playNode: ScriptPlayNode,
  param: string,
): AssetPropValue {
  if (param !== 'result') return null;
  return castAssetPropValueToInt(playNode.values?.value ?? null);
}

export function playDataComputeConstString(
  _context: ScriptPlayContext,
  playNode: ScriptPlayNode,
  param: string,
): AssetPropValue {
  if (param !== 'result') return null;
  return castAssetPropValueToString(playNode.values?.value ?? null);
}

export function playDataComputeConstText(
  _context: ScriptPlayContext,
  playNode: ScriptPlayNode,
  param: string,
): AssetPropValue {
  if (param !== 'result') return null;
  return castAssetPropValueToText(playNode.values?.value ?? null);
}

export function playDataComputeConstAsset(
  _context: ScriptPlayContext,
  playNode: ScriptPlayNode,
  param: string,
): AssetPropValue {
  if (param !== 'result') return null;
  const value = playNode.values?.value ?? null;
  const type = getAssetPropType(value);
  if (type !== AssetPropType.ASSET) return null;
  return value as AssetPropValueAsset;
}
