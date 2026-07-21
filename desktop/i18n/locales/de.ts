import desktop from './de/desktop';
import index from '~ims-app-base/../i18n/locales/de/index';
import translatedTitles from '~ims-app-base/../i18n/locales/de/translatedTitles';
import countries from '~ims-app-base/../i18n/locales/de/countries';
import imsDialogEditor from "~ims-creators/../i18n/locales/de/imsDialogEditor";
import graphBlock from "~ims-creators/../i18n/locales/de/graphBlock";
import creatorsCommon from "~ims-creators/../i18n/locales/de/creatorsCommon";
import levelEditor from "~ims-creators/../i18n/locales/de/levelEditor";
import markdownBlock from "~ims-creators/../i18n/locales/de/markdownBlock";

const aiKeys = {
  aiAssistant: {
    defaultMessage: 'Hallo! Ich kann Ihnen bei der Verwaltung Ihrer Projektdateien helfen. Fragen Sie mich alles!',
    placeholder: 'Nachricht eingeben...',
    thought: 'Denke nach...',
    changes: 'Änderungen',
    revertAll: 'Alle Änderungen rückgängig machen',
    settings: 'AI-Modelleinstellungen',
    menu: 'Menü',
    sessions: 'Sitzungen',
    defaultSessionName: 'Neuer Chat',
    newSession: 'Neue Sitzung',
    newSessionCreated: 'Neue Sitzung erstellt',
    deleteSession: 'Sitzung löschen',
    renameSession: 'Sitzung umbenennen',
    renameSessionPrompt: 'Neuen Sitzungsnamen eingeben:',
    sessionDeleted: 'Sitzung gelöscht',
    deleteMessages: 'Nachrichten löschen',
    deleteMessagesConfirm: 'Sind Sie sicher, dass Sie die Nachrichten löschen möchten?',
    arguments: 'Argumente',
    result: 'Ergebnis',
  },
  aiSettings: {
    header: 'AI-Modelleinstellungen',
    aiProvider: 'AI-Anbieter',
    selectAiProvider: 'AI-Anbieter auswählen',
    model: 'Modell',
    selectOrTypeModel: 'Modell auswählen oder eingeben',
    enterModelName: 'Modellname eingeben',
    close: 'Schließen',
    save: 'Speichern',
    failedToLoadModels: 'Modelle konnten nicht geladen werden',
  },
  aiModelNames: {
    openrouter: 'OpenRouter',
    ollama: 'Ollama',
    gemini: 'Gemini',
    openai: 'OpenAI (GPT)',
    grok: 'Grok',
    deepseek: 'DeepSeek',
    anthropic: 'Anthropic (Claude)',
    custom: 'Benutzerdefiniert',
  },
  aiNotes: {
    openrouter: 'OpenRouter bietet Zugang zu vielen AI-Modellen. Holen Sie sich Ihren API-Schlüssel bei openrouter.ai',
    ollama: 'Führen Sie AI-Modelle lokal mit Ollama aus. Installieren Sie von ollama.com',
    gemini: 'Google Gemini AI. Holen Sie sich Ihren API-Schlüssel von Google AI Studio.',
    custom: 'Verbinden Sie sich mit jedem OpenAI-kompatiblen API-Endpunkt.',
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
