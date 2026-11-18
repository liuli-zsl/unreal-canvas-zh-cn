import { build } from 'esbuild';
import { copyFile, mkdir, readFile } from 'node:fs/promises';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  format: 'esm',
  target: 'es2020',
  external: ['@merlin/plugin-api'],
  charset: 'utf8',
});

const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
if (manifest.id !== 'unreal-canvas-zh-cn') throw new Error('Unexpected frontend plugin ID');
const embedded = `Resources/CanvasPlugins/${manifest.id}`;
await mkdir(`${embedded}/dist`, { recursive: true });
await copyFile('manifest.json', `${embedded}/manifest.json`);
await copyFile('dist/index.js', `${embedded}/dist/index.js`);
