// Check the installed host. Supply a bundle path only for browser-local preview.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';

const host = new URL(process.argv[2] || 'http://localhost:10678');
assert.ok(['localhost', '127.0.0.1'].includes(host.hostname), 'A local Canvas host is required');
const previewPath = process.argv[3];
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const page = await browser.newPage({viewport: {width: 1600, height: 1000}});
page.setDefaultTimeout(6500);
let loads = 0;
const checks = [];
try {
  const pluginPath = '/api/plugins/frontend/unreal-canvas-zh-cn/index.js';
  if (previewPath) {
    const bundle = await readFile(previewPath, 'utf8');
    await page.route('**' + pluginPath + '*', route =>
      route.fulfill({status: 200, contentType: 'text/javascript', body: bundle}));
  }
  page.on('response', response => {
    if (new URL(response.url()).pathname === pluginPath && response.ok()) loads++;
  });
  await page.goto(host.href);
  await page.locator('.merlin-app-bar button[aria-label="设置"]').waitFor();
  assert.ok(loads > 0, 'Canvas must load the localization package');

  async function panel(name, selector) {
    const target = page.locator(selector).first();
    const trigger = page.locator('.merlin-content-modes button').and(page.getByRole('button', {name, exact: true}));
    for (let attempt = 0; attempt < 3 && !await target.isVisible(); attempt++) {
      await trigger.click();
      await target.waitFor({timeout: 1200}).catch(() => {});
    }
    await target.waitFor();
  }
  await panel('资源库', '.media-library');
  await page.locator('.media-library-filter-trigger').click();
  const facets = page.getByLabel('资源库筛选', {exact: true});
  await facets.getByText('筛选条件', {exact: true}).waitFor();
  await facets.getByText('人员', {exact: true}).waitFor();
  await page.keyboard.press('Escape');
  const librarySearch = page.locator('.media-library .merlin-panel-search input');
  await librarySearch.fill('Unmatched QAX');
  await page.getByText('没有匹配的媒体', {exact: true}).waitFor();
  assert.match(await page.locator('.media-library-size').getAttribute('title'), /^缩略图大小：\d+ 像素$/);
  await librarySearch.fill('');
  checks.push('资源库的筛选、空状态和动态缩略图尺寸');

  await panel('工具箱', '.merlin-scripts');
  const toolboxSearch = page.locator('.merlin-scripts .merlin-panel-search input');
  await toolboxSearch.fill('Save');
  await page.getByText('没有与“Save”匹配的脚本。', {exact: true}).waitFor();
  assert.equal(await toolboxSearch.inputValue(), 'Save');
  await page.getByText('0 个结果', {exact: true}).waitFor();
  await toolboxSearch.fill('');
  // Built-in asset names and user library items share the same name slots.
  const assetNames = page.locator('.merlin-scripts-row-name,.merlin-graphs-tile-label');
  const firstAsset = await assetNames.first().textContent();
  await page.locator('.merlin-scripts-row,.merlin-scripts-tile').first().click({button: 'right'});
  const context = page.locator('.ue-menu[data-portal-popup]:visible').last();
  await context.getByText(/^(加星标|取消星标)$/).waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await assetNames.first().textContent(), firstAsset);
  await page.locator('.merlin-scripts [data-testid="thumbnails-sort-by"]').click();
  await page.locator('.ue-menu.nokey').getByText('最近使用', {exact: true}).waitFor();
  await page.keyboard.press('Escape');
  await page.locator('.merlin-scripts-create-btn').click();
  await page.locator('.merlin-scripts-create-kind[data-kind="skill"]').click();
  await page.locator('.merlin-scripts-create-submit').and(page.getByText('创建技能', {exact: true})).waitFor();
  await page.locator('.merlin-scripts-create-hint').getByText(/技能 ID/).waitFor();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  checks.push('工具箱的查询原文、结果数、资源名称、右键菜单、排序和新建技能表单');

  await panel('检查器', '.merlin-rail-pin');
  await page.locator('.merlin-rail-pin[aria-label="固定此卡片"],.merlin-rail-pin[aria-label="固定此框架"]').waitFor();
  await panel('操作记录', '.merlin-ops');
  await page.locator('.merlin-ops-group[aria-label="进行中"]').waitFor();
  checks.push('检查器和操作记录');
  await panel('实时日志', '.merlin-console-filter');
  await page.getByRole('combobox', {name: '日志级别'}).click();
  const levels = page.getByRole('listbox', {name: '日志级别'});
  assert.deepEqual(await levels.getByRole('option').allTextContents(), ['所有级别','日志','信息','调试','警告','错误']);
  await page.keyboard.press('Escape');
  checks.push('实时日志及其独立弹出的六个日志级别');
  await panel('执行', '.merlin-session-console');
  await page.getByRole('combobox', {name: 'Python 会话'}).waitFor();
  if (await page.locator('.merlin-session-console:not(.has-session)').count()) {
    await page.locator('.merlin-session-console > div').filter({hasText: '在 Python 工作区交互调用 merlin API。'}).waitFor();
    await page.getByRole('button', {name: '新建会话', exact: true}).waitFor();
  }
  checks.push('Python 控制台');
  await panel('智能体', '.agent-welcome,.agent-onboarding,.agent-detail-shell');
  if (await page.locator('.agent-welcome-primary').isVisible()) {
    await page.locator('.agent-welcome-primary').click();
    await page.getByRole('heading', {name: '选择连接方式'}).waitFor();
    await page.getByText('其他提供商', {exact: true}).click();
    await page.getByText('先登录对话提供商，或添加连接凭据。', {exact: true}).waitFor();
    checks.push('智能体接入向导及其他提供商子页');
  }
  console.log(JSON.stringify({host: host.origin, mode: previewPath ? 'browser-local preview' : 'installed', loads, checks}, null, 2));
} finally {
  await browser.close();
}