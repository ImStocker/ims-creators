import {
  ScriptBlockPlainVariableKinds,
  type ScriptBlockPlainAction,
  type ScriptBlockPlainActionTypes,
  type ScriptBlockPlainVariable,
} from '../logic/nodeStoring';

export type VariableListFilters = {
  query?: string;
  kind?: ScriptBlockPlainVariableKinds;
};

export type ActionsListFilters = {
  query?: string;
  type?: ScriptBlockPlainActionTypes;
};

export function isVariableVisible(
  variable: ScriptBlockPlainVariable,
  filters?: VariableListFilters | null,
) {
  return (
    (!filters?.query ||
      variable.title.toLowerCase().includes(filters.query.toLowerCase())) &&
    (!filters?.kind ||
      variable.kind === filters.kind ||
      (filters.kind === ScriptBlockPlainVariableKinds.GLOBAL &&
        variable.kind === undefined))
  );
}

export function isActionVisible(
  action: ScriptBlockPlainAction,
  filters?: ActionsListFilters | null,
) {
  return (
    (!filters?.query ||
      action.name.toLowerCase().includes(filters.query.toLowerCase())) &&
    (!filters?.type || action.type === filters.type)
  );
}
