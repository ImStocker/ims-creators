import type { AiSpecEntry } from '~ims-app-base/logic/types/AiSpec';
import { stringFieldAiSpec } from '~ims-app-base/logic/types/fields/StringField/StringFieldAiSpec';
import { textFieldAiSpec } from '~ims-app-base/logic/types/fields/TextField/TextFieldAiSpec';
import { textCutFieldAiSpec } from '~ims-app-base/logic/types/fields/TextCutField/TextCutFieldAiSpec';
import { textAttachmentFieldAiSpec } from '~ims-app-base/logic/types/fields/TextAttachmentField/TextAttachmentFieldAiSpec';
import { integerFieldAiSpec } from '~ims-app-base/logic/types/fields/IntegerField/IntegerFieldAiSpec';
import { numberFieldAiSpec } from '~ims-app-base/logic/types/fields/NumberField/NumberFieldAiSpec';
import { checkboxFieldAiSpec } from '~ims-app-base/logic/types/fields/CheckboxField/CheckboxFieldAiSpec';
import { dateFieldAiSpec } from '~ims-app-base/logic/types/fields/DateField/DateFieldAiSpec';
import { dateTimeFieldAiSpec } from '~ims-app-base/logic/types/fields/DateTimeField/DateTimeFieldAiSpec';
import { buttonDateTimeFieldAiSpec } from '~ims-app-base/logic/types/fields/ButtonDateTimeField/ButtonDateTimeFieldAiSpec';
import { enumFieldAiSpec } from '~ims-app-base/logic/types/fields/EnumField/EnumFieldAiSpec';
import { enumRadioFieldAiSpec } from '~ims-app-base/logic/types/fields/EnumRadioField/EnumRadioFieldAiSpec';
import { assetSelectorFieldAiSpec } from '~ims-app-base/logic/types/fields/AssetSelectorField/AssetSelectorFieldAiSpec';
import { gddElementSelectorFieldAiSpec } from '~ims-app-base/logic/types/fields/GddElementSelectorField/GddElementSelectorFieldAiSpec';
import { projectUserFieldAiSpec } from '~ims-app-base/logic/types/fields/ProjectUserField/ProjectUserFieldAiSpec';
import { emailFieldAiSpec } from '~ims-app-base/logic/types/fields/EmailField/EmailFieldAiSpec';
import { phoneFieldAiSpec } from '~ims-app-base/logic/types/fields/PhoneField/PhoneFieldAiSpec';
import { attachmentFieldAiSpec } from '~ims-app-base/logic/types/fields/AttachmentField/AttachmentFieldAiSpec';
import { attributeTypeFieldAiSpec } from '~ims-app-base/logic/types/fields/AttributeTypeField/AttributeTypeFieldAiSpec';
import { collectionAssetTitleFieldAiSpec } from '~ims-app-base/logic/types/fields/CollectionAssetTitleField/CollectionAssetTitleFieldAiSpec';
import { nameTitleFieldAiSpec } from '~ims-app-base/logic/types/fields/NameTitleField/NameTitleFieldAiSpec';
import { structFieldAiSpec } from '~ims-app-base/logic/types/fields/StructField/StructFieldAiSpec';
import { fieldParamsFieldAiSpec } from '~ims-app-base/logic/types/fields/FieldParamsField/FieldParamsFieldAiSpec';
import { localeBlockKeyFieldAiSpec } from '~ims-plugin-creators/field-types/LocaleBlockKeyField/LocaleBlockKeyFieldAiSpec';
import { localeBlockStatusFieldAiSpec } from '~ims-plugin-creators/field-types/LocaleBlockStatusField/LocaleBlockStatusFieldAiSpec';

export const fieldRegistry: AiSpecEntry[] = [
  stringFieldAiSpec,
  textFieldAiSpec,
  textCutFieldAiSpec,
  textAttachmentFieldAiSpec,
  integerFieldAiSpec,
  numberFieldAiSpec,
  checkboxFieldAiSpec,
  dateFieldAiSpec,
  dateTimeFieldAiSpec,
  buttonDateTimeFieldAiSpec,
  enumFieldAiSpec,
  enumRadioFieldAiSpec,
  assetSelectorFieldAiSpec,
  gddElementSelectorFieldAiSpec,
  projectUserFieldAiSpec,
  emailFieldAiSpec,
  phoneFieldAiSpec,
  attachmentFieldAiSpec,
  attributeTypeFieldAiSpec,
  collectionAssetTitleFieldAiSpec,
  nameTitleFieldAiSpec,
  structFieldAiSpec,
  fieldParamsFieldAiSpec,
  localeBlockKeyFieldAiSpec,
  localeBlockStatusFieldAiSpec,
];
