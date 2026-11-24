const mediaTypes: Record<string, string> = {
  Image: '图像', Video: '视频', Audio: '音频', Mesh: '网格', Text: '文本', File: '文件', Splat: '高斯泼溅',
};

export function translateMediaTypeLabel(english: string): string | undefined {
  if (Object.prototype.hasOwnProperty.call(mediaTypes, english)) return mediaTypes[english];
}

const cardTypes = new Map(Object.entries({
  Action: '操作', Deck: '卡组', 'Component Card': '组件卡片', Reference: '引用', Tool: '工具', Component: '组件',
}));

const cardSubtypes = new Map(Object.entries({
  Graph: '节点图', Model: '模型', ImageGen: '生成图像', VideoGen: '生成视频', AudioGen: '生成音频',
  MeshGen: '生成网格', SplatGen: '生成高斯泼溅', TextGen: '生成文本',
}));

export function translateCardTypeLabel(english: string) {
  const type = cardTypes.get(english);
  if (type) return type;
  const derived = /^([^(]+) \((.+)\)$/.exec(english);
  const parent = derived && cardTypes.get(derived[1]);
  if (derived && parent) return parent + '（' + (cardSubtypes.get(derived[2]) ?? derived[2]) + '）';
}

function libraryCardTitle(card: Element, english: string) {
  const name = card.querySelector('.media-library-caption strong')?.textContent;
  if (!name || !english.startsWith(name + '\n')) return;
  const detail = english.slice(name.length + 1);
  if (card.classList.contains('media-library-archived-card')) {
    const archive = /^(?:(.+)\n)?Archived (.+)\nWas on ([\s\S]*)\nRight-click to restore\b.*$/.exec(detail);
    if (archive) {
      const type = archive[1] ? '\n' + (translateCardTypeLabel(archive[1]) ?? archive[1]) : '';
      return name + type + '\n归档时间：' + archive[2] + '\n原画布：' + archive[3] + '\n右键可恢复，或拖到画布上恢复';
    }
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
    if (element.classList.contains('media-library-open-viewer')) {
      const viewer = /^Open [Vv]iewer — ([\s\S]+)$/.exec(english);
      if (viewer) return '在查看器中打开“' + viewer[1] + '”';
    }
    if (element.matches('.media-library-type-icon[role="img"]')) return translateMediaTypeLabel(english);
    if (element.classList.contains('media-library-usage')) {
      const used = /^Used in (\d+) places?$/.exec(english);
      if (used) return '共 ' + used[1] + ' 处引用';
    }
    if (element.matches('.media-library-results [role="dialog"]')) return archiveDialogTitle(english);
  }
  if (field !== 'text') return;
  if (element.matches('.media-library-results [role="dialog"] > div:first-child')) return archiveDialogTitle(english);
  if (element.matches('.media-library-archived-card :is(.media-library-caption,.media-library-card-meta) > span')
      && element.firstChild === node && english === 'Archived') return '归档于';
  if (element.matches('.media-library-archived-card .media-library-card-meta > span:first-child:not(:only-child)')) {
    return translateCardTypeLabel(english);
  }
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
