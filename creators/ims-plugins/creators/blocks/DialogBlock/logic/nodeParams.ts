import type {
  ScriptBlockPlainAction,
  ScriptBlockPlainVariable,
  ScriptBlockPlainProps,
} from './nodeStoring';
import type {
  DialogVariable,
  DialogBlockController,
} from '../editor/DialogBlockController';

export type ActionNodeParamsResult = {
  inputParameters: DialogVariable[];
  outputParameters: DialogVariable[];
  ownParamNames: Set<string>;
};

export function getActionNodeParams(
  params: { in: ScriptBlockPlainVariable[]; out: ScriptBlockPlainVariable[] },
  actionName: string | null,
  actions: ScriptBlockPlainAction[],
  values?: ScriptBlockPlainProps,
): ActionNodeParamsResult {
  const ownParamNames = new Set<string>();

  const inputParameters: DialogVariable[] = [];

  for (const legacy_param of params['in'] ?? []) {
    inputParameters.push(legacy_param);
    ownParamNames.add('in-' + legacy_param.name);
  }

  if (actionName) {
    const existing_action = actions.find((a) => a.name === actionName);
    if (existing_action) {
      for (const param of existing_action.params?.['in'] ?? []) {
        if (ownParamNames.has('in-' + param.name)) {
          ownParamNames.delete('in-' + param.name);
        } else {
          inputParameters.push(param);
        }
      }
    }
  }

  if (values) {
    for (const value of Object.keys(values)) {
      if (
        !inputParameters.find((v) => v.name === value) &&
        values[value] &&
        values[value]['get']
      ) {
        inputParameters.push({
          name: value,
          title: value,
          default: null,
          description: null,
          type: null,
        });
        ownParamNames.add('in-' + value);
      }
    }
  }

  const outputParameters: DialogVariable[] = [];

  for (const legacy_param of params['out'] ?? []) {
    outputParameters.push(legacy_param);
    ownParamNames.add('out-' + legacy_param.name);
  }

  if (actionName) {
    const existing_action = actions.find((a) => a.name === actionName);
    if (existing_action) {
      for (const param of existing_action.params?.['out'] ?? []) {
        if (ownParamNames.has('out-' + param.name)) {
          ownParamNames.delete('out-' + param.name);
        } else {
          outputParameters.push(param);
        }
      }
    }
  }

  return {
    inputParameters,
    outputParameters,
    ownParamNames,
  };
}

export function getCallScriptNodeParams(
  params: { in: ScriptBlockPlainVariable[]; out: ScriptBlockPlainVariable[] },
  calledScriptController: DialogBlockController | null,
  values?: ScriptBlockPlainProps,
): ActionNodeParamsResult {
  const ownParamNames = new Set<string>();

  const inputParameters: DialogVariable[] = [];

  if (calledScriptController) {
    const variables = calledScriptController.getVariables();
    const in_params = variables.filter(
      (el) => el.kind && ['in', 'in-out'].includes(el.kind),
    );
    for (const param of in_params) {
      inputParameters.push(param);
      if (ownParamNames.has('in-' + param.name)) {
        ownParamNames.delete(param.name);
      }
    }
  }

  if (values) {
    for (const value of Object.keys(values)) {
      if (
        !inputParameters.find((v) => v.name === value) &&
        values[value] &&
        values[value]['get']
      ) {
        inputParameters.push({
          name: value,
          title: value,
          default: null,
          description: null,
          type: null,
        });
        ownParamNames.add('in-' + value);
      }
    }
  }

  const outputParameters: DialogVariable[] = [];

  if (calledScriptController) {
    const variables = calledScriptController.getVariables();
    const out_params = variables.filter(
      (el) => el.kind && ['out', 'in-out'].includes(el.kind),
    );
    for (const param of out_params) {
      outputParameters.push(param);
      if (ownParamNames.has('out-' + param.name)) {
        ownParamNames.delete(param.name);
      }
    }
  }

  return {
    inputParameters,
    outputParameters,
    ownParamNames,
  };
}
