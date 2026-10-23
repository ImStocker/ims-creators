import {
  AssetPropType,
  type AssetPropValueType,
} from '~ims-app-base/logic/types/Props';
import { getFieldTypeDotClass } from '~ims-app-base/components/Props/fieldTypeDot';

export const VARIABLE_TYPES: readonly AssetPropType[] = [
  AssetPropType.BOOLEAN,
  AssetPropType.INTEGER,
  AssetPropType.FLOAT,
  AssetPropType.TEXT,
  AssetPropType.STRING,
  AssetPropType.ASSET,
];

type VariableTypeValue = AssetPropValueType | AssetPropType | null | undefined;

function resolveTypeValue(type: VariableTypeValue): AssetPropType | null {
  if (!type) {
    return null;
  }
  return typeof type === 'string' ? type : type.Type;
}

export function getVariableTypeTitleKey(type: VariableTypeValue): string {
  const type_value = resolveTypeValue(type);
  if (type_value && VARIABLE_TYPES.includes(type_value)) {
    return 'imsDialogEditor.var.types.' + type_value;
  }
  return 'imsDialogEditor.var.types.any';
}

export function getVariableTypeDotClass(type: VariableTypeValue): string {
  return getFieldTypeDotClass(resolveTypeValue(type));
}
