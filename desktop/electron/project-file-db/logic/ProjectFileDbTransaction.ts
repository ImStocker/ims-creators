import type { ProjectFileDb, ProjectFileDbAsset, ProjectFileDbWorkspace } from "../ProjectFileDb";
import type { ProjectContentChangeEventArg } from "~ims-app-base/logic/types/IProjectDatabase";
import { generateNextUniqueNameNumber } from "~ims-app-base/logic/utils/stringUtils";
import { WORKSPACE_EXT, WORKSPACE_META_FILENAME } from "../services/FileSystemService";
import { getWorkspaceLocalPathFolder, applyImsFileLocationChange, applyImsWorkspaceFolderChange, getWorkspaceLocalPathFolderById, forbiddenFilenameCharsRegexp, getAssetLocalPath } from "../utils/files";
import { shell } from "electron";
import fs from 'node:fs';
import * as node_path from 'path';
import { mergeProjectContentChangeEventArgs } from "~ims-app-base/logic/types/mergeProjectContentChangeEventArgs";
import { assert } from "~ims-app-base/logic/utils/typeUtils";

type ProjectFileDbTransactionOp = {
    type: 'workspace',
    oldEntry: ProjectFileDbWorkspace | null,
    newEntry: ProjectFileDbWorkspace | null
} | {
    type: 'asset',
    oldEntry: ProjectFileDbAsset | null,
    newEntry: ProjectFileDbAsset | null
}

export class ProjectFileDbTransaction{

    private _commitCalled = false
    private _changes: ProjectContentChangeEventArg[] = []
    private _notSyncedWorkspaces: {id: string, title?: string | null}[] = []
    private _notSyncedAssets: {id: string, title?: string | null}[] = []
    
    private _pendingOps: ProjectFileDbTransactionOp[] = []

    constructor(public db: ProjectFileDb){

    }

    changeWorkspace(oldEntry: ProjectFileDbWorkspace | null, newEntry: ProjectFileDbWorkspace | null){
        this._pendingOps.push({
            type: 'workspace',
            oldEntry,
            newEntry
        })
    }
    
    changeAsset(oldEntry: ProjectFileDbAsset | null, newEntry: ProjectFileDbAsset | null){
        this._pendingOps.push({
            type: 'asset',
            oldEntry,
            newEntry
        })
    }
    
    get touchedWIds(){
        const touchedWIds = new Set<string>();
        for (const change of this._changes){
            for (const id of change.wTchIds){
                touchedWIds.add(id)
            }
        }
        return [...touchedWIds]
    }

    async flush(options?: {fsProcessed?: true}){
        for (const op of this._pendingOps){
            if (op.type === 'workspace'){
                await this._workspaceCommit(op.oldEntry, op.newEntry, options)
            }
            else if (op.type === 'asset'){
                await this._assetCommit(op.oldEntry, op.newEntry, options)
            }
        }
        this._pendingOps = [];
    }

    async commit(options?: {fsProcessed?: true}){
        if (this._commitCalled){
            throw new Error('Cannot commit transaction twice')
        }
        this._commitCalled = true;
        await this.flush(options);
        const merged_changes = mergeProjectContentChangeEventArgs(this._changes)
        for (const change of merged_changes){
            this.db.sendProjectChange(change);
        }
        await this.db.sync.markNotSyncedEntities('workspace', this._notSyncedWorkspaces)
        await this.db.sync.markNotSyncedEntities('asset', this._notSyncedAssets)
    }


    private async _deleteWorkspaceFileFromFilesystem(workspace: ProjectFileDbWorkspace){
        if (!workspace.localName) return;

        const local_path_folder = getWorkspaceLocalPathFolder(workspace, this.db)
        const local_path_meta = local_path_folder + WORKSPACE_EXT;

        await this.db.fileSystem.expectFsChange([
            local_path_folder, local_path_meta
        ], async () => {
            // 1. Delete meta file
            try {
                await shell.trashItem(local_path_meta);
            }
            catch (err: any){
                // Ignore error
            }
            
            // 2. Delete entire folder
            try {
                await shell.trashItem(local_path_folder);
            }
            catch (err: any){
                // Ignore error
            }
        })
    }
    
    private async _workspaceCommit(oldEntry: ProjectFileDbWorkspace | null, newEntry: ProjectFileDbWorkspace | null, options?: {fsProcessed?: true}) {
        const entry_id = newEntry ? newEntry.id : (oldEntry?.id)
        assert(entry_id)

        if (newEntry){
            if (oldEntry && oldEntry.id !== newEntry.id) {
                // Id changed (conflict resolution): the old id must not linger
                this.db.workspace.workspaces.delete(oldEntry.id);
                // Children must follow the id change — nothing else re-points
                // already-inserted descendants (assets.workspaceId, nested
                // workspaces.parentId) when a workspace is re-identified at runtime.
                this._repointChildrenAfterIdChange(oldEntry.id, newEntry.id);
            }
            this.db.workspace.workspaces.replace(newEntry);
            // The claim is content-owned: never drop it when a change was
            // built from a payload that doesn't carry the field (e.g. sync).
            if (newEntry.idClaimedAt == null && oldEntry?.idClaimedAt != null) {
                newEntry.idClaimedAt = oldEntry.idClaimedAt;
            }
            this._notSyncedWorkspaces.push({id: newEntry.id, title: newEntry.title})
        }
        else {
            const nested_workspaces = this.db.workspace.getNestedWorkspaces(entry_id);
            const nested_assets = await this.db.asset.searchAssets({
                workspaceids: entry_id
            })
            this.db.workspace.workspaces.delete(entry_id);
            for (const nested_workspace of nested_workspaces){
                this.db.workspace.workspaces.delete(nested_workspace.id)
            }
            for (const nested_asset of nested_assets){
                this.db.asset.deleteOwnAssetFromCollectionOnly(nested_asset.id);
            }
            this._notSyncedWorkspaces.push({id: entry_id, title: oldEntry?.title})
        }

        if(!options?.fsProcessed){
            if (oldEntry && !newEntry){
                await this._deleteWorkspaceFileFromFilesystem(oldEntry);
            }
            else if (oldEntry && newEntry) {
                const old_path_folder = getWorkspaceLocalPathFolder(oldEntry, this.db);
                let local_path_folder = old_path_folder;
                if(newEntry.parentId !== oldEntry.parentId || newEntry.title !== oldEntry.title) {
                    local_path_folder = await applyImsWorkspaceFolderChange(newEntry, old_path_folder, this.db);
                    newEntry.localName = node_path.basename(local_path_folder);
                }
                else if (newEntry.localName?.endsWith(WORKSPACE_EXT)) {
                    // Lazy migration of a legacy localName (`name.imw.json`) to the folder-basename form
                    newEntry.localName = node_path.basename(local_path_folder);
                }
                const local_path_meta = node_path.join(local_path_folder, WORKSPACE_META_FILENAME);
                // Folderless metas (kept from legacy projects) get their folder
                // created on first edit instead of failing with ENOENT.
                if (!fs.existsSync(local_path_folder)) {
                    await this.db.fileSystem.expectFsChange([local_path_folder], async () => {
                        await fs.promises.mkdir(local_path_folder, { recursive: true });
                    })
                }
                await this.db.workspace.saveWorkspaceFileToFile(newEntry, local_path_meta);
                // Drop the legacy sibling meta (if any) — the meta now lives inside the folder
                const legacy_meta_path = old_path_folder + WORKSPACE_EXT;
                if (legacy_meta_path !== local_path_meta && fs.existsSync(legacy_meta_path)) {
                    await this.db.fileSystem.expectFsChange([legacy_meta_path], async () => {
                        try {
                            await shell.trashItem(legacy_meta_path);
                        }
                        catch (err: any){
                            // Ignore error
                        }
                    })
                }
            }
            else if (newEntry) {
                const workspace_file_basename = newEntry.title ? newEntry.title : entry_id;
                let parent_workspace_path = this.db.localPath;
                if(newEntry.parentId) {
                    parent_workspace_path = getWorkspaceLocalPathFolderById(newEntry.parentId, this.db)
                }
                const suggest_title = generateNextUniqueNameNumber(
                    (workspace_file_basename ?? 'untitled').replace(forbiddenFilenameCharsRegexp, '_').trim(),
                    (name) => !fs.existsSync(node_path.join(parent_workspace_path, name + '')),
                );
                newEntry.localName = suggest_title;
                // Assert this file's claim on its id at creation
                newEntry.idClaimedAt = newEntry.idClaimedAt ?? Date.now();
                const workspace_local_path_folder = node_path.join(parent_workspace_path, suggest_title);
                const workspace_local_path_meta = node_path.join(workspace_local_path_folder, WORKSPACE_META_FILENAME);
                await this.db.fileSystem.expectFsChange([
                    workspace_local_path_folder
                ], async () => {
                    await fs.promises.mkdir(workspace_local_path_folder);
                    await this.db.workspace.saveWorkspaceFileToFile(newEntry, workspace_local_path_meta);
                })
            }         
        }
        if (newEntry) {
            // Claim after file ops — localName/paths are final by now
            this.db.fileSystem.noteWorkspaceClaim(newEntry);
        }
                
        const wTchIds = [];
        if(oldEntry?.parentId !== newEntry?.parentId){
            if(oldEntry?.parentId){
                wTchIds.push(oldEntry?.parentId)  
            }
            if(newEntry?.parentId){
                wTchIds.push(newEntry?.parentId)  
            }
        }
        this._changes.push({
            aUpsIds: [],            
            aDelIds: [],
            wUpsIds: newEntry ? [entry_id] : [],
            wDelIds: !newEntry ? [entry_id] : [],
            wTchIds,
            instigator: null
        })
    }

    
    /**
     * Enforce "a workspace's children point at its CURRENT id": when a
     * workspace id changes at runtime (conflict resolution during a watcher
     * re-load), re-point every collection asset whose workspaceId and every
     * nested workspace whose parentId still references the old id. Ops are
     * appended to this transaction, so the changes are marked not-synced,
     * serialized and emitted like any other change.
     */
    private _repointChildrenAfterIdChange(oldId: string, newId: string) {
        for (const asset of this.db.asset.assets.iterate()) {
            if (asset.workspaceId === oldId) {
                this.changeAsset(asset, { ...asset, workspaceId: newId });
            }
        }
        for (const workspace of this.db.workspace.workspaces.iterate()) {
            if (workspace.parentId === oldId) {
                this.changeWorkspace(workspace, { ...workspace, parentId: newId });
            }
        }
    }


    private async _deleteAssetFileFromFilesystem(asset: ProjectFileDbAsset){
        if (!asset.localName) return;
        const local_path = getAssetLocalPath(asset, this.db)
        await this.db.fileSystem.expectFsChange([
            local_path
        ], async () => {
            try {
                await shell.trashItem(local_path);
            }
            catch (err: any){
                // Ignore error
            }
        })
    }

    private async _assetCommit(oldEntry: ProjectFileDbAsset | null, newEntry: ProjectFileDbAsset | null, options?: {fsProcessed?: true}) {
        const entry_id = newEntry ? newEntry.id : (oldEntry?.id)
        assert(entry_id)

        if (newEntry){
            if (oldEntry && oldEntry.id !== newEntry.id) {
                // Id changed (conflict resolution): the old id must not linger
                this.db.asset.assets.delete(oldEntry.id);
            }
            this.db.asset.assets.replace(newEntry)
            // The claim is content-owned: never drop it when a change was
            // built from a payload that doesn't carry the field (e.g. sync).
            if (newEntry.idClaimedAt == null && oldEntry?.idClaimedAt != null) {
                newEntry.idClaimedAt = oldEntry.idClaimedAt;
            }
            this.db.asset.onAssetCollectionUpdated(oldEntry, newEntry)
            this._notSyncedAssets.push({id: newEntry.id, title: newEntry.title})
        }
        else {
            this.db.asset.deleteOwnAssetFromCollectionOnly(entry_id);
            this._notSyncedAssets.push({id: entry_id, title: oldEntry?.title})
        }

        if(!options?.fsProcessed){
            if (oldEntry && !newEntry){
                 await this._deleteAssetFileFromFilesystem(oldEntry);
            }
            else if (oldEntry && newEntry) {
                const old_path = getAssetLocalPath(oldEntry, this.db);
                const workspace_id_changed = oldEntry.workspaceId !== newEntry.workspaceId
                const title_changed = oldEntry.title !== newEntry.title
                if(workspace_id_changed || title_changed) {
                    const local_path = await applyImsFileLocationChange(newEntry, old_path, this.db);
                    newEntry.localName = node_path.basename(local_path);
                }
                await this.db.asset.saveAssetFile(newEntry)
            }
            else if (newEntry) {
                let parent_workspace_path = this.db.localPath;
                if(newEntry.workspaceId) {
                    parent_workspace_path = getWorkspaceLocalPathFolderById(newEntry.workspaceId, this.db);
                }
                const suggest_title = await this.db.asset.getAssetFileSavingFilename(
                    newEntry,
                    (name) => !fs.existsSync(node_path.join(parent_workspace_path, name))
                )
                newEntry.localName = suggest_title;
                // Assert this file's claim on its id at creation
                newEntry.idClaimedAt = newEntry.idClaimedAt ?? Date.now();
                await this.db.asset.saveAssetFile(newEntry)
            }
        }
        if (newEntry) {
            // Claim after file ops — localName/paths are final by now
            this.db.fileSystem.noteAssetClaim(newEntry);
        }

        const wTchIds = [];
        if(oldEntry?.workspaceId !== newEntry?.workspaceId){
            if(oldEntry?.workspaceId){
              wTchIds.push(oldEntry?.workspaceId)  
            }
            if(newEntry?.workspaceId){
              wTchIds.push(newEntry?.workspaceId)  
            }
        }
        this._changes.push({
            aUpsIds: newEntry ? [entry_id] : [],
            aDelIds: !newEntry ? [entry_id] : [],
            wUpsIds: [],
            wDelIds: [],
            wTchIds,
            instigator: null
        })
    }
}