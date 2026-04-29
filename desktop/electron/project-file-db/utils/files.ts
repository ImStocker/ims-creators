import fs from 'node:fs';
import fse from 'fs-extra';
import path from 'node:path';
import crypto from 'node:crypto';
import { generateNextUniqueNameNumber } from '~ims-app-base/logic/utils/stringUtils';
import type { ProjectFileDbWorkspace, ProjectFileDbAsset, ProjectFileDb } from '../ProjectFileDb';
import { assert } from '~ims-app-base/logic/utils/typeUtils';
import { WORKSPACE_EXT } from '../services/FileSystemService';

export const forbiddenFilenameCharsRegexp = /[<>:"/\\|?*\x00-\x1f]/;
export const forbiddenFilenameValuesRegexp = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
export const trailingDotsOrSpaces = /[\s.]$/;

export function getIndexRangeStartAndStep(
  from: number | undefined,
  to: number | undefined,
  count: number,
): {
  start: number;
  step: number;
} {
  let start: number | undefined;
  if (from !== undefined) {
    start = from;
  } else {
    start = to !== undefined ? to - count : 1;
  }
  if (to === undefined) {
    to = start + count;
  }
  const step = count > 0 ? (to - start) / count : 0;

  return {
    start,
    step,
  };
}

export function getImsExtname(localPath: string){
  const file_local_ext_match = localPath.match(/^.*?\.([^\\/]*)$/)
  const file_local_ext = file_local_ext_match ? '.' + file_local_ext_match[1] : '';
  return file_local_ext;
}

export function prepareFileBasenameByEntityTitle(title: string){
  return title.replace(forbiddenFilenameCharsRegexp, '_').trim()
}

export function getAssetLocalPath(asset: { localName?: string, workspaceId: string | null}, db: ProjectFileDb): string {
  const parent_local_path = getWorkspaceLocalPathFolderById(asset.workspaceId, db)
  return path.join(parent_local_path, asset?.localName ?? '');
}

export function getAssetLocalPathById(asset_id: string, db: ProjectFileDb): string {
  const asset = db.asset.assets.byId.get(asset_id);
  assert(asset);
  return getAssetLocalPath(asset, db)
}

export function getWorkspaceLocalPathFolder(workspace: { id: string, localName?: string, parentId: string | null} | null, db: ProjectFileDb): string {
  if (!workspace || workspace.id === db.RootGddFolder.id){
    return db.localPath;
  }
  
  const parent_local_path = getWorkspaceLocalPathFolderById(workspace.parentId, db)
  return path.join(parent_local_path, workspace?.localName ?? '').replace(/\.imw\.json$/, '');
}

export function getWorkspaceLocalPathFolderById(workspace_id: string | null, db: ProjectFileDb): string {
  const workspace = workspace_id ? db.workspace.workspaces.byId.get(workspace_id) : null;
  return getWorkspaceLocalPathFolder(workspace ?? null, db)
}

  export async function applyImsFileLocationChange(file: ProjectFileDbWorkspace | ProjectFileDbAsset, old_local_path: string, db: ProjectFileDb): Promise<string> {
    let parent_id: string | null;
    let parent_path: string = db.localPath;
    let is_workspace = false;
    if((file as ProjectFileDbAsset)?.workspaceId){
        parent_id = (file as ProjectFileDbAsset).workspaceId;
    }
    else {
        parent_id = (file as ProjectFileDbWorkspace).parentId;
        is_workspace = true;
    }
    assert(file.localName);
    const file_local_ext = getImsExtname(file.localName);
    parent_path = getWorkspaceLocalPathFolderById(parent_id, db);
    const suggest_title_with_ext = generateNextUniqueNameNumber(
        prepareFileBasenameByEntityTitle(file.title ?? 'untitled'),
        (name) => !fs.existsSync(path.join(parent_path, name )),
        ' - ',
        file_local_ext
    );
    const new_w_file_path = path.join(parent_path, suggest_title_with_ext)
    const old_w_file_path = old_local_path + (is_workspace ? WORKSPACE_EXT: '');
    // перемещаю информацию о файле (.im(a|w).json)



    // move file meta (.im(a|w).json)
    await db.fileSystem.expectFsChange([
      old_w_file_path, 
      new_w_file_path
    ], async () => {
      try {
        await fse.move(old_w_file_path, new_w_file_path);
      }
      catch (err: any){
        if (err.code !== 'ENOENT'){
          throw err;
        }
      }
    })
    if (is_workspace) {
        // move folder for workspaces 
        const workspace_folder_from = old_w_file_path.replace(/\.imw\.json$/, '');
        const workspace_folder_to = new_w_file_path.replace(/\.imw\.json$/, '');
        await db.fileSystem.expectFsChange([
          workspace_folder_from, 
          workspace_folder_to
        ], async () => {
            try {
                await fse.move(workspace_folder_from, workspace_folder_to)
            }
            catch (err: any){
              if (err.code !== 'ENOENT'){
                throw err;
              }
            }
        })
    }
    return new_w_file_path;
  }

  export function absolutePathToUuid(filepath: string, root_path: string){
    let relative_path = path.relative(root_path, filepath).replaceAll('\\', '/');
    const md5 = crypto.createHash('md5').update(relative_path).digest('hex');
    return md5.replace(
        /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
        '$1-$2-$3-$4-$5'
    );
  }

  export function isDirSync(filepath: string): boolean{
    const stat = fs.statSync(filepath, {
      throwIfNoEntry: false
    })
    return stat ? stat.isDirectory() : false;
  }
  
  export async function isDir(filepath: string): Promise<boolean> {
    try {
        const file_info = await fs.promises.stat(filepath);
        return file_info.isDirectory();
    }
    catch (err: any){
        if (err.code === 'ENOENT'){
            return false;
        }
        throw err;
    }
  }