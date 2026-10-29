// Headless stub of `electron-json-storage/lib/utils` for vitest.
// Aliased in vitest.config.ts.
import path from 'node:path';

export default {
    getFileName: (key: string) => path.join(process.cwd(), '.vitest-appdata', key),
};
