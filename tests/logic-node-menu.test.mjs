import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const bundle = await build({entryPoints:['src/geometry-menu.ts'], bundle:true, write:false, format:'esm'});
const { translateGeometryMenu } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].contents).toString('base64'));

test('logic picker checks the category entry even when a script uses the built-in name and ID', () => {
  const dom = new JSDOM('<div class="ue-menu"><input aria-label="搜索节点"><div class="ue-submenu"><button class="ue-menu-item"><span class="ue-menu-label"></span></button></div></div>');
  const label = dom.window.document.querySelector('.ue-menu-label');
  const button = label.parentElement;
  for (const [kind, english, chinese] of [['formatString','Format String','格式化字符串'], ['textExtract','Text Extract','提取文本']]) {
    label.textContent = english;
    const entry = { kind, label: english, category: 'Logic' };
    const group = { memoizedProps: { entries: [entry] } };
    button.__reactFiber$fixture = { key: null, return: { key: kind, memoizedProps: {label: english}, return: group } };
    const read = () => translateGeometryMenu(label, 'text', english);
    assert.equal(read(), chinese);
    group.memoizedProps.entries = [{kind:'script', category:'Custom', label:english, customNodeId:kind}];
    assert.equal(read(), undefined);
    group.memoizedProps.entries = [{...entry, source: {key:kind}}];
    assert.equal(read(), undefined);
    group.memoizedProps.entries = [entry, {...entry, source: {key:kind}}];
    assert.equal(read(), undefined);
    group.memoizedProps.entries = [entry];
    button.parentElement.classList.remove('ue-submenu');
    assert.equal(read(), undefined);
    button.parentElement.classList.add('ue-submenu');
    delete button.__reactFiber$fixture;
    assert.equal(read(), undefined);
  }
  dom.window.close();
});
