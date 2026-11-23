import { copyKey } from './copy-id';

const browserScope = '[role="dialog"]:is([aria-label="Open canvas"],[aria-label="打开画布"])';
const elapsedUnits: Record<string, string> = { s: '秒', m: '分钟', h: '小时', d: '天' };
const customNodeCommands = new Map([
  ['Custom Node', '自定义节点'],
  ['Update from Library', '从资源库更新'],
  ['Publish to Library…', '发布到资源库…'],
  ['Export as file…', '导出为文件…'],
]);
const nestedTrigger = 'body > .ue-submenu > div > button[aria-haspopup="menu"]';
const nestedCommand = 'body > .ue-submenu > div > .ue-submenu > button.ue-menu-item';

function isCustomNodeMenu(element: Element): boolean {
  const activeGroup = element.ownerDocument.querySelector(
    '[role=menu]:is([aria-label="Canvas actions"],[aria-label="画布操作"]) > button[aria-expanded=true] > .feature-hint-menu-label',
  )?.textContent;
  if (activeGroup !== 'Inspect' && activeGroup !== '检查') return false;
  const row = element.closest('button');
  if (row?.matches(nestedTrigger)) return true;
  if (!row?.matches(nestedCommand)) return false;
  const submenu = row.parentElement?.previousElementSibling?.querySelector('.feature-hint-menu-label')?.textContent;
  return submenu === 'Custom Node' || submenu === '自定义节点';
}

export function translateMenuDynamic(element: Element, field: string, english: string): string | undefined {
  const command = field === 'text' && customNodeCommands.get(english);
  if (command && element.matches('.feature-hint-menu-label,.ue-menu-label') && isCustomNodeMenu(element)) return command;
  if (field === 'title' && element.matches(nestedCommand) && isCustomNodeMenu(element)) {
    const key = copyKey(english);
    if (key === '#51:e2f6181aece37205') return '将此卡片保存到自定义节点库，供以后复用。';
    if (key === '#56:c45701dd2f709202') return '将此卡片的定义导出为 .customnode JSON 文件。';
    const start = english.indexOf('"');
    const end = english.lastIndexOf('"');
    if (start >= 0 && end > start && copyKey(english.slice(0, start + 1) + english.slice(end)) === '#142:998c292fdfcf2cb8') {
      return '将资源库中“' + english.slice(start + 1, end) + '”的新版定义应用到此卡片。保留仍然存在的引脚连线和你的设置值。此操作可撤销。';
    }
  }
  if (field === 'text' && element.matches('[role="dialog"]:is([aria-label="About Unreal Canvas"],[aria-label="关于 Unreal Canvas"]) p')) {
    const native = /^\+ (\d+) native$/.exec(english);
    if (native) return '+ ' + native[1] + ' 个原生依赖';
    if (english === '(') return '（共';
  }
  if (field === 'title' && element.matches('.merlin-canvas-tab > span')) {
    const suffix = ' — Double-click to rename';
    if (english.endsWith(suffix)) return english.slice(0, -suffix.length) + ' — 双击重命名';
  }
  if (element.closest(browserScope)) {
    if (field === 'aria-label' && element.matches('button[title]') && english.startsWith('Actions for ')) {
      return '画布操作：' + english.slice('Actions for '.length);
    }
    // The first two spans are the thumbnail and the user-defined canvas name.
    // The timestamp follows those and may also follow the visibility badge.
    if (field === 'text' && element.matches('section button > span:nth-child(n+3):not([aria-label])')) {
      if (english === 'never') return '从未更新';
      const age = /^(\d+)([smhd]) ago$/.exec(english);
      if (age) return age[1] + ' ' + elapsedUnits[age[2]] + '前';
    }
  }
  if (element.closest('[data-testid="canvas-settings-popover"],.merlin-graph-inspector')) {
    const label = /^(root canvas|subcanvas|nested canvas|graph) (“[\s\S]*”)$/.exec(english);
    if (field === 'text' && label && element.matches('.merlin-script-form-none')) {
      return (label[1] === 'graph' ? '节点图' : label[1] === 'root canvas' ? '根画布' : '子画布') + label[2];
    }
    const attach = /^Attach a skill to (root canvas|subcanvas|nested canvas|graph) (“[\s\S]*”)$/.exec(english);
    if (field === 'title' && attach && element.matches('.merlin-skill-attach-add')) {
      return '为' + (attach[1] === 'graph' ? '节点图' : attach[1] === 'root canvas' ? '根画布' : '子画布') + attach[2] + '添加技能';
    }
  }
  if (element.closest('[data-testid="ask-pill-tiles"]') && (field === 'title' || field === 'aria-label')) {
    const show = /^Show ([\s\S]+) on the canvas$/.exec(english);
    if (show && element.matches('[role="button"]')) return '在画布上显示“' + show[1] + '”';
    if (element.matches('button') && english.startsWith('Remove ')) return '移除“' + english.slice(7) + '”';
  }
  if (field === 'title' && element.matches('.canvas-card-toolbar .node-header-btn')) {
    const open = /^Open ([\s\S]+) (\([^()]+\))$/.exec(english);
    if (open) return '打开“' + open[1] + '” ' + open[2];
  }
  if (field === 'title' && element.matches('.agent-voice-toggle,.canvas-card-ask-agent')) {
    const action = /^(Ask the agent|Dictate message) (\([^()]+\))$/.exec(english);
    if (action) return (action[1] === 'Ask the agent' ? '询问智能体' : '听写消息') + ' ' + action[2];
  }
  if (field === 'aria-label' && element.closest('.timeline-panel')) {
    const track = /^(Select )?([\s\S]+) track$/.exec(english);
    if (track && element.matches('.tl-track,.tl-track-select')) {
      return (track[1] ? '选择轨道“' : '轨道“') + track[2] + '”';
    }
    const mute = /^(Mute|Unmute) ([\s\S]+)$/.exec(english);
    if (mute && element.matches('.tl-track-mute')) {
      return (mute[1] === 'Mute' ? '静音轨道“' : '取消静音轨道“') + mute[2] + '”';
    }
  }
  if (field === 'text' && element.matches('.ue-menu-label') && element.closest('.ue-menu-item[aria-pressed]')) {
    // Only the Votes submenu owns these labels. Other submenus show user-defined tags.
    const filter = element.closest('[role="dialog"].nodrag.nowheel');
    const active = filter?.querySelector('.ue-menu:first-child .ue-menu-item[aria-expanded="true"] .ue-menu-label')?.textContent;
    if (active === 'Votes' || active === '投票') {
      if (english === 'Has 👍') return '有赞 👍';
      if (english === 'Has 👎') return '有踩 👎';
      if (english === 'No votes') return '暂无投票';
    }
  }
  if (element.closest('.merlin-graph-inspector')) {
    if (field === 'aria-label' && element.matches('.merlin-script-form-dot.is-button') && english.startsWith('Find ')) return '定位“' + english.slice(5) + '”';
    if (field === 'aria-label' && element.matches('.merlin-script-form-remove')) {
      const hide = /^Hide ([\s\S]+) settings$/.exec(english);
      if (hide) return '隐藏“' + hide[1] + '”的设置';
    }
    if (field === 'text' && element.matches('.merlin-script-form-none[title]') && english !== element.getAttribute('title')) {
      const count = /^(\d+) settings?$/.exec(english);
      if (count) return count[1] + ' 项设置';
    }
  }
  return undefined;
}
