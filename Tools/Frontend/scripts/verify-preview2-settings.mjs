// Open settings and disposable ComfyUI nodes without saving, loading a file, or starting a server.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';

const [address, bundlePath] = process.argv.slice(2);
const host = new URL(address);
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(host.hostname));
const bundle = bundlePath ? await readFile(bundlePath) : (await build({
  entryPoints: ['src/index.ts'], bundle: true, write: false, format: 'esm',
  external: ['@merlin/plugin-api'], charset: 'utf8',
})).outputFiles[0].contents;
const browser = await chromium.launch({ channel: 'chrome', headless: true });

try {
  const context = await browser.newContext({ viewport: {width: 1600, height: 1080}, serviceWorkers: 'block' });
  await context.routeWebSocket('**/*', ws => ws.close());
  let loads = 0;
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== host.origin) return route.abort();
    if (url.pathname === '/api/plugins/frontend/unreal-canvas-zh-cn/index.js') {
      loads++;
      return route.fulfill({ body: Buffer.from(bundle), contentType: 'text/javascript' });
    }
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method()) || (request.method() === 'POST' &&
        /^\/api\/fs\/(?:readDir|exists|stat|readText|readBinary)$/.test(url.pathname))) return route.continue();
    return route.fulfill({status: 403, body: 'Read-only Canvas QA'});
  });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  await page.goto(host.href);
  const status = page.locator('.generation-shelf-status > span');
  await status.filter({hasText: '设置 → 模型服务商'}).waitFor();
  assert.match(await status.innerText(), /模型“.+”尚无已确认的凭据。.+密钥“[\w-]+”/);
  await page.locator('.merlin-app-bar button[aria-label="设置"]').click();
  const main = page.locator('.settings-window-body main');
  const tab = name => page.locator('.settings-nav button').getByText(name, {exact: true}).click();
  await main.getByText('清除批注前要求确认', {exact: true}).waitFor();
  await main.getByText('缩放速度', {exact: true}).waitFor();
  await tab('模型目录');
  await main.getByText(/^缺少 .+ 的凭据。请在“设置 → 模型服务商”中登录或添加密钥，以运行“.+”。$/).first().waitFor();
  await tab('外部路径');
  await main.getByRole('searchbox', {name: '搜索外部路径设置'}).waitFor();
  const group = main.locator('section').filter({has: page.getByText('本地服务器', {exact: true})});
  await group.getByText(/^尚未为 http:\/\/.+ 保存 ComfyUI 服务器/).waitFor();
  await group.getByRole('button', {name: '添加服务器…', exact: true}).click();
  await group.getByText(/^指定在此地址提供 ComfyUI 服务/).waitFor();
  await group.getByRole('combobox').click();
  await page.getByRole('option', {name: '模型服务器', exact: true}).click();
  await group.getByText(/^指定在此地址提供模型服务/).waitFor();
  const args = group.getByPlaceholder('（无）');
  await args.fill('settings "Save as"');
  await group.getByText('2 个参数', {exact: true}).waitFor();
  assert.equal(await args.inputValue(), 'settings "Save as"');
  await group.getByRole('button', {name: '取消', exact: true}).click();
  console.log('PASS preferences, external paths, local server kinds, arguments and model credential messages');

  await page.goto(host.href);
  await page.locator('.merlin-app-bar button[aria-label="设置"]').waitFor();
  await page.locator('.react-flow__pane').first().waitFor();
  await page.waitForFunction(() => performance.getEntriesByType('resource').some(e => e.name.includes('/assets/canvasStore-')));
  async function fixture(graph) {
    const id = await page.evaluate(async inGraph => {
      const url = performance.getEntriesByType('resource').find(e => e.name.includes('/assets/canvasStore-')).name;
      const chunk = await import(url), store = chunk.u;
      const makeNode = [chunk.aW, chunk.aN].find(fn => fn?.toString().includes('applyUserDefaults'));
      const state = store.getState(), base = structuredClone(state.canvases[state.activeCanvasId]);
      const root = crypto.randomUUID(), child = crypto.randomUUID();
      const empty = {...base, edges: [], frames: [], textNotes: [], flowchartConnectors: []};
      const node = makeNode('comfyui', {x: 0, y: 0}, {applyUserDefaults: false});
      const graphNode = makeNode('subgraph', {x: 0, y: 0}, {applyUserDefaults: false});
      graphNode.params = {...graphNode.params, subgraphId: child, subgraphVersions: [child]};
      store.setState({canvases: {
        [root]: {...empty, id: root, nodes: inGraph ? [graphNode] : [node]},
        [child]: {...empty, id: child, nodes: inGraph ? [node] : []},
      }, activeCanvasId: inGraph ? child : root, canvasStack: inGraph ? [root, child] : [root], openTabIds: [root]});
      return node.id;
    }, graph);
    return page.locator('.react-flow__node[data-id="' + id + '"]');
  }
  const flat = await fixture(false);
  await flat.getByText('将 ComfyUI 工作流拖到这里', {exact: true}).waitFor();
  await flat.getByRole('button', {name: '浏览…'}).waitFor();
  const node = await fixture(true);
  await node.getByText('将 ComfyUI 工作流拖到这里', {exact: true}).waitFor();
  await node.getByText('工作流（API 格式）', {exact: true}).waitFor();
  const workflow = node.getByPlaceholder(/^粘贴 ComfyUI 的 API 格式工作流/);
  const add = node.getByRole('button', {name: '+ 添加输入', exact: true});
  assert.ok(await add.isDisabled());
  const sample = JSON.stringify({'6': {class_type: 'SaveImage', inputs: {filename_prefix: 'Save'}, _meta: {title: 'Server URL'}}});
  await workflow.fill(sample);
  await workflow.press('Tab');
  await node.getByText('已解析 1 个节点', {exact: true}).waitFor();
  await add.click();
  const pin = node.getByRole('textbox', {name: 'Unreal Canvas 输入引脚名称', exact: true});
  await pin.fill('Server URL');
  assert.equal(await pin.inputValue(), 'Server URL');
  assert.equal(await workflow.inputValue(), sample);
  const type = node.getByTitle('引脚类型', {exact: true}).first();
  await type.click();
  await page.getByRole('option', {name: '整数', exact: true}).click();
  assert.equal(await type.getAttribute('data-value'), 'int');
  await node.getByRole('button', {name: '移除输入'}).waitFor();
  await node.getByRole('button', {name: '+ 添加输出', exact: true}).click();
  await node.getByRole('textbox', {name: 'Unreal Canvas 输出引脚名称', exact: true}).waitFor();
  await node.getByRole('button', {name: '移除输出'}).waitFor();
  assert.ok(loads > 0);
  console.log('PASS flat card, graph card, JSON input, node count, input and output pin controls on ' + host.origin);
} finally {
  await browser.close();
}
