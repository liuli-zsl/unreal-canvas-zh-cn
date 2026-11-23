import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const compiled = await build({
  stdin: { contents: "export { localize } from './src/translate'; export { copyKey, copyId } from './src/copy-id';", resolveDir: process.cwd() },
  write: false, bundle: true, platform: 'node', format: 'esm',
});
const { localize, copyKey, copyId } = await import('data:text/javascript;base64,' +
  Buffer.from(compiled.outputFiles[0].contents).toString('base64'));

test('a fingerprint is stable across platforms and counts UTF-16 code units', () => {
  assert.equal(copyId('hello'), 'a430d84680aabd0b');
  assert.match(copyKey('A😀'), /^#3:[0-9a-f]{16}$/);
});

test('a fingerprint rule is limited to its selector and field and restores the source on unload', async () => {
  const doc = new JSDOM('<div class="probe"></div><aside></aside><textarea></textarea>').window.document;
  const original = 'Example instruction for the blue triangle.';
  const changed = 'Another instruction for the blue triangle.';
  const control = doc.querySelector('.probe');
  control.textContent = original;
  control.title = original;
  doc.querySelector('aside').textContent = original;
  doc.querySelector('textarea').value = original;
  const entries = { [copyKey(original)]: '查看蓝色三角形。', [copyKey(changed)]: '移动蓝色三角形。' };
  const stop = localize(doc, [{ selector: '.probe', fields: ['text'], entries }]);
  assert.equal(control.textContent, entries[copyKey(original)]);
  assert.equal(control.title, original);
  assert.equal(doc.querySelector('aside').textContent, original);
  assert.equal(doc.querySelector('textarea').value, original);
  control.textContent = changed;
  await new Promise(resolve => doc.defaultView.setTimeout(resolve, 0));
  assert.equal(control.textContent, entries[copyKey(changed)]);
  stop();
  assert.equal(control.textContent, changed);
  doc.defaultView.close();
});
