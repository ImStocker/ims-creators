import type { AssetPropValue } from '~ims-app-base/logic/types/Props';
import type { ScriptPlayNode } from './ScriptPlayNode';
import type { ScriptBlockPlainVariable } from '../logic/nodeStoring';
import type { AssetFullInstanceR } from '../../../../../../ims-app-base/app/logic/types/AssetFullInstance';

export type ScriptPlayContext = {
  variables: Map<string, AssetPropValue>;
  nodeParams: Map<string, AssetPropValue>;
  assets: Map<string, AssetFullInstanceR>;
  currentNode: ScriptPlayNode | null;
  ended: boolean;
};

export function createScriptPlayContext(
  variables: ScriptBlockPlainVariable[],
): ScriptPlayContext {
  return {
    variables: new Map(
      variables.map((v) => [
        v.name,
        v.default !== undefined ? v.default : null,
      ]),
    ),
    nodeParams: new Map(),
    assets: new Map(),
    currentNode: null,
    ended: false,
  };
}

export function cloneScriptPlayContext(
  original: ScriptPlayContext,
): ScriptPlayContext {
  return {
    variables: new Map(original.variables.entries()),
    nodeParams: new Map(original.nodeParams.entries()),
    assets: new Map(original.assets.entries()),
    currentNode: original.currentNode,
    ended: original.ended,
  };
}

export function getScriptPlayContextNodeParam(
  context: ScriptPlayContext,
  node_id: string,
  param: string,
): AssetPropValue {
  return context.nodeParams.get(node_id + '-' + param) ?? null;
}

export function setScriptPlayContextNodeParam(
  context: ScriptPlayContext,
  node_id: string,
  param: string,
  value: AssetPropValue,
): void {
  context.nodeParams.set(node_id + '-' + param, value);
}
