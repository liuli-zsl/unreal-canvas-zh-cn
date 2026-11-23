// Run from the plugin root against either Unreal Canvas host. Browser-only fixtures never save project data.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';

const host = new URL(process.argv[2] ?? 'http://localhost:10678');
assert.ok(['localhost', '127.0.0.1'].includes(host.hostname));
const browser = await chromium.launch({
  executablePath: process.env.CHROME_EXE ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  let previewLoads = 0;
  const preview = process.argv.includes('--preview');
  if (preview) {
    const result = await build({
      entryPoints: ['src/index.ts'], write: false, format: 'esm', bundle: true,
      external: ['@merlin/plugin-api'], target: 'es2020', charset: 'utf8',
    });
    await page.route('**/api/plugins/frontend/unreal-canvas-zh-cn/index.js*', route => {
      previewLoads++;
      return route.fulfill({ body: result.outputFiles[0].text, contentType: 'application/javascript' });
    });
  }

  await page.goto(host.href);
  await page.locator('.merlin-app-bar button[aria-label="设置"]').click();
  const main = page.locator('.settings-window-body > main');
  const nav = page.locator('.settings-nav button');
  const categories = new Map([
    ['偏好设置', 'text=外观'], ['智能体', '[aria-label="搜索项目审阅"]'],
    ['语音输入', 'text=语音识别模型'], ['快捷键', 'text=返回选择工具'],
    ['语义与元数据', 'text=自定义字段'], ['协作', 'input[placeholder="输入共享链接或房间 ID"]'],
    ['外部路径', 'text=摄像头采集服务'], ['存储', 'text=旧版来源'],
    ['扩展', '[aria-label="允许直接执行的操作"]'], ['模型服务商', 'text=凭据'],
    ['模型目录', '[aria-label="模型目录表"]'], ['模型定义', '[aria-label="模型定义表"]'],
    ['默认模型', '[aria-label="搜索默认模型设置"]'],
  ]);

  for (const [name, sample] of categories) {
    await nav.getByText(name, { exact: true }).click();
    await main.locator(sample).first().waitFor({ state: 'attached', timeout: 6000 });
    if (name === '语义与元数据') {
      const inspector = main.locator('section.settings-group').filter({ has: page.locator('h3', { hasText: /^检查器$/ }) }).first();
      const expand = inspector.locator('.settings-group-header button[aria-expanded="false"]').first();
      if (await expand.count()) await expand.click();
      const row = inspector.locator('[data-field-id="votes"]').first();
      await row.waitFor({ state: 'attached' });
      assert.ok((await row.innerText()).includes('票数'));
      // Duplicate a real control and simulate a name identical to a standard UI command.
      await row.evaluate(el => {
        const copy = el.cloneNode(true);
        copy.setAttribute('data-field-id', 'custom:acceptance');
        copy.querySelector('span[style*="flex: 1"]').textContent = 'Save';
        copy.querySelector('button').setAttribute('aria-label', 'Hide Save from this layout');
        el.after(copy);
      });
      const copy = inspector.locator('[data-field-id="custom:acceptance"]');
      await copy.locator('button[aria-label="在此布局中隐藏“Save”"]').waitFor({ state: 'attached' });
      assert.equal(await copy.locator('span[style*="flex: 1"]').textContent(), 'Save');
      await copy.evaluate(el => el.remove());
    }
    if (name === '模型定义') {
      const row = main.locator('[data-service-id]').first();
      await row.waitFor({ state: 'attached' });
      await row.evaluate(el => {
        const copy = el.cloneNode(true);
        copy.setAttribute('data-service-id', 'test-localization');
        copy.querySelector(':scope > div:first-child > div:first-child').textContent = 'Save';
        el.after(copy);
      });
      const copy = main.locator('[data-service-id="test-localization"]');
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await copy.locator(':scope > div:first-child > div:first-child').textContent(), 'Save');
      await copy.evaluate(el => el.remove());
    }
    console.log(name + ' OK');
  }
  if (preview) assert.ok(previewLoads > 0);
} finally {
  await browser.close();
}
