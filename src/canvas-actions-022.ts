const closeGraphButton = '[data-merlin-canvas-surface] > [data-merlin-punch-cover] > span > button:has(> svg[data-icon="close"])';

function currentGraphName(button: Element) {
  const surface = button.closest('[data-merlin-canvas-surface]');
  const crumbs = surface?.querySelector(':scope > div > [data-merlin-punch-cover]:has(> svg[data-icon="chevron-right"])');
  return crumbs?.lastElementChild?.lastElementChild?.textContent;
}

export function translateCanvasAction(element: Element, field: string, english: string): string | undefined {
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
