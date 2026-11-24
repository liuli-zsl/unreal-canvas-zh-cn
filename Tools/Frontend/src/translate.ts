import { copyId, copyKey, keyLength } from './copy-id';
import { toolboxScriptNameSelector, translateGeneration, translateToolboxScriptName } from './generation';
import { translateMenuDynamic } from './menu-dynamic';
import { translateGraphContext } from './graph-context';
import { translatePanelsDynamic } from './panels';
import { translateSettingsDynamic } from './settings';
import { translateViewerDynamic } from './viewers';
import { translateCanvasAction } from './canvas-actions-022';
import { translatePanelActions } from './panel-actions-022';
import { translateSettingsActions } from './settings-actions-022';
import { translateSettingsPreview2 } from './settings-preview2';
import { translateShelfAction } from './shelf-actions';
import type { ReadonlyCanvasState } from '@merlin/plugin-api';
import { createWorkspaceTranslator } from './workspace-details';
import { translateMediaDetails } from './media-details';
import { translateEditorConnection } from './editor-connection';
import { translateGeometryMenu } from './geometry-menu';
import { translateNodeHover } from './node-hover';
import { translatePanelDetails } from './panel-details';
import { isAgentChatChrome, translateAgentChat } from './agent-chat';
import { translateAgentModelPlaceholder, translateAgentSettings } from './agent-settings';

export interface Group {
  selector: string;
  fields: string[];
  entries: Record<string, string | undefined>;
}
type Entry = { original: string; displayed: string };
type Rule = { selector: string; translation: string };
const attributes = ['title', 'aria-label', 'aria-description', 'placeholder', 'data-tooltip', 'data-title-tip', 'alt'];
const scopeAttributes = ['class', 'role', 'contenteditable', 'translate', 'data-testid', 'data-package-row', 'data-value', 'data-role', 'disabled', 'aria-checked'];
const protectedContent = 'script,style,pre,code,.cm-content,.view-lines,[translate="no"],[data-merlin-text-surface],.canvas-card-header,.agent-attention-preview,.agent-assignee-name,.agent-current-task-title,.merlin-scripts-name,.credential-row-label,.merlin-ops-name';
const editableContent = '[contenteditable]:not([contenteditable="false"]),input,textarea,[role="textbox"]';
const searchMessageStart = 'No settings in this category match “';
const searchEndId = '38f7650709e6c304';
const searchMessageStartZh = '当前分类没有与“';
const searchMessageEndZh = '”匹配的设置。要搜索其他分类，请先在左侧选择。';

export function localize(doc: Document, dictionary: Group[], readCanvas?: () => ReadonlyCanvasState) {
  const translateWorkspaceDetails = createWorkspaceTranslator(readCanvas);
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
    const toolboxScriptName = english && translateToolboxScriptName(element, field, english, readCanvas);
    let translated: string | null | undefined;
    const candidates = english ? (rules.get(field + '\n' + english)
      ?? (helpLengths.has(english.length) ? rules.get(field + '\n' + copyKey(english)) : undefined)) : undefined;
    const splitMessage = element.classList.contains('ue-menu-note') || element.classList.contains('merlin-graphs-empty')
      || (english === '.' && element.matches('.agent-onboarding-content > p,.agent-setup-hint'))
      || (english === '”.' && element.classList.contains('agent-model-empty'))
      || (english === '?' && element.matches('.generation-shelf-approval > strong'));
    if (toolboxScriptName) {
      translated = toolboxScriptName;
    } else if (english && element.closest('.agent-chat-message')) {
      // A user's message can contain the same strings as any of the system controls.
      if (isAgentChatChrome(element, field)) translated = translateAgentChat(element, field, english, node);
    } else if (english && (candidates || splitMessage || english === '(' || /[A-Za-z]/.test(english))) {
      translated = translateAgentSettings(element, field, english, node);
      if (translated === undefined) translated = translateAgentChat(element, field, english, node);
      if (translated === undefined) translated = translateEditorConnection(element, field, english, node);
      if (translated === undefined) translated = translateGeometryMenu(element, field, english);
      if (translated === undefined) translated = translateNodeHover(element, field, english);
      if (translated === undefined) translated = translateMediaDetails(element, field, english, node);
      if (translated === undefined) translated = translateWorkspaceDetails(element, field, english, node);
      if (translated === undefined) translated = translatePanelDetails(element, field, english, node);
      if (translated === undefined) translated = translatePanelsDynamic(element, field, english, node);
      if (translated === undefined) translated = translateCanvasAction(element, field, english);
      if (translated === undefined) translated = translatePanelActions(element, field, english);
      if (translated === undefined) translated = translateSettingsPreview2(element, field, english, node);
      if (translated === undefined) translated = translateSettingsActions(element, field, english);
      if (translated === undefined) translated = translateShelfAction(element, field, english);
      if (translated === undefined) translated = translateGeneration(element, field, english, node);
      if (translated === undefined) translated = translateSettingsDynamic(element, field, english, node);
      if (translated === undefined) translated = translateMenuDynamic(element, field, english);
      if (translated === undefined) translated = translateGraphContext(element, field, english);
      if (translated === undefined) translated = translateViewerDynamic(element, field, english);
      if (translated === undefined) {
        translated = candidates?.find(rule => element.matches(rule.selector))?.translation ?? translateDynamic(element, field, english);
      }
    }
    if (field === 'text' && isSettingsSearchMessage(element)) {
      // React renders the user's query as a separate text node between these labels.
      translated = undefined;
      if (node === element.firstChild) translated = searchMessageStartZh;
      if (node === element.lastChild) translated = searchMessageEndZh;
    }
    if (translated) {
      const packageName = element.closest('[data-package-row]')?.getAttribute('data-package-row');
      const modelName = element.querySelector(':scope > [data-testid="provider-icon"]');
      const tabAction = (isTabCloseAttribute(element, field) && english?.startsWith('Close '))
        || (field === 'title' && element.matches('.merlin-canvas-tab > span') && english?.endsWith(' — Double-click to rename'));
      const emptyTextInputHint = field === 'text' && english === 'Double-click to edit' && translated === '双击编辑'
        && element.matches('.text-input-rich[data-merlin-text-surface] > span:only-child') && !element.closest('[contenteditable]');
      if (english === packageName || modelName || element.matches('[data-testid="provider-icon"]')
        || (element.closest('.agent-model-name') && !(field === 'text' && english && translateAgentModelPlaceholder(element, english)))
        || (element.closest(toolboxScriptNameSelector) && !toolboxScriptName)
        || (element.closest(protectedContent) && !emptyTextInputHint) || (element.closest('.merlin-canvas-tab') && !tabAction)
        || (field === 'text' && element.closest(editableContent + ',option[value="custom"]'))) translated = undefined;
    }
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
        if (record.target instanceof doc.defaultView!.Element && record.target.classList.contains('generation-shelf-workflow-folder')) {
          roots.add(record.target);
        }
      } else if (record.type === 'characterData') roots.add(record.target);
      else if (record.attributeName && doc.contains(record.target)) {
        const element = record.target as Element;
        if (scopeAttributes.includes(record.attributeName) ||
            (record.attributeName === 'title' && element.matches('.agent-model-list [role="menuitemradio"]'))) roots.add(element);
        else translate(element, element, record.attributeName);
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
    if (missing) {
      const credential = missing[2] === 'the native Claude API credentials' ? 'Claude 原生 API 凭据' : missing[2];
      return '模型“' + missing[1] + '”尚无已确认的凭据。请登录或在设置中配置 ' + credential + '，然后重试。';
    }
  }
  if (element.matches('.merlin-panel-count,.merlin-panel-count-pill,.merlin-panel-chip-count')) {
    const tools = /^(\d+) tools?$/.exec(english);
    if (tools) return tools[1] + ' 个工具';
    const items = /^(\d+) items?$/.exec(english);
    if (items) return items[1] + ' 项';
  }
}
