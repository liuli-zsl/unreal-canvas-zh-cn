import { copyId } from './copy-id';
const skillModes: Record<string, readonly [string, string]> = {
  selected: ['Selected only', '仅使用所选技能'],
  suggest: ['Suggest', '建议启用'],
  auto: ['Add automatically', '自动添加'],
};

function skillStatus(english: string): string | undefined {
  const count = /^(\d+) active skills?$/.exec(english);
  if (count) return `已启用 ${count[1]} 项技能`;
  switch (english) {
    case 'No active skills': return '没有启用的技能';
    case 'Loading skills': return '正在加载技能';
    case 'Skills could not be loaded': return '无法加载技能';
  }
}

export function translatePanelDetails(element: Element, field: string, english: string, node?: Node): string | null | undefined {
  if (field === 'text') {
    if (element.matches('.agent-retry-status > div > span')) {
      const recovering = /^(\d+) requests recovering\. (Active retry|Next retry)$/.exec(english);
      if (recovering) return recovering[1] + ' 个请求正在恢复。' + (recovering[2] === 'Next retry' ? '下次重试' : '正在重试');
      const delay = /^in (\d+)s…$/.exec(english);
      if (delay) return delay[1] + ' 秒后重试…';
    }
    if (element.matches('.generation-shelf-approval > strong') && element.childNodes.length === 3) {
      if (node === element.firstChild && english === 'Allow organization on') return '是否允许整理画布';
      if (node === element.lastChild && english === '?') return '？';
      return null; // The middle text node is the user's canvas name.
    }
    if (element.matches('.generation-shelf-approval > small')) {
      if (english === 'Local CLI action on the server computer') return '在服务器所在电脑上执行的本地命令行操作';
      if (english.startsWith('Canvas: ')) return '画布：' + english.slice(8);
    }
    if (element.matches('.agent-history-list > button[data-follower] > span > strong + small') && node === element.firstChild) {
      if (english === 'Closed') return '已关闭';
      if (english === 'Open') return '已打开';
    }
    if (element.matches('.agent-mcp-servers > p[role=status]') && element.childNodes.length === 3) {
      if (node === element.firstChild && english === 'Finish signing in to') return '请在浏览器中完成登录：';
      if (node === element.lastChild && copyId(english) === '7fb86d60be24c1c7') return '。连接成功后，即可在本次对话中使用其工具。';
      return null;
    }
    if (element.matches('.agent-mcp-servers li > small') && node === element.firstChild && element.childNodes.length === 2 &&
        english === 'The sign-in did not finish:') return '登录未完成：';
    if (element.matches('.agent-process-session > p:first-of-type') && node === element.firstChild) {
      if (english === 'No active turn') return '没有正在进行的交互';
      if (english === 'Agent turn active') return '智能体正在处理请求';
      if (english === 'Closed') return '已关闭';
    }
    if (element.matches('.mini-agent-chat-empty') && node === element.firstChild && english === 'Start a conversation with') {
      return '开始对话：';
    }
    if (element.matches('.merlin-skill-attach > .merlin-script-form-none')) {
      if (node === element.firstChild && english === 'No skills attached to') return '尚未挂接技能的位置：';
      if (node === element.childNodes[1]) {
        const scope = /^(root canvas|subcanvas|graph) “(.+)”$/s.exec(english);
        if (scope) {
          const label = scope[1] === 'root canvas' ? '根画布' : scope[1] === 'subcanvas' ? '子画布' : '节点图';
          return label + '“' + scope[2] + '”';
        }
      }
    }
    if (element.matches('.mini-agent-chat-compose [contenteditable="true"][role="textbox"] + [role="separator"] + div:not([contenteditable])') &&
        english.startsWith('Message ') && english.endsWith('…')) {
      return '发消息给 ' + english.slice(8);
    }
    if (element.matches('.agent-task-filters > button:nth-child(2)') && english.endsWith('’s tasks')) {
      return english.slice(0, -'’s tasks'.length) + '的任务';
    }
    if (element.matches('.agent-activity-presence > summary')) {
      const disconnected = /^· (\d+) disconnected$/.exec(english);
      if (disconnected) return `· ${disconnected[1]} 个已断开`;
    }
    if (element.matches('.chat-skills-heading > span')) return skillStatus(english);
    const option = element.closest('[role="listbox"]:is([aria-label="Skill selection"],[aria-label="技能选择"]) > [role="option"][data-value]');
    const mode = option && skillModes[option.getAttribute('data-value')!];
    if (mode && mode[0] === english) return mode[1];
  }
  if (field === 'aria-label') {
    if (english.startsWith('Working with ') && element.classList.contains('agent-squad-select')) {
      if (english === 'Working with Choose an agent' && !element.querySelector('.agent-squad-current > strong[title]')) return '选择协作的智能体';
      return '正在与 ' + english.slice(13) + ' 协作';
    }
    if (english.startsWith('Reopen ') && element.matches('.agent-history-list > button')) return '重新打开 ' + english.slice(7);
    if (element.matches('.agent-nav-team-toggle')) {
      if (english.startsWith('Expand team under ')) return '展开团队：' + english.slice(18);
      if (english.startsWith('Collapse team under ')) return '收起团队：' + english.slice(20);
    }
    if (english.startsWith('Following ') && element.matches('.agent-message-switcher ul')) return '跟随 ' + english.slice(10);
    if (element.matches('.agent-mcp-servers li > button')) {
      if (english.startsWith('Signing in to ')) return '正在登录 ' + english.slice(14);
      if (english.startsWith('Sign in to ')) return '登录 ' + english.slice(11);
    }
    if (element.matches('.agent-detail-shell') && english.endsWith(' details')) return english.slice(0,-8) + '的详情';
    if (element.matches('.agent-action-menu') && english.startsWith('Manage ')) return '管理 ' + english.slice(7);
    if (element.matches('.merlin-skill-attach-remove') && english.startsWith('Detach ')) return '解除挂接：' + english.slice(7);
    if (element.matches('.agent-nav-identity button, .mini-agent-chat-compose [contenteditable="true"]') && english.startsWith('Message ')) return '发消息给 ' + english.slice(8);
    if (element.matches('.mini-agent-chat-compose [role="separator"]') && english.startsWith('Resize Message ')) return '调整给 ' + english.slice(15) + ' 的消息输入框大小';
    if (element.matches('.mini-agent-chat-skills') && english.startsWith('Skills: ')) {
      const [status, policy] = english.slice(8).split(' · ');
      const label = skillStatus(status);
      if (label && !policy) return '技能：' + label;
      if (label && policy === 'Agent can suggest skills') return '技能：' + label + ' · 智能体可以建议技能';
      if (label && policy === 'Agent can choose skills') return '技能：' + label + ' · 智能体可以选择技能';
    }
  }
  if (field === 'title' && element.matches('.agent-task-owner-input .agent-assignee-picker') && english.startsWith('Assign to: ')) {
    return '分派给：' + english.slice(11);
  }
  if (field === 'title' && english.startsWith('Following ') && element.matches('.agent-history-list > button')) return '跟随 ' + english.slice(10);
}
