import { defineNuxtConfig } from 'nuxt/config';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { fileURLToPath } from 'node:url';

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  srcDir: 'app/',

  imports: {
    autoImport: false,
  },

  components: {
    dirs: [],
  },

  alias: {
    '#components': fileURLToPath(new URL('./app/components', import.meta.url)),
    '#logic': fileURLToPath(new URL('./app/logic', import.meta.url)),
    '~ims-app-base': fileURLToPath(
      new URL('../ims-app-base/app', import.meta.url),
    ),
    '~ims-plugin-base': fileURLToPath(
      new URL('../ims-app-base/ims-plugins/base', import.meta.url),
    ),
    '~ims-plugin-creators': fileURLToPath(
      new URL('./ims-plugins/creators', import.meta.url),
    ),
  },

  // Needed to change priority for vscode
  typescript: {
    tsConfig: {
      compilerOptions: {
        paths: {
          '#components/*': ['../app/components/*'],
          '#logic/*': ['../app/logic/*'],
          '~ims-app-base/*': ['../ims-app-base/app/*'],
          '~ims-plugin-base/*': ['../ims-app-base/ims-plugins/base/*'],
          '~ims-plugin-creators/*': ['./ims-plugins/creators/*'],
        },
      },
    },
  },

  vite: {
    resolve: {
      dedupe: [
        '@codemirror/language',
        '@codemirror/state',
        '@codemirror/view',
        '@lezer/common',
      ],
    },
    plugins: [
      nodePolyfills({
        include: ['path'],
        globals: {
          process: false,
          Buffer: false,
          global: false,
        },
      }),
    ],
    optimizeDeps: {
      esbuildOptions: {
        target: 'es2022',
      },
    },
  },

  modules: ['@nuxtjs/i18n', '@nuxt/eslint'],
});
