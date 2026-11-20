// Run against a local standalone App service connected to a Bridge-enabled editor.
import assert from 'node:assert/strict';
import path from 'node:path';
import { chromium } from 'playwright-core';

const [address, bundle, mode = 'translated', screenshot] = process.argv.slice(2);
const host = new URL(address);
assert.ok(['localhost', '127.0.0.1'].includes(host.hostname));
assert.ok(['baseline', 'translated'].includes(mode));
const chinese = mode === 'translated';
const report = await (await fetch(new URL('/api/unreal/editors', host))).json();
assert.equal(report.host, 'noLevelEditor', 'The editor picker belongs to the standalone App');
assert.ok(report.connected?.label, 'Select a running Bridge-enabled editor in the App first');
const reads = new Set(['GetStatus', 'list_toolsets', 'describe_tools', 'describe_toolsets']);
const browser = await chromium.launch({channel: 'chrome'});
try {
  const context = await browser.newContext({viewport: {width: 1500, height: 950}, serviceWorkers: 'block'});
  await context.routeWebSocket('**/*', socket => socket.close());
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== host.origin) return route.abort();
    if (bundle && bundle !== '-' && url.pathname === '/api/plugins/frontend/unreal-canvas-zh-cn/index.js') {
      return route.fulfill({path: path.resolve(bundle), contentType: 'text/javascript'});
    }
    if (url.pathname === '/api/unreal/recent-projects' && request.method() === 'GET') {
      // Publish a screenshot without exposing the user's recent projects or their paths.
      return route.fulfill({json: [{projectFile: 'D:/Demo/CanvasDemo.uproject', project: 'CanvasDemo',
        engine: {root: 'D:/UE/UE_5.9', version: '5.9', label: 'UE 5.9 (source)'}}]});
    }
    if (url.pathname === '/api/http/proxy') {
      const target = new URL(url.searchParams.get('url'));
      if (request.method() !== 'POST' || !['localhost', '127.0.0.1'].includes(target.hostname) || target.pathname !== '/mcp') return route.abort();
      const rpc = request.postDataJSON();
      if (['initialize', 'notifications/initialized', 'tools/list'].includes(rpc.method)
        || (rpc.method === 'tools/call' && reads.has(rpc.params?.name))) return route.continue();
      return route.fulfill({status: 403, body: 'Read-only editor picker fixture'});
    }
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method())
      || (request.method() === 'POST' && /^\/api\/fs\/(?:exists|stat|readText|readDir|readBinary)$/.test(url.pathname))) return route.continue();
    return route.fulfill({status: 403, body: 'Read-only editor picker fixture'});
  });
  const page = await context.newPage();
  await page.goto(host.href);
  const chip = page.locator('button.unreal-editor-chip');
  await chip.click();
  const menu = page.locator('.unreal-editor-menu');
  const name = report.connected.label;
  const statusTitle = menu.locator('.unreal-editor-menu-status-title');
  const expected = chinese ? ['节点', '卡片'].map(term => `${name} 已启用 Unreal Canvas Bridge，所有 Unreal ${term}均可使用。`)
    : ['node', 'card'].map(term => `${name} has Unreal Canvas Bridge: every Unreal ${term} works.`);
  await page.waitForFunction(expected => expected.includes(document.querySelector('.unreal-editor-menu-status-title')?.textContent), expected, {timeout: 20000});
  const status = await statusTitle.innerText();
  await menu.getByRole('menuitemradio', {checked: true}).getByText(name, {exact: true}).waitFor();
  if (report.connected.level) {
    await menu.getByRole('menuitemradio', {checked: true}).getByText(report.connected.level.split('/').pop(), {exact: true}).waitFor();
  }
  // Use textContent because the stock heading style applies CSS uppercase in English.
  const headings = await menu.locator('.ue-menu-heading').allTextContents();
  assert.deepEqual(headings, chinese ? ['运行中的编辑器', '最近的工程'] : ['Running editors', 'Recent projects']);
  const actions = chinese ? ['在后台启动', '打开 UE 工程…', '打开关卡…', '断开连接', '退出编辑器并断开连接']
    : ['Start in the background', 'Open UProject…', 'Open level…', 'Disconnect', 'Quit and disconnect'];
  for (const label of actions) await menu.getByText(label, {exact: true}).waitFor();
  const recent = menu.getByRole('menuitem').filter({has: page.getByText('CanvasDemo', {exact: true})});
  await recent.getByText(chinese ? 'UE 5.9（源码版）' : 'UE 5.9 (source)', {exact: true}).waitFor();
  assert.ok((await recent.getAttribute('title')).includes('D:/Demo/CanvasDemo.uproject'));
  if (screenshot) await menu.screenshot({path: screenshot});
  await menu.getByText(actions[2], {exact: true}).click();
  await menu.getByRole('menuitem', {name: chinese ? '返回' : /^(?:Back|返回)$/}).click();
  await menu.getByText(actions[3], {exact: true}).waitFor();
  console.log([mode, name, status, headings.join(' / '), actions.join(' / '), 'level picker and back'].join('\n'));
} finally {
  await browser.close();
}
