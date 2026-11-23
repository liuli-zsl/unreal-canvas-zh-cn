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
