import axios from "axios";
import type { ProjectFullInfo, ProjectSettingsValue } from '~ims-app-base/logic/types/ProjectTypes'
import type { ProjectFileDb } from "../ProjectFileDb"
import fs from "node:fs";
import type { Readable } from "node:stream";
import tmp from "tmp";
import JSZip from "jszip";
import * as node_path from 'path';
import path from 'node:path';
import log from 'electron-log/main';
import { PROJECT_META_SETTINGS } from '../project-db-constants';

function saveStreamToTempFile(stream: Readable,){
    return new Promise<{
        filepath: string,
        delete: () => void,
    }>((resolve, reject) =>{
        try{
            tmp.file((err, path, fd, cleanupCallback)=> {
                if (err) {
                    reject(err);
                    return;
                }
                const ws = fs.createWriteStream(null as any, {fd: fd});
                ws.on("error", (err) =>{
                    cleanupCallback();
                    reject(err);
                });
                ws.on("close", ()=> {
                    resolve({
                        filepath: path,
                        delete: cleanupCallback
                    });
                });
                stream.pipe(ws);
            });
        }
        catch (err){
            reject(err);
        }
    })
}

async function unzipArchive(path_from: string, path_to: string) {
    const data = await fs.promises.readFile(path_from);
    const zip = await JSZip.loadAsync(data)
    for (const filename of Object.keys(zip.files)){
        if (['gdd.imw.json'].includes(filename)) continue;
        const content = zip.files[filename];
        const new_filename = filename.replace(/^gdd\//, '');
        const dest = node_path.join(path_to, new_filename);
        if (content.dir) {
            if (!fs.existsSync(dest)) {
                await fs.promises.mkdir(dest, { recursive: true });
            }
        } else {
            const parentDir = node_path.dirname(dest);
            if (!fs.existsSync(parentDir)) {
                await fs.promises.mkdir(parentDir, { recursive: true });
            }

            const fileData = await content.async("nodebuffer")
            await fs.promises.writeFile(dest, fileData);
        }
    }
}

export class ProjectService {

    constructor(public db: ProjectFileDb){

    }
    
    async initializeNewLocalProject(){
        
    }

    async initializeCloudProject(){
        
    }

    async loadExistingProject(){
        
    }

    async loadProjectSettings(): Promise<ProjectSettingsValue> {
      try {
        const projectSettingsText = await fs.promises.readFile(path.join(this.db.localPath, PROJECT_META_SETTINGS), 'utf-8');
        const projectSettings = JSON.parse(projectSettingsText);
        return projectSettings;
      }
      catch (err: any) {
        if (!/^ENOENT:/.test(err.message)){
          log.error(err);
        }
        return {
          'export-format': {}
        }
      }

    }

    async saveProjectSettings(projectSettings: ProjectSettingsValue) {
      try {
        await fs.promises.writeFile(path.join(this.db.localPath, PROJECT_META_SETTINGS), JSON.stringify(projectSettings), 'utf-8');
      } catch (err: any) {
        log.error(err);
      }
    }

    async loadProjectInfo(): Promise<ProjectFullInfo>{
        
        const rootWorkspaces = await this.db.workspace.workspacesGet({
            where: {
                parentId: null,
                isSystem: false
            }
        })

        const projectSettings = await this.loadProjectSettings();

        return {
            id: this.db.info.id ?? '',
            createdAt: '',
            isPublicAbout: false,
            isPublicDiscussion: true,
            isPublicGdd: true,
            isPublicPulse: false,
            isPublicTasks: true,
            isTemplate: false,
            isUnsafeContent: false,
            lang: 'en',
            license: null,
            parentsTree: [],
            rootWorkspaces: rootWorkspaces.list,
            settings: {
                id: '',
                rights: 5,
                values: {
                    ...projectSettings
                }
            },
            shortLink: null,
            title: this.db.info.title,
            localPath:  this.db.localPath
        }
    }

    
    async importTemplateProject(templateId: string){
        const workspace = await axios.get(`${process.env.CREATORS_API_HOST}workspaces`, {
                params: {
                    pid: templateId,
                    where: JSON.stringify({
                        names: ["gdd"], 
                        isSystem: false
                    }),
                },
            });
        const gdd_workspace = workspace.data.list[0];
        const response = await axios.get(`${process.env.CREATORS_API_HOST}project/export`, {
            responseType: 'stream',
            timeout: 0,
            params: {
                pid: templateId,
                where: JSON.stringify({
                    workspace_id: gdd_workspace.id,
                }),
                save_structure:true,
                use_names:true,
            },
        });
        // Создаём write stream и подключаем к нему
        const temp_zip_loc = await saveStreamToTempFile(response.data);
        try {
            await unzipArchive(temp_zip_loc.filepath, this.db.localPath);
        }
        finally{
            temp_zip_loc.delete();
        }
    }
}