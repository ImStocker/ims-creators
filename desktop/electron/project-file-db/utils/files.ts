import fs from 'node:fs';
import fse from 'fs-extra';
import path from 'node:path';
import crypto from 'node:crypto';
import { generateNextUniqueNameNumber } from '~ims-app-base/logic/utils/stringUtils';
import type { ProjectFileDbWorkspace, ProjectFileDbAsset, ProjectFileDb } from '../ProjectFileDb';
import { assert } from '~ims-app-base/logic/utils/typeUtils';

export const forbiddenFilenameCharsRegexp = /[<>:"/\\|?*\x00-\x1f]/g;
export const forbiddenFilenameValuesRegexp = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
export const trailingDotsOrSpaces = /[\s.]$/;
export const maxFilenameLen = 128;

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
  return title.replace(forbiddenFilenameCharsRegexp, '_').substring(0, maxFilenameLen).trim()
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
    return db.localPath.replace(/(\.imw\.json)+$/gm, '');
  }
  
  const parent_local_path = getWorkspaceLocalPathFolderById(workspace.parentId, db)
  return path.join(parent_local_path, workspace?.localName ?? '').replace(/(\.imw\.json)+$/gm, '');
}

export function getWorkspaceLocalPathFolderById(workspace_id: string | null, db: ProjectFileDb): string {
  const workspace = workspace_id ? db.workspace.workspaces.byId.get(workspace_id) : null;
  return getWorkspaceLocalPathFolder(workspace ?? null, db)
}

  /**
   * Move an ASSET meta file (.ima.json / .json / .md) to its new location.
   */
  export async function applyImsFileLocationChange(file: ProjectFileDbAsset, old_local_path: string, db: ProjectFileDb): Promise<string> {
    assert(file.localName);
    const parent_path = getWorkspaceLocalPathFolderById(file.workspaceId, db);
    const file_local_ext = getImsExtname(file.localName);
    const suggest_title_with_ext = generateNextUniqueNameNumber(
        prepareFileBasenameByEntityTitle(file.title ?? 'untitled'),
        (name) => !fs.existsSync(path.join(parent_path, name )),
        ' - ',
        file_local_ext
    );
    const new_w_file_path = path.join(parent_path, suggest_title_with_ext)
    // перемещаю информацию о файле (.ima.json)



    // move file meta (.ima.json)
    await db.fileSystem.expectFsChange([
      old_local_path, 
      new_w_file_path
    ], async () => {
      try {
        await fse.move(old_local_path, new_w_file_path);
      }
      catch (err: any){
        if (err.code !== 'ENOENT'){
          throw err;
        }
      }
    })
    return new_w_file_path;
  }

  /**
   * Move/rename a workspace FOLDER. The `.imw` meta lives inside the folder,
   * so it travels along — only the folder itself is moved.
   */
  export async function applyImsWorkspaceFolderChange(workspace: ProjectFileDbWorkspace, old_folder_path: string, db: ProjectFileDb): Promise<string> {
    assert(workspace.localName);
    const parent_path = getWorkspaceLocalPathFolderById(workspace.parentId, db);
    const old_folder_path_resolved = path.resolve(old_folder_path);
    const suggest_folder_name = generateNextUniqueNameNumber(
        prepareFileBasenameByEntityTitle(workspace.title ?? 'untitled'),
        // On a pure rename the old folder itself sits at the target name — treat it as free
        (name) => path.resolve(path.join(parent_path, name)) === old_folder_path_resolved
          || !fs.existsSync(path.join(parent_path, name)),
        ' - ',
    );
    const new_folder_path = path.join(parent_path, suggest_folder_name)
    if (path.resolve(new_folder_path) === old_folder_path_resolved){
      return new_folder_path;
    }
    await db.fileSystem.expectFsChange([
      old_folder_path, 
      new_folder_path
    ], async () => {
      try {
        await fse.move(old_folder_path, new_folder_path);
      }
      catch (err: any){
        if (err.code !== 'ENOENT'){
          throw err;
        }
      }
    })
    return new_folder_path;
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

  export function suggestUniqueFilename(
    title: string | null,
    ext: string,
    checkIsAvail: (name: string) => boolean,
  ): string {
    return generateNextUniqueNameNumber(
      prepareFileBasenameByEntityTitle(title ?? 'untitled'),
      checkIsAvail,
      ' - ',
      ext,
    );
  }