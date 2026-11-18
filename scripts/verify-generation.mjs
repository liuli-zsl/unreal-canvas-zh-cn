import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const host = new URL(process.argv[2]);
assert.ok(['localhost', '127.0.0.1'].includes(host.hostname));
const output = process.argv[3];
if (output) await mkdir(output, { recursive: true });
const browser = await chromium.launch({channel: 'chrome', headless: true});
try {
  const page = await browser.newPage({viewport: {width: 1600, height: 1000}});
  page.setDefaultTimeout(6000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Mode switches and menu searches are local. Keep this audit independent of file saves.
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.protocol.startsWith('http') && url.origin !== host.origin) return route.abort();
    if (/^\/api\/fs\/(write|append|delete|remove|rename)/.test(url.pathname)) return route.fulfill({json: {ok: true}});
    return route.continue();
  });
  await page.goto(host.href);
  await page.locator('.merlin-app-bar button[aria-label="设置"]').waitFor();
  const shelf = page.locator('.merlin-generation-shelf');
  const modes = [
    ['图像', '图像脚本'], ['视频', '视频脚本'], ['音频', '音频脚本'], ['文本', '文本脚本'],
    ['网格模型', '网格模型脚本'], ['高斯泼溅', '高斯泼溅脚本'], ['其他', '其他脚本'],
  ];
  for (const [mode, scripts] of modes) {
    const button = shelf.locator('.generation-shelf-modes').getByRole('button', {name: mode, exact: true});
    if (!await button.evaluate(e => e.parentElement.dataset.selected === 'true') || !await shelf.locator('.generation-shelf-workspace').isVisible()) await button.click();
    const menuButton = shelf.getByRole('button', {name: scripts, exact: true});
    await menuButton.click();
    const menu = page.getByRole('menu', {name: scripts, exact: true});
    await menu.waitFor();
    const row = menu.locator(':scope > button[role="menuitemradio"]').first();
    assert.match(await row.innerText(), /生成|选择脚本|智能体/);
    const search = menu.getByPlaceholder('搜索脚本');
    if (await search.isVisible()) {
      await search.fill('Save 中文 QA');
      await menu.getByText('找不到与“Save 中文 QA”匹配的脚本。', {exact:true}).waitFor();
      assert.equal(await search.inputValue(), 'Save 中文 QA');
    }
    await page.keyboard.press('Escape');
    const advanced = shelf.locator('.generation-shelf-advanced-toggle');
    if (await advanced.isVisible() && await advanced.getAttribute('aria-expanded') === 'false') await advanced.click();
    if (mode === '视频') {
      await shelf.getByLabel('起始帧参考素材').waitFor();
      await shelf.getByLabel('结束帧参考素材').waitFor();
      if (output) await shelf.screenshot({path: join(output, 'video-shelf.png')});
    }
    if (mode === '音频') await shelf.locator('.merlin-param-label').filter({hasText:/^采样率$/}).first().waitFor();
    if (mode === '文本') await shelf.locator('.merlin-param-label').filter({hasText:/^系统提示词$/}).first().waitFor();
    if (mode === '高斯泼溅') await shelf.locator('.merlin-param-label').filter({hasText:/^高斯点数量$/}).first().waitFor();
  }
  await shelf.locator('.generation-shelf-options').click();
  await page.locator('.generation-shelf-menu').getByText('停靠在画布底部中央', {exact:true}).waitFor();
  await page.keyboard.press('Escape');
  assert.deepEqual(errors, []);
  console.log(host.origin, '七种生成模式、脚本菜单与搜索、视频首尾帧、音频、文本、高斯泼溅参数及停靠菜单通过；页面脚本错误 0。');
} finally {
  await browser.close();
}
