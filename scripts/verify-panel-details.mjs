// Loads a synthetic conversation into an isolated browser using the server's read responses.
// The React components, navigation, menus and normal plugin loader come from the running host.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {chromium} from 'playwright-core';

const host = new URL(process.argv[2]);
assert.ok(['127.0.0.1','localhost'].includes(host.hostname));
const baseline = process.argv.includes('--baseline');
const bundle = process.argv.find(arg => arg.startsWith('--bundle='))?.slice(9);
const preview = process.argv.includes('--preview');
assert.ok(!preview || !bundle);
const js = bundle ? await readFile(bundle,'utf8') : preview ? (await build({
  entryPoints:['src/index.ts'], bundle:true, format:'esm', write:false,
  external:['@merlin/plugin-api'], charset:'utf8', target:'es2020',
})).outputFiles[0].text : undefined;
const tr = (en, zh) => baseline ? en : zh;
const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_EXE || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try {
  const context = await browser.newContext({viewport:{width:1680,height:1000},serviceWorkers:'block'});
  const page = await context.newPage();
  page.setDefaultTimeout(5500);
  let loads = 0;
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin !== host.origin) return route.abort();
    if (!['GET','HEAD','OPTIONS'].includes(req.method()) && !/\/api\/(fs\/(stat|readText|readBytes|list|readDir)|services\/executions\/list)$/.test(url.pathname))
      return route.fulfill({json:{}});
    if (url.pathname === '/api/plugins/frontend/unreal-canvas-zh-cn/index.js') {
      loads++;
      if (js) return route.fulfill({contentType:'text/javascript',body:js});
    }
    if (url.pathname === '/api/fs/readText') {
      const path = url.searchParams.get('path') || '';
      if (path.endsWith('merlin-settings.json')) {
        const response = await route.fetch();
        const settings = JSON.parse((await response.json()).data || '{}');
        return route.fulfill({json:{data:JSON.stringify({...settings,showAgentTaskActivityLists:true,shelfAgent:{backend:'api',models:{}}})}});
      }
      if (path.endsWith('merlin-shelf-chats.json')) {
        url.searchParams.set('path',path.replace(/merlin-shelf-chats\.json$/,'merlin-session.json'));
        const session = JSON.parse((await (await context.request.get(url.href)).json()).data);
        assert.ok(session.openTabIds?.length,'This fixture requires a saved tab in the local Canvas host');
        const id = 'panel-language-qa', canvasId = session.openTabIds[0];
        const chat = {id,canvasId,relatedCanvasIds:[session.activeCanvasId,...(session.canvasStack||[])],
          title:'Save',agentName:'Messages',backend:'api',setupComplete:true,
          session:{messages:[],events:[{role:'user',text:'Our task list'}]}};
        return route.fulfill({json:{data:JSON.stringify({chats:{[id]:chat},agentOrder:[id],activeChats:{[canvasId]:id},lastChats:{[canvasId]:id}})}});
      }
    }
    return route.continue();
  });
  // This fixture does not send collaboration messages or start an agent.
  await context.routeWebSocket('**/*', socket => {
    const upstream = socket.connectToServer();
    socket.onMessage(()=>{});
    upstream.onMessage(message=>socket.send(message));
  });
  await page.goto(host.href);
  await page.locator('.merlin-content-modes button').and(page.getByRole('button',{name:'智能体',exact:true})).click();
  const shell = page.locator('.agent-detail-shell');
  const check = async (selector, en, zh) => {
    await page.locator(selector).getByText(tr(en,zh),{exact:true}).first().waitFor();
  };
  await check('.agent-detail-tabs','Messages','消息');
  await check('.agent-chat-status','Setup required','需要配置');
  assert.equal(await shell.locator('.agent-detail-header h2').innerText(),'Messages');
  assert.equal(await shell.locator('.agent-chat-message-bubble').innerText(),'Our task list');
  await shell.locator('.mini-agent-chat-compose').getByText(tr('Message Messages…','发消息给 Messages…'),{exact:true}).waitFor();
  await shell.locator('.mini-agent-chat-skills').click();
  const skills = page.locator('.chat-skills');
  const query = skills.getByPlaceholder(tr('Search skills…','搜索技能…'),{exact:true});
  await query.fill('Save');
  assert.equal(await query.inputValue(),'Save');
  await skills.getByText(tr('No skills enabled for this prompt','此消息未选用技能。'),{exact:true}).waitFor();
  await query.fill('');
  await skills.locator('.chat-skills-expansion button.custom-select').click();
  await page.getByRole('option',{name:tr('Add automatically','自动添加'),exact:true}).waitFor();
  await page.keyboard.press('Escape');
  await skills.locator('.chat-skills-reset').filter({hasText:tr('Edit canvas skills','编辑画布技能')}).click();
  await skills.locator('.merlin-skill-attach-add').click();
  const picker = page.locator('.merlin-skill-picker');
  await picker.locator('input').fill('Messages');
  assert.equal(await picker.locator('input').inputValue(),'Messages');
  await picker.locator('.merlin-skill-picker-empty').waitFor();
  assert.equal(await picker.locator('.merlin-skill-picker-empty').innerText(),'找不到符合条件的技能。');
  await page.keyboard.press('Escape');
  await shell.locator('.agent-detail-tabs button').getByText(tr('Tasks','任务'),{exact:true}).click();
  await check('.agent-task-heading','Our task list','我们的任务列表');
  const title = shell.locator('.agent-task-title-input input');
  await title.fill('Messages');
  assert.equal(await title.inputValue(),'Messages');
  await check('.agent-task-filters','Messages’s tasks','Messages的任务');
  assert.equal(await shell.locator('.agent-assignee-picker').innerText(),'Messages');
  await check('.agent-task-empty','No tasks yet','暂无任务');
  await shell.locator('.agent-detail-tabs button').getByText(tr('Activity','活动'),{exact:true}).click();
  await check('.agent-activity-heading','Team activity','团队活动');
  await shell.locator('.agent-activity-diagnostics > summary').click();
  await check('.agent-activity-diagnostics','Sessions & diagnostics','会话与诊断');
  await shell.locator('.agent-nav-identity button').first().click({button:'right'});
  const menu = page.locator('.agent-action-menu');
  await menu.getByText(tr('Appearance…','外观…'),{exact:true}).click();
  await menu.getByRole('button',{name:tr('Cat appearance','猫外观'),exact:true}).waitFor();
  assert.equal(await menu.locator('.agent-action-colors button').first().getAttribute('title'),tr('Mint','薄荷绿'));
  assert.ok(loads > 0);
  console.log(JSON.stringify({host:host.origin,mode:baseline?'baseline':js?'preview':'installed',fixture:'browser-only chat and task controls',checks:['messages','skills menu and listbox','attach-skill picker','tasks and input','activity and diagnostics','avatar and color','unchanged user names and messages']}));
} finally {
  await browser.close();
}
