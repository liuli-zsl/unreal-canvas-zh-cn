// Exercise a running local Canvas host through its ordinary controls.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const url = new URL(process.argv[2]);
assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
const output = path.resolve(process.argv[3] ?? 'verification/browser');
await fs.mkdir(output, {recursive:true});
const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report = {url:url.origin,started:new Date().toISOString(),checks:[],pages:{},errors:[]};
try {
  const page = await browser.newPage({viewport:{width:1600,height:1000}});
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => report.errors.push(error.message));
  let loads = 0;
  page.on('console', message => {if(message.text().includes('[unreal-canvas-zh-cn]')) loads++;});
  await page.goto(url.href);
  await page.locator('.merlin-app-bar button[aria-label="设置"]').waitFor();
  await page.waitForTimeout(500);
  await page.locator('.merlin-app-bar button[aria-label="设置"]').hover();
  await page.getByRole('tooltip').filter({hasText:'偏好设置、模型、快捷键及更多选项'}).waitFor();
  report.checks.push('settings tooltip title and description are Chinese');
  const tabNames=await page.locator('.merlin-canvas-tab-close').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label')));
  assert.ok(tabNames.length>0 && tabNames.every(text=>text.startsWith('关闭 ')));
  await page.locator('.merlin-app-bar button[aria-label="设置"]').click();
  for (const name of ['偏好设置','模型服务商','扩展','默认模型','存储']) {
    await page.locator('.settings-nav button').filter({hasText:new RegExp('^'+name+'$')}).click();
    if (name === '扩展') {
      const row = page.locator('[data-package-row="Unreal Canvas 简体中文"]');
      await row.waitFor();
      const listing = await (await page.request.get(new URL('/api/plugins/installed', url).href)).json();
      const plugin = listing.plugins.find(entry => entry.id === 'unreal-canvas-zh-cn');
      assert.ok(plugin);
      report.package = {version:plugin.manifest.version,rootKind:plugin.rootKind,status:plugin.status};
      if (plugin.rootKind === 'bundled') await row.getByText('随包安装', {exact:true}).waitFor();
    }
    if (name === '偏好设置') {
      const search = page.getByPlaceholder('搜索偏好设置…', {exact:true});
      const query = 'CanvasZhQA 中文查找';
      await search.fill(query);
      await page.getByText('当前分类没有与“' + query + '”匹配的设置。要搜索其他分类，请先在左侧选择。', {exact:true}).waitFor();
      assert.equal(await search.inputValue(), query);
      await search.fill('');
      report.checks.push('localized empty search result preserves the query');
    }
    report.pages[name] = await page.locator('.settings-window-body main').innerText();
    if(name === '模型服务商') assert.match(report.pages[name],/支持\s*图像、视频和音频/);
  }
  await page.screenshot({path:path.join(output,'settings.png')});
  await page.locator('.settings-nav button').filter({hasText:/^扩展$/}).click();
  const row = page.locator('[data-package-row="Unreal Canvas 简体中文"]');
  const toggle = row.getByRole('switch');
  await toggle.click();
  await page.locator('.merlin-app-bar button[aria-label="Settings"]').waitFor();
  const englishTabNames=await page.locator('.merlin-canvas-tab-close').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label')));
  assert.deepEqual(englishTabNames,tabNames.map(text=>'Close '+text.slice(3)));
  report.checks.push('disable restores original settings control');
  await toggle.click();
  await page.locator('.merlin-app-bar button[aria-label="设置"]').waitFor();
  if (report.package.rootKind === 'bundled') await row.getByText('随包安装', {exact:true}).waitFor();
  report.checks.push('enable restores Chinese');
  for (let i=0;i<2;i++) {
    const before = loads;
    await row.getByRole('button',{name:'重新加载',exact:true}).click();
    for(let n=0;n<30 && loads===before;n++) await page.waitForTimeout(100);
    assert.equal(loads,before+1,'Each Reload should load the plugin once');
    await page.locator('.merlin-app-bar button[aria-label="设置"]').waitFor();
    if (report.package.rootKind === 'bundled') await row.getByText('随包安装', {exact:true}).waitFor();
  }
  report.checks.push('two consecutive Reload actions succeeded');
  await page.keyboard.press('Escape');
  const prompt = page.getByTestId('generation-shelf-prompt');
  const originalPrompt = await prompt.innerText();
  const ime = await page.context().newCDPSession(page);
  try {
    await prompt.fill('Generate ');
    await prompt.press('End');
    await prompt.evaluate(element => {
      const events = [];
      element.dataset.qaImeEvents = '[]';
      const record = event => {
        events.push(event.type);
        element.dataset.qaImeEvents = JSON.stringify(events);
        if (event.type === 'compositionend') {
          for (const name of ['compositionstart', 'compositionupdate', 'compositionend']) {
            element.removeEventListener(name, record);
          }
        }
      };
      for (const name of ['compositionstart', 'compositionupdate', 'compositionend']) {
        element.addEventListener(name, record);
      }
    });
    await ime.send('Input.imeSetComposition', {text:'zhongwen',selectionStart:8,selectionEnd:8});
    await ime.send('Input.imeSetComposition', {text:'中文',selectionStart:2,selectionEnd:2});
    await ime.send('Input.insertText', {text:'中文测试'});
    const events = JSON.parse(await prompt.getAttribute('data-qa-ime-events'));
    for (const name of ['compositionstart','compositionupdate','compositionend']) assert.ok(events.includes(name));
    assert.equal((await prompt.innerText()).replaceAll('\u00a0',' '),'Generate 中文测试');
    await page.screenshot({path:path.join(output,'prompt.png')});
    report.checks.push('Chromium composition start, updates and commit preserve mixed prompt text');
  } finally {
    await prompt.evaluate(element => { delete element.dataset.qaImeEvents; });
    await prompt.fill(originalPrompt);
    await ime.detach();
  }
  for (const name of ['资源库','工具箱','检查器','操作记录','智能体']) {
    const button = page.locator('.merlin-content-modes button[aria-label="'+name+'"]');
    await button.click();
    await page.waitForTimeout(150);
    if (!await page.locator('.merlin-rail-body').isVisible()) await button.click();
    if (name==='资源库') await page.locator('.media-library').waitFor();
    if (name==='工具箱') await page.locator('.merlin-panel-search').getByPlaceholder('搜索工具箱').waitFor();
    report.pages[name] = await page.locator('.merlin-rail-body').innerText();
  }
  const pane = page.locator('.react-flow__pane').first();
  await pane.click({button:'right',position:{x:220,y:140}});
  report.menu = await page.getByRole('menu').innerText();
  assert.match(report.menu,/创建/);
  assert.match(report.menu,/导入文件/);
  await page.screenshot({path:path.join(output,'menu.png')});
  await page.keyboard.press('Escape');
  report.checks.push('all five panels and dynamic canvas menu open normally');
  report.appBar = await page.locator('.merlin-app-bar button').evaluateAll(elements=>elements.map(element=>({text:element.textContent,title:element.title,aria:element.getAttribute('aria-label')})));
  assert.deepEqual(report.errors,[]);
  report.passed = true;
} catch(error) {
  report.passed = false;
  report.failure = String(error);
  throw error;
} finally {
  report.finished = new Date().toISOString();
  await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
  await browser.close();
  console.log(JSON.stringify({passed:report.passed,checks:report.checks,errors:report.errors,failure:report.failure,output},null,2));
}
