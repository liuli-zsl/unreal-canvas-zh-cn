import { copyId } from './copy-id';
import setup from './locales/agent-setup.json';
import toolGroups from './locales/agent-setup-tool-groups.json';
import toolNames from './locales/agent-setup-tools.json';

const labels = new Map(Object.entries(setup.labels));
const extendedLabels = new Map(Object.entries(setup.modelAndSetupLabels));
const contexts = new Map(Object.entries(setup.contextHints));
const groupHelp = new Map(Object.entries(toolGroups.descriptions));
function label(value: string): string | undefined {
  return labels.get(value) ?? extendedLabels.get(copyId(value));
}
const hints = new Map(Object.entries(setup.hints));
const groups = new Map(Object.entries(toolGroups.labels));
const tools = new Map(Object.entries(toolNames));
const setupScope = '.agent-setup-strip,.agent-setup-popover';
function translateHint(source: string): string | undefined {
  const parts = /^(.*?)( (?:Available when|The chat keeps|You can change) .*)?$/.exec(source);
  if (!parts) return;
  const id = copyId(parts[1]);
  const hint = hints.get(id) ?? contexts.get(id);
  if (!hint || !parts[2]) return hint;
  switch (copyId(parts[2])) {
    case 'e601b6e7c7c2e9c3': return hint + ' 本轮完成后即可更改。';
    case '601322e14408f534': return hint + ' 对话已开始，将沿用当前上下文。';
    case 'e22436cbf10bfc3d': return hint + ' 开始对话前仍可调整。';
    default: return undefined;
  }
}

function translateModeSummary(source: string): string | undefined {
  const match = /^(?:(.+) · )?(Always ask|Ask if risky|Autonomous) · (Light|Standard|Thorough|Custom)$/s.exec(source);
  if (match) return (match[1] ? match[1] + ' · ' : '') + label(match[2]) + ' · ' + label(match[3]);
}

// CustomSelect portals can have no accessible name (their trigger uses an external label).
// Follow aria-controls instead of guessing from option text shared with other popups.
function isSetupList(list: Element): boolean {
  if (!list.id) return false;
  const triggers = list.ownerDocument.querySelectorAll('.agent-setup-body [role="combobox"][aria-controls]');
  return Array.from(triggers).some(trigger => trigger.getAttribute('aria-controls') === list.id);
}

// The picker uses its model-name span for a disabled status row when a provider
// has no model choices. A selectable model or the active missing model is a name.
export function translateAgentModelPlaceholder(element: Element, english: string): string | undefined {
  if (!element.classList.contains('agent-model-name')) return;
  const row = element.parentElement;
  if (!row?.matches('.agent-setup-body .agent-model-list button[role="menuitemradio"]:disabled')) return;
  const issue = row.getAttribute('title');
  if (english === 'No models available' && (issue === 'Unavailable' || issue === label('Unavailable'))) {
    return label(english);
  }
  if (row.getAttribute('aria-checked') !== 'false') return;
  if ((english === 'Not installed' || english === 'Loading models…' || copyId(english) === '1c71ea4bea582fb5') &&
      (issue === english || issue === label(english))) return label(english);
}

export function translateAgentSettings(element: Element, field: string, english: string, node: Node): string | null | undefined {
  if (element.matches('.mini-agent-chat-model-personality,.mini-agent-chat-model,.agent-setup-header > .agent-setup-hint')) {
    if (field === 'text' || field === 'title') {
      const summary = translateModeSummary(english);
      if (summary) return summary;
    }
    if (element.matches('.mini-agent-chat-model')) return label(english);
  }
  if (field === 'text' && element.matches('.mini-agent-chat-model > span:not(.mini-agent-chat-model-personality)')) return null;

  if (field === 'text' && element.matches('[role="tooltip"][data-menu-layer]')) {
    const hint = translateHint(english);
    if (hint && element.ownerDocument.querySelector(setupScope)) return hint;
  }

  if (!element.closest(setupScope)) {
    if (label(english) !== undefined && (field === 'text' || field === 'aria-label')) {
      const list = element.closest('[role="listbox"]');
      if (list && isSetupList(list)) return label(english);
    }
    return;
  }

  if (field === 'text') {
    // The first span in the model picker navigation button is the selected model label.
    if (element.closest('.agent-setup-nav button')) return null;
    if (element.classList.contains('agent-model-name')) return translateAgentModelPlaceholder(element, english) ?? null;
    if (element.closest('.agent-model-empty') && element.childNodes.length > 1) {
      if (node === element.firstChild && english === 'No models match “') return '没有与“';
      if (node === element.lastChild && english === '”.') return '”匹配的模型。';
      if (node === element.firstChild && english === 'Choose') return '请在下方的运行环境中选择';
      if (node === element.lastChild && english === 'in Environment below to load its models.') return '以加载模型。';
      return null;
    }

    if (element.matches('.agent-setup-hint') && element.childNodes.length === 3) {
      if (node === element.firstChild && copyId(english) === '063452409e766f57') {
        return '切换后可继续使用当前对话，';
      }
      if (node === element.childNodes[1] && english === 'the provider stays fixed') return '提供商已固定';
      if (node === element.childNodes[1] && english === 'the provider and context stay fixed') return '提供商和上下文已固定';
      if (node === element.lastChild && english === '.') return '。';
    }
    if (element.matches('.personality-tool-extension')) return node === element.firstChild && english === 'from' ? '来自' : null;
    if (element.matches('.personality-tool-list label > span')) {
      // A third-party tool may have the same display name as a built-in. The host
      // emits the actual tool ID in <code> and its display name in the first Text node.
      const id = element.querySelector(':scope > code')?.textContent;
      if (node === element.firstChild && id && id.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') === english) {
        return tools.get(id) ?? null;
      }
      return null;
    }
    if (element.matches('.personality-tool-group > p')) return groupHelp.get(copyId(english));
    if (element.matches('.personality-tool-group > summary > span,.personality-tool-select-all')) {
      return groups.get(english) ?? label(english);
    }
  }

  if (field === 'aria-label') {
    if (english.startsWith('Select all tools in ') && element.closest('.personality-tool-select-all')) {
      const group = groups.get(english.slice('Select all tools in '.length));
      if (group) return '全选“' + group + '”中的工具';
    }
    if (english.endsWith(' tools') && element.matches('.personality-tool-list')) {
      const group = groups.get(english.slice(0, -' tools'.length));
      if (group) return group + '工具';
    }
  }
  // Only host UI chrome is eligible. Editors and model labels have their own
  // values, and disabled model rows can carry provider diagnostics as text.
  if (element.closest('.personality-tool-list code,.personality-unavailable-tools code,.agent-model-name')) return null;
  if (field === 'text' && element.matches('.agent-model-empty[role="alert"]') && copyId(english) !== 'c45880d7d6d89bd6') return null;
  if (field === 'text' && element.matches('textarea,input,[contenteditable]')) return null;
  return label(english) ?? translateHint(english);
}
