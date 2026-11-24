import { copyId, copyKey, keyLength } from './copy-id';
import type { ReadonlyCanvasState } from '@merlin/plugin-api';
import catalog from './locales/workspace-details.json';
import geometryCatalog from './locales/geometry-menu.json';

type CanvasNodes = ReadonlyCanvasState['canvases'][string]['nodes'];
type NodeData = CanvasNodes[number];
type Roles = Record<string, ReadonlySet<string>>;

const words = new Map(Object.entries(catalog.translations));
const helpLengths = new Set(Array.from(words.keys(), keyLength));
const defaultNames = new Map<string, Map<string, string>>(
  Object.entries(catalog.defaults).map(([kind, names]) => [kind, new Map(Object.entries(names))]),
);
const nodeRules = new Map<string, Roles>(
  Object.entries(catalog.nodes).map(([kind, roles]) =>
    [kind, Object.fromEntries(Object.entries(roles).map(([role, names]) => [role, new Set(names)]))]),
);
const operationLabels = new Map(Object.entries(geometryCatalog.operations));
const operationGroups = new Map(Object.entries(geometryCatalog.categories));
const meshOperations = new Map<string, string>(Object.entries(catalog.meshOperations));
const englishRename = ' — Double-click to rename';
const chineseRename = ' — 双击重命名';
const bridgeRequirement = 'Needs the Unreal Editor (Unreal Canvas Bridge).';
const bridgeStatus = 'Not connected: could not reach ';
const platformHelpLength = 284;
function isPlatformHelp(value: string) {
  return value.length >= platformHelpLength && value.startsWith('Render as ') && copyId(value.slice(0, platformHelpLength)) === '2ab094780cb80e80';
}
const platformNoteZh = '临时切换编辑器的预览平台后渲染，首次切换可能需要编译着色器。';
const pinToggle = '.merlin-param-control > button:is([title="Expose as input pin"],[title="Remove pin"],[title="公开为输入引脚"],[title="移除引脚"])';
const standardRenderPasses = new Map([['beauty', 'Beauty'], ['depth', 'Depth'], ['normal', 'Normal']]);
const resolutionSources = new Map([['viewport', '视口'], ['camera', '相机']]);
const missingCameraPrefix = "Unreal couldn't find ";
const missingCameraSuffixLength = 61;

function isRenderVariableLabel(element: Element) {
  return element.classList.contains('merlin-param-label') &&
    !!element.closest('.merlin-param-row:not([data-param-key])')?.querySelector(':scope > ' + pinToggle);
}

function renderResolutionHint(element: Element, value: string, text: Node | undefined) {
  if (!element.matches('.graph-node-params div:not([class])') || !element.textContent?.startsWith('→')) return;
  const match = /^· matches (viewport|camera) (\d+(?:\.\d+)?):1$/.exec(value);
  if (match) return '· 匹配' + resolutionSources.get(match[1]) + '宽高比 ' + match[2] + ':1';
  if (value.startsWith(missingCameraPrefix) && copyKey(value.slice(-missingCameraSuffixLength)) === '#61:479349e67677b7c0') {
    const name = value.slice(missingCameraPrefix.length, -missingCameraSuffixLength);
    return 'UE 找不到“' + name + '”。它可能已重命名或删除，请重新选择相机。';
  }
  const source = resolutionSources.get(value);
  const lead = text?.previousSibling?.nodeValue?.trim();
  if (source && lead && ['#33:84437dbdb300b3dd', '#45:c45296b6324313b1'].some(key =>
      words.get(key) === lead || copyKey(lead) === key)) return source;
}

function renderPassLabel(element: Element, field: string, value: string, popupOwner: Element | undefined, node: NodeData) {
  const pass = standardRenderPasses.get(value);
  const names = node.params?.mrgPassNames;
  if (!pass || !Array.isArray(names) || !names.includes(pass)) return;
  const label = words.get(pass);
  if (element.matches('.graph-node-body .nodrag > button[aria-pressed]:is([title],[data-title-tip])')) {
    const title = element.getAttribute('title') ?? element.getAttribute('data-title-tip');
    if (field !== 'text' || title === value || title === label) return label;
  }
  if (field !== 'text') return;
  if (popupOwner?.closest('.graph-node-body') && element.closest('[role="option"]')?.getAttribute('data-value') === value) return label;
  if (element.matches('.graph-node-body button.custom-select[role="combobox"] > span > span[aria-hidden]')) return label;
}

function ownerOfList(element: Element) {
  const list = element.closest('[role="listbox"][id]');
  if (!list) return;
  for (const button of element.ownerDocument.querySelectorAll('.react-flow__node [role="combobox"][aria-controls]')) {
    if (button.getAttribute('aria-controls')?.split(/\s+/).includes(list.id)) return button;
  }
}

function uiRole(element: Element, field: string, isPopup: boolean) {
  if (isPopup) return field === 'text' ? 'choice' : field;
  if (element.classList.contains('merlin-pin-label')) return 'pin';
  if (element.classList.contains('merlin-param-label')) return 'field';
  if (field !== 'text') return field;
  if (element.matches('.text-input-rich[data-merlin-text-surface] > span:only-child')) return 'blankText';
  if (element.closest('[contenteditable],pre,code,textarea,[data-merlin-text-surface]')) return;
  if (element.closest('[role="combobox"]')) return 'choice';
  if (element.closest('button,[role="button"]')) return 'button';
  if (element.closest('.merlin-param-control')) return 'control';
  if (element.closest('.graph-node-params')) return 'params';
  if (element.closest('.graph-node-body')) return 'body';
}

// The SDK supplies a read-only view of the active graph. It distinguishes a built-in
// node from a script or third-party node with identical labels and DOM structure.
export function createWorkspaceTranslator(readCanvas?: () => ReadonlyCanvasState) {
  const indexes = new WeakMap<CanvasNodes, Map<string, NodeData>>();
  function displayedNode(id: string) {
    const state = readCanvas?.();
    const nodes = state?.activeCanvasId && state.canvases[state.activeCanvasId]?.nodes;
    if (!nodes) return;
    let index = indexes.get(nodes);
    if (!index) {
      index = new Map(nodes.map(node => [node.id, node]));
      indexes.set(nodes, index);
    }
    return index.get(id);
  }

  return (element: Element, field: string, value: string, text?: Node): string | null | undefined => {
    const header = element.matches('.graph-node-header-title span[title]');
    const rename = header && field === 'title' && value.endsWith(englishRename);
    const dynamic = value.startsWith(bridgeRequirement) || isPlatformHelp(value) ||
      value.startsWith('Could not fetch MCP tool list from ') || value.startsWith('Error — Could not fetch MCP tool list from ');
    const resolutionHint = field === 'text' && (value.startsWith('· matches ') ||
      value.startsWith(missingCameraPrefix) || resolutionSources.has(value));
    const renderPass = (field === 'text' || field === 'title' || field === 'data-title-tip') && standardRenderPasses.has(value);
    const key = words.has(value) || !helpLengths.has(value.length) ? value : copyKey(value);
    const translation = words.get(key);
    const geometryName = operationLabels.get(value) ?? operationGroups.get(value);
    if (!translation && !geometryName && !header && !dynamic && !resolutionHint && !renderPass) return;
    const popupOwner = ownerOfList(element);
    const owner = (popupOwner ?? element).closest('.react-flow__node[data-id]');
    const id = owner?.getAttribute('data-id');
    const node = id ? displayedNode(id) : undefined;
    if (!node) return;
    if (header && (rename || field === 'text')) {
      const original = rename ? value.slice(0, -englishRename.length) : value;
      let kindName = defaultNames.get(node.kind)?.get(original);
      if (node.kind === 'meshOp' && original !== meshOperations.get(String(node.params?.meshOp))) {
        const selector = owner?.querySelector('[role="combobox"][data-value]');
        const selected = selector?.querySelector('[aria-hidden="false"]')?.textContent;
        kindName = operationLabels.get(original);
        if (!kindName || selector?.getAttribute('data-value') !== node.params.meshOp || (selected !== original && selected !== kindName)) return;
      }
      if (kindName && !node.name) return rename ? kindName + chineseRename : kindName;
      if (rename && kindName && original === node.name) return original + '（' + kindName + '）' + chineseRename;
      return;
    }
    const rules = nodeRules.get(node.kind);
    if (!rules) return;
    if (node.kind === 'unrealRender' || node.kind === 'sequenceRender') {
      if (resolutionHint) {
        const hint = renderResolutionHint(element, value, text);
        if (hint !== undefined) return hint;
      }
      if (renderPass) return renderPassLabel(element, field, value, popupOwner, node);
      // MRG variables can use the same labels as fixed render settings.
      if ((field === 'text' || field === 'title') && isRenderVariableLabel(element)) return null;
    }
    if (dynamic && element.closest('.graph-node-body')) {
      if (value.startsWith(bridgeRequirement) && field === 'text') {
        const rest = value.slice(bridgeRequirement.length).replace(bridgeStatus, '未连接，无法访问 ');
        return '此节点需要连接虚幻编辑器（Unreal Canvas Bridge）。' + rest.trimStart();
      }
      if ((node.kind === 'sequenceRender' || node.kind === 'unrealRender') && field === 'title' && isPlatformHelp(value)) {
        return platformNoteZh + value.slice(platformHelpLength).replace("Could not read the editor's list: ", '无法读取编辑器平台列表：');
      }
      if (node.kind === 'mcpTool' && (field === 'text' || field === 'title')) {
        return value.replace(/^(Error — )?Could not fetch MCP tool list from /, '无法获取 MCP 工具列表，服务地址为 ');
      }
    }
    if (geometryName && field === 'text' && node.kind === 'meshOp') {
      const selector = popupOwner ?? element.closest('[role="combobox"]');
      const row = selector?.closest('.merlin-param-row:not([data-param-key])');
      const fieldLabel = row?.querySelector(':scope > .merlin-param-label')?.textContent;
      if ((fieldLabel === 'Operation' || fieldLabel === '操作') &&
          selector?.getAttribute('data-value') === node.params.meshOp) return geometryName;
    }
    if (field === 'text' && translation && (value === 'Add provider' || value === 'Add additional providers' || value === 'No models available')) {
      const button = popupOwner ?? element.closest('[role="combobox"]');
      const key = button?.closest('[data-param-key]')?.getAttribute('data-param-key');
      const isModel = key === 'model' || key === 'modelId' ||
        (node.kind === 'spatialPromptSynthesis' && ['Model', '模型'].includes(button?.getAttribute('aria-label') ?? ''));
      if (!isModel) return;
      const option = element.closest('[role="option"]');
      if (popupOwner) {
        if (option?.getAttribute('data-value') === '\u0000footer-action') return translation;
      } else if (button && element.parentElement?.parentElement === button) {
        const container = element.parentElement;
        if (value !== 'No models available' && element === container.lastElementChild) return translation;
        // A real model (including one named "No models available") changes this footer
        // to "Add additional providers". Only translate the host's empty-list entry.
        if (value === 'No models available' && element === container.firstElementChild &&
            container.children.length === 2 && ['Add provider','添加服务商'].includes(container.lastElementChild?.textContent ?? '')) return translation;
      }
    }
    const role = uiRole(element, field, !!popupOwner);
    if (!role || !translation || !rules[role]?.has(key)) return;
    if (role === 'blankText' && node.params?.markdown) return;
    if (role === 'pin') {
      // User-defined and promoted pins can carry any label. Only use the fixed
      // identity or the host's system-managed marker to localize their display.
      const pinId = element.parentElement?.querySelector(':scope > [data-pin-dot]')?.getAttribute('data-pin-dot');
      const pin = node.pins.find(item => item.id === pinId);
      if (!pin || (!pin.systemManaged && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(pin.id))) return;
    }
    if (role === 'body' && node.kind === 'task' && Array.isArray(node.params?.tasks) && node.params.tasks.length) return;
    if (role === 'body' && node.kind === 'mcpTool' && node.params?.toolName && node.params.toolName !== 'None') return;
    if (role === 'choice') {
      const button = popupOwner ?? element.closest('[role="combobox"]');
      const rowKey = button?.closest('[data-param-key]')?.getAttribute('data-param-key');
      // Model lists, unlike fixed enums such as Preset, contain provider-defined names.
      if (rowKey === 'modelId' || rowKey === 'model' || ['Model', '模型'].includes(button?.getAttribute('aria-label') ?? '')) return;
    }
    return translation;
  };
}
