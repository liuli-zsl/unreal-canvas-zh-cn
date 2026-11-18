// Use the dedicated QA canvas. Pass --save to exercise Save Canvas and read it back.
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const url=new URL(process.argv[2] ?? 'http://localhost:4332');
assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
const args = process.argv.slice(3);
const output = path.resolve(args.find(arg => !arg.startsWith('--')) ?? 'verification');
const save = args.includes('--save');
const fixtureName = '汉化插件回归验证';
const fixtureText = 'Generate 中文测试 Settings Save';
await fs.mkdir(output, {recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1600,height:1000}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url.href);
  await page.locator('.merlin-app-bar button[aria-label="设置"]').waitFor();
  const tab = page.locator('.merlin-canvas-tab').filter({has:page.getByText(fixtureName, {exact:true})});
  await tab.click();
  const card = page.locator('.react-flow__node[data-id]')
    .filter({has:page.locator('.canvas-card-header', {hasText:/^Settings$/})})
    .filter({hasText:fixtureText});
  await card.waitFor();
  const name=card.locator('.canvas-card-header');
  const text=card.locator('[data-merlin-text-surface]');
  assert.equal((await name.innerText()).trim(),'Settings');
  assert.equal(await text.innerText(),fixtureText);
  const id = await card.getAttribute('data-id');
  let savedAndReopened = false;
  if (save) {
    await page.locator('.merlin-app-bar button[aria-label="保存"]').click();
    const saved = page.waitForResponse(response => {
      const request = response.request();
      if (request.method() !== 'POST' || response.url() !== new URL('/api/fs/writeText', url).href) return false;
      const data = request.postDataJSON()?.data;
      return typeof data === 'string' && data.includes(id) && data.includes(fixtureText);
    });
    await page.getByRole('menu').getByText('保存画布', {exact:true}).click();
    assert.ok((await saved).ok(), 'Canvas must acknowledge the fixture write');
    await page.reload();
    await page.locator('.merlin-app-bar button[aria-label="设置"]').waitFor();
    await tab.click();
    await card.waitFor();
    assert.equal(await card.getAttribute('data-id'), id);
    assert.equal((await name.innerText()).trim(), 'Settings');
    assert.equal(await text.innerText(), fixtureText);
    savedAndReopened = true;
  }
  const menus=[];
  for(let i=0;i<2;i++) {
    await name.click({button:'right'});
    const menu=page.getByRole('menu');
    await menu.waitFor();
    const content=await menu.innerText();
    assert.match(content,/编辑/);
    assert.match(content,/添加评论/);
    menus.push(content);
    await page.keyboard.press('Escape');
  }
  await card.click();
  const inspector=page.locator('.merlin-content-modes button[aria-label="检查器"]');
  await inspector.click();
  if(!await page.locator('.merlin-rail-body').isVisible()) await inspector.click();
  await page.waitForTimeout(200);
  const details=await page.locator('.merlin-rail-body').innerText();
  assert.match(details,/详细信息/);
  assert.match(details,/卡片类型/);
  const valueHints=await page.locator('.merlin-inspector-panel span[title]').evaluateAll(es=>es.map(e=>e.getAttribute('title')));
  assert.ok(valueHints.length>0 && valueHints.every(text=>text.endsWith('（右键复制）')));
  const sections={details};
  for(const tab of ['metadata','history']) {
    await page.locator('.merlin-inspector-tabs [data-tab="'+tab+'"]').click();
    sections[tab]=await page.locator('.merlin-rail-body').innerText();
  }
  assert.match(sections.metadata,/评分/);
  assert.match(sections.metadata,/备注/);
  assert.match(sections.metadata,/评论历史/);
  await page.locator('.merlin-inspector-tabs [data-tab="metadata"]').click();
  assert.equal((await name.innerText()).trim(),'Settings');
  assert.equal(await text.innerText(),fixtureText);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(output,'card-menu-inspector.png')});
  const report = {passed:true,url:url.origin,date:new Date().toISOString(),savedAndReopened,id,cardName:'Settings',text:fixtureText,menus,sections,errors};
  await fs.writeFile(path.join(output,'card-menu.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({passed:true,savedAndReopened,errors,output}));
} finally {await browser.close();}
