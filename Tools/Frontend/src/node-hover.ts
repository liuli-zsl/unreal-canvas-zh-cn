import { copyKey } from './copy-id';
import { renderedFiber } from './host-fiber';
import descriptions from './locales/node-hover.json';
import workspace from './locales/workspace-details.json';

type HoverNode = {
  kind: string;
  name?: string;
  label?: string;
  params?: { sourceCustomNodeId?: string };
  pins?: { dataType: string; direction: string }[];
};

type PinHoverProps = {
  nodeId?: string;
  pin?: { id: string; stale?: boolean };
  entry?: { label: string; family?: { bound?: boolean } };
  inactive?: boolean;
  inactiveHint?: string;
};

const tooltip = '[role="tooltip"][data-portal-popup]';
const lookup = new Map<string, Record<string, string>>(Object.entries(descriptions));
const defaultNames = new Map(Object.entries(workspace.defaults).map(([kind, labels]) => [kind, new Map(Object.entries(labels))]));
const extraNames = new Map<string, [string, string]>([
  ['appendBundles', ['Append Bundles', '追加数据束']],
  ['blueprintCall', ['Blueprint Call', '调用蓝图']],
  ['bundle', ['Bundle', '数据束']],
  ['canvasInput', ['Canvas Input', '画布输入']],
  ['canvasOutput', ['Canvas Output', '画布输出']],
  ['componentDeck', ['Component Card', '组件卡片']],
  ['deck', ['Deck', '卡组']],
  ['fileInput', ['File', '文件']],
  ['formatString', ['Format String', '格式化字符串']],
  ['inputReference', ['Linked Input', '链接的输入']],
  ['meshOp', ['Mesh Op', '网格操作']],
  ['reroute', ['Reroute', '重定向连线']],
  ['script', ['Subscript', '子脚本']],
  ['subcanvas', ['Subcanvas', '子画布']],
  ['subgraph', ['Graph', '节点图']],
  ['textExtract', ['Text Extract', '提取文本']],
  ['workflow', ['Graph', '节点图']],
]);
const dataTypes = new Map(Object.entries({
  any: '任意类型', audio: '音频', boolean: '布尔值', choice: '选项',
  file: '文件', float: '浮点数', image: '图像', int: '整数', mesh: '网格模型',
  objectRef: '对象引用', sceneJson: '场景 JSON', splat: '高斯泼溅',
  text: '文本', usd: 'USD 场景', vector2: '二维向量', vector3: '三维向量', video: '视频',
}));
const stalePins = new Map([
  ['#80:002034be8aa37091', '失效引脚：卡片当时已停用此输入，运行时未传入任何值。'],
  ['#145:86fc3f5a06d439f9', '失效引脚：卡片已停用此输入。请改接到可用输入，或右键移除此引脚。'],
  ['#70:0712f3f90bec24ea', '失效引脚：卡片当时已停用此输出，没有传出任何值。'],
  ['#163:139c2c7424852f05', '失效引脚：卡片已停用此输出。同步或更新后若重新提供该输出，引脚会恢复，也可右键移除。'],
]);

function translateInactivePin(value: string) {
  const prefix = 'Not used by ';
  if (!value.startsWith(prefix)) return;
  const suffix = value.lastIndexOf('. Wire kept; ');
  const retained = suffix > 0 && copyKey(value.slice(suffix)) === '#71:f96cdee98802789b';
  const model = value.slice(prefix.length, retained ? suffix : undefined);
  const name = model === 'the current model' ? '当前模型' : '“' + model + '”';
  return name + '未使用此引脚' + (retained ? '。已保留连线，切换到使用此引脚的模型时会恢复。按住 Alt 单击可移除保留的连线。' : '');
}

function translatePinHover(element: Element, value: string) {
  if (!element.matches('.react-flow__handle[data-pin-dot][data-node-id]')) return;
  const id = element.getAttribute('data-pin-dot');
  const nodeId = element.getAttribute('data-node-id');
  for (let fiber = renderedFiber<PinHoverProps>(element); fiber; fiber = fiber.return ?? undefined) {
    const props = fiber.memoizedProps;
    if (props?.nodeId !== nodeId) continue;
    if (props?.pin?.id === id) {
      if (props.pin.stale && value.startsWith('Stale pin: ')) return stalePins.get(copyKey(value));
      if (props.inactive && props.inactiveHint === value) return translateInactivePin(value);
      return;
    }
    const entry = props?.entry;
    if (entry) {
      const bundle = entry.family?.bound === true;
      if (value === 'Wire to add a ' + (bundle ? 'bundle ' : '') + entry.label + ' port') {
        return '拖动连线以添加“' + entry.label + '”' + (bundle ? '数据束' : '') + '端口';
      }
    }
  }
}

function hoverNode(content: Element) {
  // The portal is outside the card. Canvas retains the owner and tooltip view
  // on the metadata component that directly renders this portal's content.
  const props = renderedFiber<{ node?: HoverNode; view?: string }>(content)?.return?.memoizedProps;
  if (props?.view === 'graphTooltip' || props?.view === 'canvasTooltip') return props.node;
}

export function nodeKindLabel(kind: string, value: string) {
  const extra = extraNames.get(kind);
  return extra?.[0] === value ? extra[1] : defaultNames.get(kind)?.get(value);
}

export function translateNodeHover(element: Element, field: string, value: string): string | null | undefined {
  if ((field === 'title' || field === 'data-title-tip') && /^(?:Stale pin: |Not used by |Wire to add a )/.test(value)) {
    return translatePinHover(element, value);
  }
  if (field !== 'text' || !element.matches(`${tooltip} > div > div,${tooltip} > div > div > span`)) return;
  const content = element.closest(tooltip)?.firstElementChild;
  if (!content) return;
  const node = hoverNode(content);
  if (!node) return;

  if (element.parentElement === content && !element.firstElementChild) {
    // Default card names are saved too. Keep the original alongside the Chinese
    // kind label, and preserve user-assigned labels and imported script names.
    const name = value === node.name?.trim() && !node.label && !node.params?.sourceCustomNodeId
      ? nodeKindLabel(node.kind, value)
      : undefined;
    return name ? value + '（' + name + '）' : null;
  }
  const row = element.parentElement;
  if (!row || element !== row.lastElementChild || element === row.firstElementChild) return;
  const fieldId = renderedFiber(row)?.key;
  if (fieldId === 'sys:description') return lookup.get(node.kind)?.[copyKey(value)] ?? null;
  if (fieldId === 'sys:kindLabel' || fieldId === 'kind') return nodeKindLabel(node.kind, value) ?? null;
  if (fieldId === 'type') {
    const output = node.pins?.find(pin => pin.direction === 'output' && pin.dataType !== 'any')?.dataType;
    if (output && value === output.charAt(0).toUpperCase() + output.slice(1)) return dataTypes.get(output) ?? null;
    return nodeKindLabel(node.kind, value);
  }
  if (fieldId === 'notes') return null;
}
