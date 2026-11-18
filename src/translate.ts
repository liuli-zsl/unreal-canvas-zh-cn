import { copyId, copyKey, keyLength } from './copy-id';
export interface Group {
  selector: string;
  fields: string[];
  entries: Record<string, string | undefined>;
}
type Entry = { original: string; displayed: string };
type Rule = { selector: string; translation: string };
const attributes = ['title', 'aria-label', 'placeholder', 'data-tooltip'];
const scopeAttributes = ['class', 'role', 'contenteditable', 'translate', 'data-testid', 'data-package-row'];
const protectedContent = 'script,style,pre,code,[translate="no"],[data-merlin-text-surface],.agent-chat-message,.canvas-card-header,.agent-attention-preview,.agent-model-name,.agent-assignee-name,.agent-current-task-title,.merlin-scripts-name,.merlin-scripts-row-name,.merlin-graphs-tile-label,.credential-row-label,.merlin-ops-name';
const editableContent = '[contenteditable]:not([contenteditable="false"]),input,textarea,[role="textbox"]';
const searchMessageStart = 'No settings in this category match “';
const searchEndId = '38f7650709e6c304';
const searchMessageStartZh = '当前分类没有与“';
const searchMessageEndZh = '”匹配的设置。要搜索其他分类，请先在左侧选择。';

export function localize(doc: Document, dictionary: Group[]) {
  const rules = new Map<string, Rule[]>();
  const helpLengths = new Set<number>();
  for (const group of dictionary) {
    for (const [english, translation] of Object.entries(group.entries)) {
      if (!translation) continue;
      const length = keyLength(english);
      if (length !== undefined) helpLengths.add(length);
      for (const field of group.fields) {
        const key = field + '\n' + english;
        const candidates = rules.get(key) ?? [];
        candidates.push({ selector: group.selector, translation });
        rules.set(key, candidates);
      }
    }
  }
  const originals = new Map<Node, Map<string, Entry>>();
  function put(node: Node, field: string, value: string) {
    if (field === 'text') node.nodeValue = value;
    else (node as Element).setAttribute(field, value);
  }
  function read(node: Node, field: string) {
    return field === 'text' ? node.nodeValue : (node as Element).getAttribute(field);
  }
  function translate(node: Node, element: Element, field: string) {
    const value = read(node, field);
    const fields = originals.get(node);
    const prior = fields?.get(field);
    const original = prior && prior.displayed === value ? prior.original : value;
    const english = original?.trim();
    const candidates = english && (rules.get(field + '\n' + english)
      ?? (helpLengths.has(english.length) ? rules.get(field + '\n' + copyKey(english)) : undefined));
    let translated = candidates && candidates.find(rule => element.matches(rule.selector))?.translation;
    if (!translated && english) translated = translateDynamic(element, field, english);
    if (field === 'text' && isSettingsSearchMessage(element)) {
      // React renders the user's query as a separate text node between these labels.
      translated = undefined;
      if (node === element.firstChild) translated = searchMessageStartZh;
      if (node === element.lastChild) translated = searchMessageEndZh;
    }
    const packageName = element.closest('[data-package-row]')?.getAttribute('data-package-row');
    const modelName = element.querySelector(':scope > [data-testid="provider-icon"]');
    if (english === packageName || modelName || element.matches('[data-testid="provider-icon"]')) translated = undefined;
    const tabAction = isTabCloseAttribute(element, field) && english?.startsWith('Close ');
    if (translated && (element.closest(protectedContent) || (element.closest('.merlin-canvas-tab') && !tabAction) || (field === 'text' && element.closest(editableContent + ',option[value="custom"]')))) translated = undefined;
    if (translated && original && english) {
      const start = original.indexOf(english);
      const displayed = original.slice(0, start) + translated + original.slice(start + english.length);
      if (value !== displayed) {
        const entries = fields ?? new Map<string, Entry>();
        entries.set(field, { original, displayed });
        originals.set(node, entries);
        put(node, field, displayed);
      }
    } else if (prior && fields) {
      if (value === prior.displayed) put(node, field, prior.original);
      fields.delete(field);
      if (!fields.size) originals.delete(node);
    }
  }
  function visit(node: Node) {
    if (node.nodeType === 3 && node.parentElement) translate(node, node.parentElement, 'text');
    else if (node.nodeType === 1) {
      const element = node as Element;
      for (const field of attributes) if (element.hasAttribute(field) || originals.get(node)?.has(field)) translate(node, element, field);
    }
  }
  function walk(root: Node, fn: (node: Node) => void) {
    fn(root);
    const walker = doc.createTreeWalker(root, 5); // SHOW_ELEMENT | SHOW_TEXT
    while (walker.nextNode()) fn(walker.currentNode);
  }
  function restore(node: Node) {
    const entries = originals.get(node);
    if (!entries) return;
    for (const [field, entry] of entries) if (read(node, field) === entry.displayed) put(node, field, entry.original);
    originals.delete(node);
  }
  const observer = new doc.defaultView!.MutationObserver(records => {
    const roots = new Set<Node>();
    for (const record of records) {
      if (record.type === 'childList') {
        for (const removed of record.removedNodes) if (!doc.contains(removed)) walk(removed, restore);
        for (const added of record.addedNodes) roots.add(added);
      } else if (record.type === 'characterData') roots.add(record.target);
      else if (record.attributeName && doc.contains(record.target)) {
        if (scopeAttributes.includes(record.attributeName)) roots.add(record.target);
        else translate(record.target, record.target as Element, record.attributeName);
      }
    }
    for (const root of roots) {
      if (!doc.contains(root)) continue;
      let parent = root.parentNode;
      while (parent && !roots.has(parent)) parent = parent.parentNode;
      if (!parent) walk(root, visit);
    }
  });
  walk(doc.body ?? doc.documentElement, visit);
  observer.observe(doc.documentElement, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...attributes, ...scopeAttributes]});
  return () => { observer.disconnect(); for (const node of originals.keys()) restore(node); };
}

function isTabCloseAttribute(element: Element, field: string) {
  return (field === 'title' || field === 'aria-label') && element.matches('.merlin-canvas-tab > button.merlin-canvas-tab-close');
}

function isSettingsSearchMessage(element: Element): boolean {
  if (element.tagName !== 'P' || !element.matches('.settings-window-body > main > p')) return false;
  const first = element.firstChild?.nodeValue;
  const last = element.lastChild?.nodeValue;
  return (first === searchMessageStart || first === searchMessageStartZh)
    && (last === searchMessageEndZh || (!!last && copyId(last) === searchEndId));
}

function translateDynamic(element: Element, field: string, english: string): string | undefined {
  if (isTabCloseAttribute(element, field) && english.startsWith('Close ')) return '关闭 ' + english.slice(6);
  if (field === 'title' && element.matches('.merlin-inspector-panel span[title]')) {
    const copyHint = /\n\n\(right-click to copy\)$/.exec(english);
    if (copyHint) return english.slice(0, copyHint.index) + '\n\n（右键复制）';
  }
  if (field !== 'text') return;
  if (element.closest('.merlin-generation-shelf')) {
    const missing = /^Model '(.+)' has no confirmed credentials\..*?\bconfigure (.+?) in Settings\b.*$/.exec(english);
    if (missing) return '模型“' + missing[1] + '”尚无已确认的凭据。请登录或在设置中配置 ' + missing[2] + '，然后重试。';
  }
  if (element.matches('.merlin-panel-count,.merlin-panel-count-pill,.merlin-panel-chip-count')) {
    const tools = /^(\d+) tools?$/.exec(english);
    if (tools) return tools[1] + ' 个工具';
    const items = /^(\d+) items?$/.exec(english);
    if (items) return items[1] + ' 项';
  }
}
