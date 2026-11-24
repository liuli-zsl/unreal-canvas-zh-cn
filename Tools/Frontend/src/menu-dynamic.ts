import { copyKey } from './copy-id';
import { renderedFiber } from './host-fiber';

const browserScope = '[role="dialog"]:is([aria-label="Open canvas"],[aria-label="打开画布"])';
const canvasMenu = '[role=menu]:is([aria-label="Canvas actions"],[aria-label="画布操作"])';
const extensionGraphDialogBody = '[role="dialog"]:is([aria-label="Graphs from extensions can\'t be edited"],[aria-label="扩展提供的节点图不可编辑"]) > [data-confirm-body]';
const elapsedUnits: Record<string, string> = { s: '秒', m: '分钟', h: '小时', d: '天' };
const customNodeCommands = new Map([
  ['Custom Node', '自定义节点'],
  ['Update from Library', '从资源库更新'],
  ['Publish to Library…', '发布到资源库…'],
  ['Export as file…', '导出为文件…'],
]);
const nestedTrigger = 'body > .ue-submenu > div > button[aria-haspopup="menu"]';
const nestedCommand = 'body > .ue-submenu > div > .ue-submenu > button.ue-menu-item';
const canvasActionLabels = new Map<string, readonly [string, string]>([
  ['bake-text', ['Reference (Text)', '引用（文本）']],
  ['bake-audio', ['Reference (Audio)', '引用（音频）']],
  ['bake-video', ['Reference (Video)', '引用（视频）']],
  ['bake-video-frame', ['Reference (Current Frame)', '引用（当前帧）']],
  ['bake-multiple-images', ['References', '引用各输出']],
  ['bake-layered-image', ['Layered Reference', '分层引用']],
  ['dcc-edit-in', ['Send to', '发送到']],
  ['dcc-edit-in-imageEditor', ['Image editor', '图像编辑器']],
  ['dcc-finish', ['Finish editing', '完成编辑']],
  ['graph-add-to-library', ['Add to Library', '添加到资源库']],
  ['graph-export-file', ['Export as file…', '导出为文件…']],
  ['recreate-graph-from-artifact', ['Re-create graph as new canvas', '将节点图重建为新画布']],
  ['grab-into-console', ['Grab into Console', '载入控制台']],
  ['go-to-original', ['Go to source', '前往来源']],
]);
const canvasActionTitles = new Map<string, readonly [string, string]>([
  ['#94:acd39b2f01c47aab', ['bake-image', '在旁边创建引用卡片，保留与原卡片输出的关联。']],
  ['#62:b171e5bd14d3f4d2', ['bake-text', '在旁边为文本结果创建引用卡片。']],
  ['#70:73a7aa983666461f', ['bake-audio', '在旁边为当前音频结果创建引用卡片。']],
  ['#70:1ef68d5dbcb72000', ['bake-video', '在旁边为当前视频结果创建引用卡片。']],
  ['#84:e2081b6b1b7c152b', ['bake-video-frame', '在旁边为当前显示的视频帧创建图像引用卡片。']],
  ['#76:5910dcf9f2851e40', ['bake-video-frame', '为所选视频各自显示的当前帧创建图像引用卡片。']],
  ['#49:d1a2cc24981e5eed', ['bake-multiple-images', '为卡片的每个输出创建一张引用卡片。']],
  ['#62:8ce60ae663cd6b67', ['bake-layered-image', '创建包含所有图层的引用卡片，并保留图层切换控件。']],
  ['#111:1499c939b221200d', ['dcc-edit-in-imageEditor', '未自动找到图像编辑器。请在「设置 → 外部路径 → 图像编辑器路径」中选择程序。']],
  ['#51:15209f0c50788792', ['graph-add-to-library', '将节点图副本保存到工具箱，供以后使用。']],
  ['#39:ff34a80c5efe8b04', ['graph-export-file', '将节点图导出为 .graph.json 文件。']],
  ['#60:d073ad792e80f49e', ['multi-create-subcanvas', '将所选卡片移入节点图，跨边界的连线会创建对应端口。']],
  ['#35:177176e9056b1e98', ['multi-collapse-subcanvas', '将所选卡片移入子画布。']],
]);
type MenuAction = { id: string; label?: string; title?: string };
type MenuActionProps = { action?: MenuAction };

export function getRenderedMenuAction(button: Element): MenuAction | undefined {
  // The same action can render inside the menu or in a detached flyout.
  // Verify the owning key so a similarly named item cannot supply its identity.
  for (let owner = renderedFiber<MenuActionProps>(button); owner; owner = owner.return ?? undefined) {
    const action = owner.memoizedProps?.action;
    if (action?.id && (owner.key === action.id || owner.return?.key === action.id)) return action;
  }
}

function translateEditorActionHint(action: MenuAction, english: string, key: string) {
  const name = action.label;
  if (!action.id.startsWith('dcc-edit-in-') || !name) return;
  if (key === '#44:5c9dc21452fe59e9') return '请等待卡片运行完毕。';
  const path = /^([\s\S]+)Settings ▸ External paths ▸ "([^"]+)"\.$/.exec(english);
  if (!path) return;
  const lead = path[1];
  const location = '「设置 → 外部路径 → ' + path[2] + '」';
  if (lead.startsWith(name) && copyKey(lead.slice(name.length)) === '#51:20e20b5f91793c9c') {
    return '未自动找到「' + name + '」。请在' + location + '中选择程序。';
  }
  const start = 'Choose the program ';
  if (lead.startsWith(start + name) && copyKey(start + lead.slice(start.length + name.length)) === '#29:1ac6ec9acf4ab05d') {
    return '请在' + location + '中选择「' + name + '」使用的程序。';
  }
}

export function translateMenuActionCopy(action: MenuAction, field: string, english: string) {
  if (field === 'title' || field === 'data-title-tip') {
    if (action.title !== english) return;
    const key = copyKey(english);
    const copy = canvasActionTitles.get(key);
    if (copy && (action.id === copy[0] || (action.id === 'create-reference' && copy[0].startsWith('bake-')))) return copy[1];
    return translateEditorActionHint(action, english, key);
  }
  if (field !== 'text' || action.label !== english) return;
  const copy = canvasActionLabels.get(action.id);
  if (copy?.[0] === english) return copy[1];
  if (action.id === 'dcc-reimport' && english.startsWith('Reimport from ')) return '从' + english.slice(14) + '重新导入';
  if (action.id === 'bake-video-frame') {
    const count = /^(\d+) References \(Current Frame\)$/.exec(english);
    if (count) return '创建 ' + count[1] + ' 张引用卡片（当前帧）';
  }
  if (action.id === 'grab-into-console') {
    const count = /^Grab (\d+) into Console$/.exec(english);
    if (count) return '载入 ' + count[1] + ' 项到控制台';
  }
}

function translateCanvasAction(element: Element, field: string, english: string) {
  const label = field === 'text' && element.matches('.ue-menu-label,.feature-hint-menu-label');
  const hint = (field === 'title' || field === 'data-title-tip') && element.matches('button');
  if (!label && !hint) return;
  const button = element.closest('button.ue-menu-item');
  if (!button?.closest(canvasMenu + ',body > .ue-submenu') || !element.ownerDocument.querySelector(canvasMenu)) return;
  const action = getRenderedMenuAction(button);
  return action && translateMenuActionCopy(action, field, english);
}

function isCustomNodeMenu(element: Element): boolean {
  const activeGroup = element.ownerDocument.querySelector(
    canvasMenu + ' > button[aria-expanded=true] > .feature-hint-menu-label',
  )?.textContent;
  if (activeGroup !== 'Inspect' && activeGroup !== '检查') return false;
  const row = element.closest('button');
  if (row?.matches(nestedTrigger)) return true;
  if (!row?.matches(nestedCommand)) return false;
  const submenu = row.parentElement?.previousElementSibling?.querySelector('.feature-hint-menu-label')?.textContent;
  return submenu === 'Custom Node' || submenu === '自定义节点';
}

export function translateMenuDynamic(element: Element, field: string, english: string): string | undefined {
  const canvasAction = translateCanvasAction(element, field, english);
  if (canvasAction !== undefined) return canvasAction;
  if (field === 'text' && english.startsWith('Comes with the ') && element.matches('[role="tooltip"][data-portal-popup][id]')) {
    const start = 'Comes with the '.length;
    const end = english.lastIndexOf(' extension — locked.');
    const trigger = [...element.ownerDocument.querySelectorAll('span[aria-describedby]:has(> button[data-graph-edit-lock])')]
      .find(wrapper => wrapper.getAttribute('aria-describedby')?.split(/\s+/).includes(element.id));
    if (trigger && end > start && copyKey(english.slice(0, start) + english.slice(end)) === '#72:d59ddf8ec23d900e') {
      return '此节点图由「' + english.slice(start, end) + '」扩展提供，现已锁定。复制后即可编辑副本。';
    }
  }
  if (field === 'text' && english.startsWith('This graph comes with the ')) {
    const start = 'This graph comes with the '.length;
    const dialog = element.matches(extensionGraphDialogBody);
    const inspector = element.matches('.merlin-graph-inspector .merlin-script-side-locked > span');
    const end = english.lastIndexOf(dialog ? ' extension and changes only when ' : ' extension, so its settings ');
    if (dialog && end > start && copyKey(english.slice(0, start) + english.slice(end)) === '#142:287aed80dd143695') {
      return '此节点图由「' + english.slice(start, end) + '」扩展提供，随扩展更新。在工具箱中复制它，即可编辑副本。';
    }
    if (inspector && end > start && copyKey(english.slice(0, start) + english.slice(end)) === '#129:731a0436349e0feb') {
      return '此节点图由「' + english.slice(start, end) + '」扩展提供，设置已锁定。在工具箱中复制它，即可编辑副本。';
    }
  }
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
