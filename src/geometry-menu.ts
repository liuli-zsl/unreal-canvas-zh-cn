import catalog from './locales/geometry-menu.json';

const categories = new Map(Object.entries(catalog.categories));
const operations = new Map(Object.entries(catalog.operations));
const nodePicker = '.pill-menu:has(.merlin-panel-search),.ue-menu:has(input:is([aria-label="Search nodes"],[aria-label="搜索节点"]))';

export function translateGeometryMenu(element: Element, field: string, english: string): string | undefined {
  if (field !== 'text') return;
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
