import { requestProjectDb } from "../../electron/project-file-db/project-registry";
import { ImsHostBase } from "./ImsHostBase";

export class ImsHostSettings extends ImsHostBase{
    async getKey(project_path: string, key: string, default_value?: any){
        const project_db = requestProjectDb(project_path, this._window);
        return await project_db.settings.getKey(key, default_value);
    }

    async setKey(project_path: string, key: string, value: any){
        const project_db = requestProjectDb(project_path, this._window);
        return await project_db.settings.setKey(key, value);
    }
}