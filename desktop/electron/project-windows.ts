import type { BrowserWindow } from 'electron';
import path from 'node:path';

const windowProjectPaths = new Map<BrowserWindow, string>();

export function registerWindowProjectPath(
  win: BrowserWindow,
  localPath: string | null | undefined,
) {
  if (localPath) {
    windowProjectPaths.set(win, path.normalize(localPath));
  } else {
    windowProjectPaths.delete(win);
  }
}

export function unregisterWindowProjectPath(win: BrowserWindow) {
  windowProjectPaths.delete(win);
}

export function isProjectOpenedInWindow(
  localPath: string,
  exceptWindow?: BrowserWindow | null,
): boolean {
  if (!localPath) return false;
  const norm = localPath;
  for (const [win, openedPath] of windowProjectPaths) {
    if (exceptWindow && win === exceptWindow) continue;
    if (openedPath === norm) return true;
  }
  return false;
}
