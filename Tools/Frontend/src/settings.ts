// The host renders user-defined field names in the same component as built-in labels.
// Use the schema field ID before translating a label or an action containing its name.
const builtInFields = new Map<string, [string, string]>([
  ['name', ['Name', '名称']], ['rating', ['Rating', '评分']], ['votes', ['Votes', '票数']],
  ['tags', ['Tags', '标签']], ['status', ['Status', '状态']], ['notes', ['Notes', '备注']],
  ['subtype', ['Component', '组件']], ['assignees', ['Assignees', '负责人']], ['team', ['Team', '团队']],
  ['type', ['Type', '类型']], ['sys:cardType', ['Card type', '卡片类型']], ['sys:source', ['Source', '来源']],
  ['age', ['Age', '存续时间']], ['sys:prompt', ['Prompt', '提示词']], ['sys:negativePrompt', ['Negative', '负面提示词']],
  ['sys:model', ['Model', '模型']], ['sys:resolution', ['Resolution', '分辨率']], ['sys:mediaDuration', ['Duration', '时长']],
  ['sys:seed', ['Seed', '随机种子']], ['sys:sequence', ['Sequence', '序列']], ['sys:lineage', ['Lineage', '来源链']],
  ['sys:c2pa', ['Provenance', '来源凭据']], ['id', ['ID', 'ID']], ['kind', ['Kind', '种类']],
  ['createdAt', ['Created', '创建时间']], ['createdBy', ['Created by', '创建者']], ['modifiedAt', ['Modified', '修改时间']],
  ['modifiedBy', ['Modified by', '修改者']], ['sys:duration', ['Run time', '运行时间']], ['sys:metadata', ['Metadata', '元数据']],
  ['sys:childCount', ['Contents', '内容']], ['sys:description', ['Description', '描述']], ['sys:sourceFile', ['File', '文件']],
  ['sys:kindLabel', ['Kind name', '类型名称']], ['sys:runStatus', ['Run', '运行']], ['sys:sources', ['Sources', '来源']],
]);

const groupTitles = new Map<string, string>(Object.entries({
  Appearance: '外观', 'Canvas & Interaction': '画布与交互', 'Grid & Alignment': '网格与对齐',
  Graphs: '节点图', Generation: '生成', Exports: '导出', 'Toolbox Library Paths': '工具箱资源库路径',
  'Local agents': '本地智能体', 'Agent chat': '智能体对话', 'Project review catalogue': '项目审阅目录',
  Dictation: '语音输入', Share: '分享', 'Custom Fields': '自定义字段', Inspector: '检查器',
  Tooltips: '悬浮提示', Cards: '卡片', Tags: '标签', Teams: '团队', Users: '用户', Components: '组件',
  Display: '显示', Canvas: '画布', Graph: '节点图', 'Editors & Tools': '编辑器与工具', Workers: '工作进程',
  'Webcam Capture Server': '摄像头采集服务', 'Live session': '实时会话', Status: '状态', Credentials: '凭据',
  'Media Providers': '媒体服务商', 'Model Approval': '模型审批', 'By capability': '按能力',
  'Header Left': '标题栏左侧', 'Header Right': '标题栏右侧', 'Footer Left': '底栏左侧', 'Footer Right': '底栏右侧',
  'Footer left': '底栏左侧', 'Footer right': '底栏右侧',
}));

function groupTitle(title: string): string | undefined {
  if (title.startsWith('Canvas knowledge · ')) return '画布知识 · ' + title.slice('Canvas knowledge · '.length);
  const memory = /^Agent memory \((\d+)\)$/.exec(title);
  if (memory) return '智能体记忆（' + memory[1] + '）';
  return groupTitles.get(title);
}

function fieldControls(element: Element, field: string, english: string): string | undefined {
  const row = element.closest('[data-field-id]');
  if (!row) return;
  const label = builtInFields.get(row.getAttribute('data-field-id') ?? '');
  const display = (name: string) => label?.[0] === name ? label[1] : name;
  if (field === 'text' && element.parentElement === row && label?.[0] === english) return label[1];
  if (element.tagName !== 'BUTTON') return;
  if (field === 'title') {
    const hide = /^Hide "(.+)" from this layout — .*\bHidden\b.*$/.exec(english);
    if (hide) return '在此布局中隐藏“' + display(hide[1]) + '”。可以从“隐藏”分组恢复。';
  }
  if (field === 'aria-label') {
    const hide = /^Hide (.+) from this layout$/.exec(english);
    if (hide) return '在此布局中隐藏“' + display(hide[1]) + '”';
    const show = /^Show (.+) in this layout$/.exec(english);
    if (show) return '在此布局中显示“' + display(show[1]) + '”';
  }
}

export function translateSettingsDynamic(element: Element, field: string, english: string, node?: Node): string | null | undefined {
  if (!element.closest('.settings-window-body > main')) return;
  if (field === 'text') {
    // A user can name a custom field, component, canvas, or model “Save”.
    // A null result bypasses the shared dictionary for these data-bearing slots.
    const parentField = element.parentElement?.getAttribute('data-field-id');
    if (parentField && !builtInFields.has(parentField) && element.matches('span[style*="flex: 1"]')) return null;
    if (element.matches('[data-def-id]:has(button[role="switch"]:enabled) > div > span[style*="flex: 1"]')) return null;
    if (element.matches('section:not(.settings-group) label > span[title]:first-of-type')
        && element.getAttribute('title') !== 'graph-library') return null;
    if (element.matches('[data-service-id] > div:first-child > div:nth-child(-n+2)')) return null;
    if (element.matches('[role="region"] button > div > div:first-child:has([data-testid="provider-icon"])')) return null;
    if (node && element.matches('[role="region"] button > div > div:nth-child(2)')
        && (node === element.firstChild || node.previousSibling?.nodeValue?.trim() === '·')) return null;
  }
  if (element.closest('.settings-group-header')) {
    if (field === 'text' && element.closest('h3')) return groupTitle(english);
    if ((field === 'title' || field === 'aria-label') && element.matches('button[aria-expanded]')) {
      const match = /^(Expand|Collapse) (.+)$/.exec(english);
      if (match) return (match[1] === 'Expand' ? '展开' : '折叠') + '“' + (groupTitle(match[2]) ?? match[2]) + '”';
    }
  }
  if (field === 'aria-label' && element.matches('[data-zone-id] input') && english.startsWith('Rename group ')) {
    return '重命名分组“' + english.slice('Rename group '.length) + '”';
  }
  if (element.closest('[data-field-id]')) return fieldControls(element, field, english);
  if (field !== 'text') return;
  if (element.matches('[role="region"] button > div > div')) {
    const missing = /^no credential for (.+) — sign in to run "(.+)"$/.exec(english);
    if (missing) return '缺少 ' + missing[1] + ' 的凭据，登录后可运行“' + missing[2] + '”';
    const disabled = /^"(.+)" has no permitted provider route$/.exec(english);
    if (disabled) return '“' + disabled[1] + '”没有获准使用的服务商路由';
    if ((english === 'route' || english === 'routes') && /^\d+$/.test(node?.previousSibling?.nodeValue?.trim() ?? '')) return '条路由';
    if (english === 's' && /^(?:route|条路由)$/.test(node?.previousSibling?.nodeValue?.trim() ?? '')) return ' ';
  }
  if (element.matches('section:not(.settings-group) div, section:not(.settings-group) label > span:not([title])')) {
    const nodes = Array.from(element.childNodes, node => node.nodeValue?.trim() ?? '');
    // React splits counts, nouns and plural endings into adjacent text nodes.
    if (!nodes.some(value => /^\d+$/.test(value))) return;
    if (english === 'canvas') return '张画布';
    if (english === 'node') return '个节点';
    if (english === 'child canvas') return '张子画布';
    if ((english === 'es' || english === 's') && nodes.some(value => /^(canvas|child canvas|node|张画布|张子画布|个节点)$/.test(value))) return ' ';
    const children = /^\(\+ (\d+) subcanvases?\)$/.exec(english);
    if (children) return '（另有 ' + children[1] + ' 张子画布）';
  }
}
