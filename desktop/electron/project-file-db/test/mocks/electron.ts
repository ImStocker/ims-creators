// Headless stub of the `electron` module for vitest (specs run outside Electron).
// Aliased in vitest.config.ts.
import fs from 'node:fs/promises';
import path from 'node:path';

export const app = {
    getPath: () => path.join(process.cwd(), '.vitest-appdata'),
};

export const ipcMain = {
    on() {},
    handle() {},
    removeHandler() {},
    removeListener() {},
};

export const shell = {
    // Emulate trash by actually removing the entry — specs assert on filesystem state
    trashItem: async (target: string) => {
        await fs.rm(target, { recursive: true, force: true });
    },
    openPath: async () => {},
};

export default { app, ipcMain, shell };
