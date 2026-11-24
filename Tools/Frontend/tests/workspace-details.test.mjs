import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

await build({entryPoints:['src/translate.ts'], outfile:'.test-build/workspace-details.mjs', bundle:true, platform:'node', format:'esm'});
const { localize } = await import('../.test-build/workspace-details.mjs');

test('graph captions follow node kinds, leaving user titles, prompt bodies, custom pins and scripts intact', () => {
  const node = (id, kind, name, params = {}, pins = []) => ({id,kind,name,params,pins});
  const nodes = [
    node('weld','meshOp','Weld Edges',{meshOp:'Repair.WeldMeshEdges'}),
    node('renamed','meshOp','Simplify',{meshOp:'Repair.WeldMeshEdges'}),
    node('custom','script','Weld Edges'),
    node('empty','textInput','Text Input',{markdown:''}),
    node('written','textInput','Text Input',{markdown:'Double-click to edit'}),
    node('gen','imageGenerator','Settings',{},[{id:'fb0dc024-20c2-4037-b50b-8cf6add171b8',name:'Image',direction:'input'}]),
  ];
  const graph = {activeCanvasId:'c',canvases:{c:{nodes}}};
  const markup = nodes.map(n=>`<div class="react-flow__node" data-id="${n.id}">
    <div class="graph-node-header-title"><span title="${n.name} — Double-click to rename">${n.name}</span></div>
    <div class="graph-node-body"><div class="graph-node-params"><span class="merlin-param-label">Operation</span></div>
    <div class="text-input-rich" data-merlin-text-surface><span>Double-click to edit</span></div>
    <div contenteditable="true">Operation</div></div><div><div data-pin-dot="fb0dc024-20c2-4037-b50b-8cf6add171b8"></div><div class="merlin-pin-label">Image</div></div></div>`).join('');
  const dom = new JSDOM(markup);
  try {
    const doc = dom.window.document;
    const element = (id, selector) => doc.querySelector(`[data-id="${id}"] ${selector}`);
    const stop = localize(doc, [], () => graph);
    assert.equal(element('weld','.merlin-param-label').textContent,'操作');
    assert.equal(element('custom','.merlin-param-label').textContent,'Operation');
    assert.equal(element('weld','.graph-node-header-title span').textContent,'Weld Edges');
    assert.equal(element('weld','.graph-node-header-title span').title,'Weld Edges（焊接边） — 双击重命名');
    assert.equal(element('renamed','.graph-node-header-title span').title,'Simplify — 双击重命名');
    assert.equal(element('empty','.text-input-rich span').textContent,'双击编辑');
    assert.equal(element('written','.text-input-rich span').textContent,'Double-click to edit');
    assert.equal(element('weld','[contenteditable]').textContent,'Operation');
    assert.equal(element('gen','.merlin-pin-label').textContent,'Image');
    stop();
    assert.equal(element('weld','.merlin-param-label').textContent,'Operation');
    assert.equal(element('empty','.text-input-rich span').textContent,'Double-click to edit');
  } finally {
    dom.window.close();
  }
});

test('render fields, pass controls and resolution hints preserve user variable names and original values', () => {
  const dom = new JSDOM(`
    <div class="react-flow__node" data-id="render">
      <div class="graph-node-body">
        <div class="nodrag">
          <button aria-pressed="true" title="beauty">beauty</button>
          <button aria-pressed="false" title="Custom Pass">Custom Pass</button>
        </div>
        <button class="custom-select" role="combobox" aria-controls="passes" data-value="depth">
          <span><span id="depth" aria-hidden="false">depth</span></span>
        </button>
        <div class="graph-node-params">
          <div class="merlin-param-row"><span id="fixed" class="merlin-param-label" title="Show flags">Show flags</span></div>
          <div class="merlin-param-row"><span id="variable" class="merlin-param-label" title="Show flags">Show flags</span>
            <div class="merlin-param-control"><button title="Expose as input pin"></button></div>
          </div>
          <div id="resolution">→ 1920×1080 · matches viewport 1.78:1</div>
          <div id="fallback"></div>
        </div>
      </div>
    </div>
    <div role="listbox" id="passes"><div role="option" data-value="depth"><span id="option">depth</span></div></div>`);
  try {
    const doc = dom.window.document;
    const state = {activeCanvasId:'c',canvases:{c:{nodes:[{id:'render',kind:'unrealRender',params:{mrgPassNames:['Beauty','Depth']}}]}}};
    const field = id => doc.getElementById(id);
    field('resolution').replaceChildren(...['→ ', '1920×1080', ' · matches viewport 1.78:1'].map(text => doc.createTextNode(text)));
    field('fallback').replaceChildren(...['→ ', '1920×1080', ' — ', 'viewport',
      " couldn't be found, so this is the ", 'viewport', " aspect, not that camera's. Pick the camera again."
    ].map(text => doc.createTextNode(text)));
    const stop = localize(doc, [], () => state);
    const beauty = doc.querySelector('button[aria-pressed="true"]');
    assert.equal(beauty.textContent,'最终合成');
    assert.equal(beauty.title,'最终合成');
    assert.equal(doc.querySelector('button[aria-pressed="false"]').textContent,'Custom Pass');
    assert.equal(field('depth').textContent,'深度');
    assert.equal(field('option').textContent,'深度');
    assert.equal(field('depth').closest('button').getAttribute('data-value'),'depth');
    assert.equal(field('fixed').textContent,'显示标志');
    assert.equal(field('variable').textContent,'Show flags');
    assert.equal(field('variable').title,'Show flags');
    assert.equal(field('resolution').textContent,'→ 1920×1080 · 匹配视口宽高比 1.78:1');
    assert.equal(field('fallback').textContent,'→ 1920×1080 — viewport 未找到，当前显示的是 视口 的宽高比。请重新选择相机。');
    stop();
    assert.equal(beauty.title,'beauty');
    assert.equal(field('resolution').textContent,'→ 1920×1080 · matches viewport 1.78:1');
  } finally {
    dom.window.close();
  }
});
