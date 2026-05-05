// https://nuxt.com/docs/api/configuration/nuxt-config
import path from 'node:path';
import fs from 'node:fs';
import pkg from './package.json';
import { fileURLToPath } from 'node:url';

import { nodePolyfills } from 'vite-plugin-node-polyfills';
import vueDevTools from 'vite-plugin-vue-devtools'

import { viteImsResolvePlugin } from "../ims-app-base/config/vite-ims-resolve-plugin"
import type { ViteConfig } from 'nuxt/schema';

const dist_electron_path = path.join(__dirname, 'dist-electron')
const dist_client_path = path.join(__dirname, 'dist-client')
if (process.env.NODE_ENV === 'production'){
  fs.rmSync(dist_electron_path, {
      recursive: true,
      force: true,
  });
  fs.rmSync(dist_client_path, {
      recursive: true,
      force: true,
  });
}
else {
  const main_entry = path.join(dist_electron_path, 'main.js');
  if (!fs.existsSync(main_entry)){
    // Add stub main.js to eliminate missing entry error, when dev script is running at first time
    fs.mkdirSync(dist_electron_path, {
      recursive: true
    })
    fs.writeFileSync(main_entry, ''); 
  }
}

const viteElectronBuildConfig: ViteConfig = {
  build: {
    minify: process.env.NODE_ENV === 'production',
    rollupOptions: {
      external: Object.keys('dependencies' in pkg ? pkg.dependencies : {}),
    },
  },
  define: {
    'process.env.CREATORS_API_HOST': JSON.stringify(process.env.CREATORS_API_HOST),
    'process.env.AUTH_API_HOST': JSON.stringify(process.env.AUTH_API_HOST),
    'process.env.FILE_STORAGE_API_HOST': JSON.stringify(process.env.FILE_STORAGE_API_HOST)
  },
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./', import.meta.url)),
      '#components': fileURLToPath(new URL('./app/components', import.meta.url)),
      '#logic': fileURLToPath(new URL('./app/logic', import.meta.url)),
      '#bridge': fileURLToPath(new URL('./bridge', import.meta.url)),
      '~ims-app-base': fileURLToPath(
        new URL('../ims-app-base/app', import.meta.url),
      ),
      '~ims-creators': fileURLToPath(
        new URL('../creators/app', import.meta.url),
      ),
      '~ims-plugin-base': fileURLToPath(
        new URL('../ims-app-base/ims-plugins/base', import.meta.url),
      ),
      '~ims-plugin-creators': fileURLToPath(
        new URL('../creators/ims-plugins/creators', import.meta.url),
      ),
    },
  },
};

export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  srcDir: 'app/',  
  devtools: { enabled: false },
  modules: ['@nuxt/eslint', 'nuxt-electron', '@nuxtjs/i18n'],
  ssr: false,
  nitro: {
    output: {
      dir: 'dist-client'
    }
  },
  experimental: {
    appManifest: false,
  },
  router: {
    options: {
      hashMode: true
    }
  },
  imports: {
    autoImport: false,
  },
  app: {
    baseURL: './',
    buildAssetsDir: './_nuxt/',
  },
  components: {
    dirs: [],
  },

  alias: {
    '#components': fileURLToPath(new URL('./app/components', import.meta.url)),
    '#logic': fileURLToPath(new URL('./app/logic', import.meta.url)),
    '#bridge': fileURLToPath(new URL('./bridge', import.meta.url)),
    '~ims-app-base': fileURLToPath(
      new URL('../ims-app-base/app', import.meta.url),
    ),
    '~ims-creators': fileURLToPath(
      new URL('../creators/app', import.meta.url),
    ),
    '~ims-plugin-base': fileURLToPath(
      new URL('../ims-app-base/ims-plugins/base', import.meta.url),
    ),
    '~ims-plugin-creators': fileURLToPath(
      new URL('../creators/ims-plugins/creators', import.meta.url),
    ),
  },

  // Needed to change priority for vscode
  typescript: {
    tsConfig: {
      compilerOptions: {
        paths: {
          '#components/*': ['./app/components/*'],
          '#logic/*': ['./app/logic/*'],
          '#bridge/*': ['./bridge/*'],
          '~ims-app-base/*': ['../ims-app-base/app/*'],
          '~ims-creators/*': ['../creators/app/*'],
          '~ims-plugin-base/*': ['../ims-app-base/ims-plugins/base/*'],
          '~ims-plugin-creators/*': ['../creators/ims-plugins/creators/*'],
        },
      },
    },
  },

  extends: [
    '../ims-app-base',
    '../creators',
  ],
  runtimeConfig: {
    public: {
      APP_CONFIGURATION_NAME: 'creators',

      AUTH_API_HOST: process.env.AUTH_API_HOST,
      CREATORS_API_HOST: process.env.CREATORS_API_HOST,
      FILE_STORAGE_API_HOST: process.env.FILE_STORAGE_API_HOST,
      SUPERVISOR_API_HOST: process.env.SUPERVISOR_API_HOST,
      GAMEMANAGER_API_HOST: process.env.GAMEMANAGER_API_HOST,
      SPACE_API_HOST: process.env.SPACE_API_HOST,
      CREATORS_HOST: process.env.CREATORS_HOST,
      PROJECT_TEMPLATES_LINK: process.env.PROJECT_TEMPLATES_LINK,
    },
  },

  vite: {
    plugins: [
      nodePolyfills({
        include: ['path'],
      }),
      vueDevTools(),
      viteImsResolvePlugin({
        projectRoots: [
          fileURLToPath(new URL('../ims-app-base', import.meta.url)),
          fileURLToPath(new URL('../creators', import.meta.url)),
          fileURLToPath(new URL('./', import.meta.url))
        ]
      })
    ],
    server: {
      allowedHosts: true,
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'es2022',
      },
      exclude: [
        ...(
           // Note: not working in dev 🤷‍♂️, that's why here is that condition
           process.env.NODE_ENV === 'production' ? [
            '@codemirror/language',
            '@codemirror/state',
            '@codemirror/view',
          ] : [
            '@codemirror/state',
           ])
      ],
    },
    resolve: {
      dedupe: [
        'vue',
        'vue-router',
        
        ...(
           // Note: not working in dev 🤷‍♂️, that's why here is that condition
           process.env.NODE_ENV === 'production' ? [
            '@codemirror/language',
            '@codemirror/state',
            '@codemirror/view',
           ] : [
            '@codemirror/state',
        ])
      ],
    },
    define: {
      "process.platform": JSON.stringify(process.platform)
    }
  },
  i18n: {
    strategy: 'no_prefix',
    vueI18n: "./i18n.config.ts",
    detectBrowserLanguage: false
  },
  electron: {
    build: [
      {
        entry: 'electron/main.ts',
        vite: viteElectronBuildConfig,
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          // Notify the renderer process to reload the page when the preload-script is completely loaded
          // Instead of restarting the entire electron app
          options.reload();
        },
        vite: viteElectronBuildConfig,
      },
    ],
    disableDefaultOptions: true,
  },
});
