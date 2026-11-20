// Stage the developer's own Canvas SDK for the local file dependency in npm's lockfile.
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8'));
const sdk = lock.packages['node_modules/@merlin/plugin-api'];
const filename = 'unreal-canvas-plugin-api-' + sdk.version + '.tgz';
const destination = join(root, 'vendor', filename);
const supplied = process.argv[2];
const local = process.env.LOCALAPPDATA;
const source = supplied ? resolve(supplied) : local && join(local, 'UnrealCanvas', 'Builds', 'v0.24.0', 'plugin-sdk', filename);

function matchesLock(bytes) {
  return 'sha512-' + createHash('sha512').update(bytes).digest('base64') === sdk.integrity;
}

async function readIfPresent(path) {
  try {
    return await readFile(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

const existing = await readIfPresent(destination);
if (!supplied && existing && matchesLock(existing)) {
  console.log('Canvas SDK ' + sdk.version + ' 已就绪。');
} else {
  const bytes = source && await readIfPresent(source);
  if (!bytes || !matchesLock(bytes)) {
    throw new Error('请先从 UE 启动 Canvas 0.24.0，或运行 node scripts/prepare-sdk.mjs "<官方 ' + filename + ' 的路径>"。SDK 必须与锁文件中的版本和校验值一致。');
  }
  await mkdir(dirname(destination), { recursive: true });
  const pending = destination + '.' + process.pid + '.tmp';
  try {
    await writeFile(pending, bytes, { flag: 'wx' });
    await rename(pending, destination);
  } finally {
    await rm(pending, { force: true });
  }
  console.log('已校验并准备本机 Canvas SDK ' + sdk.version + '。');
}
