
import { defineI18nConfig } from "#imports"
import locale_en from "./locales/en"
import locale_ru from "./locales/ru"
import locale_de from "./locales/de"

export default defineI18nConfig(() => {
  return {
    legacy: false,
    locale: 'en',
    fallbackLocale: 'en',
    messages: {
      en: locale_en,
      ru: locale_ru,
      de: locale_de
    },
  }
})
