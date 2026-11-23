// Closes this private context at the end. Any edit or socket writes during exploration are intercepted locally.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';

const host = new URL(process.argv[2] || 'http://localhost:10678');
assert.ok(['localhost','127.0.0.1'].includes(host.hostname));
const candidate = process.argv[3] ? await readFile(process.argv[3], 'utf8') : undefined;
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});
const page = await browser.newPage({viewport:{width:1680,height:1000}});
page.setDefaultTimeout(6500);
const blocked = new Set();
const checks = [];
let inspecting = false;
try {
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (candidate && url.pathname === '/api/plugins/frontend/unreal-canvas-zh-cn/index.js')
      return route.fulfill({contentType:'text/javascript',body:candidate});
    if (inspecting && !['GET','HEAD','OPTIONS'].includes(request.method()) &&
        !/\/(?:readText|readBytes|list|stat|inspect|hierarchy)$/.test(url.pathname)) {
      blocked.add(url.pathname);
      return route.fulfill({json:{}});
    }
    return route.continue();
  });
  await page.routeWebSocket('**/*', socket => {
    const upstream = socket.connectToServer();
    socket.onMessage(message => { if (!inspecting) upstream.send(message); });
    upstream.onMessage(message => socket.send(message));
  });
  await page.goto(host.href);
  await page.locator('.merlin-app-bar button[aria-label="设置"]').waitFor();
  await page.waitForTimeout(250);
  inspecting = true;
  async function panel(name, selector) {
    const target = page.locator(selector).first();
    for (let attempt=0; attempt<3 && !await target.isVisible(); attempt++) {
      await page.locator('.merlin-content-modes button').and(page.getByRole('button',{name,exact:true})).click();
      await target.waitFor({timeout:550}).catch(()=>{});
    }
    await target.waitFor();
  }
  await panel('智能体','.agent-welcome,.agent-onboarding,.agent-detail-shell');
  if (await page.locator('.agent-welcome-primary').isVisible()) {
    await page.locator('.agent-welcome-primary').click();
    await page.getByText('Codex',{exact:true}).last().click();
    await page.locator('.agent-onboarding summary').filter({hasText:'高级'}).click();
    await page.locator('.agent-onboarding details > p').filter({hasText:/完整的 Codex 配置/}).waitFor();
    await page.locator('button.agent-onboarding-select').click();
    await page.getByRole('option',{name:'空白上下文'}).waitFor();
    await page.keyboard.press('Escape');
    await page.locator('.agent-onboarding button').filter({hasText:/安装步骤|登录步骤/}).click();
    await page.locator('.agent-onboarding-guidance button').filter({hasText:'打开设置指南'}).waitFor();
    await page.locator('.agent-onboarding-progress button').last().click();
    checks.push('智能体的高级上下文、提供商说明和登录/安装指南');
  }
  await panel('资源库','.media-library');
  await page.locator('.media-library-filter-trigger').click();
  await page.locator('.ue-menu-item').filter({hasText:'自定义筛选…'}).click();
  const custom = page.getByRole('dialog',{name:'自定义筛选',exact:true});
  await custom.getByRole('combobox').filter({hasText:'添加字段'}).click();
  const fields = page.getByRole('listbox').last();
  await fields.getByRole('option',{name:'运行耗时',exact:true}).waitFor();
  await fields.getByRole('option',{name:'负面提示词',exact:true}).waitFor();
  await fields.locator('[data-value="name"]').click();
  const query = custom.getByPlaceholder('包含…',{exact:true});
  await query.fill('Save');
  assert.equal(await query.inputValue(),'Save');
  await custom.getByRole('button',{name:'移除第 1 个条件'}).waitFor();
  await custom.locator('button').filter({hasText:'✕'}).first().click();
  await page.keyboard.press('Escape');
  checks.push('自定义筛选字段、运行耗时、负面提示词和用户输入');
  if (!await page.locator('.outliner-body').isVisible()) {
    await page.locator('.media-library button').and(page.getByRole('button',{name:/^列表视图$|^列表$/})).click();
  }
  await page.locator('.outliner-header-cell[title="按模型排序"]').waitFor();
  await page.locator('.merlin-navigator-tree-actions button[aria-label="树视图选项"]').click();
  const tree = page.locator('.merlin-panel-settings-menu');
  await tree.getByText('全部展开',{exact:true}).waitFor();
  await tree.getByText('全部折叠',{exact:true}).waitFor();
  await page.keyboard.press('Escape');
  checks.push('资源树表头与树视图的二级选项');

  await panel('工具箱','.merlin-scripts');
  await page.locator('.media-library-filter-trigger').click();
  await page.getByRole('button',{name:'按位置筛选'}).hover();
  await page.getByText('团队资源库',{exact:true}).waitFor();
  await page.getByText('我的脚本',{exact:true}).waitFor();
  await page.keyboard.press('Escape');
  const entry = page.locator('.merlin-scripts-row,.merlin-scripts-tile').filter({hasText:'Modify Viewport (Spatial)'});
  await entry.click();
  const lock = page.locator('.merlin-script-side-locked');
  await lock.getByText(/此节点图为内置模板/).waitFor();
  const prompt = page.locator('input.merlin-script-form-name[aria-label="Prompt的名称"]');
  assert.equal(await prompt.inputValue(),'Prompt');
  const promptType = page.locator('.merlin-script-form-row button[aria-label="Prompt的类型"]');
  await promptType.locator('span[aria-hidden="false"]').filter({hasText:/^文本$/}).waitFor();
  await page.locator('.merlin-script-form-dot').and(page.getByRole('button',{name:'点击定位“Prompt”，拖动可放置另一个关联图块'})).waitFor();
  await page.locator('.merlin-script-form-star[aria-label="image是主要输出"]').waitFor();
  assert.equal(await page.locator('.merlin-script-heading-name').textContent(),'Modify Viewport (Spatial)');
  checks.push('内置脚本详情、原始接口和脚本名、类型与定位按钮、主要输出');
  console.log(JSON.stringify({host:host.origin,mode:candidate?'preview':'installed',checks,blockedWrites:[...blocked]},null,2));
} finally {
  await browser.close();
}