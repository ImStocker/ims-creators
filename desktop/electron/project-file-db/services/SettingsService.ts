import { storageGetKey, storageSetKey } from "../../../electron/storage";
import type { ProjectFileDb } from "../ProjectFileDb";

export class SettingsService{
    constructor(public db: ProjectFileDb){

    }
    init(){

    }

    destroy(){

    }

    async getKey(key: string, default_value?: any){
        const settings: {
            [key: string]: any
        } = await storageGetKey('settings') ?? {};
        return settings[key] ?? default_value;
    }

    async setKey(key: string, value: any){
        let settings: {
            [key: string]: any
        } = await storageGetKey('settings') ?? {};
        settings[key] = value;
        await storageSetKey('settings', settings);
    }
}