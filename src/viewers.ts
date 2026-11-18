export function translateViewerDynamic(element: Element, field: string, english: string): string | undefined {
  if (field !== 'text') return undefined;
  if (english.startsWith('No 3D viewer for .') && element.matches('div.nodrag.nowheel[data-scroll-passthrough] > div > span')) {
    const format = /^No 3D viewer for (\.[^\s/]+) files\.$/.exec(english);
    if (format) return `目前无法预览 ${format[1]} 文件。`;
  }
  if (english.startsWith('Downloading:') && element.matches('.nodrag.nowheel[data-scroll-passthrough] :is([class*="messageContainerPrimary"],[class*="messageContainerMin"])')) {
    const progress = /^Downloading: (\d+(?:\.\d+)?%)$/.exec(english);
    if (progress) return '正在下载：' + progress[1];
  }
  return undefined;
}