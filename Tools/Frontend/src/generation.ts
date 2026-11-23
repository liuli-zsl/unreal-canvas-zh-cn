import { renderedFiber, type HostFiber } from './host-fiber';

const media = new Map(Object.entries({
  Image: '图像', Video: '视频', Audio: '音频', Text: '文本', Mesh: '网格模型',
  Splat: '高斯泼溅', Other: '其他', Graph: '节点图', Script: '脚本', Number: '数值',
  Timeline: '时间线', Python: 'Python',
}));
const cardKinds = new Map(Object.entries({
  Tool: '工具', Action: '操作', Deck: '卡组', Asset: '资产', Process: '流程',
  Container: '容器', Canvas: '画布', Note: '笔记', ...Object.fromEntries(media),
}));
const runStates = new Map(Object.entries({
  Idle: '空闲', Running: '运行中', Queued: '已排队', Ready: '就绪', Failed: '失败',
  Done: '完成', Completed: '已完成', Cancelled: '已取消', Pending: '等待中', Error: '错误',
}));

const viewportScripts = new Map([
  ['Modify Viewport (Spatial)', { id: 'b88aa71e-c1eb-4302-a9f1-d370fa1fc9b1', label: '修改视口（空间）' }],
  ['Viewport Render', { id: 'b7f96a53-c341-4f12-a3de-a8801e610c7c', label: '视口渲染' }],
  ['Viewport Snapshot', { id: 'a104f84a-29f0-44e6-9c20-c75c25a1d69c', label: '视口快照' }],
  ['Sequence Render', { id: '0100c861-07be-4c12-b12e-a97271962ee5', label: '序列渲染' }],
]);
type ShelfScript = { id: string; name: string; params?: { category?: string; builtinGraph?: boolean } };
type ShelfProps = { scripts?: ShelfScript[] };

function shelfScriptLists(fiber: HostFiber<ShelfProps> | undefined) {
  for (let owner = fiber; owner; owner = owner.return ?? undefined) {
    const scripts = owner.memoizedProps?.scripts;
    if (!Array.isArray(scripts)) continue;
    const alternate = owner.alternate?.memoizedProps?.scripts;
    return Array.isArray(alternate) && alternate !== scripts ? [scripts, alternate] : [scripts];
  }
  return [];
}

function isBuiltinViewportScript(script: ShelfScript) {
  return script?.params?.builtinGraph === true && viewportScripts.get(script.name)?.id === script.id;
}

function translateViewportScript(element: Element, field: string, value: string) {
  const entry = viewportScripts.get(value);
  if (entry && field === 'text' && element.matches('button[role="menuitemradio"] > .ue-menu-label') && element.parentElement) {
    const fiber = renderedFiber<ShelfProps>(element.parentElement);
    if (fiber?.key !== entry.id) return;
    const lists = shelfScriptLists(fiber);
    if (lists.length && lists.every(scripts => scripts.some(script =>
      script?.name === value && isBuiltinViewportScript(script)))) return entry.label;
  }
  if (value !== 'Viewport') return;
  const folder = field === 'aria-label' && element.matches('.generation-shelf-workflow-folder')
    ? element
    : field === 'text' && element.matches('.generation-shelf-workflow-folder-name > .ue-menu-label')
      ? element.closest('.generation-shelf-workflow-folder')
      : null;
  if (!folder) return;
  const fiber = renderedFiber<ShelfProps>(folder);
  if (fiber?.key !== 'folder:Viewport') return;
  const lists = shelfScriptLists(fiber);
  const onlyBuiltin = lists.length > 0 && lists.every(scripts => {
    const group = scripts.filter(script => {
      const category = script?.params?.category;
      const path = typeof category === 'string' ? category.split('/').map(segment => segment.trim()).filter(Boolean) : [];
      return path[0] === 'Viewport';
    });
    return group.length > 0 && group.every(isBuiltinViewportScript);
  });
  if (onlyBuiltin) return '视口';
}

function footer(element: Element, field: string, value: string) {
  const id = element.getAttribute('data-field');
  if (id === 'rating' && field === 'title' && value === 'Rating') return '评分';
  if (id === 'votes' && field === 'title' && value === 'Votes') return '票数';
  if (id === 'sys:childCount') {
    const count = /^(Contents )?(\d+) cards?$/.exec(value);
    if (count) return (count[1] ? '内容：' : '') + count[2] + ' 张卡片';
  }
  if (id === 'sys:runStatus') {
    const label = value.startsWith('Run ') ? value.slice(4) : value;
    const state = runStates.get(label);
    if (state) return (label === value ? '' : '运行状态：') + state;
  }
  if (id === 'sys:cardType') {
    const prefix = value.startsWith('Card type ') ? 'Card type ' : '';
    const type = value.slice(prefix.length);
    const parts = /^(Tool|Action) \(([^()]+)\)$/.exec(type);
    const kind = parts && media.has(parts[2])
      ? cardKinds.get(parts[1]) + '（' + media.get(parts[2]) + '）' : cardKinds.get(type);
    if (kind) return (prefix ? '卡片类型：' : '') + kind;
  }
  return null;
}

export function translateGeneration(element: Element, field: string, value: string, node: Node): string | null | undefined {
  if (element.hasAttribute('data-field') && element.closest('.canvas-card-footer')) return footer(element, field, value);
  if (element.matches('.canvas-timeline-caption > span') && field === 'text') {
    if (value === 'Empty Timeline') return '空时间线';
    if (value === 'Double-click to open') return '双击打开';
    const clips = /^(\d+) clips? · (\d+(?:\.\d+)?)s$/.exec(value);
    if (clips) return clips[1] + ' 个片段 · ' + clips[2] + ' 秒';
  }
  if (element.classList.contains('canvas-timeline-card') && field === 'title' && value === 'Double-click to open Timeline') return '双击打开时间线';
  if (field === 'alt' && element.matches('.canvas-timeline-thumbnail img') && value.endsWith(' first video frame')) {
    return value.slice(0, -' first video frame'.length) + ' 的视频首帧';
  }
  if (element.classList.contains('generation-shelf-script') && element.querySelector('.generation-shelf-script-name')) return null;
  if (element.closest('.generation-shelf-script-name')) return null;
  if (element.closest('.generation-shelf-workflow-menu')) {
    if (field === 'text' && element.matches('.generation-shelf-workflow-menu-tools .merlin-panel-settings > [role="menu"] > button[role="menuitem"] > .ue-menu-label')) {
      if (value === 'Collapse all folders') return '折叠所有文件夹';
      if (value === 'Expand all folders') return '展开所有文件夹';
    }
    const viewportLabel = translateViewportScript(element, field, value);
    if (viewportLabel) return viewportLabel;
    if (element.classList.contains('ue-menu-label')) {
      // The unfiltered first direct radio row is supplied by Canvas. Other rows are named by their authors.
      const menu = element.closest('.generation-shelf-workflow-menu')!;
      const query = menu.querySelector('input')?.value.trim();
      if (query || element.parentElement !== menu.querySelector(':scope > button[role="menuitemradio"]')) return null;
      if (value === 'Choose a script') return '选择脚本';
      if (value === 'Agent chooses') return '由智能体选择';
      if (value.startsWith('Generate ') && media.has(value.slice(9))) return '生成' + media.get(value.slice(9));
      return null;
    }
    if (element.matches('.ue-menu-note[role="status"]') && field === 'text' && element.childNodes.length === 3) {
      if (element.firstChild === node && value === 'No scripts match "') return '找不到与“';
      if (element.lastChild === node && value === '".') return '”匹配的脚本。';
      return null;
    }
    if (element.matches('.generation-shelf-workflow-menu > .ue-menu-heading') && field === 'text') {
      if (value === 'scripts') return '脚本';
      return media.get(value);
    }
  }
  if (field === 'aria-label') {
    if (element.matches('.generation-shelf-workflow-trigger,.generation-shelf-workflow-menu,.generation-shelf-script')) {
      const match = /^(\w+) scripts$/.exec(value);
      if (match && media.has(match[1])) return media.get(match[1]) + '脚本';
    }
    if (element.matches('.generation-shelf-workflow-menu input')) {
      const mode = /^Search (\w+) scripts$/.exec(value)?.[1];
      if (mode) {
        const label = media.get(mode[0].toUpperCase() + mode.slice(1));
        if (label) return '搜索' + label + '脚本';
      }
    }
    if (element.classList.contains('generation-shelf-reference-pick')) {
      const label = new Map([['Start Frame reference','起始帧参考素材'],['End Frame reference','结束帧参考素材'],['Image reference','参考图像']]);
      return label.get(value);
    }
  }
  if (field === 'text' && element.matches('.generation-shelf-script > strong')) {
    if (value === 'Choose a script') return '选择脚本';
    if (value === 'Agent chooses a script') return '由智能体选择脚本';
  }
}
