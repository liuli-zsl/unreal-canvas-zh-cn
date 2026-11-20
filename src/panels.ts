import { copyId } from './copy-id';
const panelNames: Record<string, string | undefined> = {
  Agents: '智能体',
  Library: '资源库',
  Toolbox: '工具箱',
  Inspector: '检查器',
  Operations: '操作记录',
  'Script details': '脚本详情',
  'Live logging': '实时日志',
  Execution: '执行',
  Viewer: '查看器',
};

const outputTypes: Record<string, string | undefined> = {
  Image: '图像', Video: '视频', Audio: '音频', Text: '文本', Mesh: '网格',
  Number: '数值', Boolean: '布尔值', Integer: '整数', Float: '浮点数',
  String: '字符串', Object: '对象', File: '文件', Color: '颜色', Vector: '向量',
};

const noScriptsStart = 'No scripts match “';
const noScriptsEnd = '”.';
const noScriptsStartZh = '没有与“';
const noScriptsEndZh = '”匹配的脚本。';

export function translatePanelsDynamic(element: Element, field: string, english: string, node: Node): string | null | undefined {
  const classes = element.classList;
  // Subview titles come from the selected script/card. A back button distinguishes them from panel labels.
  if (classes.contains('merlin-panel-title') && element.previousElementSibling?.classList.contains('merlin-pane-back')) return null;
  if (classes.contains('merlin-panel-chip') && element.parentElement?.firstElementChild !== element &&
      element.closest('.media-library') && !['Limited to the selected cards', 'Limited to the selected Library items'].includes(english)) return null;
  // Facet menus can contain arbitrary folder, tag, person and saved filter names.
  if ((field === 'text' && (classes.contains('ue-menu-label') || element.parentElement?.classList.contains('ue-menu-label'))) ||
      (field === 'aria-label' && classes.contains('ue-menu-item'))) {
    if (element.closest('.filter-saved-row')) return null;
    const facetPane = element.closest('.nodrag.nowheel > .ue-menu:not(:first-child)');
    if (facetPane && element.closest('button[aria-pressed]')) {
      const activeFacet = facetPane.previousElementSibling?.querySelector('button[aria-expanded="true"] > .ue-menu-label')?.textContent?.trim();
      if (!activeFacet || !['Location', '位置', 'Output', '输出', 'Age', '时间', 'Votes', '投票', 'Status', '状态', 'Type', '类型'].includes(activeFacet)) return null;
    }
  }
  if (field === 'text') {
    if (element.closest(':is(.agent-onboarding-select[role=combobox],[role=listbox]):is([aria-label="Model for your first chat"],[aria-label="首次对话使用的模型"])')) return null;
    if (element.matches('.agent-onboarding-content > p')) {
      // React supplies the provider and model labels as separate text nodes.
      const parts = element.childNodes;
      if (parts.length > 1) {
        if (parts.length === 2 && node === parts[1] && copyId(english) === 'dbd98086296d67df') {
          return '已就绪。发送测试消息即可检查所选模型。';
        }
        if (parts.length === 4 && node === parts[1] && english === 'replied successfully. Your first chat will use') return '已回复。首次对话将使用';
        if (parts.length === 4 && node === parts[3] && english === '.') return '。';
        if (parts.length === 3 && node === parts[0] && english === 'Set up previously:') return '此前已配置：';
        if (parts.length === 3 && node === parts[2] && copyId(english) === '62970e1b3528296c') return '。选择一项即可检查或更改连接。';
        if (parts.length !== 3 && node === parts[0] && english === 'API connection') return 'API 连接';
        return null;
      }
      if (element.getAttribute('role') === 'status') {
        const connecting = /^Connecting to (.+) and loading its models…$/.exec(english);
        if (connecting) return '正在连接 ' + (connecting[1] === 'API connection' ? 'API 连接' : connecting[1]) + ' 并加载模型列表…';
        const testing = /^(.+) is responding to the connection test…$/.exec(english);
        if (testing) return (testing[1] === 'API connection' ? 'API 连接' : testing[1]) + ' 正在响应连接测试…';
      }
    }
    // Canvas renders the exact search query as a separate Text node, even when it names a UI action.
    if (classes.contains('merlin-graphs-empty') && element.childNodes.length === 3) {
      const first = element.firstChild;
      const last = element.lastChild;
      if ([noScriptsStart, noScriptsStartZh].includes(first?.nodeValue ?? '') &&
          [noScriptsEnd, noScriptsEndZh].includes(last?.nodeValue ?? '')) {
        if (node === first) return noScriptsStartZh;
        if (node === last) return noScriptsEndZh;
        return null;
      }
    }
    if (classes.contains('merlin-panel-search-count')) {
      const result = /^(\d+) results?$/.exec(english);
      if (result) return `${result[1]} 个结果`;
    }
    return undefined;
  }
  if (field !== 'aria-label' && field !== 'title') return undefined;
  if (classes.contains('media-library-size')) {
    const size = /^Thumbnail size: (\d+)px$/.exec(english);
    if (size) return `缩略图大小：${size[1]} 像素`;
  }
  if (classes.contains('merlin-script-output-icons') && english.startsWith('Outputs: ')) {
    const types = english.slice('Outputs: '.length).split(', ');
    return '输出：' + types.map(type => Object.prototype.hasOwnProperty.call(outputTypes, type) ? outputTypes[type] : type).join('、');
  }
  if (classes.contains('merlin-panel-control-btn')) {
    for (const [name, label] of Object.entries(panelNames)) {
      if (english === 'Close ' + name) return '关闭' + label;
      if (english === 'Fill Canvas with ' + name) return '用' + label + '填满画布';
      if (english === 'Restore ' + name + ' Side Panel') return '还原' + label + '侧栏';
    }
  }
  if (classes.contains('merlin-rail-pin')) {
    const pinned = /^Pinned to (.+) — click to release$/s.exec(english);
    if (pinned) return `已固定到${pinned[1]}，点击取消固定`;
  }
  if (classes.contains('merlin-scripts-row-count')) {
    const uses = /^(\d+) (?:cards? )?on this canvas$/.exec(english);
    if (uses) return `当前画布有 ${uses[1]} 张卡片使用此脚本`;
  }
  return undefined;
}
