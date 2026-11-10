import type { BrowserWindow } from "electron";
import log from "electron-log/main";
import { ProjectFileDb } from "./ProjectFileDb";
import path from "node:path"

const projectDbMap = new Map<string, {
  for: Set<BrowserWindow>,
  db: ProjectFileDb
}>();

export function requestProjectDb(projectPath: string, forWindow?: BrowserWindow): ProjectFileDb {
  projectPath = path.normalize(projectPath);
  let requested = projectDbMap.get(projectPath);
  // One live instance per path, even mid-destroy: a destroying db is reused —
  // ProjectFileDb.init() waits out the destroy and joins the in-flight recreate.
  // Spawning a second instance here (the old `isDestroying` branch) left two
  // RootGddFolder ids alive for one project: the stale one kept serving sync
  // and could clobber .imsc/index.json with a null rootWorkspaceId.
  if (!requested) {
    requested = {
      for: new Set(),
      db: new ProjectFileDb(projectPath)
    }
    projectDbMap.set(projectPath, requested);
  }
  if (forWindow) {
    requested.for.add(forWindow);
  }
  return requested.db;
}

export async function closeProjectDb(projectPath: string, forWindow?: BrowserWindow): Promise<void> {
  projectPath = path.normalize(projectPath);
  let requested = projectDbMap.get(projectPath);
  if (!requested) {
    return;
  }
  if (forWindow) {
    requested.for.delete(forWindow);
  }
  if (requested.for.size === 0) {
    projectDbMap.delete(projectPath);
    await requested.db.destroy();
  }
}

export async function closeAllProjectDb() {
  const closing_projects = [...projectDbMap.entries()];
  for (const [path, request] of closing_projects) {
    projectDbMap.delete(path);
    await request.db.destroy();
  }
}

/**
 * Drop `win` from every project it holds and destroy the projects whose last
 * window just closed. Called from the window `closed` handler — without it a
 * dead BrowserWindow stays in the `for` set forever, `closeProjectDb` never
 * sees size 0, and the SQLite connection plus the parcel watcher keep the
 * project folder locked until the whole app quits.
 *
 * `beforeDestroy` runs before each destroy (MCP sessions must disconnect
 * first, mirroring `closeProject`). Every step is guarded so one failing
 * project cannot prevent the others from being released.
 */
export async function releaseProjectDbForWindow(
  win: BrowserWindow,
  beforeDestroy?: (projectPath: string) => Promise<void>,
): Promise<void> {

  const doomed: Array<[string, ProjectFileDb]> = [];
  for (const [projectPath, request] of projectDbMap) {
    if (!request.for.delete(win)) continue;
    if (request.for.size === 0) {
      projectDbMap.delete(projectPath);
      doomed.push([projectPath, request.db]);
    }
  }
  for (const [projectPath, db] of doomed) {
    try {
      await beforeDestroy?.(projectPath);
    } catch (err: any) {
      log.error(`Pre-destroy step failed for ${projectPath} (continuing with destroy):`, err);
    }
    try {
      await db.destroy();
    } catch (err: any) {
      log.error(`Failed to destroy project db for ${projectPath}:`, err);
    }
  }
}

export function sendEventToProjectDbWindows(projectPath: string, eventName: string, args: any[]) {
  let project_path = path.normalize(projectPath);
  let requested = projectDbMap.get(project_path);
  if (!requested) {
    return;
  }
  for (const win of requested.for) {
    if (win && !win.isDestroyed()) {
      win.webContents.send(eventName, ...args)
    }
  }
}