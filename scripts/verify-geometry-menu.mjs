// Traverse the real GeometryScript palette in a disposable workspace. Only read operations reach the editor.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const [address, bundle, mode = 'translated'] = process.argv.slice(2);
const host = new URL(address);
assert.ok(['127.0.0.1', 'localhost'].includes(host.hostname));
assert.ok(['baseline', 'translated'].includes(mode));
const translated = mode === 'translated';
const catalog = JSON.parse(await fs.readFile(new URL('../src/locales/geometry-menu.json',import.meta.url),'utf8'));
let liveOps;
const allowedReads = new Set(['/api/fs/readText', '/api/fs/exists', '/api/fs/readDir', '/api/fs/stat', '/api/fs/readBinary']);
const browser = await chromium.launch({channel: 'chrome', headless: true});
try {
  const context = await browser.newContext({viewport: {width: 1600, height: 1080}, serviceWorkers: 'block'});
  await context.routeWebSocket('**/*', ws => ws.close());
  await context.route('**/*', async route => {
    const req = route.request();
    const u = new URL(req.url());

    if (u.origin !== host.origin) return route.abort();
    if (u.pathname === '/api/http/proxy') {
      const target = new URL(u.searchParams.get('url'));
      if (req.method() !== 'POST' || !['localhost','127.0.0.1'].includes(target.hostname) || target.pathname !== '/mcp') return route.abort();
      const rpc=req.postDataJSON();
      if (['initialize','notifications/initialized','tools/list'].includes(rpc.method)) return route.continue();
      if (rpc.method !== 'tools/call' || rpc.params?.name !== 'ListMeshOps') return route.fulfill({status:403,body:'Read-only geometry fixture'});
      const response = await route.fetch();
      const payload = await response.json();
      assert.ok(!payload.result?.isError);
      liveOps = JSON.parse(payload.result.content[0].text).ops;
      return route.fulfill({response});
    }
    if (bundle && u.pathname === '/api/plugins/frontend/unreal-canvas-zh-cn/index.js') {
      return route.fulfill({path: path.resolve(bundle), contentType: 'text/javascript'});
    }
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method()) || (req.method() === 'POST' && allowedReads.has(u.pathname))) return route.continue();
    return route.fulfill({status: 403, body: 'Read-only Canvas QA fixture'});
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5500);

  async function reset() {
    await page.goto(host.href);
    await page.locator('.merlin-app-bar button[aria-label="设置"]').waitFor();
    await page.waitForFunction(() => performance.getEntriesByType('resource').some(e => /\/assets\/canvasStore-[\w-]+\.js/.test(e.name)));
    await page.locator('.react-flow__pane').first().waitFor();
    // The host hydrates its saved canvas asynchronously after mounting the app bar.
    await page.waitForTimeout(450);
    const ids = await page.evaluate(async () => {
      const src = performance.getEntriesByType('resource').find(e => /\/assets\/canvasStore-[\w-]+\.js/.test(e.name)).name;
      // These exports are the fixture API in the supported Canvas 0.21 frontend.
      const {u: store, aW: makeNode} = await import(src);
      const state = store.getState(), id = state.activeCanvasId;
      const canvas = {...structuredClone(state.canvases[id]), name: 'Canvas QA · 图像', nodes: [], edges: [], frames: [], textNotes: [], flowchartConnectors: []};
      store.setState({canvases: {[id]: canvas}, canvasStack: [id], openTabIds: [id], activeCanvasId: id});
      return ['发布测试图像', 'Settings'].map((name, index) => {
        const node = makeNode('script', {x: index * 280, y: 0}, {applyUserDefaults: false});
        node.name = name;
        state.addNode(id, node);
        return node.id;
      });
    });
    await page.locator('.react-flow__node[data-id="' + ids[1] + '"]').waitFor();
    return ids.map(id => page.locator('.react-flow__node[data-id="' + id + '"] .canvas-card-header'));
  }
  async function rightClickEmpty() {
    const pane = page.locator('.react-flow__pane').last();
    const point = await pane.evaluate(e => {
      const box = e.getBoundingClientRect();
      for (let y = box.top + 140; y < box.bottom - 130; y += 45) {
        for (let x = box.left + 80; x < box.right - 70; x += 52) {
          const hit = document.elementFromPoint(x, y);
          if (hit === e || hit?.classList.contains('react-flow__viewport')) return {x, y};
        }
      }
    });
    assert.ok(point, 'expected free space in the nested graph');
    await page.mouse.click(point.x, point.y, {button: 'right'});
  }
  const cards = await reset();
  await cards[1].click({button: 'right', force: true});
  await page.locator('.pill-menu-item:visible').filter({hasText: /^创建$/}).first().click();
  await page.locator('.pill-menu-item:visible').filter({hasText: /^复制到新节点图$/}).first().click();
  const graph = page.locator('.react-flow__node').filter({has: page.locator('.canvas-card-header', {hasText: /^Graph$/})}).first();
  await graph.locator('.canvas-card-body').dblclick({position: {x: 25, y: 30}, force: true});
  await page.locator('.graph-node-header-title').first().waitFor();
  await rightClickEmpty();
  const library = page.locator('.pill-menu:has(.merlin-panel-search)').last();
  const input=library.locator('input');
  await input.waitFor();
  const geometry=library.getByText('几何',{exact:true});
  await geometry.hover();
  const expected=(english,dictionary)=>translated?dictionary[english]:english;
  const first=expected('Basic Edits',catalog.categories);
  await library.getByText(first,{exact:true}).waitFor({timeout:20000});
  assert.ok(Array.isArray(liveOps) && liveOps.length>0,'The editor must return a real ListMeshOps catalog');
  for (const op of liveOps) {
    assert.ok(catalog.categories[op.library],op.library);
    assert.ok(catalog.operations[op.label],op.label);
  }
  async function walk(experimental) {
    const operations = liveOps.filter(op=>experimental || !op.sidecarOnly);
    const byLibrary = Map.groupBy(operations,op=>op.library);
    const tree = library.locator('.pill-submenu').first();
    const menus = tree.locator(':scope > div > button[aria-haspopup="menu"] .ue-menu-label');
    assert.equal(await menus.count(),byLibrary.size);
    for (const [name,ops] of byLibrary) {
      const label=expected(name,catalog.categories);
      const row=menus.filter({hasText:new RegExp('^'+label+'$')});
      await row.hover();
      const child=row.locator('../..').locator(':scope > .pill-submenu');
      await child.waitFor();
      const wanted=ops.map(op=>expected(op.label,catalog.operations)).sort();
      if (!translated) {
        // In 0.2.2 one full operation label was already shared with a preset.
        const normals=wanted.indexOf('Recompute Normals');
        if(normals>=0)wanted[normals]='重算法线';
        wanted.sort();
      }
      const shown=(await child.locator(':scope > div > button > .ue-menu-label,:scope > button > .ue-menu-label').allInnerTexts()).sort();
      assert.deepEqual(shown,wanted,name);
    }
    console.log(host.origin,experimental?'实验操作':'默认',byLibrary.size,'类',operations.length,'项');
  }
  async function setExperimental(value) {
    // Update only the transient store, without invoking the application's persistence action.
    await page.evaluate(async value=>{
      const url=performance.getEntriesByType('resource').find(e=>/\/assets\/valueTypes-[\w-]+\.js/.test(e.name)).name;
      (await import(url)).x.setState({showExperimentalMeshOps:value});
    },value);
  }
  await setExperimental(false);
  await walk(false);
  await setExperimental(true);
  await library.getByText(expected('Sculpt Layers',catalog.categories),{exact:true}).waitFor();
  await walk(true);
  await input.fill('Add Triangles to Mesh');
  const searchRow=library.locator('button').filter({has:page.getByText(expected('Add Triangles to Mesh',catalog.operations),{exact:true})});
  await searchRow.locator('.ue-menu-count').getByText(first,{exact:true}).waitFor();
  assert.equal(await input.inputValue(),'Add Triangles to Mesh');
  await searchRow.evaluate(button=>{
    const custom=button.cloneNode(true);
    custom.dataset.testCollision='true';
    custom.querySelector('.ue-menu-icon > span').style.background='#fb923c';
    custom.querySelector('.ue-menu-label').textContent='Add Triangles to Mesh';
    custom.querySelector('.ue-menu-count').textContent='Custom';
    button.after(custom);
  });
  await page.waitForTimeout(90);
  assert.equal(await library.locator('[data-test-collision] .ue-menu-label').innerText(),'Add Triangles to Mesh');
  await page.keyboard.press('Escape');
} finally { await browser.close(); }
