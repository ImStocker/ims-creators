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
            [path: string]: {
                [key: string]: any
            }
        } = await storageGetKey('settings') ?? {};
        const project_settings = settings[this.db.localPath] ?? {};
        return project_settings[key] ?? default_value;
    }

    async setKey(key: string, value: any){
        let settings: {
            [path: string]: {
                [key: string]: any
            }
        } = await storageGetKey('settings') ?? {};
        let project_settings = settings[this.db.localPath] 
        if (!project_settings){
            project_settings = {}
            settings[this.db.localPath] = project_settings;
        }
        project_settings[key] = value;
        await storageSetKey('settings', settings);
    }
}