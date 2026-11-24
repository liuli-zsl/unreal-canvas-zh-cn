import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const compiled = await build({
  stdin: {
    contents: "export {localize} from './src/translate'; export {dictionary} from './src/dictionary';",
    resolveDir: process.cwd(),
  },
  write: false, bundle: true, format: 'esm', platform: 'node',
});
const { localize, dictionary } = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].contents).toString('base64'));
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('card request labels preserve agent names and summaries when they match a status', () => {
  const dom = new JSDOM(`<div class="node-agent-head-position">
    <button class="node-agent-head" data-agent-preview-trigger="qa"
      aria-label="Check in with QA · Ready to look at" aria-describedby="qa-info"></button><span id="qa-info" hidden></span>
  </div><div class="node-agent-head-position">
    <button class="node-agent-head" data-agent-preview-trigger="codex"
      aria-label="Check in with Codex · Ready to look at" aria-describedby="codex-info"><span class="node-agent-request-label">Ready to look at</span></button><span id="codex-info" hidden></span>
  </div>`);
  try {
    const doc = dom.window.document;
    doc.querySelector('#qa-info').append('QA · Ready to look at', ' ', 'Ready to look at');
    doc.querySelector('#codex-info').append('Check in with Codex', ' ', 'Ready to look at');
    const before = doc.body.innerHTML;
    const stop = localize(doc, dictionary);
    const [plain, request] = doc.querySelectorAll('button');
    assert.equal(plain.getAttribute('aria-label'), '查看智能体“QA · Ready to look at”的状态');
    assert.equal(request.getAttribute('aria-label'), 'Check in with Codex · 待查看');
    assert.equal(request.textContent, '待查看');
    assert.equal(doc.querySelector('#qa-info').textContent, 'QA · Ready to look at Ready to look at');
    stop();
    assert.equal(doc.body.innerHTML, before);
  } finally {
    dom.window.close();
  }
});

test('the connected welcome panel and disconnected chat expose their actions in Chinese', () => {
  const dom = new JSDOM(`<section>
    <div class="agent-welcome-actions"><button class="agent-welcome-primary" title="Start a chat" aria-label="Start a chat"><span class="new-agent-glyph" aria-hidden="true"></span>Start a chat</button><button>Manage connections</button></div>
    <p class="agent-welcome-start">Choose Start a chat to get started.</p>
    <header class="agent-detail-header"><div><h2>Reconnect</h2></div><div class="agent-detail-actions"><button>Reconnect</button><button>Resume task</button><button>View lead</button></div></header>
    <div class="agent-chat-message" data-role="user"><div class="agent-chat-message-bubble">Start a chat</div></div>
  </section>`);
  try {
    const doc = dom.window.document;
    const before = doc.body.innerHTML;
    const stop = localize(doc, dictionary);
    const start = doc.querySelector('.agent-welcome-primary');
    assert.equal(start.textContent, '开始对话');
    assert.equal(start.title, '开始对话');
    assert.equal(start.getAttribute('aria-label'), '开始对话');
    assert.equal(start.nextElementSibling.textContent, '管理连接');
    assert.equal(doc.querySelector('.agent-welcome-start').textContent, '选择「开始对话」以发送第一条消息。');
    assert.deepEqual([...doc.querySelectorAll('.agent-detail-actions > button')].map(btn => btn.textContent),
      ['重新连接', '继续任务', '查看负责人']);
    assert.equal(doc.querySelector('h2').textContent, 'Reconnect');
    assert.equal(doc.querySelector('.agent-chat-message-bubble').textContent, 'Start a chat');
    stop();
    assert.equal(doc.body.innerHTML, before);
  } finally {
    dom.window.close();
  }
});

test('the connected chat localizes status changes and fixed skill notices while preserving skill titles and free-form data', async () => {
  const originalNotice = 'Skills for this prompt: None. Skill selection: Suggest.';
  const dom = new JSDOM(`<div class="mini-agent-chat">
    <div class="agent-chat-status" data-tone="idle"><span class="agent-status"><span class="agent-status-dot"></span><span class="agent-status-text">Ready</span></span></div>
    <div class="generation-shelf-conversation" role="log">
      <div class="shelf-skills-notice" role="note">${originalNotice}</div>
      <div class="generation-shelf-activity-entry">Ready</div>
      <div class="agent-chat-message" data-role="user"><span class="agent-chat-message-author">You</span><div class="agent-chat-message-bubble">Ready</div></div>
      <div class="agent-chat-message" data-role="assistant"><span class="agent-chat-message-author">You</span><div class="agent-chat-message-bubble">${originalNotice}</div></div>
    </div>
    <form class="mini-agent-chat-compose"><div contenteditable="true">Working with local Codex</div></form>
  </div>`);
  try {
    const doc = dom.window.document;
    const get = selector => doc.querySelector(selector);
    const status = get('.agent-status-text');
    const note = get('.shelf-skills-notice');
    const user = get('[data-role=user]');
    const author = user.firstElementChild;
    const stop = localize(doc, dictionary);
    assert.equal(status.textContent, '就绪');
    assert.equal(note.textContent, '本次提示词使用的技能：无。技能选择：建议启用。');
    assert.equal(author.textContent, '你');
    assert.equal(get('[data-role=assistant] .agent-chat-message-author').textContent, 'You');
    assert.equal(get('[data-role=assistant] .agent-chat-message-bubble').textContent, originalNotice);
    assert.equal(get('[data-role=user] .agent-chat-message-bubble').textContent, 'Ready');
    assert.equal(get('.generation-shelf-activity-entry').textContent, 'Ready');
    assert.equal(get('[contenteditable]').textContent, 'Working with local Codex');

    const nextNotice = 'Skills for this prompt: Ready, Agent 1, paper.v2. Skill selection: Add automatically. Unavailable: my.other-skill.';
    status.firstChild.data = 'Working with local Codex';
    note.textContent = nextNotice;
    user.setAttribute('data-role', 'assistant');
    await tick();
    assert.equal(status.textContent, '本地 Codex 正在处理');
    assert.equal(note.textContent, '本次提示词使用的技能：Ready, Agent 1, paper.v2。技能选择：自动添加。不可用的技能：my.other-skill。');
    assert.equal(author.textContent, 'You');
    user.setAttribute('data-role', 'user');
    await tick();
    assert.equal(author.textContent, '你');

    stop();
    assert.equal(status.textContent, 'Working with local Codex');
    assert.equal(note.textContent, nextNotice);
    assert.equal(author.textContent, 'You');
  } finally {
    dom.window.close();
  }
});

test('role labels preserve recipient names and chat names that coincide with system labels', () => {
  const dom = new JSDOM(`<div class="mini-agent-chat">
    <div class="agent-chat-message" data-role="user"><span class="agent-chat-message-author">You → Agent 1 · Queued</span></div>
    <div class="agent-chat-message" data-role="user"><span class="agent-chat-message-author">You · Queued</span></div>
    <div class="agent-chat-message" data-role="assistant"><span class="agent-chat-message-author">Agent 1</span></div>
    <div class="shelf-skills-notice" role="note">Agent reported using: Ready, None.</div>
    <div class="shelf-skills-notice" role="note">Added skill: Suggest — My reason in English.</div>
  </div>`);
  try {
    const doc = dom.window.document;
    const before = doc.body.innerHTML;
    const stop = localize(doc, dictionary);
    assert.deepEqual([...doc.querySelectorAll('.agent-chat-message-author')].map(e => e.textContent),
      ['你 → Agent 1 · Queued', '你 · 已排队', 'Agent 1']);
    assert.deepEqual([...doc.querySelectorAll('.shelf-skills-notice')].map(e => e.textContent),
      ['智能体报告使用了以下技能：Ready, None。', '已添加技能：Suggest — My reason in English.']);
    stop();
    assert.equal(doc.body.innerHTML, before);
  } finally {
    dom.window.close();
  }
});
