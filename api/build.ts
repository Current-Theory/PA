import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: [join(root, 'src/index.ts')], outfile: join(root, 'dist/index.cjs'),
  bundle: true, platform: 'node', target: 'node22', format: 'cjs',
  external: ['@azure/functions'], sourcemap: false
});
