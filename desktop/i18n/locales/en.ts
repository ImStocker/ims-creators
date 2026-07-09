import desktop from './en/desktop';
import index from '~ims-app-base/../i18n/locales/en/index';
import translatedTitles from '~ims-app-base/../i18n/locales/en/translatedTitles';
import countries from '~ims-app-base/../i18n/locales/en/countries';
import imsDialogEditor from "~ims-creators/../i18n/locales/en/imsDialogEditor";
import graphBlock from "~ims-creators/../i18n/locales/en/graphBlock";
import creatorsCommon from "~ims-creators/../i18n/locales/en/creatorsCommon";
import levelEditor from "~ims-creators/../i18n/locales/en/levelEditor";
import markdownBlock from "~ims-creators/../i18n/locales/en/markdownBlock";

export default {
  ...index,
  ...translatedTitles,
  ...countries,
  ...imsDialogEditor,
  ...graphBlock,
  ...creatorsCommon,
  ...levelEditor,
  ...markdownBlock,
  ...desktop
};
