import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
await build({entryPoints:['src/translate.ts'],outfile:'.test-build/legacy-translate.mjs',format:'esm',bundle:true,platform:'node'});
const {localize}=await import('../.test-build/legacy-translate.mjs');
await build({entryPoints:['src/dictionary.ts'],outfile:'.test-build/legacy-dictionary.mjs',format:'esm',bundle:true,platform:'node'});
const {dictionary}=await import('../.test-build/legacy-dictionary.mjs');
const tick=()=>new Promise(r=>setTimeout(r,15));
test('bundled badge stays translated when a transient status follows it during reload', async () => {
  const {dom, d, stop} = setup('<div data-package-row="My Plugin"><button aria-expanded="false"><span>My Plugin</span><span>included</span><span>Loading…</span></button></div>');
  const [, badge, status] = d.querySelectorAll('span');
  assert.equal(badge.textContent, '随包安装');
  status.remove();
  await tick();
  assert.equal(badge.textContent, '随包安装');
  stop();
  assert.equal(badge.textContent, 'included');
  dom.window.close();
});
function setup(html){const dom=new JSDOM(html);const d=dom.window.document;return {dom,d,stop:localize(d,dictionary)};}
test('controls translate without changing user content or event nodes',()=>{
 const {dom,d,stop}=setup('<div class="merlin-app-bar"><button aria-label="Settings">icon</button></div><div class="settings-window-body"><button>Save</button><textarea placeholder="Describe what you want to create…">Generate 中文测试</textarea><input value="Settings"><div contenteditable="true">Save</div><code>Save</code></div><div class="canvas-card-header">Settings</div><div class="agent-chat-message">Save</div>');
 assert.equal(d.querySelector('button').getAttribute('aria-label'),'设置');
 assert.equal(d.querySelector('textarea').value,'Generate 中文测试');
 assert.equal(d.querySelector('textarea').placeholder,'描述想要生成的内容…');
 assert.equal(d.querySelector('input').value,'Settings');
 assert.equal(d.querySelector('[contenteditable]').textContent,'Save');
 assert.equal(d.querySelector('.canvas-card-header').textContent,'Settings');
 assert.equal(d.querySelector('.agent-chat-message').textContent,'Save');
 const button=d.querySelector('.settings-window-body button');let n=0;button.addEventListener('click',()=>n++);button.click();assert.equal(n,1);
 stop();assert.equal(button.textContent,'Save');dom.window.close();
});
test('portal menus, delayed labels, React re-render, restored attributes',async()=>{
 const {dom,d,stop}=setup('<div class="settings-window-body"><button>Save</button></div>');
 const btn=d.querySelector('button');const text=btn.firstChild;text.nodeValue='Cancel';await tick();assert.equal(btn.textContent,'取消');assert.equal(btn.firstChild,text);
 const menu=d.createElement('div');menu.innerHTML='<button role="menuitem">Paste</button>';d.body.append(menu);await tick();assert.equal(menu.textContent,'粘贴');
 btn.title='Reset to default';await tick();assert.equal(btn.title,'恢复默认');
 btn.removeAttribute('title');await tick();assert.equal(btn.hasAttribute('title'),false);
 stop();assert.equal(menu.textContent,'Paste');assert.equal(btn.textContent,'Cancel');dom.window.close();
});
test('canvas toolbar hover descriptions translate and rebound shortcuts are preserved', async () => {
  const description = 'Draw shapes and marks over the canvas and cards';
  const { dom, d, stop } = setup(`
    <div class="canvas-tool-palette"><button data-app-tooltip aria-label="Annotate" aria-description="${description}"></button></div>
    <div role="tooltip" data-portal-popup><div><div><div id="title">Annotate (Ctrl+D)</div><div id="detail">${description}</div></div></div></div>
    <div role="tooltip" data-portal-popup><div><div><div id="other">Annotate (Ctrl+D)</div><div>Custom operation</div></div></div></div>`);
  const button = d.querySelector('button');
  const title = d.getElementById('title');
  const detail = d.getElementById('detail');
  assert.equal(title.textContent, '批注 (Ctrl+D)');
  assert.equal(detail.textContent, '在画布和卡片上绘制形状与标记');
  assert.equal(button.getAttribute('aria-description'), detail.textContent);
  assert.equal(d.getElementById('other').textContent, 'Annotate (Ctrl+D)');
  title.firstChild.nodeValue = 'Annotate (Shift+D)';
  await tick();
  assert.equal(title.textContent, '批注 (Shift+D)');
  stop();
  assert.equal(title.textContent, 'Annotate (Shift+D)');
  assert.equal(button.getAttribute('aria-description'), description);
  assert.equal(detail.textContent, description);
  dom.window.close();
});
test('host tooltip data attributes translate after mount and restore their latest source text', async () => {
  const dom = new JSDOM('<button id="scoped" data-title-tip="Save">x</button><button id="other" data-title-tip="Save">y</button>');
  const {document} = dom.window;
  const scoped = document.getElementById('scoped');
  const stop = localize(document, [{selector:'#scoped', fields:['data-title-tip'], entries:{Save:'保存', Cancel:'取消'}}]);
  assert.equal(scoped.getAttribute('data-title-tip'), '保存');
  assert.equal(document.getElementById('other').getAttribute('data-title-tip'), 'Save');
  scoped.setAttribute('data-title-tip','Cancel');
  await tick();
  assert.equal(scoped.getAttribute('data-title-tip'), '取消');
  stop();
  assert.equal(scoped.getAttribute('data-title-tip'), 'Cancel');
  dom.window.close();
});
test('shelf collaborator menu translates its actions and preserves matching agent names', () => {
  const {dom, d, stop} = setup(`
    <div class="generation-shelf-menu" role="menu" aria-label="Agent">
      <div style="display: contents">
        <div class="generation-shelf-menu-row">
          <button class="generation-shelf-menu-option" role="menuitemradio" aria-label="Work on my own">
            <span class="ue-menu-label generation-shelf-menu-copy"><span id="alone">Work on my own</span></span>
          </button>
        </div>
      </div>
      <div class="generation-shelf-menu-row">
        <button class="generation-shelf-menu-option" role="menuitemradio" aria-label="Working with Image">
          <span class="ue-menu-label generation-shelf-menu-copy"><span id="current">Image</span></span>
        </button>
        <div class="generation-shelf-menu" role="menu" aria-label="Image">
          <div class="generation-shelf-menu-row">
            <button class="generation-shelf-menu-option" role="menuitemradio" aria-label="Work with Work on my own">
              <span class="ue-menu-label generation-shelf-menu-copy"><span id="named-agent">Work on my own</span></span>
            </button>
          </div>
          <div class="generation-shelf-menu-row">
            <button class="generation-shelf-menu-option" role="menuitem" aria-label="New agent">
              <span class="ue-menu-label generation-shelf-menu-copy"><span id="new-agent">+ New agent</span></span>
            </button>
          </div>
          <div class="generation-shelf-menu-row">
            <button class="generation-shelf-menu-option" role="menuitem" aria-label="Reopen agent">
              <span class="ue-menu-label generation-shelf-menu-copy"><span id="reopen">Reopen agent…</span></span>
            </button>
          </div>
        </div>
      </div>
    </div>`);
  const label = id => d.getElementById(id).textContent;
  assert.equal(label('alone'), '独立工作');
  assert.equal(label('current'), 'Image');
  assert.equal(label('named-agent'), 'Work on my own');
  assert.equal(label('new-agent'), '+ 新建智能体');
  assert.equal(label('reopen'), '重新打开智能体…');
  const reopen = d.getElementById('reopen').closest('button');
  assert.equal(reopen.getAttribute('aria-label'), '重新打开智能体');
  stop();
  assert.equal(label('alone'), 'Work on my own');
  assert.equal(label('new-agent'), '+ New agent');
  assert.equal(label('reopen'), 'Reopen agent…');
  assert.equal(reopen.getAttribute('aria-label'), 'Reopen agent');
  dom.window.close();
});
test('stop does not overwrite changed text; moved nodes and repeated loads recover',async()=>{
 const {dom,d,stop}=setup('<div class="settings-window-body"><button>Save</button></div>');
 const btn=d.querySelector('button');d.body.append(btn);await tick();assert.equal(btn.textContent,'Save');
 d.querySelector('.settings-window-body').append(btn);await tick();assert.equal(btn.textContent,'保存');
 stop();assert.equal(btn.textContent,'Save');
 for(let i=0;i<3;i++){const end=localize(d,dictionary);assert.equal(btn.textContent,'保存');end();assert.equal(btn.textContent,'Save');}
 const end=localize(d,dictionary);btn.firstChild.nodeValue='User new name';end();assert.equal(btn.textContent,'User new name');dom.window.close();
});

test('viewport script labels require verified built-in identities, including in collapsed folders', async () => {
  const dom = new JSDOM(`
    <div class="generation-shelf-workflow-menu">
      <div class="generation-shelf-workflow-folder" role="group" aria-label="Viewport">
        <button class="generation-shelf-workflow-folder-name" aria-expanded="false"><span class="ue-menu-label">Viewport</span></button>
      </div>
    </div>`);
  const d = dom.window.document;
  const group = d.querySelector('[role="group"]');
  const builtin = {
    id: 'a104f84a-29f0-44e6-9c20-c75c25a1d69c',
    name: 'Viewport Snapshot',
    params: {category:'Viewport', builtinGraph:true},
  };
  const custom = {...builtin, id:'user-script', params:{category:'Viewport'}};
  const owner = {memoizedProps:{scripts:[builtin]}};
  const property = '__reactFiber$viewportTest';
  group[property] = {key:'folder:Viewport', return:owner};
  const stop = localize(d, dictionary);
  assert.equal(group.getAttribute('aria-label'), '视口');
  assert.equal(group.querySelector('span').textContent, '视口');
  const createRow = script => {
    const row = d.createElement('button');
    row.setAttribute('role', 'menuitemradio');
    row.innerHTML = '<span class="ue-menu-label">Viewport Snapshot</span>';
    if (script) row[property] = {key:script.id, return:owner};
    group.append(row);
    return row;
  };
  owner.memoizedProps.scripts = [builtin, custom];
  const builtinRow = createRow(builtin);
  const customRow = createRow(custom);
  const unknownRow = createRow();
  await tick();
  assert.equal(group.getAttribute('aria-label'), 'Viewport');
  assert.equal(group.querySelector('span').textContent, 'Viewport');
  assert.equal(builtinRow.textContent, '视口快照');
  assert.equal(customRow.textContent, 'Viewport Snapshot');
  assert.equal(unknownRow.textContent, 'Viewport Snapshot');
  stop();
  assert.equal(builtinRow.textContent, 'Viewport Snapshot');
  dom.window.close();
});

test('model picker translates the browse action and retains a matching model name', () => {
  const dom = new JSDOM('<div class="ue-menu"><div role="listbox"><div class="ue-menu-item" role="option"><span>Browse models…</span></div><div class="ue-menu-item" role="option" data-value="test-model"><span>Browse models…</span></div></div></div>');
  const d = dom.window.document;
  const [action, model] = d.querySelectorAll('[role="option"]');
  const actionValue = String.fromCharCode(0) + 'footer-action-0';
  action.setAttribute('data-value', actionValue);
  const stop = localize(d, dictionary);
  assert.equal(action.textContent, '浏览模型…');
  assert.equal(action.getAttribute('data-value'), actionValue);
  assert.equal(model.textContent, 'Browse models…');
  stop();
  assert.equal(action.textContent, 'Browse models…');
  dom.window.close();
});
test('credential status translates template while preserving provider and model IDs',()=>{
 const {dom,d,stop}=setup('<div class="merlin-generation-shelf"><span>Model \'Example\' has no confirmed credentials. Sign in or configure example-key in Settings, then retry.</span></div>');
 assert.match(d.querySelector('span').textContent,/模型“Example”.*example-key/);stop();assert.match(d.querySelector('span').textContent,/^Model/);dom.window.close();
});

test('editable prompt labels translate while composing text and package/model names remain intact', async () => {
 const {dom,d,stop}=setup('<div class="settings-window-body"><div data-package-row="Save"><button role="switch" aria-label="Save"></button><span>Save</span></div><div><span data-testid="provider-icon" title="Save">S</span>Save</div></div><div class="generation-shelf-prompt-row"><div><div data-testid="generation-shelf-prompt" contenteditable="true" role="textbox" aria-label="Prompt"></div><div>Describe what you want to create…</div></div></div><div class="merlin-panel-chip-count">4 tools</div><span class="merlin-scripts-row-name">Settings</span>');
 const prompt=d.querySelector('[contenteditable]');
 assert.equal(prompt.getAttribute('aria-label'),'提示词');
 assert.equal(prompt.nextElementSibling.textContent,'描述想要生成的内容…');
 assert.equal(d.querySelector('[data-package-row] span').textContent,'Save');
 assert.equal(d.querySelector('[role="switch"]').getAttribute('aria-label'),'Save');
 assert.equal(d.querySelector('[data-testid="provider-icon"]').parentElement.textContent,'SSave');
 assert.equal(d.querySelector('.merlin-scripts-row-name').textContent,'Settings');
 assert.equal(d.querySelector('.merlin-panel-chip-count').textContent,'4 个工具');
 prompt.dispatchEvent(new dom.window.CompositionEvent('compositionstart'));
 prompt.textContent='Generate 中文测试';
 await tick();
 prompt.dispatchEvent(new dom.window.CompositionEvent('compositionend'));
 assert.equal(prompt.textContent,'Generate 中文测试');
 stop();
 assert.equal(prompt.getAttribute('aria-label'),'Prompt');
 assert.equal(prompt.textContent,'Generate 中文测试');
 dom.window.close();
});

test('reload lifecycle leaves one observer and read-only user text is protected', () => {
 const dom=new JSDOM('<div class="settings-window-body"><button>Save</button><div data-merlin-text-surface>Save</div><span translate="no">Save</span></div>');
 const NativeObserver=dom.window.MutationObserver;
 let active=0;
 dom.window.MutationObserver=class extends NativeObserver {
   observe(...args){super.observe(...args);active++;}
   disconnect(){super.disconnect();active--;}
 };
 for(let i=0;i<3;i++) {
   const stop=localize(dom.window.document,dictionary);
   assert.equal(active,1);
   assert.equal(dom.window.document.querySelector('[data-merlin-text-surface]').textContent,'Save');
   assert.equal(dom.window.document.querySelector('[translate="no"]').textContent,'Save');
   stop();
   assert.equal(active,0);
 }
 dom.window.close();
});

test('changing a translated control into editable content restores its original first', async () => {
 const {dom,d,stop}=setup('<div class="settings-window-body"><div class="label">Save</div></div>');
 const label=d.querySelector('.label');
 assert.equal(label.textContent,'保存');
 label.setAttribute('contenteditable','true');
 await tick();
 assert.equal(label.textContent,'Save');
 label.textContent='Generate 中文测试';
 await tick();
 assert.equal(label.textContent,'Generate 中文测试');
 stop();
 dom.window.close();
});

test('inspector translates field labels but preserves matching metadata values', () => {
 const {dom,d,stop}=setup('<div class="merlin-inspector-tabs"><button>Details</button></div><div class="merlin-inspector-panel"><button class="merlin-field-group-header">General</button><span style="font-size:var(--field-label-size)">Name</span><span title="Name">Name</span><input value="Settings"><textarea>Notes</textarea></div>');
 assert.equal(d.querySelector('.merlin-inspector-tabs button').textContent,'详细信息');
 assert.equal(d.querySelector('.merlin-field-group-header').textContent,'常规');
 assert.equal(d.querySelector('span[style]').textContent,'名称');
 assert.equal(d.querySelector('span[title]').textContent,'Name');
 assert.equal(d.querySelector('input').value,'Settings');
 assert.equal(d.querySelector('textarea').value,'Notes');
 stop();
 assert.equal(d.querySelector('span[style]').textContent,'Name');
 dom.window.close();
});

test('dynamic control hints keep canvas names and metadata values unchanged and restore on stop', async () => {
 const {dom,d,stop}=setup('<div class="merlin-canvas-tab"><span>Settings</span><button class="merlin-canvas-tab-close" aria-label="Close Settings" title="Close Settings">×</button></div><div class="merlin-inspector-panel"><span title="Settings\n\n(right-click to copy)">Settings</span></div><button title="Close Settings">unrelated</button><div translate="no"><div class="merlin-canvas-tab"><button class="merlin-canvas-tab-close" title="Close Settings">×</button></div></div>');
 const close=d.querySelector('.merlin-canvas-tab-close');
 const value=d.querySelector('.merlin-inspector-panel span');
 assert.equal(close.getAttribute('aria-label'),'关闭 Settings');
 assert.equal(close.title,'关闭 Settings');
 assert.equal(d.querySelector('.merlin-canvas-tab span').textContent,'Settings');
 assert.equal(value.textContent,'Settings');
 assert.equal(value.title,'Settings\n\n（右键复制）');
 assert.equal(d.querySelector('body > button').title,'Close Settings');
 assert.equal(d.querySelector('[translate="no"] button').title,'Close Settings');
 close.setAttribute('aria-label','Close 中文画布 Save');
 await tick();
 assert.equal(close.getAttribute('aria-label'),'关闭 中文画布 Save');
 stop();
 assert.equal(close.getAttribute('aria-label'),'Close 中文画布 Save');
 assert.equal(value.title,'Settings\n\n(right-click to copy)');
 dom.window.close();
});

test('script chooser translates its direct action and preserves colliding user names and queries', async () => {
  const {dom, d, stop} = setup('<div class="ue-menu generation-shelf-workflow-menu" role="menu" aria-label="Video scripts"><input placeholder="Search scripts"><button role="menuitemradio"><span class="ue-menu-label">Generate Video</span></button><button role="menuitemradio"><span class="ue-menu-label">Generate Video</span></button><div class="generation-shelf-workflow-folder"><button role="menuitem"><span class="ue-menu-label">Save</span></button></div><div class="ue-menu-note" role="status"></div></div>');
  const menu = d.querySelector('[role="menu"]');
  assert.equal(menu.getAttribute('aria-label'), '视频脚本');
  assert.deepEqual([...menu.querySelectorAll('.ue-menu-label')].map(e=>e.textContent), ['生成视频', 'Generate Video', 'Save']);
  const status = menu.querySelector('[role="status"]');
  status.append('No scripts match "', 'Save', '".');
  await tick();
  assert.equal(status.textContent, '找不到与“Save”匹配的脚本。');
  stop();
  assert.equal(menu.getAttribute('aria-label'), 'Video scripts');
  assert.equal(status.textContent, 'No scripts match "Save".');
  dom.window.close();
});

test('card footer localizes system field values and preserves identically named user text', () => {
  const {dom, d, stop} = setup('<div class="canvas-card-footer"><span data-field="sys:cardType">Tool (Text)</span><span data-field="sys:childCount" title="Contents 0 cards">0 cards</span><span data-field="sys:runStatus">Running</span><span data-field="rating" title="Rating"></span><span data-field="custom">Tool (Text)</span></div><div class="merlin-canvas-tab"><span title="Save — Double-click to rename">Save</span></div>');
  const [kind, count, status, rating, custom] = d.querySelectorAll('[data-field]');
  assert.equal(kind.textContent, '工具（文本）');
  assert.equal(count.textContent, '0 张卡片');
  assert.equal(count.title, '内容：0 张卡片');
  assert.equal(status.textContent, '运行中');
  assert.equal(rating.title, '评分');
  assert.equal(custom.textContent, 'Tool (Text)');
  const tab = d.querySelector('.merlin-canvas-tab > span');
  assert.equal(tab.textContent, 'Save');
  assert.equal(tab.title, 'Save — 双击重命名');
  stop();
  assert.equal(tab.title, 'Save — Double-click to rename');
  assert.equal(count.title, 'Contents 0 cards');
  dom.window.close();
});

test('model parameters translate inside the generation shelf while script-defined fields keep their labels', () => {
  const {dom, d, stop} = setup('<div class="merlin-generation-shelf"><div class="generation-shelf-fields"><div class="merlin-param-row"><span class="merlin-param-label" title="Sample Rate">Sample Rate</span><input aria-label="Sample Rate" value="48000"></div></div><div class="generation-shelf-script"><div class="merlin-param-row"><span class="merlin-param-label">Sample Rate</span></div></div></div>');
  assert.equal(d.querySelector('.generation-shelf-fields span').textContent, '采样率');
  assert.equal(d.querySelector('input').getAttribute('aria-label'), '采样率');
  assert.equal(d.querySelector('input').value, '48000');
  assert.equal(d.querySelector('.generation-shelf-script span').textContent, 'Sample Rate');
  stop();
  assert.equal(d.querySelector('.generation-shelf-fields span').title, 'Sample Rate');
  dom.window.close();
});

test('timeline captions preserve clip counts and user titles when the card updates', async () => {
  const {dom, d, stop} = setup('<div class="canvas-timeline-card" title="Double-click to open Timeline"><div class="canvas-timeline-thumbnail"><img alt="Save first video frame"></div><div class="canvas-timeline-caption"><span>Empty Timeline</span><span>Double-click to open</span></div></div><div class="canvas-card-footer"><span data-field="sys:cardType">Tool (Timeline)</span><span data-field="sys:cardType">Action (Python)</span></div>');
  const caption = d.querySelector('.canvas-timeline-caption > span');
  assert.equal(caption.textContent, '空时间线');
  assert.equal(caption.nextElementSibling.textContent, '双击打开');
  assert.equal(d.querySelector('img').alt, 'Save 的视频首帧');
  assert.deepEqual([...d.querySelectorAll('[data-field]')].map(e=>e.textContent), ['工具（时间线）', '操作（Python）']);
  caption.firstChild.nodeValue = '2 clips · 12.5s';
  await tick();
  assert.equal(caption.textContent, '2 个片段 · 12.5 秒');
  stop();
  assert.equal(caption.textContent, '2 clips · 12.5s');
  assert.equal(d.querySelector('img').alt, 'Save first video frame');
  dom.window.close();
});



test('loading progress keeps the canvas name and updates the translated count', async () => {
  const {dom, d, stop} = setup('<div class="merlin-generation-host"><div><div><div><button title="Save — background results">Restoring results 4/32</button></div></div></div></div>');
  const button = d.querySelector('button');
  assert.equal(button.title, 'Save — 正在后台恢复结果');
  assert.equal(button.textContent, '正在后台恢复结果 4/32');
  button.firstChild.nodeValue = 'Restoring results 6/32';
  await tick();
  assert.equal(button.textContent, '正在后台恢复结果 6/32');
  stop();
  assert.equal(button.textContent, 'Restoring results 6/32');
  assert.equal(button.title, 'Save — background results');
  dom.window.close();
});

test('editor picker distinguishes connection actions from project names, level names and paths', async () => {
  const {dom, d, stop} = setup('<div class="unreal-editor-menu"><div class="ue-menu-heading">Running editors</div>'
    + '<div class="unreal-editor-menu-status-title">Save has Unreal Canvas Bridge: every Unreal node works.</div>'
    + '<button role="menuitemradio"><span class="ue-menu-label">Disconnect</span><span class="ue-menu-detail">Back</span></button>'
    + '<div class="unreal-editor-menu-row"><button title="D:/Save.uproject\nOpens with UE 5.9 (source), D:/UE"><span class="ue-menu-label">Start in the background</span><span class="ue-menu-count">UE 5.9 (source)</span></button></div>'
    + '<button role="menuitem"><span class="ue-menu-label">Disconnect</span></button></div>');
  const title = d.querySelector('.unreal-editor-menu-status-title');
  const selected = d.querySelector('[role=menuitemradio]');
  const recent = d.querySelector('.unreal-editor-menu-row button');
  const action = d.querySelector('[role=menuitem]');
  assert.equal(title.textContent, 'Save 已启用 Unreal Canvas Bridge，所有 Unreal 节点均可使用。');
  title.firstChild.nodeValue = 'Save has Unreal Canvas Bridge: every Unreal card works.';
  await tick();
  assert.equal(title.textContent, 'Save 已启用 Unreal Canvas Bridge，所有 Unreal 卡片均可使用。');
  assert.equal(selected.firstChild.textContent, 'Disconnect');
  assert.equal(selected.lastChild.textContent, 'Back');
  assert.equal(recent.firstChild.textContent, 'Start in the background');
  assert.equal(recent.lastChild.textContent, 'UE 5.9（源码版）');
  assert.match(recent.title, /^D:\/Save\.uproject\n使用 UE 5\.9（源码版）.*D:\/UE$/);
  assert.equal(action.textContent, '断开连接');
  title.firstChild.nodeValue = "Back doesn't have Unreal Canvas Bridge.";
  await tick();
  assert.equal(title.textContent, 'Back 未启用 Unreal Canvas Bridge。');
  stop();
  assert.equal(action.textContent, 'Disconnect');
  assert.equal(title.textContent, "Back doesn't have Unreal Canvas Bridge.");
  assert.equal(recent.title, 'D:/Save.uproject\nOpens with UE 5.9 (source), D:/UE');
  dom.window.close();
});
