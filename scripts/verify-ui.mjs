// Run against an isolated UE or standalone Canvas process started with -cefdebug=<port>.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const endpoint = new URL(process.argv[2]);
if (endpoint.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname)) {
  throw new Error('Pass the loopback Chrome DevTools endpoint of a test editor.');
}
const browser = await chromium.connectOverCDP(endpoint.href);
try {
  let page;
  for (let i = 0; i < 80 && !page; i++) {
    for (const context of browser.contexts()) {
      for (const candidate of context.pages()) {
        if (/^https?:\/\/(?:localhost|127\.0\.0\.1):\d+(?:\/|$)/.test(candidate.url()) &&
            await candidate.locator('.merlin-app-bar').count()) page = candidate;
      }
    }
    if (!page) await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(page, 'Open the Unreal Canvas tab in the test instance first');
  const settings = page.locator('.merlin-app-bar button[aria-label="设置"]');
  await settings.waitFor();
  await settings.click();
  const body = page.locator('.settings-window-body');
  await body.waitFor();
  assert.match(await body.innerText(), /[\u3400-\u9fff]/u);
  if (process.argv[3]) await page.screenshot({ path: process.argv[3] });
  await page.keyboard.press('Escape');
  console.log('中文设置按钮和可打开的设置界面已验证。');
} finally {
  await browser.close();
}
