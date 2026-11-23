import { copyKey } from './copy-id';

const closeGraphButton = '[data-merlin-canvas-surface] > [data-merlin-punch-cover] > span > button:has(> svg[data-icon="close"])';
const toolbarButton = '.canvas-tool-palette button[data-app-tooltip]';
const toolbarTooltipLine = '[role="tooltip"][data-portal-popup] > div:only-child > div:only-child > div:not(:has(*))';
const toolbarTools = [
  { title: 'Select', label: '选择', key: '#27:5324499e7f3fb863', detail: '选择、移动卡片并调整大小' },
  { title: 'Annotate', label: '批注', key: '#47:ad5834405fadb661', detail: '在画布和卡片上绘制形状与标记' },
  { title: 'Connector', label: '连接线', key: '#40:cf3d70940b3e5fb2', detail: '在画布对象之间绘制连接线' },
  { title: 'Frame', label: '框架', key: '#43:24ed411515102f59', detail: '拖出框架以组织和排列卡片' },
  { title: 'Comment', label: '评论', key: '#26:a227813f159a07f2', detail: '给卡片添加评论' },
  { title: 'Insert', label: '插入', key: '#51:a154afaea67fdcc6', detail: '添加文本便笺、卡片、节点图、容器和文件' },
];

function translateToolbar(element: Element, field: string, english: string) {
  const button = (field === 'aria-label' || field === 'aria-description') && element.matches(toolbarButton);
  const line = field === 'text' && element.matches(toolbarTooltipLine);
  if (!button && !line) return;

  // The hover text is rendered in a portal without a link back to its button.
  const nextLine = element.nextElementSibling;
  const title = button
    ? (field === 'aria-label' ? english : element.getAttribute('aria-label'))
    : (nextLine ? english : element.previousElementSibling?.textContent);
  const detail = button
    ? (field === 'aria-description' ? english : element.getAttribute('aria-description'))
    : (nextLine ? nextLine.textContent : english);
  if (!title || !detail) return;

  const shortcut = / \(.+\)$/.exec(title)?.[0] ?? '';
  const name = title.slice(0, title.length - shortcut.length);
  const tool = toolbarTools.find(tool => tool.title === name || tool.label === name);
  if (!tool || (detail !== tool.detail && copyKey(detail) !== tool.key)) return;
  return (button ? field === 'aria-label' : !!nextLine) ? tool.label + shortcut : tool.detail;
}

function currentGraphName(button: Element) {
  const surface = button.closest('[data-merlin-canvas-surface]');
  const crumbs = surface?.querySelector(':scope > div > [data-merlin-punch-cover]:has(> svg[data-icon="chevron-right"])');
  return crumbs?.lastElementChild?.lastElementChild?.textContent;
}

export function translateCanvasAction(element: Element, field: string, english: string): string | undefined {
  const toolbar = translateToolbar(element, field, english);
  if (toolbar !== undefined) return toolbar;

  if (field === 'text' && element.closest('button[data-result-index]')) {
    // Canvas search highlights substrings in separate spans. The first line contains
    // the swatch, user-owned name, and built-in type. Later lines are path or content.
    if (element.closest('button[data-result-index] > span:first-child > span:nth-child(2),button[data-result-index] > span:nth-child(n+2)')) {
      return english;
    }
  }
  if (field === 'title' && english.startsWith('Navigate to ') &&
      element.matches('[data-merlin-canvas-surface] [data-merlin-punch-cover]:has(> svg[data-icon="chevron-right"]) > span[title]')) {
    const name = element.lastElementChild?.textContent;
    if (name && english === 'Navigate to ' + name) return '前往“' + name + '”';
  }
  if (field === 'aria-label' && english.startsWith('Close ') && element.matches(closeGraphButton)) {
    const name = currentGraphName(element);
    if (name && english === 'Close ' + name) return '关闭“' + name + '”';
  }
  if (field === 'text' && english.startsWith('Close ') && english.endsWith(' and go back up') &&
      element.matches('[role="tooltip"][id]')) {
    for (const button of element.ownerDocument.querySelectorAll(closeGraphButton)) {
      if (!button.parentElement?.getAttribute('aria-describedby')?.split(/\s+/).includes(element.id)) continue;
      const name = currentGraphName(button);
      if (name && english === 'Close ' + name + ' and go back up') return '关闭“' + name + '”并返回上一级';
    }
  }
  if (field === 'aria-label' && element.matches('.frame-color-swatches button')) {
    const color = /^Suggested (#[0-9a-f]{6})$/i.exec(english);
    if (color) return '推荐颜色 ' + color[1];
  }
  if (field === 'aria-label' && element.matches('.annotation-toolbar button')) {
    const swatch = /^(Outline|Fill) (#[0-9a-f]{6})$/i.exec(english);
    if (swatch) return (swatch[1] === 'Outline' ? '描边 ' : '填充 ') + swatch[2];
  }
  if (field === 'aria-label' && element.matches('.react-flow__handle')) {
    const pin = /^(input|output) pin ([\s\S]+)$/.exec(english);
    if (pin) return (pin[1] === 'input' ? '输入引脚 ' : '输出引脚 ') + pin[2];
  }
  if (field === 'title' && element.matches('.graph-node-header-title span[title]')) {
    const suffix = ' — Double-click to rename';
    if (english.endsWith(suffix)) return english.slice(0, -suffix.length) + ' — 双击重命名';
  }
  if (field === 'text' && element.matches('.ue-menu:has(button:is([aria-label="Close search"],[aria-label="关闭搜索"])) .merlin-panel-search-count')) {
    const results = /^(\d+) results?$/.exec(english);
    if (results) return results[1] + ' 个结果';
  }
}
