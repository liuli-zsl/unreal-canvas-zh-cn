const mediaTypes: Record<string, string> = {
  Image: '图像', Video: '视频', Audio: '音频', Mesh: '网格', Text: '文本', File: '文件', Splat: '高斯泼溅',
};

function libraryCardTitle(card: Element, english: string) {
  const name = card.querySelector('.media-library-caption strong')?.textContent;
  if (!name || !english.startsWith(name + '\n')) return;
  const detail = english.slice(name.length + 1);
  if (card.classList.contains('media-library-archived-card')) {
    const archive = /^Archived (.+)\nWas on ([\s\S]*)\nRight-click to restore\b.*$/.exec(detail);
    if (archive) return name + '\n归档时间：' + archive[1] + '\n原画布：' + archive[2] + '\n右键可恢复，或拖到画布上恢复';
    return;
  }
  const lines = detail.split('\n');
  // A single usage has a type, breadcrumb and filename. The fourth line is produced only for multiple usages.
  if (lines.length < 3 || !(lines[0] in mediaTypes)) return;
  lines[0] = mediaTypes[lines[0]];
  if (lines.length === 4) lines[2] = lines[2].replace(/^Used in (\d+) places: /, '共 $1 处引用：');
  return [name, ...lines].join('\n');
}

function archiveDialogTitle(english: string) {
  const single = /^Delete “([\s\S]*)” permanently\?$/.exec(english);
  if (single) return '永久删除“' + single[1] + '”？';
  const multi = /^Delete (\d+) archived cards permanently\?$/.exec(english);
  if (multi) return '永久删除 ' + multi[1] + ' 张已归档卡片？';
}

export function translateMediaDetails(element: Element, field: string, english: string, node: Node): string | undefined {
  if (field === 'title' && element.classList.contains('media-library-card')) return libraryCardTitle(element, english);
  if ((field === 'title' || field === 'aria-label') && element.matches('.card-version-tray button')) {
    const choose = /^Show ([\s\S]+) as the component card's face$/.exec(english);
    if (choose) return '将“' + choose[1] + '”显示在组件卡片正面';
    const active = /^([\s\S]+) — the component card's face$/.exec(english);
    if (active) return '组件卡片正面当前显示“' + active[1] + '”';
  }
  if (field === 'aria-label') {
    if (element.classList.contains('media-library-select') && english.startsWith('Select ')) return '选择“' + english.slice(7) + '”';
    if (element.classList.contains('media-library-locate') && english.startsWith('Show ') && english.endsWith(' on the canvas')) {
      return '在画布中定位“' + english.slice(5, -14) + '”';
    }
    if (element.classList.contains('media-library-open-viewer') && english.startsWith('Open Viewer — ')) {
      return '在查看器中打开“' + english.slice('Open Viewer — '.length) + '”';
    }
    if (element.matches('.media-library-results [role="dialog"]')) return archiveDialogTitle(english);
  }
  if (field !== 'text') return;
  if (element.matches('.media-library-results [role="dialog"] > div:first-child')) return archiveDialogTitle(english);
  if (element.matches('.media-library-archived-card .media-library-caption > span') && element.firstChild === node && english === 'Archived') return '归档于';
  if (element.classList.contains('ue-menu-label') && element.closest('.ue-menu')?.parentElement?.querySelector('.media-library')) {
    const prefix = element.firstChild?.nodeValue?.trim();
    // The prefix, authored card name, separator and canvas breadcrumb are separate React text nodes.
    // Keep their actual spelling even when the node is named "Open" or the canvas is named "Save".
    if ((prefix === 'Show in' || prefix === '定位到') && element.childNodes.length === 4 && element.childNodes[2].nodeValue === ' · ') {
      return node === element.firstChild ? '定位到' : english;
    }
    const restore = /^Restore (\d+) cards$/.exec(english);
    if (restore) return '恢复 ' + restore[1] + ' 张卡片';
    const remove = /^Delete (\d+) cards permanently$/.exec(english);
    if (remove) return '永久删除 ' + remove[1] + ' 张卡片';
    const files = /^Copy (\d+) file paths$/.exec(english);
    if (files) return '复制 ' + files[1] + ' 个文件路径';
  }
  if (element.localName === 'button' && element.childNodes.length === 5 && !element.hasAttribute('title')
    && element.closest('.nodrag.nowheel:has(.merlin-pane-collapse[aria-expanded])')) {
    const prefix = element.firstChild?.nodeValue;
    if (prefix !== 'Load more (' && prefix !== '加载更多（已显示 ') return;
    if (node === element.firstChild) return '加载更多（已显示 ';
    if (node === element.childNodes[2] && english === 'of') return '/';
    if (node === element.lastChild && english === ')') return '）';
  }
}
