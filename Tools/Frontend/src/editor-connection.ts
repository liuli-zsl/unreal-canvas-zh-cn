import { copyId } from './copy-id';
// The picker mixes system actions with project names, level names and paths in identical spans.
const chipPrefix = 'Unreal Editor: ';
type Messages = ReadonlyArray<readonly [RegExp, string]>;
const chipStates: Messages = [
  [/^connected to (.+), which is still loading\.$/, '已连接到 $1，编辑器仍在加载。'],
  [/^connected to (.+), without Unreal Canvas Bridge\..*\bnodes\b.*$/, '已连接到 $1。该编辑器没有 Unreal Canvas Bridge，部分 Unreal 节点不可用。打开菜单可查看详情。'],
  [/^connected to (.+), without Unreal Canvas Bridge\..*\bcards\b.*$/, '已连接到 $1。该编辑器没有 Unreal Canvas Bridge，部分 Unreal 卡片不可用。打开菜单可查看详情。'],
  [/^connected to (.+), but it isn't answering\..*$/, '已连接到 $1，但编辑器没有响应。打开菜单可查看详情。'],
  [/^connected to (.+), but Unreal nodes can't run in it\..*$/, '已连接到 $1，但该编辑器无法运行 Unreal 节点。打开菜单可查看详情。'],
  [/^connected to (.+), but Unreal cards can't run in it\..*$/, '已连接到 $1，但该编辑器无法运行 Unreal 卡片。打开菜单可查看详情。'],
  [/^connected to (.+)\. Renders, imports\b.*$/, '已连接到 $1。渲染、导入和视口操作将发送到该编辑器。'],
  [/^not connected\. One editor is running;.*$/, '尚未连接。有一个编辑器正在运行，选择后即可向它发送渲染、导入和视口操作。'],
  [/^not connected\. (\d+) editors are running;.*$/, '尚未连接。有 $1 个编辑器正在运行，请选择接收渲染、导入和视口操作的编辑器。'],
  [/^not connected\. (.+) (?:is|are) running without an MCP server;.*$/, '尚未连接。$1 正在运行，但未启动 MCP 服务。打开菜单可查看详情。'],
  [/^not connected\. Renders, imports\b.*$/, '尚未连接。请在虚幻编辑器中打开工程，以便渲染、导入和使用视口。'],
  [/^(.+) is running but has no MCP server\b.*$/, '$1 正在运行，但没有 MCP 服务，无法连接。打开菜单可查看详情。'],
  [/^starting (.+)\. It connects once it has loaded\.$/, '正在启动 $1。加载完成后将自动连接。'],
  [/^(.+) is opening (.+)\.$/, '$1 正在打开 $2。'],
];
const capability: Messages = [
  [/^(.+) has Unreal Canvas Bridge: every Unreal node works\.$/, '$1 已启用 Unreal Canvas Bridge，所有 Unreal 节点均可使用。'],
  [/^(.+) has Unreal Canvas Bridge: every Unreal card works\.$/, '$1 已启用 Unreal Canvas Bridge，所有 Unreal 卡片均可使用。'],
  [/^(.+) has Unreal Canvas Bridge, but can't run Python for Unreal Canvas\.$/, '$1 已启用 Unreal Canvas Bridge，但无法为 Unreal Canvas 运行 Python。'],
  [/^(.+) is still loading\.$/, '$1 仍在加载。'],
  [/^(.+) isn't answering\.$/, '$1 没有响应。'],
  [/^(.+) doesn't have Unreal Canvas Bridge\.$/, '$1 未启用 Unreal Canvas Bridge。'],
  [/^(.+) has neither Unreal Canvas Bridge nor engine Python\.$/, '$1 未启用 Unreal Canvas Bridge，也未启用引擎 Python。'],
  [/^(.+) is running, but it has no MCP server\.$/, '$1 正在运行，但没有 MCP 服务。'],
  [/^(.+) didn't open (.+)\.$/, '$1 未能打开 $2。'],
];
function matchMessage(value: string, messages: Messages) {
  for (const [pattern, replacement] of messages) {
    if (pattern.test(value)) return value.replace(pattern, replacement);
  }
}

function editorVersion(label: string) {
  return label.replace(/^(UE [\d.]+) \(source\)$/, '$1（源码版）');
}

function describeRow(value: string) {
  const newline = value.indexOf('\n');
  if (newline < 0) return;
  const lines = value.slice(newline + 1);
  const path = value.slice(0, newline + 1);
  const engine = /^Opens with (.+?), (.+)$/.exec(lines);
  if (engine) return path + '使用 ' + editorVersion(engine[1]) + ' 打开，路径：' + engine[2];
  if (copyId(lines) === 'a22f81473ffecbf7') return path + '此电脑未安装工程使用的引擎，请选择一个引擎打开它。';
  const process = /^(?:Unreal Engine ([^\n,]+), )?process (\d+), MCP port (\d+)(?:\n(Found by its MCP server:[^\n]+))?$/.exec(lines);
  if (process) return path + (process[1] ? '虚幻引擎 ' + process[1] + '，' : '') + '进程 ' + process[2] + '，MCP 端口 ' + process[3] +
    (process[4] ? '\n通过 MCP 服务发现。Unreal Canvas Bridge 未列出此编辑器，其中的渲染、导入和视口功能可能不可用。' : '');
  if (lines.startsWith('This editor has no MCP server, so Unreal Canvas')) return path + '此编辑器没有 MCP 服务，Unreal Canvas 无法连接。请在“编辑 → 插件”中启用 Model Context Protocol 和可用的 Unreal Canvas Bridge，然后重启编辑器。';
}

const detailStates: Messages = [
  [/^These won't work: (.+)\.$/, '以下节点不可用：$1。'],
  [/^Its MCP server didn't respond \(([\s\S]+)\)\. A busy editor\b.*$/, 'MCP 服务没有响应（$1）。编辑器正在加载或编译着色器时可能繁忙，空闲后会恢复响应。'],
  [/^If it stays\b.*? Details: ([\s\S]+)$/, '如果一直没有响应，请重启编辑器。详细信息：$1'],
  [/^Renders, imports\b.*?\bPython instead\. These won't work: (.+)\.$/, '渲染、导入和生成对象将通过引擎 Python 执行。以下节点不可用：$1。'],
  [/^Renders, imports\b.*?\bPython instead\.$/, '渲染、导入和生成对象将通过引擎 Python 执行。'],
  [/^Unreal nodes can't run in it: (.+)\.$/, '以下 Unreal 节点无法在此编辑器中运行：$1。'],
  [/^Unreal cards can't run in it: (.+)\.$/, '以下 Unreal 卡片无法在此编辑器中运行：$1。'],
];

const pythonHelp = '检查 Bridge 的蓝图执行设置，或启用 EditorToolset 和 Python 后重启。';
function changeAction(value: string) {
  if (value === 'quit' || value === 'Quit') return '退出编辑器';
  if (value === 'Quitting') return '退出编辑器';
  return value.replace(/^(?:open|Open|Opening) (.+)$/, '打开 $1');
}

export function translateEditorConnection(el: Element, field: string, value: string, node: Node): string | null | undefined {
  if (el.classList.contains('unreal-editor-chip') && field === 'aria-label' && value.startsWith(chipPrefix)) {
    const status = matchMessage(value.slice(chipPrefix.length), chipStates);
    if (status) return '虚幻编辑器：' + status;
  }
  if (field === 'title' && copyId(value) === 'b697adbe21e20ffc' &&
      el.matches(':is(.pill-menu,.ue-menu):has(.merlin-panel-search) button,.ue-submenu > button')) {
    return '需要在虚幻编辑器中运行 Python。' + pythonHelp;
  }
  const tip = el.closest('[role="tooltip"]');
  if (tip?.id && field === 'text') {
    const chip = el.ownerDocument.querySelector('.unreal-editor-chip');
    if (chip?.getAttribute('aria-describedby')?.split(/\s+/).includes(tip.id)) {
      if (value === 'Unreal Editor') return '虚幻编辑器';
      if (copyId(value) === '7e481c7ef0ae84fc') return '连接虚幻编辑器并打开工程';
      return matchMessage(value.charAt(0).toLowerCase() + value.slice(1), chipStates);
    }
  }
  if (!el.closest('.unreal-editor-menu')) return;
  if (field === 'title' && el.matches('button,.unreal-editor-menu-starting')) {
    if (copyId(value) === '3f8a09e9464431a3') return '当前编辑器无法为 Unreal Canvas 运行 Python。' + pythonHelp;
    return describeRow(value);
  }
  if (field === 'aria-label') {
    if (el.classList.contains('unreal-editor-menu-forget')) return value.replace(/^Remove (.+) from recent projects$/, '从最近工程中移除“$1”');
    if (el.classList.contains('unreal-editor-menu-quit')) return value.replace(/^Quit (.+)$/, '退出 $1');
  }
  if (field === 'placeholder' && el.closest('.unreal-level-picker-search')) {
    const n = /^Search (\d+) levels$/.exec(value);
    if (n) return '搜索 ' + n[1] + ' 个关卡';
  }
  if (field !== 'text') return;
  if (el.closest('[role="alert"]') && !el.classList.contains('unreal-editor-menu-note')) return null;
  const cls = el.classList;
  if (cls.contains('unreal-editor-menu-status-title')) return matchMessage(value, capability);
  if (cls.contains('unreal-editor-menu-status-detail')) {
    if (copyId(value) === '11e3055b87885f7d') return pythonHelp;
    if (value.startsWith('To fix: enable') && value.includes('Unreal Canvas Bridge')) {
      return '请启用 Unreal Canvas Bridge 并重启。仅使用渲染与导入等功能时，也可检查 EditorToolset、Python 和 Movie Render Queue。';
    }
    return matchMessage(value, detailStates);
  }
  if (el.matches('.unreal-editor-menu-row .ue-menu-count:not(.unreal-editor-menu-path)')) return value === 'No engine' ? '未找到引擎' : editorVersion(value);
  if (el.closest('.unreal-editor-menu-path,button[role="menuitemradio"] .ue-menu-label,.unreal-editor-menu-row .ue-menu-label,button[role="menuitemradio"] .ue-menu-detail,[aria-disabled="true"] .ue-menu-label')) return null;
  if (el.matches('.unreal-editor-menu-starting[role="status"] .ue-menu-label')) return matchMessage(value, [
    [/^Saving, then quitting (.+)…$/, '正在保存，随后退出 $1…'], [/^Quitting (.+)…$/, '正在退出 $1…'],
  ]);
  // React puts variable project/package names in separate text nodes. Only translate fixed fragments in their original slots.
  if (el.childNodes.length > 1) {
    if (cls.contains('ue-menu-heading')) {
      if (node === el.firstChild && value === 'Open a level in') return '打开此工程中的关卡：';
      if (node === el.firstChild && value === 'Open') return '选择打开工程';
      if (node === el.lastChild && value === 'with') return '所用的引擎';
      return null;
    }
    if (cls.contains('unreal-editor-menu-note')) {
      if (node === el.firstChild && ['Open now:', "Didn't open", "Didn't quit"].includes(value)) return value === 'Open now:' ? '当前关卡：' : value === "Didn't open" ? '未能打开' : '未能退出';
      if (node === el.lastChild && copyId(value) === '5bad8359f1866095') return '项未显示。输入部分名称或文件夹名可查找关卡。';
      if (node === el.lastChild && value === '. A large level takes a while.') return '。大型关卡可能需要一些时间。';
      if (node === el.firstChild && value === 'Saving, then opening') return '正在保存，随后打开';
      if (node === el.firstChild && value === 'Opening') return '正在打开';
      if (node.previousSibling && value === 'has unsaved changes in') return '有未保存的更改，涉及';
      if (node === el.lastChild && value === 'drops them unless they are saved first.') return '将丢弃这些更改，请先保存。';
      if (node === el.lastChild && value === 'without saving, or cancel.') return '且不保存，或取消。';
      if (node.previousSibling && value === 'was never saved. Save it as') return '尚未保存，请另存为';
      if (node.previousSibling && copyId(value) === '6904898a54d24aa6') return '尚未保存，也不是当前打开的关卡，无法在此保存。你可以';
      const following = node.nextSibling?.textContent?.trim();
      if (following && ['drops them unless they are saved first.', 'without saving, or cancel.', '将丢弃这些更改，请先保存。', '且不保存，或取消。'].includes(following)) return changeAction(value);
      return null;
    }
    if (cls.contains('ue-menu-label')) {
      if (el.closest('.unreal-editor-menu-starting')) {
        if (node === el.firstChild && value === 'Opening') return '正在打开';
        if (node === el.firstChild && value === 'Starting') return '正在启动';
        if (node.previousSibling && value === 'in the background') return '（后台）';
        return null;
      }
      if (node === el.firstChild && value === 'Save and') return '保存并';
      if (node === el.lastChild && value === 'without saving') return '且不保存';
      return changeAction(value);
    }
  }
}
