import { build } from 'esbuild';
import { copyFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontend = fileURLToPath(new URL('../', import.meta.url));
const sourceManifest = join(frontend, 'manifest.json');
const manifest = JSON.parse(await readFile(sourceManifest, 'utf8'));
if (manifest.id !== 'unreal-canvas-zh-cn') throw new Error('Unexpected frontend plugin ID');
const embedded = join(frontend, '../../Resources/CanvasPlugins', manifest.id);

await build({
  absWorkingDir: frontend,
  entryPoints: ['src/index.ts'],
  outfile: join(embedded, 'dist/index.js'),
  bundle: true,
  format: 'esm',
  target: 'es2020',
  external: ['@merlin/plugin-api'],
  charset: 'utf8',
});

await copyFile(sourceManifest, join(embedded, 'manifest.json'));
