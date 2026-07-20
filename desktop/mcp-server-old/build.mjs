import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [path.join(__dirname, 'src/index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outdir: path.join(__dirname, 'dist'),
  sourcemap: true,
  alias: {
    '~ims-app-base': path.join(__dirname, '../../ims-app-base/app'),
    '~': path.join(__dirname, '../electron'),
  },
  external: [],
});
