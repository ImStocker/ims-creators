import { AssetPropType } from '~ims-app-base/logic/types/Props';
import { getNodeDescriptorOfType } from '../nodes/getNodeDescriptiors';
import {
  ScriptBlockPlainActionTypes,
  type ScriptBlockPlainAction,
} from './nodeStoring';

export function withFunctionOutParam(
  action: ScriptBlockPlainAction,
): ScriptBlockPlainAction {
  if (
    action.type !== ScriptBlockPlainActionTypes.FUNCTION ||
    action.params?.out?.length
  ) {
    return action;
  }

  const used_names = new Set(
    [...(action.params?.in ?? []), ...(action.params?.out ?? [])].map(
      (param) => param.name,
    ),
  );
  let out_name = 'out';
  let suffix = 2;
  while (used_names.has(out_name)) {
    out_name = 'out' + suffix;
    suffix++;
  }

  return {
    ...action,
    params: {
      in: action.params?.in ?? [],
      out: [
        ...(action.params?.out ?? []),
        {
          name: out_name,
          title: out_name,
          type: { Type: AssetPropType.BOOLEAN },
          description: null,
          default: false,
        },
      ],
    },
  };
}

export function getAvailableActionTypes(
  $t: (key: string, params?: any) => string,
) {
  const res: { title: string; icon?: string; value: string | null }[] = [];
  const available_types = ['trigger', 'function'];
  for (const type of available_types) {
    const node_descriptor = getNodeDescriptorOfType(type);
    res.push({
      title: $t(`imsDialogEditor.nodes.${type}.title`),
      icon: node_descriptor?.icon,
      value: type,
    });
  }
  return res;
}
