import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const bundle = await build({
  stdin: {
    contents: 'export { localize } from "./src/translate"; export { dictionary } from "./src/dictionary";',
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  format: 'esm',
});
const { localize, dictionary } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].contents).toString('base64'));

test('node hover localizes built-in metadata and restores it on unload', () => {
  const description = 'Raises a video\'s resolution frame by frame.';
  const dom = new JSDOM(`
    <div role="tooltip" data-portal-popup><div id="popup">
      <div id="name">Video Upscaler</div>
      <div id="type"><span>Type</span><span>Video</span></div>
      <div id="description"><span>Description</span><span>${description}</span></div>
      <div id="notes"><span>Notes</span><span>Settings</span></div>
    </div></div>
    <div role="tooltip" data-portal-popup><div>
      <div id="unowned"><span>Description</span><span>${description}</span></div>
    </div></div>
  `);
  const doc = dom.window.document;
  const get = id => doc.getElementById(id);
  const value = id => get(id).lastElementChild.textContent;
  const node = { kind: 'videoUpscaler', name: 'Video Upscaler', pins: [{ direction: 'output', dataType: 'video' }] };
  get('popup').__reactFiber$fixture = { return: { memoizedProps: { view: 'graphTooltip', node } } };
  get('type').__reactFiber$fixture = { key: 'type' };
  get('description').__reactFiber$fixture = { key: 'sys:description' };
  get('notes').__reactFiber$fixture = { key: 'notes' };
  const stop = localize(doc, dictionary);
  assert.equal(get('name').textContent, 'Video Upscaler（视频超分辨率）');
  assert.equal(value('type'), '视频');
  assert.equal(value('description'), '逐帧提升视频分辨率。');
  assert.equal(value('notes'), 'Settings');
  assert.equal(value('unowned'), description);
  stop();
  assert.equal(value('type'), 'Video');
  assert.equal(value('description'), description);

  node.kind = 'script';
  node.name = 'Settings';
  get('name').textContent = node.name;
  const stopCustom = localize(doc, dictionary);
  assert.equal(get('name').textContent, 'Settings');
  assert.equal(value('description'), description);
  stopCustom();
  dom.window.close();
});

test('pin hints localize host state and retain model and port names', () => {
  const inactive = 'Not used by Image Model V1';
  const port = 'Wire to add a bundle Design Image port';
  const dom = new JSDOM(`
    <div class="react-flow__handle" data-pin-dot="first" data-node-id="node" title="${inactive}"></div>
    <div class="react-flow__handle" data-pin-dot="custom" data-node-id="node" title="${inactive}"></div>
    <div class="react-flow__handle" data-pin-dot="virtual" data-node-id="node" title="${port}"></div>
  `);
  const [first, custom, virtual] = dom.window.document.querySelectorAll('.react-flow__handle');
  first.__reactFiber$fixture = { memoizedProps: { nodeId: 'node', pin: { id: 'first' }, inactive: true, inactiveHint: inactive } };
  custom.__reactFiber$fixture = { memoizedProps: { nodeId: 'node', pin: { id: 'custom' } } };
  virtual.__reactFiber$fixture = { memoizedProps: { nodeId: 'node', entry: { label: 'Design Image', family: { bound: true } } } };
  const stop = localize(dom.window.document, dictionary);
  assert.equal(first.title, '“Image Model V1”未使用此引脚');
  assert.equal(custom.title, inactive);
  assert.equal(virtual.title, '拖动连线以添加“Design Image”数据束端口');
  stop();
  assert.equal(first.title, inactive);
  assert.equal(virtual.title, port);
  dom.window.close();
});
