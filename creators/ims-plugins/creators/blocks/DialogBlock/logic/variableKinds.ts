import { ScriptBlockPlainVariableKinds } from './nodeStoring';

export type VariableKindInfo = {
  kind: ScriptBlockPlainVariableKinds;
  titleKey: string;
  icon: string;
};

export const VARIABLE_KINDS: readonly VariableKindInfo[] = [
  {
    kind: ScriptBlockPlainVariableKinds.GLOBAL,
    titleKey: 'imsDialogEditor.var.kinds.global',
    icon: 'ri-global-line',
  },
  {
    kind: ScriptBlockPlainVariableKinds.LOCAL,
    titleKey: 'imsDialogEditor.var.kinds.local',
    icon: 'ri-terminal-line',
  },
  {
    kind: ScriptBlockPlainVariableKinds.IN,
    titleKey: 'imsDialogEditor.var.kinds.in',
    icon: 'ri-contract-right-line',
  },
  {
    kind: ScriptBlockPlainVariableKinds.OUT,
    titleKey: 'imsDialogEditor.var.kinds.out',
    icon: 'ri-expand-right-line',
  },
  {
    kind: ScriptBlockPlainVariableKinds.INOUT,
    titleKey: 'imsDialogEditor.var.kinds.in-out',
    icon: 'ri-expand-horizontal-line',
  },
];

export function getVariableKindInfo(
  kind?: ScriptBlockPlainVariableKinds | null,
): VariableKindInfo {
  return VARIABLE_KINDS.find((item) => item.kind === kind) ?? VARIABLE_KINDS[0];
}

export function getVariableKindTitleKey(
  kind?: ScriptBlockPlainVariableKinds | null,
): string {
  return getVariableKindInfo(kind).titleKey;
}

export function getVariableKindIcon(
  kind?: ScriptBlockPlainVariableKinds | null,
): string {
  return getVariableKindInfo(kind).icon;
}
