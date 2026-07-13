import { FieldTypeController } from '~ims-app-base/logic/types/FieldTypeController';
import LocaleBlockStatusPropEditor from '../blocks/LocaleBlock/LocaleBlockStatusPropEditor.vue';
import { AssetPropType } from '~ims-app-base/logic/types/Props';

export class LocaleBlockStatusFieldController extends FieldTypeController {
  name = 'localeBlockStatus';
  title = '[[t:LocaleBlockStatus]]';
  editor = async () => LocaleBlockStatusPropEditor;
  presenter = async () => LocaleBlockStatusPropEditor;

  override aiSpec =
    'Locale block status field (creators module). Value is stored as a boolean. ' +
    'Indicates whether a locale block has been translated/completed. ' +
    'Used within the locale management system to track translation progress across languages.';
  override dataTypes = [
    {
      Type: AssetPropType.BOOLEAN,
    },
  ];
}
