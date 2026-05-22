import contextMenu, { type Options } from "electron-context-menu";
import { storageGetKey, storageSetKey } from "../electron/storage";
import { app } from 'electron'
import deskI18nEn from '../i18n/locales/en/desktop';
import deskI18nRu from '../i18n/locales/ru/desktop';

export type MainSupportedLang = 'ru' | 'en';

export class MainAppController{
    private _currentLanguage!: MainSupportedLang;
    private _contextMenuDisposer?: () => void;

    private _buildContextMenuLabels(): Options['labels'] {
        const t = this._loadDesktopLocale()?.desktop?.contextMenu;
        if (!t) return undefined;
        return {
            cut: t.cut,
            copy: t.copy,
            paste: t.paste,
            selectAll: t.selectAll,
            saveImageAs: t.saveImageAs,
            copyImage: t.copyImage,
            copyImageAddress: t.copyImageAddress,
            saveVideo: t.saveVideo,
            saveVideoAs: t.saveVideoAs,
            copyVideoAddress: t.copyVideoAddress,
            copyLink: t.copyLink,
            saveLinkAs: t.saveLinkAs,
            inspect: t.inspect,
        };
    }

    private _loadDesktopLocale(): typeof deskI18nEn | null {
        if (this._currentLanguage === 'ru') return deskI18nRu;
        return deskI18nEn;
    }

    private _setupContextMenu() {
        if (this._contextMenuDisposer) {
            this._contextMenuDisposer();
        }
        this._contextMenuDisposer = contextMenu({
            showSearchWithGoogle: false,
            labels: this._buildContextMenuLabels(),
        });
    }

    async init(){
        let lang = await storageGetKey<MainSupportedLang>('lang');
        if (!lang){
            lang = 'en';
            const system_locale = app.getLocale();
            if (/^ru/i.test(system_locale)) lang = 'ru';
        }
        this._currentLanguage = lang;

        this._setupContextMenu();
    }


    getLanguage(): MainSupportedLang{
        return this._currentLanguage;
    }

    async setLanguage(lang: MainSupportedLang){
        switch (lang) {
            case 'ru':
            case 'en':
                break;
            default:
                lang = 'en';
                break;
        }
        await storageSetKey('lang', lang);
        this._currentLanguage = lang;
        this._setupContextMenu();
    }
}

export const MainAppControllerInstance = new MainAppController();
