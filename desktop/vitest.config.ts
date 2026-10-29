import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Mirrors the aliases defined in nuxt.config.ts — specs run outside Nuxt.
const resolvePath = (relative: string) =>
  fileURLToPath(new URL(relative, import.meta.url));

const MOCKS_DIR = './electron/project-file-db/test/mocks/';

export default defineConfig({
  resolve: {
    // Electron-only modules must be stubbed — specs run headless in Node.
    // Exact-match regexes: 'electron' must not swallow other package names.
    alias: [
      { find: /^electron$/, replacement: resolvePath(`${MOCKS_DIR}electron.ts`) },
      {
        find: /^electron-log\/main$/,
        replacement: resolvePath(`${MOCKS_DIR}electron-log-main.ts`),
      },
      {
        find: /^electron-json-storage\/lib\/utils$/,
        replacement: resolvePath(`${MOCKS_DIR}electron-json-storage-utils.ts`),
      },
      {
        find: /^electron-json-storage$/,
        replacement: resolvePath(`${MOCKS_DIR}electron-json-storage.ts`),
      },
      // Ordered: more specific prefixes must come first ('~' would otherwise
      // swallow '~ims-app-base/...', '~~' '~...' etc).
      { find: '~ims-app-base', replacement: resolvePath('../ims-app-base/app/') },
      { find: '~ims-creators', replacement: resolvePath('../creators/app/') },
      {
        find: '~ims-plugin-base',
        replacement: resolvePath('../ims-app-base/ims-plugins/base/'),
      },
      {
        find: '~ims-plugin-creators',
        replacement: resolvePath('../creators/ims-plugins/creators/'),
      },
      { find: '#components', replacement: resolvePath('./app/components/') },
      { find: '#logic', replacement: resolvePath('./app/logic/') },
      { find: '#bridge', replacement: resolvePath('./bridge/') },
      { find: '~~', replacement: resolvePath('./') },
      { find: '~', replacement: resolvePath('./') },
    ],
  },
  test: {
    include: ['**/*.spec.ts'],
    globals: true,
    // FS + sqlite recreate flows take seconds each and were brushing the 5s
    // default whenever the desktop app was running (tests hit 3–4.5s alone).
    testTimeout: 30_000,
    // Specs share global state (mocked electron-json-storage dir, parcel
    // watcher handles, sqlite files) — run files one at a time to avoid
    // cross-worker contention crashing workers mid-suite.
    fileParallelism: false,
  },
});
