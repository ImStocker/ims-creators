import { BlockTypeDefinition } from '~ims-app-base/logic/types/BlockTypeDefinition';

export class LocaleBlockDefinition extends BlockTypeDefinition {
  name = 'locale';
  component = async () => (await import('./LocaleBlock.vue')).default;
  icon = 'table-2';

  override hideInAdding = true;
  override aiSpec =
    'This block manages translations for the entire asset. Props: `{locale}\\{key}` (string — translated value for a given locale and field key, e.g. "ru-RU\\title" or "fr-FR\\myBlock.text"); `__meta\\{key}\\key` (string — locale key), `__meta\\{key}\\locales\\{locale}\\checked` (boolean — reviewer confirmed), `__meta\\{key}\\locales\\{locale}\\hash` (string — MD5 of original value to detect source changes). Localizable fields are discovered via getBlockLocalizableFields() on every block in the asset (text/string type fields only). Translation status: "new"|"changed"|"needReview"|"done". System-internal (hideInAdding=true), auto-created when localization is enabled.';
}
