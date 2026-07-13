import { FieldTypeController } from '~ims-app-base/logic/types/FieldTypeController';
import LocaleBlockKeyPropPresenter from '../blocks/LocaleBlock/LocaleBlockKeyPropPresenter.vue';
import { AssetPropType } from '~ims-app-base/logic/types/Props';

export class LocaleBlockKeyController extends FieldTypeController {
  name = 'localeBlockKey';
  title = '[[t:LocaleBlockKey]]';
  editor = async () => LocaleBlockKeyPropPresenter;
  presenter = async () => LocaleBlockKeyPropPresenter;

  override aiSpec =
    'Locale block key field (creators module). Value is stored as a string. ' +
    'Represents the localization key for a translatable text block. ' +
    'Used to identify and match corresponding translations across different language locales.';
  override dataTypes = [
    {
      Type: AssetPropType.STRING,
    },
  ];
}
