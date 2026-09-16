import axios from "axios";
import type { ProjectFullInfo, ProjectSettingsValue } from '~ims-app-base/logic/types/ProjectTypes'
import type { AiSession, AiTurn } from '~ims-app-base/logic/ai-core/AiTypes'
import type { ProjectFileDb, ProjectFileDbAsset } from "../ProjectFileDb"
import fs from "node:fs";
import type { Readable } from "node:stream";
import tmp from "tmp";
import JSZip from "jszip";
import * as node_path from 'path';
import path from 'node:path';
import log from 'electron-log/main';
import { PROJECT_META_AI_CHAT, PROJECT_META_SETTINGS, ASSET_SAVE_FORMAT_SETTING_KEY, ASSET_SAVE_FORMAT_DEFAULT, type AssetSaveFormat } from '../project-db-constants';
import { ASSET_EXT, WORKSPACE_EXT, WORKSPACE_EXT_TEST_REGEXP, ATTACHMENTS_FOLDER } from './FileSystemService';
import { suggestUniqueFilename } from '../utils/files';

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
        const content = zip.files[filename];
        const new_filename = filename
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

    async loadAiChat(): Promise<{ sessions: AiSession[]; turns: AiTurn[] }> {
      try {
        const text = await fs.promises.readFile(path.join(this.db.localPath, PROJECT_META_AI_CHAT), 'utf-8');
        const data = JSON.parse(text);
        return {
          sessions: Array.isArray(data.sessions) ? data.sessions : [],
          turns: Array.isArray(data.turns) ? data.turns : [],
        };
      }
      catch (err: any) {
        if (!/^ENOENT:/.test(err.message)){
          log.error(err);
        }
        return {
          sessions: [],
          turns: [],
        };
      }
    }

    async saveAiChat(data: { sessions: AiSession[]; turns: AiTurn[] }): Promise<void> {
      await fs.promises.writeFile(path.join(this.db.localPath, PROJECT_META_AI_CHAT), JSON.stringify(data), 'utf-8');
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
        if (!gdd_workspace){
            throw new Error('Failed to find root gdd folder in project')
        }
        const response = await axios.get(`${process.env.CREATORS_API_HOST}project/export`, {
            responseType: 'stream',
            timeout: 0,
            params: {
                pid: templateId,
                where: JSON.stringify({
                    workspace_id: gdd_workspace.id,
                }),
                save_structure:true,
                name_mode: 'title',
                skip_itself: true
            },
        });
        // Создаём write stream и подключаем к нему
        const temp_zip_loc = await saveStreamToTempFile(response.data);
        let temp_dir: { name: string; removeCallback: () => void } | null = null;
        try {
            temp_dir = tmp.dirSync({ unsafeCleanup: true });
            await unzipArchive(temp_zip_loc.filepath, temp_dir.name);
            const format = await this.db.settings.getKey<AssetSaveFormat>(ASSET_SAVE_FORMAT_SETTING_KEY, ASSET_SAVE_FORMAT_DEFAULT);
            await this.convertImportedRootToTarget(temp_dir.name, this.db.localPath, this.db.RootGddFolder.id, format);
        }
        finally{
            temp_zip_loc.delete();
            temp_dir?.removeCallback();
        }
    }

    /**
     * Import helper: walk files of a not-yet-imported project (e.g. an unzipped
     * template) and write them into `targetRoot` re-serialized in the target
     * project's save format.
     * - workspace meta files (`*.imw.json`) and non-asset files are copied as-is
     * - asset files are re-serialized: markdown-typed assets are written as `.md`,
     *   everything else as new-format `.json` (or legacy `.ima.json` per `format`)
     * - file names are preserved, only the extension is swapped; collisions get
     *   a unique ` - N` suffix
     */
    async convertImportedRootToTarget(srcRoot: string, targetRoot: string, rootWorkspaceId: string, format: AssetSaveFormat) {
        // The template archive may wrap the gdd workspace into a `gdd/` folder with
        // a `gdd.imw.json` meta next to it. In that case the folder contents belong
        // to the project root (`rootWorkspaceId`); unwrap the wrapper instead of
        // importing it as a nested workspace.
        let import_root = srcRoot;
        if (
            fs.existsSync(node_path.join(srcRoot, 'gdd' + WORKSPACE_EXT))
            && fs.existsSync(node_path.join(srcRoot, 'gdd'))
            && fs.statSync(node_path.join(srcRoot, 'gdd')).isDirectory()
        ) {
            import_root = node_path.join(srcRoot, 'gdd');
        }
        await this._convertImportedFolder(import_root, import_root, targetRoot, rootWorkspaceId, format);
    }

    private async _convertImportedFolder(srcFolder: string, srcRoot: string, targetFolder: string, parentWorkspaceId: string, format: AssetSaveFormat) {
        const items = await fs.promises.readdir(srcFolder, { withFileTypes: true });
        const is_root = node_path.resolve(srcFolder) === node_path.resolve(srcRoot);
        const folder_base = node_path.basename(srcFolder);
        const workspace_meta_name = is_root ? null : folder_base + WORKSPACE_EXT;

        let child_workspace_id = parentWorkspaceId;
        await fs.promises.mkdir(targetFolder, { recursive: true });

        if (workspace_meta_name) {
            const has_ws_file = items.some((item) => item.isFile() && item.name === workspace_meta_name);
            if (has_ws_file) {
                const ws_raw = node_path.join(srcFolder, workspace_meta_name);
                const parsed = JSON.parse(await fs.promises.readFile(ws_raw, 'utf8'));
                if (parsed && typeof parsed.id === 'string') {
                    child_workspace_id = parsed.id;
                }
                await this._copyImportedFile(ws_raw, node_path.join(targetFolder, workspace_meta_name));
            }
        }

        for (const item of items) {
            if (item.name.startsWith('.')) continue;
            // Workspace content index emitted by the exporter is not importable content
            if (is_root && item.isFile() && item.name === 'index.ima.json') continue;
            if (is_root && item.isDirectory() && item.name === ATTACHMENTS_FOLDER) {
                await this._copyImportedFolder(node_path.join(srcFolder, item.name), node_path.join(targetFolder, item.name));
                continue;
            }
            if (item.isFile() && (item.name === workspace_meta_name || WORKSPACE_EXT_TEST_REGEXP.test(item.name))) {
                if (item.name !== workspace_meta_name) {
                    await this._copyImportedFile(node_path.join(srcFolder, item.name), node_path.join(targetFolder, item.name));
                }
                continue;
            }
            const src_path = node_path.join(srcFolder, item.name);
            if (item.isDirectory()) {
                await this._convertImportedFolder(src_path, srcRoot, node_path.join(targetFolder, item.name), child_workspace_id, format);
            }
            else {
                await this._convertImportedAssetFile(src_path, targetFolder, child_workspace_id, srcRoot, format);
            }
        }
    }

    private async _convertImportedAssetFile(src_path: string, targetFolder: string, workspaceId: string, srcRoot: string, format: AssetSaveFormat) {
        const src_name = node_path.basename(src_path);
        const extname = node_path.extname(src_name).toLowerCase();

        if (extname !== '.json' && extname !== '.md') {
            await this._copyImportedFile(src_path, node_path.join(targetFolder, src_name));
            return;
        }

        const asset = await this.db.fileSystem.loadAssetFromFile(src_path, workspaceId, srcRoot);
        if (!asset) {
            await this._copyImportedFile(src_path, node_path.join(targetFolder, src_name));
            return;
        }

        const is_md = this.db.asset.isMarkdownAsset(asset);
        const target_ext = is_md ? '.md' : (format === 'json' ? '.json' : ASSET_EXT);
        const base_name = src_name.endsWith(ASSET_EXT)
            ? src_name.substring(0, src_name.length - ASSET_EXT.length)
            : src_name.substring(0, src_name.length - extname.length);
        const target_name = suggestUniqueFilename(
            base_name,
            target_ext,
            (name) => !fs.existsSync(node_path.join(targetFolder, name)),
        );
        await this.db.asset.saveAssetFileToFile(asset, node_path.join(targetFolder, target_name), format);
    }

    private async _copyImportedFile(src_path: string, target_path: string) {
        await fs.promises.mkdir(node_path.dirname(target_path), { recursive: true });
        await fs.promises.copyFile(src_path, target_path);
    }

    private async _copyImportedFolder(srcFolder: string, targetFolder: string) {
        const items = await fs.promises.readdir(srcFolder, { withFileTypes: true });
        await fs.promises.mkdir(targetFolder, { recursive: true });
        for (const item of items) {
            const src_path = node_path.join(srcFolder, item.name);
            const target_path = node_path.join(targetFolder, item.name);
            if (item.isDirectory()) {
                await this._copyImportedFolder(src_path, target_path);
            }
            else {
                await this._copyImportedFile(src_path, target_path);
            }
        }
    }
}