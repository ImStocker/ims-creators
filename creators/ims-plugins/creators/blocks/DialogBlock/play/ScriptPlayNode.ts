import type { ImscScriptPlayerState } from 'imsc-script';
import type { ImscScriptGraphNode } from 'imsc-script/Graph';
import type {
  AssetPropsPlainObject,
  AssetPropsPlainObjectValue,
} from '~ims-app-base/logic/types/Props';

export type ScriptPlayNode = {
  id: string;
  node: ImscScriptGraphNode;
  inputs: AssetPropsPlainObject;
  subject: AssetPropsPlainObjectValue;
  optionsInputs: AssetPropsPlainObject[];
};

export function getScriptPlayNodeFromState(
  record: ImscScriptPlayerState,
): ScriptPlayNode | null {
  if (!record.frames[0].currentNode) {
    return null;
  }
  const graph = record.frames[0].graph;
  return {
    id: record.frames[0].currentNode.id,
    node: graph.nodes[record.frames[0].currentNode.id],
    subject: record.frames[0].currentNode.subject ?? null,
    inputs: record.frames[0].currentNode.inputs ?? {},
    optionsInputs: record.frames[0].currentNode.optionsInputs ?? [],
  };
}
