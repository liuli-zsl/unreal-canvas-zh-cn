import catalog from './locales/geometry-menu.json';
import { renderedFiber } from './host-fiber';

const categories = new Map(Object.entries(catalog.categories));
const operations = new Map(Object.entries(catalog.operations));
const nodePicker = '.pill-menu:has(.merlin-panel-search),.ue-menu:has(input:is([aria-label="Search nodes"],[aria-label="搜索节点"]))';
const logicNodes = new Map([
  ['Format String', { kind: 'formatString', label: '格式化字符串' }],
  ['Text Extract', { kind: 'textExtract', label: '提取文本' }],
]);

type PickerEntry = { label?: string; kind?: string; category?: string; customNodeId?: string; source?: { key?: string } };

function isBuiltinLogicRow(element: Element, english: string, kind: string) {
  const button = element.parentElement;
  if (!button?.matches('.ue-submenu button.ue-menu-item') || !element.classList.contains('ue-menu-label') ||
      !button.closest(nodePicker)) return false;
  const row = renderedFiber<{label?: string; entries?: PickerEntry[]}>(button)?.return;
  if (row?.key !== kind || row.memoizedProps?.label !== english) return false;
  // The category component owns the node definitions. A custom script can use
  // the very same ID and label. Flat search results omit this source metadata.
  for (let group = row.return; group; group = group.return) {
    const entries = group.memoizedProps?.entries;
    if (!Array.isArray(entries)) continue;
    const matching = entries.filter(entry => entry?.label === english &&
      (entry.source?.key ?? entry.customNodeId ?? entry.kind) === kind);
    return matching.length === 1 && matching[0].kind === kind && matching[0].category === 'Logic' &&
      !matching[0].customNodeId && !matching[0].source;
  }
  return false;
}

export function translateGeometryMenu(element: Element, field: string, english: string): string | undefined {
  if (field !== 'text') return;
  const logic = logicNodes.get(english);
  if (logic) return isBuiltinLogicRow(element, english, logic.kind) ? logic.label : undefined;
  const category = categories.get(english);
  const operation = operations.get(english);
  if (!category && !operation) return;
  const isLabel = element.classList.contains('ue-menu-label');
  const isCategoryHint = element.classList.contains('ue-menu-count');
  if ((!isLabel && !isCategoryHint) || !element.closest(nodePicker)) return;
  const button = element.parentElement;
  if (!button || button.tagName !== 'BUTTON') return;
  // Canvas 0.21 exposes the built-in geometry rows using a mint geometric swatch.
  // User nodes use an orange swatch even when their name matches a GeometryScript function.
  const swatch = button.querySelector<HTMLElement>(':scope > .ue-menu-icon > span');
  if (swatch?.style.backgroundColor !== 'rgb(110, 231, 183)') return;
  return isCategoryHint || button.hasAttribute('aria-haspopup') ? category : operation;
}
