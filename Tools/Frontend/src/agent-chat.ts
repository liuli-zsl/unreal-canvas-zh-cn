import { copyId } from './copy-id';
const statusText = new Map(Object.entries({
  'Ready': '就绪',
  'Closed · work retained': '已关闭 · 工作内容已保留',
  'Disconnected': '已断开连接',
  'Connecting': '正在连接',
  'Waiting for your approval': '等待你批准',
  'Needs your input': '需要你提供信息',
  'Working with local Codex': '本地 Codex 正在处理',
  'Working with local Claude Code': '本地 Claude Code 正在处理',
  'Waiting for model response': '正在等待模型回复',
  'Waiting for child reports': '正在等待子智能体反馈',
  'The reply reached the output limit; continuing': '回复已达到输出上限，正在继续',
  'Stopping after the current step': '当前步骤结束后停止',
  'Preparing context': '正在准备上下文',
  'Background work failed; telling the agent': '后台任务失败，正在通知智能体',
  'Waiting for a result': '正在等待结果',
  'Waiting for teammates': '正在等待队友',
  'Waiting for your team decision': '等待你确认是否组队',
  'Preparing team assignments': '正在分配团队任务',
  'Reading a file': '正在读取文件',
  'Editing files': '正在编辑文件',
  'Running a command': '正在运行命令',
  'Searching for information': '正在搜索信息',
  'Working': '正在处理',
  'Generating': '正在生成',
  'Thinking': '正在思考',
  'Idle': '空闲',
  'New': '新建',
  'Unread message': '有未读消息',
  'Failed': '失败',
  'Interrupted': '已中断',
  'Persistence error': '保存失败',
}));

const skillSelection = new Map(Object.entries({
  'Selected only': '仅使用所选技能', 'Suggest': '建议启用', 'Add automatically': '自动添加',
}));

function translateSkillNotice(english: string): string | undefined {
  const skills = /^Skills for this prompt: (.+)\. Skill selection: (Selected only|Suggest|Add automatically)\.(?: Unavailable: (.+)\.)?$/s.exec(english);
  if (skills) {
    const list = skills[1] === 'None' ? '无' : skills[1];
    return `本次提示词使用的技能：${list}。技能选择：${skillSelection.get(skills[2])}。` +
      (skills[3] ? `不可用的技能：${skills[3]}。` : '');
  }
  const used = /^Agent reported using: (.+)\.$/s.exec(english);
  if (used) return `智能体报告使用了以下技能：${used[1]}。`;
  if (english.startsWith('Added skill: ')) return '已添加技能：' + english.slice('Added skill: '.length);
  const handoff = /^Continues from “(.+)”\. Its conversation and cards (were|are)\b.*\.$/s.exec(english);
  if (handoff) return `接续“${handoff[1]}”的工作。${handoff[2] === 'were' ? '对话和卡片已随你的第一条消息转交给此智能体。' : '发送第一条消息时，对话和卡片将一并转交给此智能体。'}`;
}

const userAuthor = '.agent-chat-message[data-role="user"] > .agent-chat-message-author';
const userContext = '.agent-chat-message[data-role="user"] > .agent-chat-message-inputs';
const restoreButton = '.agent-chat-message[data-role="user"] > .agent-chat-message-bubble > button[title]';
const delivery = new Map(Object.entries({
  Queued: '已排队', 'Not sent': '未发送', 'Delivery unconfirmed': '送达状态未知', Delivered: '已送达',
}));

// Only the role label, context list heading and draft recovery button are host chrome.
// The assistant's author label can be a user-chosen name, including "You".
export function isAgentChatChrome(element: Element, field: string): boolean {
  if (field === 'aria-label') return element.matches(userContext);
  if (field === 'title') return element.matches(restoreButton);
  return field === 'text' && element.matches(userAuthor + ',' + restoreButton);
}

export function translateAgentChat(element: Element, field: string, english: string, node?: Node): string | undefined {
  const classes = element.classList;
  if (field === 'text') {
    // Activity entries mix arbitrary tool output with system updates in identical markup.
    if (classes.contains('agent-status-text') && element.matches('.agent-chat-status > .agent-status > span')) {
      const base = english.replace(/(?:…|\.\.\.)$/, '');
      const translated = statusText.get(base);
      if (translated) return translated + (english === base ? '' : '…');
      if (base.startsWith('Waiting for approval: ')) return '等待批准：' + english.slice('Waiting for approval: '.length);
    }
    if (classes.contains('shelf-skills-notice') && element.getAttribute('role') === 'note') return translateSkillNotice(english);
    if (classes.contains('agent-chat-message-author') && element.matches(userAuthor)) {
      if (english === 'You') return '你';
      // Recipient names and delivery suffixes are flattened into a single text node.
      if (english.startsWith('You → ')) return '你' + english.slice(3);
      if (english.startsWith('You · ')) {
        const state = delivery.get(english.slice('You · '.length));
        if (state) return '你 · ' + state;
      }
    }
    if (classes.contains('mini-agent-chat-receipt') && element.getAttribute('role') === 'status' && english === 'Queued') return '已排队';
    if (classes.contains('generation-shelf-jump-recent') && english === 'Jump to recent') return '跳至最新消息';
    if (classes.contains('mini-agent-chat-empty') && english === 'Start a conversation with the agent.') return '与智能体开始对话。';
    if (element.matches('.generation-shelf-activity-toggle > span')) {
      if (english === 'activity') return '条活动';
      if (english === 'update' || english === 'updates') return '更新';
    }
    if (element.matches(restoreButton) && english === 'Restore to draft') return '恢复为草稿';
    if (element.matches('.chat-skills-inherited > span > small') && node === element.lastChild && english === '· active through your Personal context') return '· 已通过个人上下文启用';
    if (element.matches('.chat-skills-chips > span[role="alert"]')) {
      if (english === 'Skills could not be loaded.') return '无法加载技能。';
      if (english === 'attached') return '项已挂接的';
      if (english === 'skill is' || english === 'skills are') return '技能';
      if (english === 'unavailable') return '不可用';
    }
  }
  if (field === 'aria-label') {
    if (english === 'Message context' && element.matches(userContext)) return '消息上下文';
    if (element.closest('.chat-skills-entry') && element.matches('input,button,[role="switch"],[role="checkbox"]')) {
      if (english.startsWith('Enable ')) return '启用 ' + english.slice(7);
      if (english.startsWith('Inherited ')) return '继承的技能：' + english.slice(10);
    }
  }
  if (field === 'title' && element.matches(restoreButton)) {
    if (copyId(english) === '8356c07c3afad5d1') return '请先检查对话，避免重复发送。';
    if (copyId(english) === 'cf620984371fb920') return '放回草稿，等待手动发送。';
  }
  if ((field === 'aria-label' || field === 'title') && classes.contains('mini-agent-chat-send')) {
    if (english === 'Stop agent') return '停止智能体';
    if (english === 'Stop agent (Esc)') return '停止智能体（Esc）';
    if (english === 'Send') return '发送';
  }
}
