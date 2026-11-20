const sections: Record<string, string> = {
  'Canvas & interaction': '画布与交互', 'Grid & alignment': '网格与对齐',
  'Toolbox library paths': '工具箱资源库路径', 'Custom fields': '自定义字段',
  'Editors & tools': '编辑器与工具', 'Local servers': '本地服务器',
  'Webcam capture server': '摄像头采集服务器', 'Media providers': '媒体服务商',
  'Model approval': '模型审批', 'By capability': '按能力',
};
const categories: Record<string, string> = {
  'External paths': '外部路径', 'Model providers': '模型服务商', 'Model catalog': '模型目录',
  'Model schemas': '模型定义', 'Default models': '默认模型',
};
const pinTypes = new Map(Object.entries({
  text: '文本', int: '整数', float: '浮点数', image: '图像', video: '视频', audio: '音频',
}));
const comfyPinPicker = 'div:has(> div > textarea[placeholder*="ComfyUI"]) [role=combobox]:is(' +
  '[title="Pin type"],[title="引脚类型"],[data-title-tip="Pin type"],[data-title-tip="引脚类型"])';

export function translateSettingsPreview2(element: Element, field: string, english: string): string | undefined {
  if (field === 'text' && pinTypes.has(english)) {
    if (element.closest(comfyPinPicker)) return pinTypes.get(english);
    const menu = element.closest('[role=option]')?.closest('[role=listbox]');
    if (menu?.id && Array.from(element.ownerDocument.querySelectorAll(comfyPinPicker + '[aria-controls]'))
        .some(picker => picker.getAttribute('aria-controls') === menu.id)) return pinTypes.get(english);
  }
  if (field === 'text' && english.startsWith("Model '") && element.matches('.generation-shelf-status > span')) {
    const missing = /^Model '(.+)' has no confirmed credentials\. .*?(?:its key \("(.+)"\)|the Claude API key).*$/.exec(english);
    if (missing) return '模型“' + missing[1] + '”尚无已确认的凭据。请在“设置 → 模型服务商”中登录或添加' +
      (missing[2] ? '密钥“' + missing[2] + '”' : ' Claude API 密钥') + '，然后重试。';
  }
  if (field === 'text' && english.startsWith('Workflow loaded') &&
      element.matches(':is(.canvas-card-preview,.graph-node-body) div:has(> svg[data-icon="file-download"]) > span')) {
    const loaded = /^Workflow loaded · (\d+) nodes?$/.exec(english);
    if (loaded) return '已载入工作流（' + loaded[1] + ' 个节点）';
  }
  if (field === 'text' && /^\d+ nodes parsed$/.test(english) && element.matches('div:has(> textarea[placeholder*="ComfyUI"]) > div')) {
    return '已解析 ' + english.split(' ')[0] + ' 个节点';
  }
  if (!element.closest('.settings-window-body')) return;
  if (element.matches('.settings-group-header h3, .settings-group-header h3 span') && field === 'text') return sections[english];
  if (element.matches('.settings-group-header button[aria-expanded]') && (field === 'title' || field === 'aria-label')) {
    const toggle = /^(Expand|Collapse) (.+)$/.exec(english);
    if (toggle && sections[toggle[2]]) return (toggle[1] === 'Expand' ? '展开' : '折叠') + '“' + sections[toggle[2]] + '”';
  }
  if (element.matches('.settings-pane-header input[type="search"]') && (field === 'aria-label' || field === 'placeholder')) {
    const search = /^Search (.+?)(?: settings|…)$/.exec(english);
    if (search && categories[search[1]]) return '搜索' + categories[search[1]] + (field === 'placeholder' ? '…' : '设置');
  }
  if (field === 'text' && element.matches('.settings-window-body [role="region"] button > div > div')) {
    const missing = /^no credential for (.+?);.*? to run "(.+)"$/.exec(english);
    if (missing) return '缺少 ' + missing[1] + ' 的凭据。请在“设置 → 模型服务商”中登录或添加密钥，以运行“' + missing[2] + '”。';
    const disabled = /^no provider is allowed to run "(.+)"$/.exec(english);
    if (disabled) return '没有获准运行“' + disabled[1] + '”的服务商。';
  }
  if (field === 'text' && element.matches('.settings-row-value div[id], .settings-row-value span')) {
    const noServer = /^No ComfyUI server is saved for (.+?),.*$/.exec(english);
    if (noServer) return '尚未为 ' + noServer[1] + ' 保存 ComfyUI 服务器，Unreal Canvas 不会在该地址启动服务。';
    const args = /^(\d+) arguments?$/.exec(english);
    if (args) return args[1] + ' 个参数';
  }
}
