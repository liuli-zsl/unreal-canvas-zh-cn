import { copyId } from './copy-id';
import { renderedFiber } from './host-fiber';
const counts: Record<string, string> = { 'Batch slot': '批量插槽', Batch: '批量输入' };
const namedAgentLabel = '.generation-shelf-menu:is([aria-label="Agent"],[aria-label="智能体"]) button.generation-shelf-menu-option[role="menuitemradio"]:is([aria-label^="Work with "],[aria-label^="Working with "]) > .generation-shelf-menu-copy > span';
const outputControl = '.generation-shelf-output > span button.generation-shelf-menu-trigger,.generation-shelf-output > button.generation-shelf-menu-trigger';
const shelfMenu = '.generation-shelf-menu[role="menu"]';
const outputRow = '.generation-shelf-menu-row > button.generation-shelf-menu-option';
const outputRowLabel = outputRow + ' > .generation-shelf-menu-copy > span:first-child';
const outputRowHint = outputRow + ' > .generation-shelf-menu-copy > .ue-menu-detail';
const outputChoices = new Map([
  ['Create new card', '创建新卡片'],
  ['Create new deck', '创建新卡组'],
  ['Add to deck', '添加到卡组'],
  ['Agent chooses', '由智能体选择'],
]);

type ShelfOutputOption = { id: string; label: string; selected?: boolean; children?: ShelfOutputOption[] };
type ShelfOutputProps = { option?: ShelfOutputOption; options?: ShelfOutputOption[] };

function optionProps(button: Element | null) {
  if (!button) return;
  for (let owner = renderedFiber<ShelfOutputProps>(button); owner; owner = owner.return ?? undefined) {
    if (owner.memoizedProps?.option) return owner.memoizedProps.option;
  }
}

function selectedBatchOutput(button: Element) {
  const propKey = Object.keys(button).find(key => key.startsWith('__reactProps$'));
  const liveProps = propKey && Object.getOwnPropertyDescriptor(button, propKey)?.value;
  const mounted = renderedFiber<ShelfOutputProps>(button);
  const committed = mounted?.memoizedProps === liveProps ? mounted :
    mounted?.alternate?.memoizedProps === liveProps ? mounted?.alternate : undefined;
  for (let owner = committed; owner; owner = owner.return ?? undefined) {
    const deck = owner.memoizedProps?.options?.find(option => option.id === 'same');
    if (deck) return deck.children?.some(option => option.id === 'sources' && option.selected);
  }
}

function outputSummary(value: string, button?: Element) {
  if (value === 'Create new card') return '输出到新卡片';
  if (value === 'Create new deck') return '输出到新卡组';
  if (value === 'Agent chooses') return '输出目标由智能体选择';
  const deckPrefix = 'Add to deck · ';
  if (!value.startsWith(deckPrefix)) return;
  const name = value.slice(deckPrefix.length);
  return name === 'From batch' && button && selectedBatchOutput(button)
    ? '输出到各批量输入所属的卡组'
    : '输出到卡组“' + name + '”';
}

function shelfOutput(element: Element, field: string, value: string) {
  if ((field === 'aria-label' || field === 'title' || field === 'data-title-tip') && element.matches(outputControl)) {
    if (value.startsWith('Output: ')) return outputSummary(value.slice('Output: '.length), element);
    if (value === 'Choose an available deck or Create new card to continue.') return '先选择可用的卡组，或创建新卡片以继续。';
    if (value === 'Choose an available deck or Create new deck to continue.') return '先选择可用的卡组，或创建新卡组以继续。';
  }
  if (field === 'text' && element.matches('.generation-shelf-output-name')) {
    return outputChoices.get(value) ?? outputSummary(value, element.closest(outputControl) ?? undefined);
  }
  const label = field === 'text' && element.matches(outputRowLabel);
  const description = field === 'text' && element.matches(outputRowHint);
  const aria = field === 'aria-label' && element.matches(shelfMenu + ',' + outputRow);
  if (!label && !description && !aria) return;
  const menu = element.closest(shelfMenu);
  const root = menu?.parentElement?.closest(shelfMenu) ?? menu;
  const trigger = root?.id && Array.from(element.ownerDocument.querySelectorAll(outputControl))
    .find(button => button.getAttribute('aria-controls') === root.id);
  if (!trigger) return;
  if (aria && element === root && value.startsWith('Output: ')) return outputSummary(value.slice('Output: '.length), trigger);
  if (aria && element === menu && value === 'Add to deck') return '添加到卡组';
  if (description) {
    const pick = /^Click to use ([\s\S]+); hover to choose a deck$/.exec(value);
    if (menu === root && pick) return '点击使用“' + pick[1] + '”，悬停可选择卡组。';
    if (menu !== root && value === 'This card was removed') return '此卡片已移除。';
    return;
  }
  if (menu === root) return outputChoices.get(value);
  if (optionProps(element.closest(outputRow))?.id === 'sources' && value === 'From batch') return '来自批量输入';
  // Rows under the add-to-deck submenu may use any user-defined name.
  return value;
}
const voiceInstructions: Record<string, string> = {
  'Keep Ctrl held while speaking.': '说话时请按住 Ctrl 键。',
  'Press again to stop.': '再按一次即可停止。',
};

const progressPhases = new Map(Object.entries({
  start: ['Opening your workspace', '正在打开工作区'], read: ['Reading canvas', '正在读取画布'],
  'expand-tree': ['Loading graphs', '正在加载节点图'], migrate: ['Upgrading canvas', '正在升级画布'],
  normalize: ['Preparing canvas', '正在准备画布'], versions: ['Reading history', '正在读取历史记录'],
  register: ['Opening canvas', '正在打开画布'], results: ['Restoring results', '正在恢复结果'],
  'background results': ['Restoring results', '正在后台恢复结果'],
}));

function progress(element: Element, field: string, value: string) {
  const title = field === 'title' ? value : element.getAttribute('title') ?? '';
  const separator = title.lastIndexOf(' — ');
  const phase = separator < 0 ? '' : title.slice(separator + 3);
  const definition = progressPhases.get(phase) ?? (field === 'text'
    ? [...progressPhases.values()].find(pair => pair[1] === phase) : undefined);
  if (definition && field === 'title') return title.slice(0, separator) + ' — ' + definition[1];
  if (field !== 'text') return;
  const options = definition ? [definition] : [...progressPhases.values()];
  for (const [source, translated] of options) {
    if (!value.startsWith(source)) continue;
    const suffix = value.slice(source.length);
    if (/^(…| \d+…| \d+\/\d+\+?)?$/.test(suffix)) return translated + suffix;
  }
}

function batchPosition(label: string) {
  const reference = /^Reference (\d+)$/.exec(label);
  return reference ? '参考素材 ' + reference[1] : label;
}

function outputTooltipControl(popup: Element) {
  // The portaled tooltip retains its owning trigger wrapper in the React tree.
  for (let owner = renderedFiber(popup); owner; owner = owner.return ?? undefined) {
    const wrapper = (owner as { stateNode?: Element }).stateNode;
    if (wrapper?.nodeType !== 1 || !wrapper.hasAttribute('data-tooltip-owner')) continue;
    const button = wrapper.firstElementChild;
    return button?.matches(outputControl) ? button : undefined;
  }
}

function tooltip(element: Element, value: string) {
  // The footer identifies the settings tooltip. Other tooltip headings may be arbitrary asset names.
  const parent = element.parentElement;
  const popup = parent?.parentElement;
  if (!parent || !popup?.matches('[role="tooltip"]')) return;
  const footer = parent.lastElementChild?.textContent?.trim();
  if (['Choose where results land', '选择结果的输出位置'].includes(footer ?? '')) {
    if (element === parent.firstElementChild && value === 'Output') return '输出';
    if (element !== parent.lastElementChild) return outputChoices.get(value) ?? outputSummary(value, outputTooltipControl(popup));
  }
  if (element === parent.firstElementChild && value.startsWith('Settings · ')
    && ['Click to hide the settings', 'Click to change them', '点击收起设置', '点击修改设置'].includes(footer ?? '')) {
    return '设置 · ' + value.slice('Settings · '.length);
  }
  if (element === parent.firstElementChild && value.startsWith('Working with ')
    && (copyId(footer ?? '') === '13503ee6df5fc76a' || footer?.startsWith('切换智能体或独立工作'))) {
    return '正在与“' + value.slice('Working with '.length) + '”协作';
  }
  const voice = /^Press (.+?) to dictate\b.*?\. (Keep Ctrl held while speaking\.|Press again to stop\.)$/.exec(value);
  if (voice) return '按 ' + voice[1] + ' 可在此处听写，或在画布中打开语音聊天。' + voiceInstructions[voice[2]];
  const runs = /^Batch · (\d+) runs?$/.exec(value);
  if (runs && element === parent.firstElementChild) return '批量 · ' + runs[1] + ' 次运行';
}

export function translateShelfAction(element: Element, field: string, value: string): string | undefined {
  const output = shelfOutput(element, field, value);
  if (output !== undefined) return output;
  // The collaborator's name can coincide with a built-in label in another shelf menu.
  if (field === 'text' && element.matches(namedAgentLabel)) return value;
  if (field === 'text' && value === 'Browse models…' &&
      element.matches('.ue-menu [role="listbox"] .ue-menu-item[role="option"][data-value] > span:last-child')) {
    // CustomSelect reserves these values for actions such as opening the model catalog.
    const option = element.parentElement?.getAttribute('data-value');
    if (option?.startsWith('\0footer-action-')) return '浏览模型…';
  }
  const cls = element.classList;
  if (cls.contains('label') && element.matches('#splash .loading-status .label')) return progress(element, field, value);
  if (element.localName === 'button' && element.hasAttribute('title') && element.matches('.merlin-generation-host > div > div > div > button')) {
    if (field === 'title' && copyId(value) === 'ce624c5d25d02c89') return '查看加载耗时明细（也可在控制台运行 __merlinLoad.log()）';
    const result = progress(element, field, value);
    if (result) return result;
  }
  if (field === 'text' && element.parentElement?.parentElement?.getAttribute('role') === 'tooltip') {
    return tooltip(element, value);
  }
  if (cls.contains('canvas-card-facet-star') && (field === 'title' || field === 'aria-label')) {
    const stars = /^Rate ([1-5])$/.exec(value);
    if (stars) return '评为 ' + stars[1] + ' 星';
    if (value === 'Clear your rating') return '清除我的评分';
  }
  if (field === 'text' && element.matches('[data-add-reference-popover] > div:last-child > button:is(.pill-menu-item,.ue-menu-item)')) {
    const selected = /^Use selected \((\d+)\)$/.exec(value);
    if (selected) return '使用所选内容（' + selected[1] + ' 项）';
  }
  if (field === 'aria-description' && cls.contains('generation-shelf-selection-item')) {
    const descriptions: Record<string, string> = {
      '5ada1addbf0016dd': '拖动或按 Alt 加左右方向键排序。',
      'b04d6f31170506c0': '按空格键加入批次。',
      'ef3e4c580953dd56': '拖动或按 Alt 加左右方向键排序，按空格键加入批次。',
    };
    return descriptions[copyId(value)];
  }
  if (field === 'aria-label') {
    if (cls.contains('generation-shelf-batch-slot') || cls.contains('generation-shelf-batch-well')) {
      const count = /^(Batch slot|Batch): (\d+) inputs?$/.exec(value);
      if (count) return counts[count[1]] + '：' + count[2] + ' 项输入';
    }
    if (cls.contains('generation-shelf-selection-item') && element.getAttribute('data-batch') === 'true'
      && value.startsWith('Batch position · ')) return '批量输入位置 · ' + batchPosition(value.slice('Batch position · '.length));
    if (element.matches('.generation-shelf-batch-member button,.generation-shelf-batch-well button')) {
      const move = /^Move (.+) out of batch$/.exec(value);
      if (move) return '将“' + move[1] + '”移出批量输入';
      const remove = /^Remove (.+) from inputs$/.exec(value);
      if (remove) return '从输入中移除“' + remove[1] + '”';
    }
    if ((cls.contains('generation-shelf-generate-options') || cls.contains('generation-shelf-menu'))
      && value.startsWith('Output: Add to Deck · ') && value !== 'Output: Add to Deck · From Batch') {
      return '输出到卡组“' + value.slice('Output: Add to Deck · '.length) + '”';
    }
    if (cls.contains('generation-shelf-reference-pick') && value.endsWith(' reference')) {
      const reference = /^Reference (\d+) reference$/.exec(value);
      if (reference) return '参考素材 ' + reference[1];
    }
  }
  if (field === 'text') {
    if (cls.contains('generation-shelf-selection-badge') && element.closest('[data-batch="true"]')) {
      const reference = /^Reference (\d+)$/.exec(value);
      if (reference) return '参考素材 ' + reference[1];
    }
    if (cls.contains('generation-shelf-well-title') && value.startsWith('Batch · ')) return '批量 · ' + value.slice('Batch · '.length);
    if (element.matches('.generation-shelf-batch-popover > p,.generation-shelf-batch-well p')) {
      const each = /^Each batch card runs here, as (.+?)\.(?: (Drag (?:this tile|it onto)\b.*\.))?$/.exec(value);
      if (each) return '每张批量卡片都会作为“' + batchPosition(each[1]) + '”运行。' + (each[2] ? '拖动可更改输入位置。' : '');
    }
    if (cls.contains('generation-shelf-generate') || cls.contains('generation-shelf-generate-label')) {
      const batch = /^Send batch · (\d+) inputs?$/.exec(value);
      if (batch) return '发送批量输入 · ' + batch[1] + ' 项';
      const run = /^Run (\d+) (Images?|Items?)$/.exec(value);
      if (run) return '运行并生成 ' + run[1] + (run[2].startsWith('Image') ? ' 张图像' : ' 项结果');
      const generate = /^Generate · (\d+) (images?|items?)$/.exec(value);
      if (generate) return '生成 ' + generate[1] + (generate[2].startsWith('image') ? ' 张图像' : ' 项结果');
    }
  }
}
