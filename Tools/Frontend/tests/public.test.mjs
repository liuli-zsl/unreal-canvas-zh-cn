import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

await build({ entryPoints: ['src/translate.ts', 'src/dictionary.ts'], outdir: '.test-build',
  outExtension: { '.js': '.mjs' }, format: 'esm', bundle: true, platform: 'node' });
const { localize } = await import('../.test-build/translate.mjs');
const { dictionary } = await import('../.test-build/dictionary.mjs');

test('agent controls localize while messages, model IDs, and user input retain their values', async () => {
  const { window } = new JSDOM('<section class="agent-setup-popover"><div class="agent-setup-body">'
    + '<label>Permission</label><button data-value="auto">Autonomous</button><span class="agent-model-name">Test Model</span>'
    + '<textarea>Permission</textarea></div></section><div class="agent-chat-message">Autonomous</div>');
  const doc = window.document;
  const stop = localize(doc, dictionary);
  assert.equal(doc.querySelector('label').textContent, '权限');
  const button = doc.querySelector('button');
  assert.match(button.textContent, /自主/);
  assert.equal(button.dataset.value, 'auto');
  assert.equal(doc.querySelector('.agent-model-name').textContent, 'Test Model');
  assert.equal(doc.querySelector('textarea').value, 'Permission');
  assert.equal(doc.querySelector('.agent-chat-message').textContent, 'Autonomous');
  button.textContent = 'Standard';
  await new Promise(resolve => window.setTimeout(resolve, 0));
  assert.equal(button.textContent, '标准');
  stop();
  assert.equal(doc.querySelector('label').textContent, 'Permission');
  assert.equal(button.textContent, 'Standard');
  window.close();
});

test('geometry submenus recognize host operation swatches and skip a custom item with the same title', () => {
  const { window } = new JSDOM('<div class="pill-menu"><input class="merlin-panel-search"></div>');
  const doc = window.document;
  const menu = doc.querySelector('.pill-menu');
  for (const color of ['rgb(110, 231, 183)', 'orange']) {
    const item = doc.createElement('button');
    item.setAttribute('aria-haspopup', 'menu');
    item.innerHTML = '<span class="ue-menu-icon"><span></span></span><span class="ue-menu-label">Basic Edits</span>';
    item.firstChild.firstChild.style.backgroundColor = color;
    menu.appendChild(item);
  }
  const stop = localize(doc, dictionary);
  const labels = [...doc.querySelectorAll('.ue-menu-label')];
  assert.equal(labels[0].textContent, '基础编辑');
  assert.equal(labels[1].textContent, 'Basic Edits');
  stop();
  assert.equal(labels[0].textContent, 'Basic Edits');
  window.close();
});

test('editor picker shows localized capability, retaining project and level names', () => {
  const { window } = new JSDOM('<div class="unreal-editor-menu"><div class="unreal-editor-menu-status-title">'
    + 'Orchid has Unreal Canvas Bridge: every Unreal node works.</div><button class="unreal-editor-menu-row" role="menuitemradio">'
    + '<span class="ue-menu-label">Orchid</span><span class="ue-menu-detail">My_Level</span></button></div>');
  const doc = window.document;
  const stop = localize(doc, dictionary);
  assert.match(doc.querySelector('.unreal-editor-menu-status-title').textContent, /^Orchid .*节点/);
  assert.equal(doc.querySelector('.ue-menu-label').textContent, 'Orchid');
  assert.equal(doc.querySelector('.ue-menu-detail').textContent, 'My_Level');
  stop();
  window.close();
});

test('offline help lookup translates a host setting without acting on chat content with identical text', () => {
  const { window } = new JSDOM('<div class="agent-setup-strip"><span class="agent-setup-hint">Acts and generates without asking.</span></div>'
    + '<div class="agent-chat-message">Acts and generates without asking.</div>');
  const stop = localize(window.document, dictionary);
  assert.equal(window.document.querySelector('.agent-setup-hint').textContent, '可自行修改并生成内容。');
  assert.equal(window.document.querySelector('.agent-chat-message').textContent, 'Acts and generates without asking.');
  stop();
  window.close();
});

test('viewer fixtures contain the authored triangle and a WebM clip', async () => {
  const mesh = await readFile(new URL('./fixtures/viewer.glb', import.meta.url));
  assert.equal(mesh.toString('ascii', 0, 4), 'glTF');
  const gltf = JSON.parse(mesh.toString('utf8', 20, 20 + mesh.readUInt32LE(12)));
  assert.equal(gltf.accessors[gltf.meshes[0].primitives[0].attributes.POSITION].count, 3);
  const clip = await readFile(new URL('./fixtures/viewer.webm', import.meta.url));
  assert.equal(clip.readUInt32BE(0), 0x1a45dfa3);
});
