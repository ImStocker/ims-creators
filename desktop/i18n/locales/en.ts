import desktop from './en/desktop';
import index from '~ims-app-base/../i18n/locales/en/index';
import translatedTitles from '~ims-app-base/../i18n/locales/en/translatedTitles';
import countries from '~ims-app-base/../i18n/locales/en/countries';
import imsDialogEditor from "~ims-creators/../i18n/locales/en/imsDialogEditor";
import graphBlock from "~ims-creators/../i18n/locales/en/graphBlock";
import creatorsCommon from "~ims-creators/../i18n/locales/en/creatorsCommon";
import levelEditor from "~ims-creators/../i18n/locales/en/levelEditor";
import markdownBlock from "~ims-creators/../i18n/locales/en/markdownBlock";

const aiKeys = {
  aiAssistant: {
    defaultMessage: 'Hello! I can help you manage your project files. Ask me anything!',
    placeholder: 'Type a message...',
    thought: 'Thinking...',
    changes: 'Changes',
    revertAll: 'Revert all changes',
    settings: 'AI Model Settings',
    defaultSessionName: 'New Chat',
    arguments: 'Arguments',
    result: 'Result',
  },
  aiSettings: {
    header: 'AI Model Settings',
    aiProvider: 'AI Provider',
    selectAiProvider: 'Select AI provider',
    model: 'Model',
    selectOrTypeModel: 'Select or type a model',
    enterModelName: 'Enter model name',
    close: 'Close',
    save: 'Save',
    failedToLoadModels: 'Failed to load models',
  },
  aiModelNames: {
    openrouter: 'OpenRouter',
    ollama: 'Ollama',
    gemini: 'Gemini',
    openai: 'OpenAI (GPT)',
    grok: 'Grok',
    deepseek: 'DeepSeek',
    anthropic: 'Anthropic (Claude)',
    custom: 'Custom',
  },
  aiNotes: {
    openrouter: 'OpenRouter provides access to many AI models. Get your API key at openrouter.ai',
    ollama: 'Run AI models locally with Ollama. Install from ollama.com',
    gemini: 'Google Gemini AI. Get your API key from Google AI Studio.',
    custom: 'Connect to any OpenAI-compatible API endpoint.',
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
