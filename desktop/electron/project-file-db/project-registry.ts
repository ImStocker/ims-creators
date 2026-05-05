import type { BrowserWindow } from "electron";
import { ProjectFileDb } from "./ProjectFileDb";
import path from "node:path"

const projectDbMap = new Map<string, {
    for: Set<BrowserWindow>,
    db: ProjectFileDb
}>();

export function requestProjectDb(projectPath: string, forWindow: BrowserWindow): ProjectFileDb{
    projectPath = path.normalize(projectPath);
    let requested = projectDbMap.get(projectPath);
    if (!requested || requested.db.isDestroying){
        requested = {
            for: new Set(),
            db: new ProjectFileDb(projectPath)
        }
        projectDbMap.set(projectPath, requested);
    }
    requested.for.add(forWindow);
    return requested.db;
}

export async function closeProjectDb(projectPath: string, forWindow: BrowserWindow): Promise<void> {
    projectPath = path.normalize(projectPath);
    let requested = projectDbMap.get(projectPath);
    if (!requested){
        return;
    }
    requested.for.delete(forWindow);
    if (requested.for.size === 0){
        projectDbMap.delete(projectPath);
        await requested.db.destroy();
    }
}

export async function closeAllProjectDb(){
    const closing_projects = [...projectDbMap.entries()];
    for (const [path, request] of closing_projects){
        projectDbMap.delete(path);
        await request.db.destroy();
    }
}

export function sendEventToProjectDbWindows(projectPath: string, eventName:string, args: any[]){
    let project_path = path.normalize(projectPath);
    let requested = projectDbMap.get(project_path);
    if (!requested){
        return;
    }
    for(const win of requested.for) {
        if (win && !win.isDestroyed()){
            win.webContents.send(eventName, ...args)
        }
    }
}