// Opens a private Canvas fixture; the only permitted POST requests read local files.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const [address = 'http://localhost:10678', bundle, mode = 'translated'] = process.argv.slice(2);
const host = new URL(address);
assert.ok(['127.0.0.1', 'localhost'].includes(host.hostname));
assert.ok(['baseline', 'translated'].includes(mode));
const label = (en, zh) => mode === 'baseline' ? en : zh;
const allowedReads = new Set(['/api/fs/readText', '/api/fs/exists', '/api/fs/readDir', '/api/fs/stat', '/api/fs/readBinary']);
const browser = await chromium.launch({channel: 'chrome', headless: true});
const blocked = new Set();
const checks = [];
try {
  const context = await browser.newContext({viewport: {width: 1600, height: 1080}, serviceWorkers: 'block'});
  await context.routeWebSocket('**/*', ws => ws.close());
  await context.route('**/*', async route => {
    const req = route.request();
    const u = new URL(req.url());
    if (u.origin !== host.origin) return route.abort();
    if (bundle && u.pathname === '/api/plugins/frontend/unreal-canvas-zh-cn/index.js') {
      return route.fulfill({path: path.resolve(bundle), contentType: 'text/javascript'});
    }
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method()) || (req.method() === 'POST' && allowedReads.has(u.pathname))) return route.continue();
    blocked.add(req.method() + ' ' + u.pathname);
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
  async function pressButton(locator) {
    await locator.focus();
    await page.keyboard.press('Enter');
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

  await reset();
  await page.locator('.react-flow__pane').first().click({force: true, position: {x: 720, y: 350}});
  await page.keyboard.press('Control+f');
  const search = page.locator('.ue-menu:has(button[aria-label="关闭搜索"])');
  const query = search.getByPlaceholder(label('Search cards, frames, notes…', '搜索卡片、框架和便笺…'));
  await query.fill('QA no match 55');
  await search.getByText(label('No matches', '没有匹配结果'), {exact: true}).waitFor();
  assert.equal(await query.inputValue(), 'QA no match 55');
  const scope = search.getByText(label('This canvas', '当前画布'), {exact: true});
  const resultLabel = search.locator('button[data-result-index]').first();
  for (const name of ['发布测试图像', 'Settings']) {
    await query.fill(name);
    // The 0.2.1 release incorrectly translated the highlighted user name.
    const displayedName = mode === 'baseline' && name === 'Settings' ? '设置' : name;
    await resultLabel.getByText(displayedName, {exact: true}).last().waitFor();
    assert.equal(await query.inputValue(), name);
  }
  await scope.click();
  await query.fill('发布测试图像');
  await resultLabel.getByText('发布测试图像', {exact: true}).last().waitFor();
  checks.push('Ctrl+F searches all open canvases and the current canvas for user-provided Chinese and English content');

  await reset();
  await pressButton(page.getByRole('button', {name: '插入', exact: true}).last());
  await page.locator('.canvas-tool-palette .ue-menu').getByText(label('Insert File…', '插入文件…'), {exact: true}).waitFor();
  await page.keyboard.press('Escape');
  await pressButton(page.getByRole('button', {name: '批注', exact: true}).last());
  const annotations = page.locator('.annotation-toolbar');
  await pressButton(annotations.getByRole('button', {name: label('Freehand draw options', '自由绘制选项')}));
  await annotations.getByText(label('Lasso area', '套索区域'), {exact: true}).waitFor();
  await page.keyboard.press('Escape');
  await pressButton(annotations.getByRole('button', {name: label('Outline color', '描边颜色')}));
  await annotations.getByRole('button', {name: label('Outline #ff3333', '描边 #ff3333'), exact: true}).waitFor();
  checks.push('Insert menu, drawing tools, shape choices and color value');

  const selected = await reset();
  await selected[0].click({force: true});
  await selected[1].click({modifiers: ['Shift'], force: true});
  await selected[1].click({button: 'right', force: true});
  await page.locator('.pill-menu-item:visible').filter({hasText: /^排列$/}).first().click();
  await page.locator('.pill-submenu').getByText(label('Send to Back', '置于底层'), {exact: true}).waitFor();
  checks.push('card selection Arrange flyout');

  await reset();
  await page.locator('.react-flow__pane').first().click({button:'right', force:true, position:{x:720,y:350}});
  await page.locator('.pill-menu-item:visible').filter({hasText:/^创建$/}).first().click();
  await page.locator('.pill-menu-item:visible').filter({hasText:/^框架$/}).first().click();
  const grid = page.locator('[data-frame-grid-btn]').last();
  if (await grid.getAttribute('aria-pressed') === 'false') await pressButton(grid);
  await pressButton(page.locator('[data-frame-table-config-btn]').last());
  const layout = page.getByRole('dialog', {name:label('Structured Layout options', '结构化布局选项')});
  await layout.getByText(label('Card scale','卡片缩放'), {exact:true}).waitFor();
  await layout.getByText(label('Spacing','间距'), {exact:true}).waitFor();
  await layout.getByText(label('Add section','添加分区'), {exact:true}).waitFor();
  await page.keyboard.press('Escape');
  await pressButton(page.locator('[data-frame-color-btn]').last());
  const color = page.locator('.frame-color-picker');
  await color.getByRole('slider', {name: label('Hue and saturation','色相与饱和度')}).waitFor();
  await color.getByRole('button', {name: label('Cancel','取消'), exact:true}).waitFor();
  checks.push('structured-frame layout options and frame color picker');

  const cards = await reset();
  await cards[1].click({button: 'right', force: true});
  await page.locator('.pill-menu-item:visible').filter({hasText: /^创建$/}).first().click();
  await page.locator('.pill-menu-item:visible').filter({hasText: /^复制到新节点图$/}).first().click();
  const graph = page.locator('.react-flow__node').filter({has: page.locator('.canvas-card-header', {hasText: /^Graph$/})}).first();
  await graph.locator('.canvas-card-body').dblclick({position: {x: 25, y: 30}, force: true});
  await page.locator('.graph-node-header-title').first().waitFor();
  await page.getByTitle(label('Navigate to Canvas QA · 图像','前往“Canvas QA · 图像”'), {exact:true}).waitFor();
  const closeGraph = page.getByRole('button',{name:label('Close Graph','关闭“Graph”'),exact:true});
  await closeGraph.hover();
  await page.getByRole('tooltip').getByText(label('Close Graph and go back up','关闭“Graph”并返回上一级'),{exact:true}).waitFor();
  await rightClickEmpty();
  const library = page.locator('.pill-menu:has(.merlin-panel-search)').last();
  const input = library.getByPlaceholder(label('Search nodes...', '输入英文节点名，如 image…'));
  await input.waitFor();
  const geometry = library.getByText(label('Geometry', '几何'), {exact: true});
  await geometry.hover();
  await library.getByText(label('Weld Edges', '焊接边'), {exact: true}).waitFor();
  const emptyNodeSearch = label('No match', '没有匹配的节点。可输入英文名，或清空后按分类浏览。');
  for (const word of ['图像','加法']) {
    await input.fill(word);
    await library.getByText(emptyNodeSearch, {exact:true}).waitFor();
    assert.equal(await input.inputValue(), word);
  }
  await input.fill('image');
  const result = library.getByText(label('Image Viewer', '图像查看器'), {exact: true});
  await result.waitFor();
  assert.equal(await input.inputValue(), 'image');
  // The host renders custom entries with this mark from the Custom category.
  // Reproduce a user node whose name collides with a built-in in flat search.
  await result.evaluate(e => {
    const row = e.closest('button').cloneNode(true);
    row.dataset.qaCustomResult = 'true';
    row.querySelector('.ue-menu-icon > span').style.background = '#fb923c';
    row.querySelector('.ue-menu-label').textContent = 'Image Viewer';
    e.closest('button').after(row);
  });
  await page.waitForTimeout(100);
  assert.equal(await library.locator('[data-qa-custom-result] .ue-menu-label').innerText(), 'Image Viewer');
  await input.fill('zzzzz-no-such-node');
  await library.getByText(emptyNodeSearch, {exact: true}).waitFor();
  checks.push('graph category, node search, value preservation, custom-name collision and empty state');

  const out = path.join('verification', 'canvas-actions-022-' + mode + '-' + host.port + '.json');
  await fs.mkdir(path.dirname(out), {recursive: true});
  await fs.writeFile(out, JSON.stringify({host:host.origin, mode, checks, blocked:[...blocked]}, null, 2));
  console.log(mode, checks.length, 'checks passed');
} finally {
  await browser.close();
}
