import desktop from './ru/desktop';
import index from '~ims-app-base/../i18n/locales/ru/index';
import translatedTitles from '~ims-app-base/../i18n/locales/ru/translatedTitles';
import countries from '~ims-app-base/../i18n/locales/ru/countries';
import imsDialogEditor from "~ims-creators/../i18n/locales/ru/imsDialogEditor";
import graphBlock from "~ims-creators/../i18n/locales/ru/graphBlock";
import creatorsCommon from "~ims-creators/../i18n/locales/ru/creatorsCommon";
import levelEditor from "~ims-creators/../i18n/locales/ru/levelEditor";
import markdownBlock from "~ims-creators/../i18n/locales/ru/markdownBlock";

const aiKeys = {
  aiAssistant: {
    defaultMessage: 'Здравствуйте! Я могу помочь вам управлять файлами проекта. Спросите меня о чём угодно!',
    placeholder: 'Введите сообщение...',
    thought: 'Думаю...',
    changes: 'Изменения',
    revertAll: 'Отменить все изменения',
    settings: 'Настройки AI модели',
    defaultSessionName: 'Новый чат',
    arguments: 'Аргументы',
    result: 'Результат',
  },
  aiSettings: {
    header: 'Настройки AI модели',
    aiProvider: 'AI Провайдер',
    selectAiProvider: 'Выберите AI провайдера',
    model: 'Модель',
    selectOrTypeModel: 'Выберите или введите модель',
    enterModelName: 'Введите имя модели',
    close: 'Закрыть',
    save: 'Сохранить',
    failedToLoadModels: 'Не удалось загрузить модели',
  },
  aiModelNames: {
    openrouter: 'OpenRouter',
    ollama: 'Ollama',
    gemini: 'Gemini',
    openai: 'OpenAI (GPT)',
    grok: 'Grok',
    deepseek: 'DeepSeek',
    anthropic: 'Anthropic (Claude)',
    custom: 'Свой',
  },
  aiNotes: {
    openrouter: 'OpenRouter предоставляет доступ ко многим AI моделям. Получите API ключ на openrouter.ai',
    ollama: 'Запускайте AI модели локально с Ollama. Установите с ollama.com',
    gemini: 'Google Gemini AI. Получите API ключ в Google AI Studio.',
    custom: 'Подключитесь к любому OpenAI-совместимому API.',
  },
};

export default {
  ...index,
  ...translatedTitles,
  ...countries,
  ...imsDialogEditor,
  ...graphBlock,
  ...creatorsCommon,
  ...levelEditor,
  ...markdownBlock,
  ...aiKeys,
  ...desktop
};
