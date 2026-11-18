const browserScope = '[role="dialog"]:is([aria-label="Open canvas"],[aria-label="打开画布"])';
const elapsedUnits: Record<string, string> = { s: '秒', m: '分钟', h: '小时', d: '天' };

export function translateMenuDynamic(element: Element, field: string, english: string): string | undefined {
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
