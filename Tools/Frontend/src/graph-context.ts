import { copyKey } from './copy-id';
import { getRenderedMenuAction, translateMenuActionCopy } from './menu-dynamic';

const graphMenu = '.ue-menu[data-merlin-punch-cover][popover="manual"]:not([role]):not(:has(.merlin-panel-search))';
const graphSubmenu = '.ue-submenu[data-merlin-punch-cover][popover="manual"]';
const labels = new Map<string, Record<string, string>>([
  ['create-reference', {Reference: '引用'}],
  ['create-deck', {Deck: '卡组'}],
  ['copy-to-workflow-graph', {'Graph (Copy to)': '复制到新节点图'}],
  ['multi-create-subcanvas', {'Graph (Move to)': '移入新节点图'}],
  ['multi-collapse-subcanvas', {Subcanvas: '子画布'}],
  ['clear-results', {'Clear results': '清除结果'}],
  ['graph-input-toggle', {'Create input': '创建输入', 'Remove input': '移除输入'}],
  ['toggle-required-input', {
    'Make input required': '设为必填输入', 'Make input optional': '设为可选输入', 'Required by model': '模型要求此输入',
  }],
  ['graph-settings-toggle', {'Show model settings': '显示模型设置', 'Hide model settings': '隐藏模型设置'}],
  ['restore-severed-wiring', {'Restore severed wiring': '恢复断开的连线'}],
  ['remove-reroute', {'Remove reroute': '移除重定向连线'}],
  ['inspect-menu', {Inspect: '检查'}],
  ['forward', {'Bring forward': '上移一层', 'Bring Forward': '上移一层'}],
  ['backward', {'Send backward': '下移一层', 'Send Backward': '下移一层'}],
  ['fit-aspect', {'Fit to aspect ratio': '适配宽高比'}],
  ['fit-text', {'Fit to text': '适应文本'}],
  ['reset-card-size', {'Reset card size': '重置卡片大小'}],
  ['keep-cached-result', {'Keep cached result': '保留缓存结果'}],
  ['stop-keeping-cached-result', {'Stop keeping cached result': '停止保留缓存结果'}],
  ['copy-with-annotations', {'Copy with annotations': '复制带批注的图像'}],
  ['duplicate-graph', {'Duplicate graph': '创建节点图副本'}],
  ['import-level-snapshot', {'Import Level Snapshot': '导入关卡快照'}],
  ['custom-node-menu', {'Custom Node': '自定义节点'}],
  ['custom-node-publish', {'Publish to Library…': '发布到资源库…'}],
  ['custom-node-export', {'Export as file…': '导出为文件…'}],
]);

const hints = new Map([
  ['#46:f1f7191aaa25ea86', '请先停止所选节点，再清除结果。'],
  ['#114:b1d46301269a188d', '清除所选节点的结果历史。输入、设置和连线会保留，可撤销以恢复结果。'],
  ['#74:78405a7bfd57099e', '将选中项合为一个卡组。所选卡组也会合并到其中，避免嵌套。'],
  ['#62:016d612c6e8c5126', '请选择至少两张卡片，或选择一张有多个版本的卡片。'],
  ['#69:c8ec072e046393f1', '将所选节点复制到新的节点图，原项仍留在当前画布。'],
  ['#80:b71ffd94360a43a0', '所选项包含跨边界的连线。子画布没有用于连接的引脚。'],
  ['#81:b6cc82c81a81d40a', '打开控制台，并将此结果作为变量载入当前 Python 会话。'],
  ['#63:664c02c9b129ea4e', '从节点图的输入列表移除此节点。节点仍留在图中。'],
  ['#91:8d2562d7142456b6', '将此节点设为节点图输入。可在节点图检查器中查看、排序和设置类型。'],
  ['#69:bf1cf820a560d979', '在节点图卡片和工具架中隐藏此节点的设置。'],
  ['#116:0592a56b127948e3', '在节点图的输入旁显示所选模型的设置。切换模型后会同步调整。'],
  ['#98:101d44fb45e40e88', '允许此输入留空。连接到它的节点将按引脚未连接的情况运行。'],
  ['#58:6996db3f4772b739', '填写此输入后，工作流才能运行。'],
  ['#77:b354f634faa5c02f', '参数或输入与当前结果不符时，允许重新运行此卡片。'],
  ['#81:3c90e3b7e5a33a8a', '在结果更新前复用此卡片的缓存结果。'],
  ['#72:a843d98f89810d8e', '将节点图复制到新卡片。副本暂无输出，可以编辑和生成。'],
  ['#50:20044c2f09126c9c', '复制图像并将批注合成到图像中。'],
  ['#96:ca5a9a10394f39b6', '将渲染采集的关卡快照保存到内容浏览器，便于查看或应用。'],
  ['#51:e2f6181aece37205', '将此卡片保存到自定义节点库，供以后复用。'],
  ['#56:c45701dd2f709202', '将此卡片的定义导出为 .customnode JSON 文件。'],
]);
const requiredModelSuffixes = [
  [48, '#48:777c6e4234ffc95e'],
  [47, '#47:782ce99a1d43a145'],
] as const;

const inputBadge = '.graph-node-body div[style*="letter-spacing: 0.1em"]:has(> div > span[data-app-tooltip] > button)';
const inputBadgeLabels = new Map([
  ['INPUT', '输入'],
  ['INPUT · REQUIRED', '输入 · 必填'],
  ['INPUT · REQUIRED (BY MODEL)', '输入 · 模型要求必填'],
]);
const inputToggleLines = new Map([
  ['#92:bd559d10f992ac1d', '工作流需要填写此输入。点击可设为可选。'],
  ['#142:dcdb5e6c3d59dfc1', '此输入可留空。连接到它的节点将按引脚未连接的情况运行。点击可设为必填。'],
]);
const inputToggleModelLines = [
  [61, '#61:1081d30149973964', '要求填写此输入。选用该模型时无法设为可选。'],
  [72, '#72:bc3d001a95b448d6', '被选用时会要求填写此输入。点击可立即设为必填。'],
] as const;

function translateInputBadge(element: Element, field: string, english: string) {
  if (field !== 'text') return;
  const badgeLabel = inputBadgeLabels.get(english);
  if (badgeLabel && element.matches(inputBadge + ' > span:first-child')) return badgeLabel;

  if (!element.matches('[role="tooltip"][data-portal-popup][id]') || !/^(?:Optional input:|Required input:|Required by )/.test(english)) return;
  const trigger = [...element.ownerDocument.querySelectorAll(inputBadge + ' > div > span[data-app-tooltip][aria-describedby]')]
    .find(wrapper => wrapper.getAttribute('aria-describedby')?.split(/\s+/).includes(element.id));
  if (!trigger) return;
  const caption = inputToggleLines.get(copyKey(english));
  if (caption) return caption;
  const prefix = 'Required by ';
  if (!english.startsWith(prefix)) return;
  for (const [length, key, message] of inputToggleModelLines) {
    if (english.length > prefix.length + length && copyKey(english.slice(-length)) === key) {
      const model = english.slice(prefix.length, -length);
      return (model === 'the selected model' ? '所选模型' : '「' + model + '」') + message;
    }
  }
}

export function translateGraphContext(element: Element, field: string, english: string): string | undefined {
  const input = translateInputBadge(element, field, english);
  if (input !== undefined) return input;
  const label = field === 'text' && element.matches('.ue-menu-label,.feature-hint-menu-label');
  const hint = (field === 'title' || field === 'data-title-tip') && element.matches('button');
  if (!label && !hint) return;
  const button = element.closest('button.ue-menu-item');
  if (!button) return;
  if (!button.closest(graphMenu) &&
      !(button.closest(graphSubmenu) && element.ownerDocument.querySelector(graphMenu + ' > button[aria-expanded="true"]'))) return;
  const action = getRenderedMenuAction(button);
  if (!action) return;
  const shared = translateMenuActionCopy(action, field, english);
  if (shared !== undefined) return shared;

  if (label) return action.label === english ? labels.get(action.id)?.[english] : undefined;
  if (action.title !== english) return;
  const fixed = hints.get(copyKey(english));
  if (fixed !== undefined) return fixed;
  if (action.id === 'toggle-required-input' && action.label === 'Required by model') {
    for (const [length, key] of requiredModelSuffixes) {
      if (english.length > length && copyKey(english.slice(-length)) === key) {
        const model = english.slice(0, -length);
        return (model === 'The selected model' ? '所选模型' : '「' + model + '」') + '要求填写此输入。';
      }
    }
  }
  if (action.id === 'create-deck') {
    const takes = /^Hold this card's (\d+) takes as a deck of cards$/.exec(english);
    if (takes) return '将此卡片的 ' + takes[1] + ' 个版本汇集为卡组。';
  }
}
