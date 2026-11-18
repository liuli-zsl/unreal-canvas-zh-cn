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
