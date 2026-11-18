// src/index.ts
import { loadSignal } from "@merlin/plugin-api";

// src/copy-id.ts
function copyId(value) {
  let hash = 0xcbf29ce484222325n;
  for (let i = 0; i < value.length; i++) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(value.charCodeAt(i))) * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}
function copyKey(value) {
  return "#" + value.length + ":" + copyId(value);
}
function keyLength(value) {
  const match = /^#(\d+):[0-9a-f]{16}$/.exec(value);
  return match ? Number(match[1]) : void 0;
}

// src/generation.ts
var media = new Map(Object.entries({
  Image: "图像",
  Video: "视频",
  Audio: "音频",
  Text: "文本",
  Mesh: "网格模型",
  Splat: "高斯泼溅",
  Other: "其他",
  Graph: "节点图",
  Script: "脚本",
  Number: "数值",
  Timeline: "时间线",
  Python: "Python"
}));
var cardKinds = new Map(Object.entries({
  Tool: "工具",
  Action: "操作",
  Deck: "卡组",
  Asset: "资产",
  Process: "流程",
  Container: "容器",
  Canvas: "画布",
  Note: "笔记",
  ...Object.fromEntries(media)
}));
var runStates = new Map(Object.entries({
  Idle: "空闲",
  Running: "运行中",
  Queued: "已排队",
  Ready: "就绪",
  Failed: "失败",
  Done: "完成",
  Completed: "已完成",
  Cancelled: "已取消",
  Pending: "等待中",
  Error: "错误"
}));
function footer(element, field, value) {
  const id = element.getAttribute("data-field");
  if (id === "rating" && field === "title" && value === "Rating") return "评分";
  if (id === "votes" && field === "title" && value === "Votes") return "票数";
  if (id === "sys:childCount") {
    const count = /^(Contents )?(\d+) cards?$/.exec(value);
    if (count) return (count[1] ? "内容：" : "") + count[2] + " 张卡片";
  }
  if (id === "sys:runStatus") {
    const label = value.startsWith("Run ") ? value.slice(4) : value;
    const state = runStates.get(label);
    if (state) return (label === value ? "" : "运行状态：") + state;
  }
  if (id === "sys:cardType") {
    const prefix = value.startsWith("Card type ") ? "Card type " : "";
    const type = value.slice(prefix.length);
    const parts = /^(Tool|Action) \(([^()]+)\)$/.exec(type);
    const kind = parts && media.has(parts[2]) ? cardKinds.get(parts[1]) + "（" + media.get(parts[2]) + "）" : cardKinds.get(type);
    if (kind) return (prefix ? "卡片类型：" : "") + kind;
  }
  return null;
}
function translateGeneration(element, field, value, node) {
  if (element.hasAttribute("data-field") && element.closest(".canvas-card-footer")) return footer(element, field, value);
  if (element.matches(".canvas-timeline-caption > span") && field === "text") {
    if (value === "Empty Timeline") return "空时间线";
    if (value === "Double-click to open") return "双击打开";
    const clips = /^(\d+) clips? · (\d+(?:\.\d+)?)s$/.exec(value);
    if (clips) return clips[1] + " 个片段 · " + clips[2] + " 秒";
  }
  if (element.classList.contains("canvas-timeline-card") && field === "title" && value === "Double-click to open Timeline") return "双击打开时间线";
  if (field === "alt" && element.matches(".canvas-timeline-thumbnail img") && value.endsWith(" first video frame")) {
    return value.slice(0, -" first video frame".length) + " 的视频首帧";
  }
  if (element.classList.contains("generation-shelf-script") && element.querySelector(".generation-shelf-script-name")) return null;
  if (element.closest(".generation-shelf-script-name")) return null;
  if (element.closest(".generation-shelf-workflow-menu")) {
    if (element.classList.contains("ue-menu-label")) {
      const menu = element.closest(".generation-shelf-workflow-menu");
      const query = menu.querySelector("input")?.value.trim();
      if (query || element.parentElement !== menu.querySelector(':scope > button[role="menuitemradio"]')) return null;
      if (value === "Choose a script") return "选择脚本";
      if (value === "Agent chooses") return "由智能体选择";
      if (value.startsWith("Generate ") && media.has(value.slice(9))) return "生成" + media.get(value.slice(9));
      return null;
    }
    if (element.matches('.ue-menu-note[role="status"]') && field === "text" && element.childNodes.length === 3) {
      if (element.firstChild === node && value === 'No scripts match "') return "找不到与“";
      if (element.lastChild === node && value === '".') return "”匹配的脚本。";
      return null;
    }
    if (element.matches(".generation-shelf-workflow-menu > .ue-menu-heading") && field === "text") {
      if (value === "scripts") return "脚本";
      return media.get(value);
    }
  }
  if (field === "aria-label") {
    if (element.matches(".generation-shelf-workflow-trigger,.generation-shelf-workflow-menu,.generation-shelf-script")) {
      const match = /^(\w+) scripts$/.exec(value);
      if (match && media.has(match[1])) return media.get(match[1]) + "脚本";
    }
    if (element.matches(".generation-shelf-workflow-menu input")) {
      const mode = /^Search (\w+) scripts$/.exec(value)?.[1];
      if (mode) {
        const label = media.get(mode[0].toUpperCase() + mode.slice(1));
        if (label) return "搜索" + label + "脚本";
      }
    }
    if (element.classList.contains("generation-shelf-reference-pick")) {
      const label = /* @__PURE__ */ new Map([["Start Frame reference", "起始帧参考素材"], ["End Frame reference", "结束帧参考素材"], ["Image reference", "参考图像"]]);
      return label.get(value);
    }
  }
  if (field === "text" && element.matches(".generation-shelf-script > strong")) {
    if (value === "Choose a script") return "选择脚本";
    if (value === "Agent chooses a script") return "由智能体选择脚本";
  }
}

// src/menu-dynamic.ts
var browserScope = '[role="dialog"]:is([aria-label="Open canvas"],[aria-label="打开画布"])';
var elapsedUnits = { s: "秒", m: "分钟", h: "小时", d: "天" };
function translateMenuDynamic(element, field, english) {
  if (field === "text" && element.matches('[role="dialog"]:is([aria-label="About Unreal Canvas"],[aria-label="关于 Unreal Canvas"]) p')) {
    const native = /^\+ (\d+) native$/.exec(english);
    if (native) return "+ " + native[1] + " 个原生依赖";
    if (english === "(") return "（共";
  }
  if (field === "title" && element.matches(".merlin-canvas-tab > span")) {
    const suffix = " — Double-click to rename";
    if (english.endsWith(suffix)) return english.slice(0, -suffix.length) + " — 双击重命名";
  }
  if (element.closest(browserScope)) {
    if (field === "aria-label" && element.matches("button[title]") && english.startsWith("Actions for ")) {
      return "画布操作：" + english.slice("Actions for ".length);
    }
    if (field === "text" && element.matches("section button > span:nth-child(n+3):not([aria-label])")) {
      if (english === "never") return "从未更新";
      const age = /^(\d+)([smhd]) ago$/.exec(english);
      if (age) return age[1] + " " + elapsedUnits[age[2]] + "前";
    }
  }
  if (element.closest('[data-testid="canvas-settings-popover"],.merlin-graph-inspector')) {
    const label = /^(root canvas|subcanvas|nested canvas|graph) (“[\s\S]*”)$/.exec(english);
    if (field === "text" && label && element.matches(".merlin-script-form-none")) {
      return (label[1] === "graph" ? "节点图" : label[1] === "root canvas" ? "根画布" : "子画布") + label[2];
    }
    const attach = /^Attach a skill to (root canvas|subcanvas|nested canvas|graph) (“[\s\S]*”)$/.exec(english);
    if (field === "title" && attach && element.matches(".merlin-skill-attach-add")) {
      return "为" + (attach[1] === "graph" ? "节点图" : attach[1] === "root canvas" ? "根画布" : "子画布") + attach[2] + "添加技能";
    }
  }
  if (element.closest('[data-testid="ask-pill-tiles"]') && (field === "title" || field === "aria-label")) {
    const show = /^Show ([\s\S]+) on the canvas$/.exec(english);
    if (show && element.matches('[role="button"]')) return "在画布上显示“" + show[1] + "”";
    if (element.matches("button") && english.startsWith("Remove ")) return "移除“" + english.slice(7) + "”";
  }
  if (field === "title" && element.matches(".canvas-card-toolbar .node-header-btn")) {
    const open = /^Open ([\s\S]+) (\([^()]+\))$/.exec(english);
    if (open) return "打开“" + open[1] + "” " + open[2];
  }
  if (field === "title" && element.matches(".agent-voice-toggle,.canvas-card-ask-agent")) {
    const action = /^(Ask the agent|Dictate message) (\([^()]+\))$/.exec(english);
    if (action) return (action[1] === "Ask the agent" ? "询问智能体" : "听写消息") + " " + action[2];
  }
  if (field === "aria-label" && element.closest(".timeline-panel")) {
    const track = /^(Select )?([\s\S]+) track$/.exec(english);
    if (track && element.matches(".tl-track,.tl-track-select")) {
      return (track[1] ? "选择轨道“" : "轨道“") + track[2] + "”";
    }
    const mute = /^(Mute|Unmute) ([\s\S]+)$/.exec(english);
    if (mute && element.matches(".tl-track-mute")) {
      return (mute[1] === "Mute" ? "静音轨道“" : "取消静音轨道“") + mute[2] + "”";
    }
  }
  if (field === "text" && element.matches(".ue-menu-label") && element.closest(".ue-menu-item[aria-pressed]")) {
    const filter = element.closest('[role="dialog"].nodrag.nowheel');
    const active = filter?.querySelector('.ue-menu:first-child .ue-menu-item[aria-expanded="true"] .ue-menu-label')?.textContent;
    if (active === "Votes" || active === "投票") {
      if (english === "Has 👍") return "有赞 👍";
      if (english === "Has 👎") return "有踩 👎";
      if (english === "No votes") return "暂无投票";
    }
  }
  if (element.closest(".merlin-graph-inspector")) {
    if (field === "aria-label" && element.matches(".merlin-script-form-dot.is-button") && english.startsWith("Find ")) return "定位“" + english.slice(5) + "”";
    if (field === "aria-label" && element.matches(".merlin-script-form-remove")) {
      const hide = /^Hide ([\s\S]+) settings$/.exec(english);
      if (hide) return "隐藏“" + hide[1] + "”的设置";
    }
    if (field === "text" && element.matches(".merlin-script-form-none[title]") && english !== element.getAttribute("title")) {
      const count = /^(\d+) settings?$/.exec(english);
      if (count) return count[1] + " 项设置";
    }
  }
  return void 0;
}

// src/panels.ts
var panelNames = {
  Agents: "智能体",
  Library: "资源库",
  Toolbox: "工具箱",
  Inspector: "检查器",
  Operations: "操作记录",
  "Script details": "脚本详情",
  "Live logging": "实时日志",
  Execution: "执行",
  Viewer: "查看器"
};
var outputTypes = {
  Image: "图像",
  Video: "视频",
  Audio: "音频",
  Text: "文本",
  Mesh: "网格",
  Number: "数值",
  Boolean: "布尔值",
  Integer: "整数",
  Float: "浮点数",
  String: "字符串",
  Object: "对象",
  File: "文件",
  Color: "颜色",
  Vector: "向量"
};
var noScriptsStart = "No scripts match “";
var noScriptsEnd = "”.";
var noScriptsStartZh = "没有与“";
var noScriptsEndZh = "”匹配的脚本。";
function translatePanelsDynamic(element, field, english, node) {
  const classes = element.classList;
  if (classes.contains("merlin-panel-title") && element.previousElementSibling?.classList.contains("merlin-pane-back")) return null;
  if (classes.contains("merlin-panel-chip") && element.parentElement?.firstElementChild !== element && element.closest(".media-library") && !["Limited to the selected cards", "Limited to the selected Library items"].includes(english)) return null;
  if (field === "text" && (classes.contains("ue-menu-label") || element.parentElement?.classList.contains("ue-menu-label")) || field === "aria-label" && classes.contains("ue-menu-item")) {
    if (element.closest(".filter-saved-row")) return null;
    const facetPane = element.closest(".nodrag.nowheel > .ue-menu:not(:first-child)");
    if (facetPane && element.closest("button[aria-pressed]")) {
      const activeFacet = facetPane.previousElementSibling?.querySelector('button[aria-expanded="true"] > .ue-menu-label')?.textContent?.trim();
      if (!activeFacet || !["Location", "位置", "Output", "输出", "Age", "时间", "Votes", "投票", "Status", "状态", "Type", "类型"].includes(activeFacet)) return null;
    }
  }
  if (field === "text") {
    if (classes.contains("merlin-graphs-empty") && element.childNodes.length === 3) {
      const first = element.firstChild;
      const last = element.lastChild;
      if ([noScriptsStart, noScriptsStartZh].includes(first?.nodeValue ?? "") && [noScriptsEnd, noScriptsEndZh].includes(last?.nodeValue ?? "")) {
        if (node === first) return noScriptsStartZh;
        if (node === last) return noScriptsEndZh;
        return null;
      }
    }
    if (classes.contains("merlin-panel-search-count")) {
      const result = /^(\d+) results?$/.exec(english);
      if (result) return `${result[1]} 个结果`;
    }
    return void 0;
  }
  if (field !== "aria-label" && field !== "title") return void 0;
  if (classes.contains("media-library-size")) {
    const size = /^Thumbnail size: (\d+)px$/.exec(english);
    if (size) return `缩略图大小：${size[1]} 像素`;
  }
  if (classes.contains("merlin-script-output-icons") && english.startsWith("Outputs: ")) {
    const types = english.slice("Outputs: ".length).split(", ");
    return "输出：" + types.map((type) => Object.prototype.hasOwnProperty.call(outputTypes, type) ? outputTypes[type] : type).join("、");
  }
  if (classes.contains("merlin-panel-control-btn")) {
    for (const [name, label] of Object.entries(panelNames)) {
      if (english === "Close " + name) return "关闭" + label;
      if (english === "Fill Canvas with " + name) return "用" + label + "填满画布";
      if (english === "Restore " + name + " Side Panel") return "还原" + label + "侧栏";
    }
  }
  if (classes.contains("merlin-rail-pin")) {
    const pinned = /^Pinned to (.+) — click to release$/s.exec(english);
    if (pinned) return `已固定到${pinned[1]}，点击取消固定`;
  }
  if (classes.contains("merlin-scripts-row-count")) {
    const uses = /^(\d+) (?:cards? )?on this canvas$/.exec(english);
    if (uses) return `当前画布有 ${uses[1]} 张卡片使用此脚本`;
  }
  return void 0;
}

// src/settings.ts
var builtInFields = /* @__PURE__ */ new Map([
  ["name", ["Name", "名称"]],
  ["rating", ["Rating", "评分"]],
  ["votes", ["Votes", "票数"]],
  ["tags", ["Tags", "标签"]],
  ["status", ["Status", "状态"]],
  ["notes", ["Notes", "备注"]],
  ["subtype", ["Component", "组件"]],
  ["assignees", ["Assignees", "负责人"]],
  ["team", ["Team", "团队"]],
  ["type", ["Type", "类型"]],
  ["sys:cardType", ["Card type", "卡片类型"]],
  ["sys:source", ["Source", "来源"]],
  ["age", ["Age", "存续时间"]],
  ["sys:prompt", ["Prompt", "提示词"]],
  ["sys:negativePrompt", ["Negative", "负面提示词"]],
  ["sys:model", ["Model", "模型"]],
  ["sys:resolution", ["Resolution", "分辨率"]],
  ["sys:mediaDuration", ["Duration", "时长"]],
  ["sys:seed", ["Seed", "随机种子"]],
  ["sys:sequence", ["Sequence", "序列"]],
  ["sys:lineage", ["Lineage", "来源链"]],
  ["sys:c2pa", ["Provenance", "来源凭据"]],
  ["id", ["ID", "ID"]],
  ["kind", ["Kind", "种类"]],
  ["createdAt", ["Created", "创建时间"]],
  ["createdBy", ["Created by", "创建者"]],
  ["modifiedAt", ["Modified", "修改时间"]],
  ["modifiedBy", ["Modified by", "修改者"]],
  ["sys:duration", ["Run time", "运行时间"]],
  ["sys:metadata", ["Metadata", "元数据"]],
  ["sys:childCount", ["Contents", "内容"]],
  ["sys:description", ["Description", "描述"]],
  ["sys:sourceFile", ["File", "文件"]],
  ["sys:kindLabel", ["Kind name", "类型名称"]],
  ["sys:runStatus", ["Run", "运行"]],
  ["sys:sources", ["Sources", "来源"]]
]);
var groupTitles = new Map(Object.entries({
  Appearance: "外观",
  "Canvas & Interaction": "画布与交互",
  "Grid & Alignment": "网格与对齐",
  Graphs: "节点图",
  Generation: "生成",
  Exports: "导出",
  "Toolbox Library Paths": "工具箱资源库路径",
  "Local agents": "本地智能体",
  "Agent chat": "智能体对话",
  "Project review catalogue": "项目审阅目录",
  Dictation: "语音输入",
  Share: "分享",
  "Custom Fields": "自定义字段",
  Inspector: "检查器",
  Tooltips: "悬浮提示",
  Cards: "卡片",
  Tags: "标签",
  Teams: "团队",
  Users: "用户",
  Components: "组件",
  Display: "显示",
  Canvas: "画布",
  Graph: "节点图",
  "Editors & Tools": "编辑器与工具",
  Workers: "工作进程",
  "Webcam Capture Server": "摄像头采集服务",
  "Live session": "实时会话",
  Status: "状态",
  Credentials: "凭据",
  "Media Providers": "媒体服务商",
  "Model Approval": "模型审批",
  "By capability": "按能力",
  "Header Left": "标题栏左侧",
  "Header Right": "标题栏右侧",
  "Footer Left": "底栏左侧",
  "Footer Right": "底栏右侧"
}));
function groupTitle(title) {
  if (title.startsWith("Canvas knowledge · ")) return "画布知识 · " + title.slice("Canvas knowledge · ".length);
  const memory = /^Agent memory \((\d+)\)$/.exec(title);
  if (memory) return "智能体记忆（" + memory[1] + "）";
  return groupTitles.get(title);
}
function fieldControls(element, field, english) {
  const row = element.closest("[data-field-id]");
  if (!row) return;
  const label = builtInFields.get(row.getAttribute("data-field-id") ?? "");
  const display = (name) => label?.[0] === name ? label[1] : name;
  if (field === "text" && element.parentElement === row && label?.[0] === english) return label[1];
  if (element.tagName !== "BUTTON") return;
  if (field === "title") {
    const hide = /^Hide "(.+)" from this layout — .*\bHidden\b.*$/.exec(english);
    if (hide) return "在此布局中隐藏“" + display(hide[1]) + "”。可以从“隐藏”分组恢复。";
  }
  if (field === "aria-label") {
    const hide = /^Hide (.+) from this layout$/.exec(english);
    if (hide) return "在此布局中隐藏“" + display(hide[1]) + "”";
    const show = /^Show (.+) in this layout$/.exec(english);
    if (show) return "在此布局中显示“" + display(show[1]) + "”";
  }
}
function translateSettingsDynamic(element, field, english, node) {
  if (!element.closest(".settings-window-body > main")) return;
  if (field === "text") {
    const parentField = element.parentElement?.getAttribute("data-field-id");
    if (parentField && !builtInFields.has(parentField) && element.matches('span[style*="flex: 1"]')) return null;
    if (element.matches('[data-def-id]:has(button[role="switch"]:enabled) > div > span[style*="flex: 1"]')) return null;
    if (element.matches("section:not(.settings-group) label > span[title]:first-of-type") && element.getAttribute("title") !== "graph-library") return null;
    if (element.matches("[data-service-id] > div:first-child > div:nth-child(-n+2)")) return null;
    if (element.matches('[role="region"] button > div > div:first-child:has([data-testid="provider-icon"])')) return null;
    if (node && element.matches('[role="region"] button > div > div:nth-child(2)') && (node === element.firstChild || node.previousSibling?.nodeValue?.trim() === "·")) return null;
  }
  if (element.closest(".settings-group-header")) {
    if (field === "text" && element.closest("h3")) return groupTitle(english);
    if ((field === "title" || field === "aria-label") && element.matches("button[aria-expanded]")) {
      const match = /^(Expand|Collapse) (.+)$/.exec(english);
      if (match) return (match[1] === "Expand" ? "展开" : "折叠") + "“" + (groupTitle(match[2]) ?? match[2]) + "”";
    }
  }
  if (field === "aria-label" && element.matches("[data-zone-id] input") && english.startsWith("Rename group ")) {
    return "重命名分组“" + english.slice("Rename group ".length) + "”";
  }
  if (element.closest("[data-field-id]")) return fieldControls(element, field, english);
  if (field !== "text") return;
  if (element.matches('[role="region"] button > div > div')) {
    const missing = /^no credential for (.+) — sign in to run "(.+)"$/.exec(english);
    if (missing) return "缺少 " + missing[1] + " 的凭据，登录后可运行“" + missing[2] + "”";
    const disabled = /^"(.+)" has no permitted provider route$/.exec(english);
    if (disabled) return "“" + disabled[1] + "”没有获准使用的服务商路由";
    if ((english === "route" || english === "routes") && /^\d+$/.test(node?.previousSibling?.nodeValue?.trim() ?? "")) return "条路由";
    if (english === "s" && /^(?:route|条路由)$/.test(node?.previousSibling?.nodeValue?.trim() ?? "")) return " ";
  }
  if (element.matches("section:not(.settings-group) div, section:not(.settings-group) label > span:not([title])")) {
    const nodes = Array.from(element.childNodes, (node2) => node2.nodeValue?.trim() ?? "");
    if (!nodes.some((value) => /^\d+$/.test(value))) return;
    if (english === "canvas") return "张画布";
    if (english === "node") return "个节点";
    if (english === "child canvas") return "张子画布";
    if ((english === "es" || english === "s") && nodes.some((value) => /^(canvas|child canvas|node|张画布|张子画布|个节点)$/.test(value))) return " ";
    const children = /^\(\+ (\d+) subcanvases?\)$/.exec(english);
    if (children) return "（另有 " + children[1] + " 张子画布）";
  }
}

// src/viewers.ts
function translateViewerDynamic(element, field, english) {
  if (field !== "text") return void 0;
  if (english.startsWith("No 3D viewer for .") && element.matches("div.nodrag.nowheel[data-scroll-passthrough] > div > span")) {
    const format = /^No 3D viewer for (\.[^\s/]+) files\.$/.exec(english);
    if (format) return `目前无法预览 ${format[1]} 文件。`;
  }
  if (english.startsWith("Downloading:") && element.matches('.nodrag.nowheel[data-scroll-passthrough] :is([class*="messageContainerPrimary"],[class*="messageContainerMin"])')) {
    const progress = /^Downloading: (\d+(?:\.\d+)?%)$/.exec(english);
    if (progress) return "正在下载：" + progress[1];
  }
  return void 0;
}

// src/translate.ts
var attributes = ["title", "aria-label", "placeholder", "data-tooltip", "alt"];
var scopeAttributes = ["class", "role", "contenteditable", "translate", "data-testid", "data-package-row"];
var protectedContent = 'script,style,pre,code,.cm-content,.view-lines,[translate="no"],[data-merlin-text-surface],.agent-chat-message,.canvas-card-header,.agent-attention-preview,.agent-model-name,.agent-assignee-name,.agent-current-task-title,.merlin-scripts-name,.merlin-scripts-row-name,.merlin-graphs-tile-label,.credential-row-label,.merlin-ops-name';
var editableContent = '[contenteditable]:not([contenteditable="false"]),input,textarea,[role="textbox"]';
var searchMessageStart = "No settings in this category match “";
var searchEndId = "38f7650709e6c304";
var searchMessageStartZh = "当前分类没有与“";
var searchMessageEndZh = "”匹配的设置。要搜索其他分类，请先在左侧选择。";
function localize(doc, dictionary2) {
  const rules = /* @__PURE__ */ new Map();
  const helpLengths = /* @__PURE__ */ new Set();
  for (const group of dictionary2) {
    for (const [english, translation] of Object.entries(group.entries)) {
      if (!translation) continue;
      const length = keyLength(english);
      if (length !== void 0) helpLengths.add(length);
      for (const field of group.fields) {
        const key = field + "\n" + english;
        const candidates = rules.get(key) ?? [];
        candidates.push({ selector: group.selector, translation });
        rules.set(key, candidates);
      }
    }
  }
  const originals = /* @__PURE__ */ new Map();
  function put(node, field, value) {
    if (field === "text") node.nodeValue = value;
    else node.setAttribute(field, value);
  }
  function read(node, field) {
    return field === "text" ? node.nodeValue : node.getAttribute(field);
  }
  function translate(node, element, field) {
    const value = read(node, field);
    const fields = originals.get(node);
    const prior = fields?.get(field);
    const original = prior && prior.displayed === value ? prior.original : value;
    const english = original?.trim();
    let translated;
    const candidates = english ? rules.get(field + "\n" + english) ?? (helpLengths.has(english.length) ? rules.get(field + "\n" + copyKey(english)) : void 0) : void 0;
    const splitMessage = element.classList.contains("ue-menu-note") || element.classList.contains("merlin-graphs-empty");
    if (english && (candidates || splitMessage || english === "(" || /[A-Za-z]/.test(english))) {
      translated = translatePanelsDynamic(element, field, english, node);
      if (translated === void 0) translated = translateGeneration(element, field, english, node);
      if (translated === void 0) translated = translateSettingsDynamic(element, field, english, node);
      if (translated === void 0) translated = translateMenuDynamic(element, field, english);
      if (translated === void 0) translated = translateViewerDynamic(element, field, english);
      if (translated === void 0) {
        translated = candidates?.find((rule) => element.matches(rule.selector))?.translation ?? translateDynamic(element, field, english);
      }
    }
    if (field === "text" && isSettingsSearchMessage(element)) {
      translated = void 0;
      if (node === element.firstChild) translated = searchMessageStartZh;
      if (node === element.lastChild) translated = searchMessageEndZh;
    }
    if (translated) {
      const packageName = element.closest("[data-package-row]")?.getAttribute("data-package-row");
      const modelName = element.querySelector(':scope > [data-testid="provider-icon"]');
      const tabAction = isTabCloseAttribute(element, field) && english?.startsWith("Close ") || field === "title" && element.matches(".merlin-canvas-tab > span") && english?.endsWith(" — Double-click to rename");
      if (english === packageName || modelName || element.matches('[data-testid="provider-icon"]') || element.closest(protectedContent) || element.closest(".merlin-canvas-tab") && !tabAction || field === "text" && element.closest(editableContent + ',option[value="custom"]')) translated = void 0;
    }
    if (translated && original && english) {
      const start = original.indexOf(english);
      const displayed = original.slice(0, start) + translated + original.slice(start + english.length);
      if (value !== displayed) {
        const entries = fields ?? /* @__PURE__ */ new Map();
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
  function visit(node) {
    if (node.nodeType === 3 && node.parentElement) translate(node, node.parentElement, "text");
    else if (node.nodeType === 1) {
      const element = node;
      for (const field of attributes) if (element.hasAttribute(field) || originals.get(node)?.has(field)) translate(node, element, field);
    }
  }
  function walk(root, fn) {
    fn(root);
    const walker = doc.createTreeWalker(root, 5);
    while (walker.nextNode()) fn(walker.currentNode);
  }
  function restore(node) {
    const entries = originals.get(node);
    if (!entries) return;
    for (const [field, entry] of entries) if (read(node, field) === entry.displayed) put(node, field, entry.original);
    originals.delete(node);
  }
  const observer = new doc.defaultView.MutationObserver((records) => {
    const roots = /* @__PURE__ */ new Set();
    for (const record of records) {
      if (record.type === "childList") {
        for (const removed of record.removedNodes) if (!doc.contains(removed)) walk(removed, restore);
        for (const added of record.addedNodes) roots.add(added);
      } else if (record.type === "characterData") roots.add(record.target);
      else if (record.attributeName && doc.contains(record.target)) {
        if (scopeAttributes.includes(record.attributeName)) roots.add(record.target);
        else translate(record.target, record.target, record.attributeName);
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
  observer.observe(doc.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...attributes, ...scopeAttributes] });
  return () => {
    observer.disconnect();
    for (const node of originals.keys()) restore(node);
  };
}
function isTabCloseAttribute(element, field) {
  return (field === "title" || field === "aria-label") && element.matches(".merlin-canvas-tab > button.merlin-canvas-tab-close");
}
function isSettingsSearchMessage(element) {
  if (element.tagName !== "P" || !element.matches(".settings-window-body > main > p")) return false;
  const first = element.firstChild?.nodeValue;
  const last = element.lastChild?.nodeValue;
  return (first === searchMessageStart || first === searchMessageStartZh) && (last === searchMessageEndZh || !!last && copyId(last) === searchEndId);
}
function translateDynamic(element, field, english) {
  if (isTabCloseAttribute(element, field) && english.startsWith("Close ")) return "关闭 " + english.slice(6);
  if (field === "title" && element.matches(".merlin-inspector-panel span[title]")) {
    const copyHint = /\n\n\(right-click to copy\)$/.exec(english);
    if (copyHint) return english.slice(0, copyHint.index) + "\n\n（右键复制）";
  }
  if (field !== "text") return;
  if (element.closest(".merlin-generation-shelf")) {
    const missing = /^Model '(.+)' has no confirmed credentials\..*?\bconfigure (.+?) in Settings\b.*$/.exec(english);
    if (missing) {
      const credential = missing[2] === "the native Claude API credentials" ? "Claude 原生 API 凭据" : missing[2];
      return "模型“" + missing[1] + "”尚无已确认的凭据。请登录或在设置中配置 " + credential + "，然后重试。";
    }
  }
  if (element.matches(".merlin-panel-count,.merlin-panel-count-pill,.merlin-panel-chip-count")) {
    const tools = /^(\d+) tools?$/.exec(english);
    if (tools) return tools[1] + " 个工具";
    const items = /^(\d+) items?$/.exec(english);
    if (items) return items[1] + " 项";
  }
}

// src/locales/zh-CN.json
var zh_CN_default = [
  {
    selector: ".merlin-panel-search input",
    fields: [
      "placeholder",
      "aria-label"
    ],
    entries: {
      "Search Toolbox": "搜索工具箱"
    }
  },
  {
    selector: '.settings-window-body *,[role="tooltip"],[role="tooltip"] *',
    fields: [
      "text",
      "title",
      "aria-label"
    ],
    entries: {
      "Pre-generate .uassets": "预生成 .uasset 资产",
      "#192:03fbb2a275c17769": "启用后，后台将生成的网格及高斯泼溅转换为 .uasset，在原生视口显示。关闭后改用浏览器轻量预览并跳过转换。"
    }
  },
  {
    selector: "[data-package-row] button[aria-expanded] > span",
    fields: [
      "text"
    ],
    entries: {
      included: "随包安装"
    }
  },
  {
    selector: '[role="tooltip"],[role="tooltip"] *',
    fields: [
      "text"
    ],
    entries: {
      "#50:75e4c247165575a2": "新建画布、浏览画布库或从文件打开",
      "#38:7eb76386e94d9626": "保存当前画布、另存副本或导出包",
      "#41:f8530b9d9a73c549": "在新标签页创建画布或打开已有画布",
      "#48:ffbd99d27d6ee4a8": "查看 Canvas 帮助、快捷键及版本信息",
      "Preferences, models, shortcuts and more": "偏好设置、模型、快捷键及更多选项",
      "#47:8396400a8d0f0a14": "与智能体聊天并查看处理结果",
      "#49:aae32e0a982168e7": "浏览画布里的图片、音视频和三维资产",
      "#46:00ef3ec8fcd8a43f": "将节点图或 Python 脚本添加到画布",
      "#40:c6019721a61070dc": "查看或修改当前选择的属性",
      "#52:dbf3f10771540ccc": "查看正在执行的任务与最近完成的任务",
      "#40:27f2624de6fd2b7d": "打开实时应用日志",
      "#36:c819a0ca6d2dbeeb": "打开 Python 交互控制台"
    }
  },
  {
    selector: ".settings-window-body input",
    fields: [
      "placeholder"
    ],
    entries: {
      "Search Preferences...": "搜索偏好设置…",
      "Search Preferences…": "搜索偏好设置…",
      "#46:f82ede0753af8ffc": "填写全体成员均能访问的网络目录或共享盘"
    }
  },
  {
    selector: '.settings-window-body div[style*="--font-size-11"]',
    fields: [
      "text"
    ],
    entries: {
      accepts: "支持",
      "image, video, audio": "图像、视频和音频",
      "#44:24e6efa714470a4e": "可用的输入名有 image、image2、image3、image4、source 和 video"
    }
  },
  {
    selector: '.merlin-inspector-tabs > button,.merlin-inspector-panel .merlin-field-group-header,.merlin-inspector-panel span[style*="--field-label-size"]',
    fields: [
      "text"
    ],
    entries: {
      Details: "详细信息",
      Metadata: "元数据",
      History: "历史记录",
      Card: "卡片",
      "Card type": "卡片类型",
      Content: "内容",
      Type: "类型",
      "Kind name": "种类名称",
      Record: "记录",
      General: "常规",
      Name: "名称",
      Rating: "评分",
      Votes: "投票",
      Tags: "标签",
      Status: "状态",
      Notes: "备注",
      "Comment history": "评论历史",
      Assignees: "负责人",
      Team: "团队"
    }
  },
  {
    selector: '.merlin-inspector-tabs [role="tablist"]',
    fields: [
      "aria-label"
    ],
    entries: {
      "Inspector sections": "检查器分区"
    }
  },
  {
    selector: "#merlin-inspector-panel-metadata details > summary",
    fields: [
      "text"
    ],
    entries: {
      "Comment history": "评论历史"
    }
  },
  {
    selector: '[role="menuitem"],[role="menuitem"] *',
    fields: [
      "text"
    ],
    entries: {
      "Add Comment": "添加评论"
    }
  },
  {
    selector: '.settings-window-body *,.settings-nav *,.merlin-panel-title,.merlin-panel-context,.merlin-panel-tabs *,.merlin-rail-empty,.merlin-panel-controls *,.merlin-ops-columns *,.merlin-ops-empty *,.merlin-ops-empty,.generation-shelf-fields *,.generation-shelf-settings-heading,.generation-shelf-mode-segment *,.generation-shelf-generate-group *,.generation-shelf-options *,.generation-shelf-selection-header *,.generation-shelf-prompt-label,.generation-shelf-prompt-placeholder,.generation-shelf-empty,.generation-shelf-model *,.agent-welcome *,.agent-onboarding *,.connect-agent-header *,.connect-agent-label,.connect-agent-note,.ue-menu-item *,.ue-menu-item,.ue-menu-heading,.pill-menu-item *,.pill-menu-item,[role="menuitem"],[role="menuitem"] *,[role="tooltip"],[role="tooltip"] *,.merlin-panel-search *,.merlin-key-picker *,.merlin-panel-group *,.canvas-card-toolbar *,.merlin-file-menu-heading,.merlin-file-menu-hint,.custom-select-popover *,.custom-select-menu *,.merlin-rail-body-content > [role="status"],.merlin-ops-group-toggle span,.merlin-scripts-table-head .merlin-scripts-cell,.merlin-scripts-cell-type,.media-library-empty *,.media-library-filter-popover *,.merlin-panel-chip',
    fields: [
      "text"
    ],
    entries: {
      Settings: "设置",
      Help: "帮助",
      Preferences: "偏好设置",
      General: "常规",
      GENERAL: "常规",
      MODELS: "模型",
      Models: "模型",
      Agent: "智能体",
      Agents: "智能体",
      Library: "资源库",
      Toolbox: "工具箱",
      Inspector: "检查器",
      Operations: "操作记录",
      Dictation: "语音输入",
      Shortcuts: "快捷键",
      Semantics: "语义与元数据",
      Collaborate: "协作",
      "External Paths": "外部路径",
      Storage: "存储",
      Extensions: "扩展",
      "Model Providers": "模型服务商",
      "Model Catalog": "模型目录",
      "Model Schemas": "模型定义",
      "Default Models": "默认模型",
      Close: "关闭",
      Cancel: "取消",
      Save: "保存",
      Open: "打开",
      New: "新建",
      Create: "创建",
      Edit: "编辑",
      Delete: "删除",
      Remove: "移除",
      Apply: "应用",
      Reset: "重置",
      Confirm: "确认",
      Done: "完成",
      Back: "返回",
      Next: "下一步",
      Continue: "继续",
      Retry: "重试",
      Refresh: "刷新",
      Search: "搜索",
      Filter: "筛选",
      Filters: "筛选",
      Clear: "清除",
      Copy: "复制",
      Paste: "粘贴",
      Cut: "剪切",
      Undo: "撤销",
      Redo: "重做",
      Duplicate: "创建副本",
      Rename: "重命名",
      Import: "导入",
      "Import…": "导入…",
      Export: "导出",
      "Export…": "导出…",
      Download: "下载",
      Run: "运行",
      "Re-run": "重新运行",
      Stop: "停止",
      Play: "播放",
      Pause: "暂停",
      Show: "显示",
      Hide: "隐藏",
      Enable: "启用",
      Disable: "停用",
      Enabled: "已启用",
      Disabled: "已停用",
      On: "开启",
      Off: "关闭",
      Auto: "自动",
      None: "无",
      All: "全部",
      Default: "默认",
      DEFAULT: "默认",
      Local: "本地",
      Shared: "共享",
      UNSET: "未设置",
      "Set Default": "设为默认",
      "+ Add Folder": "+ 添加文件夹",
      "+ Add": "+ 添加",
      "Browse…": "浏览…",
      Test: "测试",
      "Open folder": "打开文件夹",
      "Reset to default": "恢复默认",
      Appearance: "外观",
      "#68:e0530d11f138c772": "调整画布显示、操作方式与可用功能。",
      "Canvas color": "画布颜色",
      "Canvas grid color": "画布网格颜色",
      "Graph color": "节点图颜色",
      "Graph grid color": "节点图网格颜色",
      "Canvas toolbar position": "画布工具栏位置",
      "Float top": "顶部浮动",
      "Float left": "左侧浮动",
      "Float right": "右侧浮动",
      "Float bottom": "底部浮动",
      "Canvas & Interaction": "画布与交互",
      "Mouse wheel zooms canvas": "鼠标滚轮缩放画布",
      "Maximum zoom": "最大缩放",
      "#26:c3872cb5a23eb6ea": "把流程生成的卡片归入框架",
      "Frame imported files": "为导入文件添加框架",
      "Fixed-size card headers": "固定卡片标题大小",
      "Show feature hints": "显示功能提示",
      "Show tooltips": "显示悬浮提示",
      "Spelling suggestions in text fields": "文本框拼写建议",
      "Use free-form bezier wires": "使用自由贝塞尔连线",
      "Default node view": "默认节点视图",
      Compact: "紧凑",
      Extended: "扩展",
      Wired: "已连接",
      Superset: "完整",
      "Live 3D on selected cards": "所选卡片实时预览 3D",
      "Show re-run indicators": "显示重新运行标记",
      "Grid & Alignment": "网格与对齐",
      "Show canvas grid": "显示画布网格",
      "Snap to grid": "吸附到网格",
      "Alignment tools": "对齐工具",
      "Snap to cards": "吸附到卡片",
      Graphs: "节点图",
      Graph: "节点图",
      Canvas: "画布",
      "Autolock on wired outputs": "连接输出后自动锁定",
      Generation: "生成",
      "Graph snapshot scope": "节点图快照范围",
      "Entire canvas": "整个画布",
      "Upstream only": "仅上游",
      Exports: "导出",
      "#45:096bb891fb9c74d5": "下载时一并写入 C2PA 来源记录",
      "Toolbox Library Paths": "工具箱资源库路径",
      "Graph & Code Script Directories": "节点图与代码脚本目录",
      "#57:f56670b436693517": "管理服务商凭据，查看可生成的媒体类型。",
      "Generation providers": "生成服务商",
      "#48:655f50063597b0df": "连接用于制作资产的模型服务。",
      "#83:efbe3393657c82ce": "尚未连接生成服务。添加服务商即可选用它提供的模型。",
      Credentials: "凭据",
      "#132:254370abf63ed06b": "分别为服务商配置密钥或 OAuth 登录。目录会保留缺少凭据的模型，并标明其状态。",
      Missing: "未配置",
      "Set…": "设置…",
      "API key setup guide": "API 密钥设置指南",
      "Media Providers": "媒体服务商",
      "#83:8f25240fb84ac9af": "按注册信息列出各服务商支持的媒体类型，此表只读。",
      "#70:62b2b87e29ca3974": "媒体服务商负责将本机文件转为目标服务接受的格式。",
      "Add media provider…": "添加媒体服务商…",
      "Built-in": "内置",
      "Create your own extension": "创建自己的扩展",
      Installed: "已安装",
      Available: "可获取",
      Sources: "来源",
      "Check for updates": "检查更新",
      "Install ▾": "安装 ▾",
      Install: "安装",
      "Ask before running": "运行前询问",
      "Every installed extension": "每个已安装的扩展",
      "#24:079ce2f31266e183": "仅包含可执行代码的扩展",
      Never: "从不",
      "Update automatically": "自动更新",
      "#51:3d7010fc5aff6a35": "尚未添加扩展。可从已有来源安装，或新建草稿。",
      Plugins: "插件",
      Plugin: "插件",
      plugin: "插件",
      "Not allowed yet": "尚未允许",
      Allow: "允许",
      "Allowing…": "正在允许…",
      Reload: "重新加载",
      "Reloading…": "正在重新加载…",
      Uninstall: "卸载",
      Live: "已加载",
      Changed: "已变更",
      Update: "更新",
      "Updating…": "正在更新…",
      Check: "检查",
      "Checking…": "正在检查…",
      "Not loaded": "未加载",
      "From a git repository…": "从 Git 仓库安装…",
      "From a folder…": "从文件夹安装…",
      "#28:437372373c5c55fc": "从 ZIP 安装包或分享码安装…",
      "Install an extension": "安装扩展",
      "Install from a git repository": "从 Git 仓库安装",
      "Install from a folder": "从文件夹安装",
      "Extension folder": "扩展文件夹",
      "#28:443c563cd4b09ee7": "从磁盘重新读取文件",
      "#68:85946dccd048b964": "已找到本机插件，请先确认允许加载。",
      "#84:3ff403a234bc1f38": "插件文件已有更新，运行新版需要再次授权。",
      "#11:696264878d4f2cff": "本画布",
      "All canvases": "所有画布",
      "Started by": "发起者",
      Status: "状态",
      "In progress": "进行中",
      "#34:a6629eadf6965c08": "本画布当前没有运行中的操作。",
      "Recently completed": "最近完成",
      "#27:b3c001a3118449f9": "任务完成后会出现在这里。",
      "#39:4269dffa9358f995": "选中卡片或框架后可查看属性。",
      "Loading library…": "正在加载资源库…",
      "Loading…": "正在加载…",
      "Loading reviews…": "正在加载评审…",
      "No results": "没有结果",
      Name: "名称",
      Type: "类型",
      Out: "输出",
      Use: "使用",
      "Group:": "分组",
      Group: "分组",
      Prompt: "提示词",
      "#33:59f2efcf6c54075c": "描述想要生成的内容…",
      "Enter prompt text…": "输入提示词…",
      "Ask the agent…": "询问智能体…",
      "Ask The Agent": "询问智能体",
      "Ask the agent": "询问智能体",
      "Aspect Ratio": "宽高比",
      Resolution: "分辨率",
      Count: "数量",
      Seed: "随机种子",
      "Google Search": "Google 搜索",
      Batch: "批量",
      Image: "图像",
      Video: "视频",
      Audio: "音频",
      Text: "文本",
      Mesh: "网格模型",
      Splat: "高斯泼溅",
      Other: "其他",
      "No models available": "没有可用模型",
      "Add provider": "添加服务商",
      Model: "模型",
      Generate: "生成",
      "Generation settings": "生成设置",
      "Generation inputs": "生成输入",
      "Generation references": "生成参考",
      "Generation toolshelf": "生成工具架",
      "Generation type": "生成类型",
      "Add inputs": "添加输入",
      "Clear toolshelf": "清空工具架",
      Toolshelf: "工具架",
      "Toolshelf options": "工具架选项",
      "Toolshelf placement": "工具架位置",
      "Expand prompt": "展开提示词",
      "Clear inputs": "清空输入",
      "Show hint": "显示提示",
      "Random seed": "随机种子",
      "Batch mode": "批量模式",
      "Fold toolshelf to its bar": "将工具架折叠为栏",
      "Fold to the bar": "折叠为栏",
      "Collapse toolshelf": "折叠工具架",
      "Create New Card": "创建新卡片",
      "Create New Deck": "创建新卡组",
      "Add to Deck": "添加到卡组",
      "Agent Chooses": "由智能体选择",
      "Output: Create New Card": "输出到新卡片",
      "Output: Create New Deck": "输出到新卡组",
      "Output: Add to Deck": "输出到卡组",
      "Output: Agent Chooses": "由智能体选择输出位置",
      "#34:21a8005b341f5766": "从画布选取或从磁盘导入素材",
      "#37:61b0f8dc935cd342": "清空输入、生成参数和提示词",
      "Generate — expand toolshelf": "生成 — 展开工具架",
      "#26:26b60f05c41af2de": "你好，我是画布智能体。",
      "#47:75074f35b1db92d0": "我可以协助你使用 Unreal Canvas。",
      "Ask me about using Canvas": "向我询问画布的用法",
      "Create custom tools": "创建自定义工具",
      "Create images": "生成图像",
      "Create meshes": "生成网格模型",
      "Edit images": "编辑图像",
      "#63:0b3c9c6fcd4ea6f2": "接入 Claude Code、Codex 或 API 服务后即可开始对话。",
      "Set up an agent →": "配置智能体 →",
      "#34:debf1359404f01a7": "请先连接智能体。",
      "Connect your agent": "连接你的智能体",
      "Local agents": "本地智能体",
      "Agent connections": "智能体连接",
      "Manage connections": "管理连接",
      "Default context for new chats": "新对话默认上下文",
      Clean: "空白",
      Personal: "个人",
      "Agent chat": "智能体对话",
      "Enable Floating Agent Chat": "启用浮动智能体对话",
      "#34:ab099b43cbfa78e1": "查看智能体的任务与活动记录",
      "No memories yet": "尚无记忆",
      "Project review catalogue": "项目评审目录",
      "Default project": "默认项目",
      "All reviews": "所有评审",
      Approved: "已批准",
      Rejected: "已拒绝",
      "All reviewers": "所有评审者",
      "Human feedback": "人工反馈",
      "Agent checks": "智能体检查",
      "Show withdrawn": "显示已撤回",
      "No canvas knowledge yet": "尚无画布知识",
      Detected: "已检测到",
      "Set up": "配置",
      "Check connection": "检查连接",
      "Show sign-in steps": "查看登录步骤",
      "Send test message": "发送测试消息",
      "Start chatting": "开始对话",
      Configure: "配置",
      Connect: "连接",
      Connected: "已连接",
      Disconnected: "未连接",
      "New agent": "新建智能体",
      "New chat": "新建对话",
      Effort: "推理强度",
      Plan: "计划",
      Permissions: "权限",
      "Model for your first chat": "首次对话使用的模型",
      "Open or browse": "打开或浏览",
      "Open new tab": "打开新标签页",
      "Live logging": "实时日志",
      Execution: "执行",
      "Select (V)": "选择 (V)",
      Insert: "插入",
      Annotate: "批注",
      "Frame (R)": "框架 (R)",
      "Toolbar position": "工具栏位置",
      "Filter cards": "筛选卡片",
      "Zoom out": "缩小",
      "Zoom in": "放大",
      "Zoom and view options": "缩放与视图选项",
      "Zoom to fit": "缩放以适应画布",
      "Fit selection": "适应所选内容",
      "Import File…": "导入文件…",
      "Canvas Settings": "画布设置",
      "Copy Link": "复制链接",
      "Open Graph": "打开节点图",
      "Open Viewer": "打开查看器",
      "Edit settings and regenerate": "编辑设置并重新生成",
      Expand: "展开",
      Collapse: "折叠",
      "Open graph": "打开节点图",
      "Open viewer": "打开查看器",
      "View script": "查看脚本",
      "Edit script": "编辑脚本",
      Pin: "固定",
      Unpin: "取消固定",
      Lock: "锁定",
      Unlock: "解锁",
      "Select all": "全选",
      Arrange: "排列",
      Align: "对齐",
      "Auto-align": "自动对齐",
      "Bring to front": "置于顶层",
      "Send to back": "置于底层",
      Details: "详情",
      Parameters: "参数",
      History: "历史",
      Metadata: "元数据",
      Provenance: "来源",
      Inputs: "输入",
      Outputs: "输出",
      Results: "结果",
      "Search cards…": "搜索卡片…",
      "Search tools…": "搜索工具…",
      "Search extensions": "搜索扩展",
      "Search the catalogs": "搜索目录",
      "Search the sources": "搜索来源",
      "Search Preferences settings": "搜索偏好设置",
      "Filter shortcuts…": "筛选快捷键…",
      "Filter canvases…": "筛选画布…",
      "#21:f147f76fac9921f2": "还没有自定义字段。",
      "Custom Fields": "自定义字段",
      "+ Add custom field": "+ 添加自定义字段",
      Share: "分享",
      "Semantics file": "语义配置文件",
      "#170:ade8d5d5c18ef7b5": "为各类能力设定默认模型。新节点及助手会优先采用，也能在模型目录点星标指定。",
      "By capability": "按能力",
      "#120:bb6da99b90aef116": "Canvas 会选择可用的服务商路由，某条路由暂时离线时也会尽量使用首选模型。",
      "Image generation": "图像生成",
      "Image upscaling": "图像放大",
      "Video generation": "视频生成",
      "Video upscaling": "视频放大",
      "Audio generation": "音频生成",
      "Text generation (LLM)": "文本生成（LLM）",
      "Mesh generation": "网格模型生成",
      "Splat generation": "高斯泼溅生成",
      "Rigging (auto-rig)": "自动绑定",
      Schema: "定义",
      Tier: "层级",
      Credential: "凭据",
      Actions: "操作",
      Untested: "未测试",
      "View JSON": "查看 JSON",
      Fork: "创建分支",
      "Add service…": "添加服务…",
      "Refresh registry": "刷新注册表",
      "Media type": "媒体类型",
      "All types": "全部类型",
      "All providers": "所有服务商",
      Favourites: "收藏",
      Favorites: "收藏",
      "Editors & Tools": "编辑器与工具",
      "ffmpeg path": "ffmpeg 路径",
      "Blender path": "Blender 路径",
      "Image editor path": "图像编辑器路径",
      "ComfyUI Server URL": "ComfyUI 服务地址",
      Workers: "工作进程",
      "AI Models Root": "AI 模型根目录",
      "Pose-fit venv dir": "Pose-fit 虚拟环境目录",
      "Pose-fit worker status": "Pose-fit 进程状态",
      "LangSAM venv dir": "LangSAM 虚拟环境目录",
      "LangSAM worker script": "LangSAM 工作脚本",
      "SAM2 variant": "SAM2 变体",
      "Live session": "实时会话",
      "Your display name": "你的显示名称",
      "Start sharing this canvas": "开始共享此画布",
      "Join someone else's session": "加入他人的会话",
      Join: "加入",
      "Shared storage": "共享存储",
      "People here": "在线成员",
      "#8:5151a0e6112ab98c": "仅自己在线",
      "#81:c309f84acd6a964a": "分享画布后可实时协作，并查看谁正在线。",
      "#87:ab6ddbfd4998b931": "为这幅画布创建实时会话并分享邀请，也可加入已有会话。",
      "Storage roots": "存储根目录",
      Scan: "扫描",
      Quarantine: "隔离",
      Projects: "项目",
      "Results cache": "结果缓存",
      Uploads: "上传",
      Cache: "缓存",
      Path: "路径",
      Size: "大小",
      Files: "文件",
      Folders: "文件夹",
      Folder: "文件夹",
      "Open location": "打开位置",
      "#56:e536832f2cc60bd3": "查看键盘快捷键及参考组合键。",
      "Canvas tools": "画布工具",
      "Select tool": "选择工具",
      "Annotate tool": "批注工具",
      "Frame tool": "框架工具",
      "Text tool": "文本工具",
      "Connector tool": "连接线工具",
      "Not available when": "不可用条件",
      "Navigating the canvas": "画布导航",
      "Selection and editing": "选择与编辑",
      Active: "生效",
      "#38:abce5d5573444111": "聚焦所选内容，无选区时显示整幅画布",
      "Fit the whole canvas": "适应整个画布",
      "Go up one level": "返回上一级",
      "Select all cards": "全选卡片",
      "Copy the selection": "复制所选内容",
      "Auto-align the selected cards": "自动对齐所选卡片",
      "#25:60e156ede888e399": "将当前画布写入文件",
      "Close viewer": "关闭查看器",
      "Close search": "关闭搜索",
      "Close tips": "关闭提示",
      "Close connection setup": "关闭连接设置",
      "Close provider setup": "关闭服务商设置",
      "Close script editor": "关闭脚本编辑器",
      "Dictate message": "语音输入消息",
      "Cancel dictation": "取消语音输入",
      Microphone: "麦克风",
      Language: "语言",
      Automatic: "自动",
      Width: "宽度",
      Height: "高度",
      "Duration (s)": "时长（秒）",
      "Create a script": "创建脚本",
      "Create task": "创建任务",
      Diagnostics: "诊断",
      Dismiss: "忽略",
      "Dismiss error": "关闭错误",
      "Dismiss suggestions": "关闭建议",
      Output: "输出",
      Input: "输入",
      Description: "描述",
      Notes: "备注",
      Tags: "标签",
      Team: "团队",
      Rating: "评分",
      Comments: "评论",
      "Add a comment…": "添加评论…",
      "Group by": "分组方式",
      "Sort by": "排序方式",
      "Newest first": "最新优先",
      "Oldest first": "最早优先",
      "Show all": "显示全部",
      "Clear all": "清空全部",
      "Filter output": "筛选输出",
      "Open in viewer": "在查看器中打开",
      "Import to Content Browser": "导入到内容浏览器",
      "From file…": "从文件…",
      "Select files": "选择文件",
      "Select folder": "选择文件夹",
      "New canvas": "新建画布",
      "Save as…": "另存为…",
      "Save As…": "另存为…",
      "Open…": "打开…",
      Recent: "最近使用",
      "Collapse General": "折叠常规",
      "Expand General": "展开常规",
      "Collapse Models": "折叠模型",
      "Expand Models": "展开模型",
      "Search extensions…": "搜索扩展…",
      "Loading extensions…": "正在加载扩展…",
      "Loading installed plugins…": "正在加载已安装插件…",
      "Switch off": "停用",
      "Switch on": "启用",
      "#38:0331ddad712abffb": "选择已安装扩展在执行前如何请求批准",
      "#190:16d013a4325dd6ad": "API 凭据写入系统密钥库。若还设置了 .env 或 --keys-file，应用会优先读取这些已有配置。",
      "#179:7c0e39f7a782aeda": "管理本机面板、命令、智能体工具、脚本和技能。已安装扩展按授权或运行前询问设置执行。",
      "#37:9d67ad8e08d0f924": "自己创建的草稿可以直接试运行。",
      "#116:bfd53f661461a1c7": "查看作品目录、团队共享目录和 Lore，维护存储或导入旧画布。",
      "Where your work is kept": "作品保存位置",
      "#111:04fb8d6eb6220ea9": "Canvas 作品可保存在下列三个相关位置。",
      "Shared with your team": "与团队共享",
      "#118:2f58581cf3727544": "团队通过工程 project.json 指定统一目录，在此共同打开和编辑共享画布。",
      "#27:16c022efbe2f9569": "此工程尚未指定",
      Maintenance: "维护",
      Advanced: "高级",
      "#187:aec8ea747b826024": "手动扫描所有已存画布，找出无引用的上传或烘焙文件以及无法读取的画布。扫描本身保留磁盘内容。",
      "Video stills:": "视频静帧：",
      "not checked": "尚未检查",
      "#272:ff10cdf7086f43c8": "视频附带静帧可立即预览。缺少静帧时需解码视频，大文件耗时较长。可单独发起元数据扫描来检查哪些结果缺少静帧。",
      "#114:02559c6c1f6ff852": "检查服务识别到的各层存储、访问状态和实际占用。",
      "#33:2c41cb4e8c52ab0c": "还没有可显示的存储状态。",
      Python: "Python",
      "Resize Prompt": "调整提示词区域高度",
      "Drag to resize": "拖动以调整大小",
      "Search library…": "搜索资源库…",
      "#295:75a7add433a3286c": "受信任目录的更新若未增加权限请求，且无可执行代码或已通过目录审核，可按现有授权自动应用。其他情况需再次确认。",
      "Media library": "媒体资源库",
      "Search media": "搜索媒体",
      "Search…": "搜索…",
      "Content view": "内容视图",
      "Tile view": "平铺视图",
      "List view": "列表视图",
      Tile: "平铺",
      List: "列表",
      Archived: "已归档",
      "Archived cards": "归档卡片",
      "#96:2134e5868863a366": "查看并恢复仍含生成媒体的已删卡片。",
      "Active filters": "当前筛选条件",
      "On this canvas": "当前画布",
      "Thumbnail size": "缩略图大小",
      "Limit to selection": "仅显示选中项",
      "#86:d28159cda7f20bb6": "只列出所选卡片或框架内的媒体",
      "Refresh media library": "刷新媒体资源库",
      "Rescan saved canvases": "重新扫描已保存画布",
      "No media yet": "暂无媒体",
      "#67:31ee5e1c0e859164": "在这里添加媒体，或转到「位置 → 我的画布」。",
      Location: "位置",
      "On my canvases": "我的画布",
      "#177:81e821083cfeef37": "扩展卡片类型和服务。插件提供的卡片、查看器和服务可热更新，内置插件需重启。安装目录为",
      "#82:75888e04e43f4477": "设为默认后，新节点和助手将优先使用该模型",
      "#217:6ceea5a8ac060001": "管理本机扩展与插件提供的面板、命令、工具、脚本或技能。已安装扩展须按授权或询问设置运行。自己的草稿可直接试运行。",
      "#32:1137794f58d3b148": "扩展可用的卡片类型与服务。",
      "#127:be82c8156124d162": "插件提供的卡片、查看器和服务可热更新，使用内置插件的新版本需重启应用。",
      "Installs land in": "安装目录为",
      "New Canvas": "新建画布",
      "Browse canvases…": "浏览画布…",
      "Open File…": "打开文件…",
      "Text Card": "文本卡片",
      Subcanvas: "子画布",
      Frame: "框架",
      Subscript: "子脚本",
      Timeline: "时间线",
      "Font size": "字号",
      Bold: "加粗",
      Italic: "斜体",
      Underline: "下划线",
      "Text color": "文字颜色",
      "Align left": "左对齐",
      "Align center": "居中",
      "Align right": "右对齐",
      "Save Canvas": "保存画布",
      "Duplicate Canvas": "复制画布",
      "Package Canvas…": "打包画布…"
    }
  },
  {
    selector: 'button,input,textarea,[role="button"],[role="combobox"],.ue-toolbar-btn,.generation-shelf-toggle,[data-tooltip],.media-library,[role="group"]',
    fields: [
      "title",
      "aria-label",
      "placeholder",
      "data-tooltip"
    ],
    entries: {
      Settings: "设置",
      Help: "帮助",
      Preferences: "偏好设置",
      General: "常规",
      GENERAL: "常规",
      MODELS: "模型",
      Models: "模型",
      Agent: "智能体",
      Agents: "智能体",
      Library: "资源库",
      Toolbox: "工具箱",
      Inspector: "检查器",
      Operations: "操作记录",
      Dictation: "语音输入",
      Shortcuts: "快捷键",
      Semantics: "语义与元数据",
      Collaborate: "协作",
      "External Paths": "外部路径",
      Storage: "存储",
      Extensions: "扩展",
      "Model Providers": "模型服务商",
      "Model Catalog": "模型目录",
      "Model Schemas": "模型定义",
      "Default Models": "默认模型",
      Close: "关闭",
      Cancel: "取消",
      Save: "保存",
      Open: "打开",
      New: "新建",
      Create: "创建",
      Edit: "编辑",
      Delete: "删除",
      Remove: "移除",
      Apply: "应用",
      Reset: "重置",
      Confirm: "确认",
      Done: "完成",
      Back: "返回",
      Next: "下一步",
      Continue: "继续",
      Retry: "重试",
      Refresh: "刷新",
      Search: "搜索",
      Filter: "筛选",
      Filters: "筛选",
      Clear: "清除",
      Copy: "复制",
      Paste: "粘贴",
      Cut: "剪切",
      Undo: "撤销",
      Redo: "重做",
      Duplicate: "创建副本",
      Rename: "重命名",
      Import: "导入",
      "Import…": "导入…",
      Export: "导出",
      "Export…": "导出…",
      Download: "下载",
      Run: "运行",
      "Re-run": "重新运行",
      Stop: "停止",
      Play: "播放",
      Pause: "暂停",
      Show: "显示",
      Hide: "隐藏",
      Enable: "启用",
      Disable: "停用",
      Enabled: "已启用",
      Disabled: "已停用",
      On: "开启",
      Off: "关闭",
      Auto: "自动",
      None: "无",
      All: "全部",
      Default: "默认",
      DEFAULT: "默认",
      Local: "本地",
      Shared: "共享",
      UNSET: "未设置",
      "Set Default": "设为默认",
      "+ Add Folder": "+ 添加文件夹",
      "+ Add": "+ 添加",
      "Browse…": "浏览…",
      Test: "测试",
      "Open folder": "打开文件夹",
      "Reset to default": "恢复默认",
      Appearance: "外观",
      "#68:e0530d11f138c772": "调整画布显示、操作方式与可用功能。",
      "Canvas color": "画布颜色",
      "Canvas grid color": "画布网格颜色",
      "Graph color": "节点图颜色",
      "Graph grid color": "节点图网格颜色",
      "Canvas toolbar position": "画布工具栏位置",
      "Float top": "顶部浮动",
      "Float left": "左侧浮动",
      "Float right": "右侧浮动",
      "Float bottom": "底部浮动",
      "Canvas & Interaction": "画布与交互",
      "Mouse wheel zooms canvas": "鼠标滚轮缩放画布",
      "Maximum zoom": "最大缩放",
      "#26:c3872cb5a23eb6ea": "把流程生成的卡片归入框架",
      "Frame imported files": "为导入文件添加框架",
      "Fixed-size card headers": "固定卡片标题大小",
      "Show feature hints": "显示功能提示",
      "Show tooltips": "显示悬浮提示",
      "Spelling suggestions in text fields": "文本框拼写建议",
      "Use free-form bezier wires": "使用自由贝塞尔连线",
      "Default node view": "默认节点视图",
      Compact: "紧凑",
      Extended: "扩展",
      Wired: "已连接",
      Superset: "完整",
      "Live 3D on selected cards": "所选卡片实时预览 3D",
      "Show re-run indicators": "显示重新运行标记",
      "Grid & Alignment": "网格与对齐",
      "Show canvas grid": "显示画布网格",
      "Snap to grid": "吸附到网格",
      "Alignment tools": "对齐工具",
      "Snap to cards": "吸附到卡片",
      Graphs: "节点图",
      Graph: "节点图",
      Canvas: "画布",
      "Autolock on wired outputs": "连接输出后自动锁定",
      Generation: "生成",
      "Graph snapshot scope": "节点图快照范围",
      "Entire canvas": "整个画布",
      "Upstream only": "仅上游",
      Exports: "导出",
      "#45:096bb891fb9c74d5": "下载时一并写入 C2PA 来源记录",
      "Toolbox Library Paths": "工具箱资源库路径",
      "Graph & Code Script Directories": "节点图与代码脚本目录",
      "#57:f56670b436693517": "管理服务商凭据，查看可生成的媒体类型。",
      "Generation providers": "生成服务商",
      "#48:655f50063597b0df": "连接用于制作资产的模型服务。",
      "#83:efbe3393657c82ce": "尚未连接生成服务。添加服务商即可选用它提供的模型。",
      Credentials: "凭据",
      "#132:254370abf63ed06b": "分别为服务商配置密钥或 OAuth 登录。目录会保留缺少凭据的模型，并标明其状态。",
      Missing: "未配置",
      "Set…": "设置…",
      "API key setup guide": "API 密钥设置指南",
      "Media Providers": "媒体服务商",
      "#83:8f25240fb84ac9af": "按注册信息列出各服务商支持的媒体类型，此表只读。",
      "#70:62b2b87e29ca3974": "媒体服务商负责将本机文件转为目标服务接受的格式。",
      "Add media provider…": "添加媒体服务商…",
      "Built-in": "内置",
      "Create your own extension": "创建自己的扩展",
      Installed: "已安装",
      Available: "可获取",
      Sources: "来源",
      "Check for updates": "检查更新",
      "Install ▾": "安装 ▾",
      Install: "安装",
      "Ask before running": "运行前询问",
      "Every installed extension": "每个已安装的扩展",
      "#24:079ce2f31266e183": "仅包含可执行代码的扩展",
      Never: "从不",
      "Update automatically": "自动更新",
      "#51:3d7010fc5aff6a35": "尚未添加扩展。可从已有来源安装，或新建草稿。",
      Plugins: "插件",
      Plugin: "插件",
      plugin: "插件",
      "Not allowed yet": "尚未允许",
      Allow: "允许",
      "Allowing…": "正在允许…",
      Reload: "重新加载",
      "Reloading…": "正在重新加载…",
      Uninstall: "卸载",
      Live: "已加载",
      Changed: "已变更",
      Update: "更新",
      "Updating…": "正在更新…",
      Check: "检查",
      "Checking…": "正在检查…",
      "Not loaded": "未加载",
      "From a git repository…": "从 Git 仓库安装…",
      "From a folder…": "从文件夹安装…",
      "#28:437372373c5c55fc": "从 ZIP 安装包或分享码安装…",
      "Install an extension": "安装扩展",
      "Install from a git repository": "从 Git 仓库安装",
      "Install from a folder": "从文件夹安装",
      "Extension folder": "扩展文件夹",
      "#28:443c563cd4b09ee7": "从磁盘重新读取文件",
      "#68:85946dccd048b964": "已找到本机插件，请先确认允许加载。",
      "#84:3ff403a234bc1f38": "插件文件已有更新，运行新版需要再次授权。",
      "#11:696264878d4f2cff": "本画布",
      "All canvases": "所有画布",
      "Started by": "发起者",
      Status: "状态",
      "In progress": "进行中",
      "#34:a6629eadf6965c08": "本画布当前没有运行中的操作。",
      "Recently completed": "最近完成",
      "#27:b3c001a3118449f9": "任务完成后会出现在这里。",
      "#39:4269dffa9358f995": "选中卡片或框架后可查看属性。",
      "Loading library…": "正在加载资源库…",
      "Loading…": "正在加载…",
      "Loading reviews…": "正在加载评审…",
      "No results": "没有结果",
      Name: "名称",
      Type: "类型",
      Out: "输出",
      Use: "使用",
      "Group:": "分组",
      Group: "分组",
      Prompt: "提示词",
      "#33:59f2efcf6c54075c": "描述想要生成的内容…",
      "Enter prompt text…": "输入提示词…",
      "Ask the agent…": "询问智能体…",
      "Ask The Agent": "询问智能体",
      "Ask the agent": "询问智能体",
      "Aspect Ratio": "宽高比",
      Resolution: "分辨率",
      Count: "数量",
      Seed: "随机种子",
      "Google Search": "Google 搜索",
      Batch: "批量",
      Image: "图像",
      Video: "视频",
      Audio: "音频",
      Text: "文本",
      Mesh: "网格模型",
      Splat: "高斯泼溅",
      Other: "其他",
      "No models available": "没有可用模型",
      "Add provider": "添加服务商",
      Model: "模型",
      Generate: "生成",
      "Generation settings": "生成设置",
      "Generation inputs": "生成输入",
      "Generation references": "生成参考",
      "Generation toolshelf": "生成工具架",
      "Generation type": "生成类型",
      "Add inputs": "添加输入",
      "Clear toolshelf": "清空工具架",
      Toolshelf: "工具架",
      "Toolshelf options": "工具架选项",
      "Toolshelf placement": "工具架位置",
      "Expand prompt": "展开提示词",
      "Clear inputs": "清空输入",
      "Show hint": "显示提示",
      "Random seed": "随机种子",
      "Batch mode": "批量模式",
      "Fold toolshelf to its bar": "将工具架折叠为栏",
      "Fold to the bar": "折叠为栏",
      "Collapse toolshelf": "折叠工具架",
      "Create New Card": "创建新卡片",
      "Create New Deck": "创建新卡组",
      "Add to Deck": "添加到卡组",
      "Agent Chooses": "由智能体选择",
      "Output: Create New Card": "输出到新卡片",
      "Output: Create New Deck": "输出到新卡组",
      "Output: Add to Deck": "输出到卡组",
      "Output: Agent Chooses": "由智能体选择输出位置",
      "#34:21a8005b341f5766": "从画布选取或从磁盘导入素材",
      "#37:61b0f8dc935cd342": "清空输入、生成参数和提示词",
      "Generate — expand toolshelf": "生成 — 展开工具架",
      "#26:26b60f05c41af2de": "你好，我是画布智能体。",
      "#47:75074f35b1db92d0": "我可以协助你使用 Unreal Canvas。",
      "Ask me about using Canvas": "向我询问画布的用法",
      "Create custom tools": "创建自定义工具",
      "Create images": "生成图像",
      "Create meshes": "生成网格模型",
      "Edit images": "编辑图像",
      "#63:0b3c9c6fcd4ea6f2": "接入 Claude Code、Codex 或 API 服务后即可开始对话。",
      "Set up an agent →": "配置智能体 →",
      "#34:debf1359404f01a7": "请先连接智能体。",
      "Connect your agent": "连接你的智能体",
      "Local agents": "本地智能体",
      "Agent connections": "智能体连接",
      "Manage connections": "管理连接",
      "Default context for new chats": "新对话默认上下文",
      Clean: "空白",
      Personal: "个人",
      "Agent chat": "智能体对话",
      "Enable Floating Agent Chat": "启用浮动智能体对话",
      "#34:ab099b43cbfa78e1": "查看智能体的任务与活动记录",
      "No memories yet": "尚无记忆",
      "Project review catalogue": "项目评审目录",
      "Default project": "默认项目",
      "All reviews": "所有评审",
      Approved: "已批准",
      Rejected: "已拒绝",
      "All reviewers": "所有评审者",
      "Human feedback": "人工反馈",
      "Agent checks": "智能体检查",
      "Show withdrawn": "显示已撤回",
      "No canvas knowledge yet": "尚无画布知识",
      Detected: "已检测到",
      "Set up": "配置",
      "Check connection": "检查连接",
      "Show sign-in steps": "查看登录步骤",
      "Send test message": "发送测试消息",
      "Start chatting": "开始对话",
      Configure: "配置",
      Connect: "连接",
      Connected: "已连接",
      Disconnected: "未连接",
      "New agent": "新建智能体",
      "New chat": "新建对话",
      Effort: "推理强度",
      Plan: "计划",
      Permissions: "权限",
      "Model for your first chat": "首次对话使用的模型",
      "Open or browse": "打开或浏览",
      "Open new tab": "打开新标签页",
      "Live logging": "实时日志",
      Execution: "执行",
      "Select (V)": "选择 (V)",
      Insert: "插入",
      Annotate: "批注",
      "Frame (R)": "框架 (R)",
      "Toolbar position": "工具栏位置",
      "Filter cards": "筛选卡片",
      "Zoom out": "缩小",
      "Zoom in": "放大",
      "Zoom and view options": "缩放与视图选项",
      "Zoom to fit": "缩放以适应画布",
      "Fit selection": "适应所选内容",
      "Import File…": "导入文件…",
      "Canvas Settings": "画布设置",
      "Copy Link": "复制链接",
      "Open Graph": "打开节点图",
      "Open Viewer": "打开查看器",
      "Edit settings and regenerate": "编辑设置并重新生成",
      Expand: "展开",
      Collapse: "折叠",
      "Open graph": "打开节点图",
      "Open viewer": "打开查看器",
      "View script": "查看脚本",
      "Edit script": "编辑脚本",
      Pin: "固定",
      Unpin: "取消固定",
      Lock: "锁定",
      Unlock: "解锁",
      "Select all": "全选",
      Arrange: "排列",
      Align: "对齐",
      "Auto-align": "自动对齐",
      "Bring to front": "置于顶层",
      "Send to back": "置于底层",
      Details: "详情",
      Parameters: "参数",
      History: "历史",
      Metadata: "元数据",
      Provenance: "来源",
      Inputs: "输入",
      Outputs: "输出",
      Results: "结果",
      "Search cards…": "搜索卡片…",
      "Search tools…": "搜索工具…",
      "Search extensions": "搜索扩展",
      "Search the catalogs": "搜索目录",
      "Search the sources": "搜索来源",
      "Search Preferences settings": "搜索偏好设置",
      "Filter shortcuts…": "筛选快捷键…",
      "Filter canvases…": "筛选画布…",
      "#21:f147f76fac9921f2": "还没有自定义字段。",
      "Custom Fields": "自定义字段",
      "+ Add custom field": "+ 添加自定义字段",
      Share: "分享",
      "Semantics file": "语义配置文件",
      "#170:ade8d5d5c18ef7b5": "为各类能力设定默认模型。新节点及助手会优先采用，也能在模型目录点星标指定。",
      "By capability": "按能力",
      "#120:bb6da99b90aef116": "Canvas 会选择可用的服务商路由，某条路由暂时离线时也会尽量使用首选模型。",
      "Image generation": "图像生成",
      "Image upscaling": "图像放大",
      "Video generation": "视频生成",
      "Video upscaling": "视频放大",
      "Audio generation": "音频生成",
      "Text generation (LLM)": "文本生成（LLM）",
      "Mesh generation": "网格模型生成",
      "Splat generation": "高斯泼溅生成",
      "Rigging (auto-rig)": "自动绑定",
      Schema: "定义",
      Tier: "层级",
      Credential: "凭据",
      Actions: "操作",
      Untested: "未测试",
      "View JSON": "查看 JSON",
      Fork: "创建分支",
      "Add service…": "添加服务…",
      "Refresh registry": "刷新注册表",
      "Media type": "媒体类型",
      "All types": "全部类型",
      "All providers": "所有服务商",
      Favourites: "收藏",
      Favorites: "收藏",
      "Editors & Tools": "编辑器与工具",
      "ffmpeg path": "ffmpeg 路径",
      "Blender path": "Blender 路径",
      "Image editor path": "图像编辑器路径",
      "ComfyUI Server URL": "ComfyUI 服务地址",
      Workers: "工作进程",
      "AI Models Root": "AI 模型根目录",
      "Pose-fit venv dir": "Pose-fit 虚拟环境目录",
      "Pose-fit worker status": "Pose-fit 进程状态",
      "LangSAM venv dir": "LangSAM 虚拟环境目录",
      "LangSAM worker script": "LangSAM 工作脚本",
      "SAM2 variant": "SAM2 变体",
      "Live session": "实时会话",
      "Your display name": "你的显示名称",
      "Start sharing this canvas": "开始共享此画布",
      "Join someone else's session": "加入他人的会话",
      Join: "加入",
      "Shared storage": "共享存储",
      "People here": "在线成员",
      "#8:5151a0e6112ab98c": "仅自己在线",
      "#81:c309f84acd6a964a": "分享画布后可实时协作，并查看谁正在线。",
      "#87:ab6ddbfd4998b931": "为这幅画布创建实时会话并分享邀请，也可加入已有会话。",
      "Storage roots": "存储根目录",
      Scan: "扫描",
      Quarantine: "隔离",
      Projects: "项目",
      "Results cache": "结果缓存",
      Uploads: "上传",
      Cache: "缓存",
      Path: "路径",
      Size: "大小",
      Files: "文件",
      Folders: "文件夹",
      Folder: "文件夹",
      "Open location": "打开位置",
      "#56:e536832f2cc60bd3": "查看键盘快捷键及参考组合键。",
      "Canvas tools": "画布工具",
      "Select tool": "选择工具",
      "Annotate tool": "批注工具",
      "Frame tool": "框架工具",
      "Text tool": "文本工具",
      "Connector tool": "连接线工具",
      "Not available when": "不可用条件",
      "Navigating the canvas": "画布导航",
      "Selection and editing": "选择与编辑",
      Active: "生效",
      "#38:abce5d5573444111": "聚焦所选内容，无选区时显示整幅画布",
      "Fit the whole canvas": "适应整个画布",
      "Go up one level": "返回上一级",
      "Select all cards": "全选卡片",
      "Copy the selection": "复制所选内容",
      "Auto-align the selected cards": "自动对齐所选卡片",
      "#25:60e156ede888e399": "将当前画布写入文件",
      "Close viewer": "关闭查看器",
      "Close search": "关闭搜索",
      "Close tips": "关闭提示",
      "Close connection setup": "关闭连接设置",
      "Close provider setup": "关闭服务商设置",
      "Close script editor": "关闭脚本编辑器",
      "Dictate message": "语音输入消息",
      "Cancel dictation": "取消语音输入",
      Microphone: "麦克风",
      Language: "语言",
      Automatic: "自动",
      Width: "宽度",
      Height: "高度",
      "Duration (s)": "时长（秒）",
      "Create a script": "创建脚本",
      "Create task": "创建任务",
      Diagnostics: "诊断",
      Dismiss: "忽略",
      "Dismiss error": "关闭错误",
      "Dismiss suggestions": "关闭建议",
      Output: "输出",
      Input: "输入",
      Description: "描述",
      Notes: "备注",
      Tags: "标签",
      Team: "团队",
      Rating: "评分",
      Comments: "评论",
      "Add a comment…": "添加评论…",
      "Group by": "分组方式",
      "Sort by": "排序方式",
      "Newest first": "最新优先",
      "Oldest first": "最早优先",
      "Show all": "显示全部",
      "Clear all": "清空全部",
      "Filter output": "筛选输出",
      "Open in viewer": "在查看器中打开",
      "Import to Content Browser": "导入到内容浏览器",
      "From file…": "从文件…",
      "Select files": "选择文件",
      "Select folder": "选择文件夹",
      "New canvas": "新建画布",
      "Save as…": "另存为…",
      "Save As…": "另存为…",
      "Open…": "打开…",
      Recent: "最近使用",
      "Collapse General": "折叠常规",
      "Expand General": "展开常规",
      "Collapse Models": "折叠模型",
      "Expand Models": "展开模型",
      "Search extensions…": "搜索扩展…",
      "Loading extensions…": "正在加载扩展…",
      "Loading installed plugins…": "正在加载已安装插件…",
      "Switch off": "停用",
      "Switch on": "启用",
      "#38:0331ddad712abffb": "选择已安装扩展在执行前如何请求批准",
      "#190:16d013a4325dd6ad": "API 凭据写入系统密钥库。若还设置了 .env 或 --keys-file，应用会优先读取这些已有配置。",
      "#179:7c0e39f7a782aeda": "管理本机面板、命令、智能体工具、脚本和技能。已安装扩展按授权或运行前询问设置执行。",
      "#37:9d67ad8e08d0f924": "自己创建的草稿可以直接试运行。",
      "#116:bfd53f661461a1c7": "查看作品目录、团队共享目录和 Lore，维护存储或导入旧画布。",
      "Where your work is kept": "作品保存位置",
      "#111:04fb8d6eb6220ea9": "Canvas 作品可保存在下列三个相关位置。",
      "Shared with your team": "与团队共享",
      "#118:2f58581cf3727544": "团队通过工程 project.json 指定统一目录，在此共同打开和编辑共享画布。",
      "#27:16c022efbe2f9569": "此工程尚未指定",
      Maintenance: "维护",
      Advanced: "高级",
      "#187:aec8ea747b826024": "手动扫描所有已存画布，找出无引用的上传或烘焙文件以及无法读取的画布。扫描本身保留磁盘内容。",
      "Video stills:": "视频静帧：",
      "not checked": "尚未检查",
      "#272:ff10cdf7086f43c8": "视频附带静帧可立即预览。缺少静帧时需解码视频，大文件耗时较长。可单独发起元数据扫描来检查哪些结果缺少静帧。",
      "#114:02559c6c1f6ff852": "检查服务识别到的各层存储、访问状态和实际占用。",
      "#33:2c41cb4e8c52ab0c": "还没有可显示的存储状态。",
      Python: "Python",
      "Resize Prompt": "调整提示词区域高度",
      "Drag to resize": "拖动以调整大小",
      "Search library…": "搜索资源库…",
      "#295:75a7add433a3286c": "受信任目录的更新若未增加权限请求，且无可执行代码或已通过目录审核，可按现有授权自动应用。其他情况需再次确认。",
      "Media library": "媒体资源库",
      "Search media": "搜索媒体",
      "Search…": "搜索…",
      "Content view": "内容视图",
      "Tile view": "平铺视图",
      "List view": "列表视图",
      Tile: "平铺",
      List: "列表",
      Archived: "已归档",
      "Archived cards": "归档卡片",
      "#96:2134e5868863a366": "查看并恢复仍含生成媒体的已删卡片。",
      "Active filters": "当前筛选条件",
      "On this canvas": "当前画布",
      "Thumbnail size": "缩略图大小",
      "Limit to selection": "仅显示选中项",
      "#86:d28159cda7f20bb6": "只列出所选卡片或框架内的媒体",
      "Refresh media library": "刷新媒体资源库",
      "Rescan saved canvases": "重新扫描已保存画布",
      "No media yet": "暂无媒体",
      "#67:31ee5e1c0e859164": "在这里添加媒体，或转到「位置 → 我的画布」。",
      Location: "位置",
      "On my canvases": "我的画布",
      "#177:81e821083cfeef37": "扩展卡片类型和服务。插件提供的卡片、查看器和服务可热更新，内置插件需重启。安装目录为",
      "#82:75888e04e43f4477": "设为默认后，新节点和助手将优先使用该模型",
      "#217:6ceea5a8ac060001": "管理本机扩展与插件提供的面板、命令、工具、脚本或技能。已安装扩展须按授权或询问设置运行。自己的草稿可直接试运行。",
      "#32:1137794f58d3b148": "扩展可用的卡片类型与服务。",
      "#127:be82c8156124d162": "插件提供的卡片、查看器和服务可热更新，使用内置插件的新版本需重启应用。",
      "Installs land in": "安装目录为",
      "New Canvas": "新建画布",
      "Browse canvases…": "浏览画布…",
      "Open File…": "打开文件…",
      "Text Card": "文本卡片",
      Subcanvas: "子画布",
      Frame: "框架",
      Subscript: "子脚本",
      Timeline: "时间线",
      "Font size": "字号",
      Bold: "加粗",
      Italic: "斜体",
      Underline: "下划线",
      "Text color": "文字颜色",
      "Align left": "左对齐",
      "Align center": "居中",
      "Align right": "右对齐",
      "Save Canvas": "保存画布",
      "Duplicate Canvas": "复制画布",
      "Package Canvas…": "打包画布…"
    }
  },
  {
    selector: '.generation-shelf-prompt-row > div > [data-testid="generation-shelf-prompt"] ~ div:not([role])',
    fields: [
      "text"
    ],
    entries: {
      "#33:59f2efcf6c54075c": "描述想要生成的内容…"
    }
  },
  {
    selector: '[data-testid="generation-shelf-prompt"],[data-testid="generation-shelf-prompt-resize"]',
    fields: [
      "aria-label",
      "title"
    ],
    entries: {
      Prompt: "提示词",
      "Resize Prompt": "调整提示词区域高度",
      "Drag to resize": "拖动以调整大小"
    }
  },
  {
    selector: '.merlin-app-bar [role="dialog"] > div > header > span',
    fields: [
      "text"
    ],
    entries: {
      Settings: "设置"
    }
  }
];

// src/locales/generation-extra.json
var generation_extra_default = [
  {
    selector: ".generation-shelf-fields .merlin-param-label,.generation-shelf-fields .merlin-param-row :is(input,textarea,button)",
    fields: [
      "text",
      "title",
      "aria-label",
      "placeholder"
    ],
    entries: {
      Acceleration: "加速",
      "Align to image": "与图像对齐",
      "Aspect Ratio": "宽高比",
      "Auto Controls": "自动控制",
      Background: "背景",
      "Base Model": "基础模型",
      Beams: "束搜索宽度",
      Compression: "压缩",
      Creativity: "创造性",
      "Crop to Fill": "裁剪以填满",
      "Custom positioning": "自定义位置",
      "Depth blur": "深度模糊",
      "Depth control": "深度控制",
      Direction: "方向",
      "Disable PBR": "禁用 PBR",
      "EXR Export": "导出 EXR",
      Engine: "引擎",
      "Enhance Details": "增强细节",
      "Enhance Model": "增强模型",
      "Face Creativity": "面部细节创造性",
      "Face Enhancement": "面部增强",
      "Face Strength": "面部增强强度",
      "Face control": "面部控制",
      "Face limit": "面数上限",
      Fidelity: "保真度",
      Flavor: "风格",
      Format: "格式",
      Fractality: "分形程度",
      GPU: "GPU",
      "Generate Audio": "生成音频",
      "Geometry File Format": "几何体文件格式",
      "Google Search": "Google 搜索",
      Grain: "颗粒",
      Guidance: "引导强度",
      "H.264 output": "H.264 输出",
      HDR: "HDR",
      Halo: "光晕",
      "Image Size": "图像大小",
      Imagination: "想象力",
      "Input Fidelity": "输入保真度",
      "Keep Original Sound": "保留原声",
      Loop: "循环",
      Loudness: "响度",
      "Manual Adherence": "手动设置保真度",
      Material: "材质",
      "Max Tokens": "最大词元数",
      Mode: "模式",
      Model: "模型",
      "Multi-Prompt (JSON)": "多段提示词（JSON）",
      Multilingual: "多语言",
      Noise: "噪声",
      "Noise Scale": "噪声尺度",
      "Normals augmentation": "法线增强",
      "Normals control": "法线控制",
      "Optimized For": "优化目标",
      "Output Format": "输出格式",
      "Output Quality": "输出质量",
      "Per-Signal Controls": "分信号控制",
      Pitch: "音高",
      "Pose control": "姿态控制",
      "Pose strength": "姿态强度",
      "Post-process rig": "后处理骨骼绑定",
      "Preserve original mesh": "保留原始网格",
      Preset: "预设",
      Prompt: "提示词",
      "Prompt Expansion": "扩展提示词",
      "Quad topology": "四边形拓扑",
      Quality: "质量",
      "Recover Detail": "恢复细节",
      "Rendering Speed": "渲染速度",
      "Repetition penalty": "重复惩罚",
      Resemblance: "相似度",
      Resolution: "分辨率",
      "Safety Checker": "安全检查",
      "Sample Rate": "采样率",
      "Sampling Steps": "采样步数",
      "Scale Factor": "缩放倍数",
      "Scale Ratio": "缩放比例",
      Sharpen: "锐化",
      Size: "大小",
      "Smart Grain": "智能颗粒",
      "Source H": "来源高度",
      "Source W": "来源宽度",
      "Source X": "来源 X 坐标",
      "Source Y": "来源 Y 坐标",
      "Speech Rate": "语速",
      Speed: "速度",
      "Splat Count": "高斯点数量",
      "Splat Resolution": "高斯泼溅分辨率",
      Steps: "步数",
      Strength: "强度",
      Structure: "结构",
      "Subject Detection": "主体检测",
      "System Prompt": "系统提示词",
      "Target FPS": "目标帧率",
      "Target Resolution": "目标分辨率",
      Temperature: "采样温度",
      "Thinking Mode": "思考模式",
      Tier: "等级",
      "Top-K": "Top-K",
      "Top-P": "Top-P",
      "Trajectory control": "轨迹控制",
      "Trajectory sparsity": "轨迹稀疏度",
      "Ultra Detail": "超精细细节",
      Version: "版本",
      "Video Reference": "参考视频",
      Volume: "音量",
      "Write Mode": "写入模式",
      Duration: "时长",
      Count: "数量",
      Seed: "随机种子"
    }
  },
  {
    selector: ".merlin-generation-shelf,.merlin-generation-shelf :is([title],[aria-label],[placeholder]),.generation-shelf-menu,.generation-shelf-menu :is([title],[aria-label]),.generation-shelf-workflow-menu input,.generation-shelf-workflow-menu button,.generation-shelf-reference-label,.generation-shelf-reference-sub,.generation-shelf-prompt-note,.generation-shelf-status,.generation-shelf-status span,.generation-shelf-generate,.generation-shelf-batch-setting,.generation-shelf-menu .ue-menu-detail,.generation-shelf-menu .ue-menu-label,.generation-shelf-fields div,.generation-shelf-menu-option span,.generation-shelf-error span",
    fields: [
      "text",
      "title",
      "aria-label",
      "placeholder"
    ],
    entries: {
      "Start Frame": "起始帧",
      "End Frame": "结束帧",
      Image: "图像",
      "+ Drop or add media": "＋ 拖入或添加媒体",
      "Generation toolshelf": "生成工具架",
      "Generation inputs": "生成输入",
      "Generation references": "生成参考素材",
      "Generation settings": "生成设置",
      "Expand toolshelf": "展开工具架",
      "Collapse toolshelf": "折叠工具架",
      "Fold toolshelf to its bar": "将工具架折叠为工具栏",
      "Fold to the bar": "折叠为工具栏",
      "Generation type": "生成类型",
      "Toolshelf options": "工具架选项",
      "Toolshelf placement": "工具架位置",
      "Anchor to bottom": "固定在底部",
      "Dock to side panel": "停靠到侧栏",
      "Float freely": "自由浮动",
      "#39:7bc4f8c2730cca30": "停靠在画布底部中央",
      "#42:835df75e766ff548": "可自由拖动，收起后保留位置。",
      "In the left side panel": "在左侧面板中显示",
      "#69:71c0c77c626589cb": "生成新的结果卡片，沿用输入和设置。",
      "#53:95b704e5f46061c9": "先选择一张卡片作为输入，再选择它的卡组。",
      "#76:f8613c1b13e1b633": "结果放回各自输入的卡组。文件输入会生成新卡片。",
      "#61:a153d9750f67ff84": "按请求创建卡片或选择卡组。",
      "#54:ddad29b9c70519ad": "使用输入所属的卡组，悬停可另选。",
      "Output: Create New Card": "输出到新卡片",
      "Output: Create New Deck": "输出到新卡组",
      "Choose a script": "选择脚本",
      "Agent chooses a script": "由智能体选择脚本",
      "Run script": "运行脚本",
      "#23:ca29505d685f3d6c": "先选择脚本。",
      "View options": "视图选项",
      "Search scripts": "搜索脚本",
      "Collapse all folders": "折叠所有文件夹",
      "Expand all folders": "展开所有文件夹",
      "Script settings": "脚本设置",
      "#72:b0f062eaa26357b9": "脚本尚无输入，请在卡片上选择「编辑脚本」添加。",
      "#75:df93ac53d99961c1": "每张批量卡片独立运行一次，可在「输入」旁查看列表。",
      "Batch mode": "批量模式",
      "Loading process inputs…": "正在加载流程输入…",
      "#30:269d6c696d05e1cd": "请先添加批量卡片。",
      "Add cards to inputs": "将卡片添加到输入",
      "Batch these inputs": "批量处理这些输入",
      "Run Batch": "批量运行",
      "Remove batch": "移除批量输入",
      "Add to batch": "加入批量列表",
      "Add cards to batch": "将卡片加入批量列表",
      "#43:3a3f665aa4b96d99": "收起批量列表，保留画布上的卡片。",
      "#44:c94c340414476b2a": "清除批量列表并保留画布卡片。",
      "#34:6840c02c0675dd26": "拖入批量区以依次作为输入。",
      "#27:b5ec66a8a04dc208": "加入批量选择",
      "#40:45b6027d8c260d75": "点击从批量选择移除",
      "#37:a7433b78bdad9db0": "此输入已固定，切换浏览时仍会保留。",
      "#46:2a10d3e89449d0af": "固定后可在取消选择时保留输入。",
      "#42:93bd931edec5de46": "拖动排序，或按 Alt 加左右方向键移动。",
      "#40:ac0223608540d7e2": "支持算式，例如 1920/512。",
      "#44:558a9a1210df82df": "可选填模型回复要求。",
      "#59:8eabe447057a3516": "根据素材生成，可直接运行。",
      "Resize toolshelf from left edge": "从左侧调整工具架宽度",
      "Resize toolshelf from right edge": "从右侧调整工具架宽度",
      "Resize toolshelf height": "调整工具架高度",
      "#37:b6c23cec475cb06a": "拖动上边缘改变工具架高度。",
      "#80:45a2b9e0b461b99f": "拖动或按左右键改变宽度，双击按内容收窄。",
      "#77:566b388e58b1ad01": "拖动或用上下键调高低。Home 或双击复位。",
      "#64:83bc8fb4d16507e6": "以同一批输入和参数重新运行失败项。",
      "#57:31f614bf23d28e3d": "点击或拖入卡片、文件以替换，× 可清除。",
      "#44:4c75562d949294ca": "模型已经下线，请改用其他模型。",
      "#26:6f332a81a1602d01": "先选择可用模型。",
      "#26:4dfc80f26a8a90cc": "请先打开一个画布。",
      "#21:3ef7beca90ef7414": "打开画布即可运行。",
      "#25:db30be3b299a8b7e": "画布处于只读模式。",
      "#25:d53077e734a07780": "解锁画布后再运行。",
      "Starting the run…": "正在启动…",
      "Retry loading agents": "重新加载智能体",
      "Retry loading models": "重新加载模型",
      "Dismiss error": "关闭错误提示",
      "Clear toolshelf": "清空工具架",
      "#37:61b0f8dc935cd342": "清空输入、生成参数和提示词"
    }
  },
  {
    selector: ".generation-shelf-fields .custom-select span,.merlin-param-row option",
    fields: [
      "text"
    ],
    entries: {
      "10 (fast)": "10（快速）",
      "20 (recommended)": "20（推荐）",
      "262K (max quality)": "262K（最高质量）",
      "32K (fastest)": "32K（最快）",
      "5 seconds": "5 秒",
      "10 seconds": "10 秒",
      "#35:fa2bec631d2abd0c": "在素材开头之前续接内容",
      "#31:161bbc1dd04e7e77": "从素材结尾继续生成",
      "Full resolution": "完整分辨率",
      "#31:89b72468a1306f2b": "文字或图片生成视频",
      "#35:4fcfd25fa6252ba5": "文字或参考素材生成图像",
      "#42:53adb85cacdda451": "用 image_edit 调整原图风格",
      "Edit (restyle a source video)": "编辑（更改源视频风格）",
      "Extend (continue a Luma video)": "延展（续接 Luma 视频）",
      "Reframe (new aspect ratio)": "重新构图（更改宽高比）",
      "None (enhance only)": "无（仅增强）",
      "Art & Illustration": "美术与插画",
      "Films & Photography": "电影与摄影",
      "Nature & Landscapes": "自然与风景",
      "Sci-Fi & Horror": "科幻与恐怖",
      "Videogame Assets": "游戏资产",
      "3D Renders": "3D 渲染图",
      "Hard Portraits": "硬光人像",
      "Soft Portraits": "柔光人像",
      "Old Film": "老电影",
      "Short Series": "短剧",
      "Target Resolution": "目标分辨率",
      "Scale Factor": "缩放倍数"
    }
  },
  {
    selector: '.generation-shelf-fields :is(span,div,label,input,button,textarea),[role="tooltip"],[role="tooltip"] *',
    fields: [
      "text",
      "title",
      "aria-label",
      "placeholder",
      "data-tooltip"
    ],
    entries: {
      "#31:05e49b9e3de061f4": "可填 0–1，最多三位小数。",
      "#18:1507650a9c25fe2e": "可在 0–1 之间微调。",
      "#53:b88abd4bba0292f5": "4K 仅支持无参考图的生成。",
      "#56:4f6f953fde8ff108": "启用 HDR 后可同时输出 MP4 和 EXR。",
      "#162:58d2b798aab3c8a2": "把骨骼用于原始分辨率的带纹理网格。导入 UE 时建议保留此项。",
      "#136:80837529dbbc1509": "K 限定每步候选数。减小 K 可使骨架更稳定，增大可增加多样性。",
      "#91:0cac9494e6351824": "自动补充简短提示词，停用即可使用原文。",
      "#127:7e76ada0560c013d": "增大束宽会同时尝试更多骨架，可能提高完整性并增加耗时。",
      "#106:f417834180423247": "对蒙皮权重进行体素平滑，以改善变形效果。",
      "#129:7b5d712874627894": "选择要下载的质量等级。Marble 会先生成全部等级。",
      "#50:08bc755999b5fb35": "增大去噪强度会产生更多新细节。",
      "#30:9f1d11d4a234078c": "设为 2 可使长和宽各扩大一倍。",
      "#74:4befbfbf97b32cab": "无参考图时可延长推理以提高生成质量。",
      "#76:10283a411cc56b10": "在当前质量等级上加速渲染，可能损失部分细节。",
      "#100:8843090e469864d4": "分别设置姿态、深度、法线、运动轨迹和脸部信号的影响。",
      "#88:27b81e0335d70dcc": "生成首尾衔接的视频。10 秒视频、关键帧及 HDR 模式不支持此选项。",
      "#70:46adc4f00b95f1d8": "导出 HDR MP4 须有 HDR 权限，分辨率可选 720p 或 1080p。",
      "#63:7f33a06867ebc82b": "增大数值能更好地保留原图结构。",
      "#50:54a0038d5cd8b021": "增大数值允许模型更自由地创作。",
      "#43:f69559877569b076": "调节对原素材的保真程度。",
      "#55:5a8441294cc33a6b": "调节面部增强时补充细节的幅度，取值 0–1。",
      "#75:dac350ebd0ed4b8a": "开启面部增强后，可用 0–1 调节增强幅度。",
      "#175:9c1949b060a9031b": "重复惩罚过大会漏掉手指或尾部等骨骼。出现此情况可试用 1.1–1.3。",
      "#36:9658df68934a7e2e": "留空使用模型预设。",
      "#68:531f5ad352d32c50": "留空沿用原帧率，指定新帧率可启用补帧。",
      "#45:d5fe64a262e2061b": "输入 1–10 倍，可用小数。",
      "#45:6955eca706721546": "输入 2–10 倍，可用小数。",
      "#50:90f0b8eba9ec3117": "支持小数倍放大，例如 2.5 倍。",
      "#118:865f1d7424e8e875": "P 决定累计概率覆盖范围，减小它可收窄候选集。",
      "#12:8f3c27b29a7a6e7e": "停用后采用 H.265 编码。",
      "#128:fab09ba9b18b86a8": "自动模式按视频内容决定编辑强度。开启此项可自行选择保真度。",
      "#82:a716012ef547f84a": "输出可缩放至输入的 1–4 倍，支持小数。",
      "#76:539cc9fa6febc356": "输出可放大 2–16 倍，限整数。",
      "#82:eed569a7a821c1d1": "输出可放大 2–8 倍，支持小数。",
      "#47:cab88937b0f15b86": "按此系数缩放输出画面。",
      "#41:b3ddaac8fb39cd35": "输出缩放系数可取 1.1–10。",
      "#122:a1fe5876c0537055": "调低随机性可得到较稳定的骨架，调高可探索更多结构。",
      "#90:1c6bae94d8164e72": "Recraft Crisp 接受 PNG，使用固定的保真放大比例。",
      "#95:80f85ed3c3599cfc": "可按倍数放大，或指定输出高度。",
      "#93:2897dc71f2ddc61e": "可按倍数放大，或指定输出尺寸。",
      "#96:72037a67a0ff7230": "Scenario LLM 会把这段文字放到用户提示之前。",
      "#172:9888fb0bc6d6133b": "选择 Topaz 算法。通用可用 Standard V2，保留纹理可用 High Fidelity，渲染画面可用 CGI。Redefine 和 Wonder 会补充新细节。",
      "#66:54301f0ca5b1bc85": "Turbo 优先速度，Quality 优先清晰度。",
      "#97:f38db91975cacc57": "设置回复的词元上限。Gemini 的推理过程也占用预算。",
      "#86:a1679e924570971a": "切换多语言模型以处理混合语言文本。",
      "#39:51f25e8bea630c36": "选择执行骨骼绑定的 GPU。",
      "#61:a4086e8c31574f91": "指定重点增强区域，适用于标准模型。"
    }
  }
];

// src/locales/editors-extra.json
var editors_extra_default = [
  {
    selector: '[data-testid="graph-no-output"] > div > div',
    fields: [
      "text"
    ],
    entries: {
      "No output": "暂无输出",
      "#56:5b1b460095bcc88d": "连接输出节点后，结果将显示在这里。"
    }
  },
  {
    selector: '[role="dialog"]:is([aria-label="About Unreal Canvas"],[aria-label="关于 Unreal Canvas"]) :is(input,p,h3,strong),[role="dialog"]:is([aria-label="About Unreal Canvas"],[aria-label="关于 Unreal Canvas"]) div:has(> .merlin-panel-search) > div:last-child > div:only-child',
    fields: [
      "text",
      "aria-label",
      "placeholder"
    ],
    entries: {
      "Third-Party Software": "第三方软件",
      "Transitive Notices": "间接依赖声明",
      "Search third-party software": "搜索第三方软件",
      "#46:9fcf2e4c4d835179": "搜索名称、版本、许可或用途…",
      "Search transitive notices": "搜索间接依赖声明",
      "#47:551d0f7a63f81b63": "搜索名称、版本、许可或生态…",
      "#30:e6dc7d8ff7ce83bb": "未找到软件包。",
      "#106:44d4dd563424f2a6": "选择库可查看 Unreal Canvas 随附的许可信息。",
      package: "项",
      s: "软件包",
      "#6:10d3e1f61f15a389": "。",
      "#50:48d6345b97ba675d": "间接使用的软件包",
      "#7:adafba36d1c77d96": "项）。",
      "Function:": "用途：",
      "Platforms:": "平台：",
      "Repository:": "仓库：",
      "EULA:": "最终用户许可协议：",
      "License (raw):": "许可证（原文）：",
      "License text:": "许可证正文："
    }
  },
  {
    selector: ".timeline-panel,.timeline-panel :is(button,input,select,output,[role],.tl-monitor,.tl-screen,.tl-edit,.tl-scroll,.tl-ruler,.tl-annotation-layer),.timeline-panel .tl-range-scrollbar",
    fields: [
      "title",
      "aria-label"
    ],
    entries: {
      Timeline: "时间线",
      "Resize Timeline height": "调整时间线高度",
      "#55:a8afcdf47abc71be": "将此工程最近一次时间线作为单独卡片导入。",
      "Maximize or restore Timeline": "最大化或还原时间线",
      "Restore Timeline panel": "还原时间线面板",
      "Maximize Timeline": "最大化时间线",
      "Close Timeline": "关闭时间线",
      "Resize Timeline preview": "调整时间线预览大小",
      "#46:1877624c7342a767": "拖动改变预览尺寸，双击恢复。",
      "Resize track names column": "调整轨道名称列宽",
      "#104:778f57e75056a4b0": "拖动或按左右键调节轨道名称列。双击或 Enter 复位，Esc 取消。",
      "Double-click to fit timeline": "双击以完整显示时间线",
      "Visible timeline start": "时间线可见范围起点",
      "Pan timeline": "平移时间线",
      "Visible timeline end": "时间线可见范围终点",
      "Drag to pan timeline": "拖动平移时间线",
      "Drag to zoom timeline": "拖动缩放时间线",
      Add: "添加",
      "#52:115a8902107169d5": "添加批注或媒体。按住 Alt 可从画布拖入媒体。",
      "Timeline monitor": "时间线监视器",
      "Timeline preview": "时间线预览",
      "Go to start (Home)": "跳至起点 (Home)",
      "Previous frame (Left arrow)": "上一帧（左方向键）",
      "Play timeline (Space)": "播放时间线（空格）",
      "Pause timeline (Space)": "暂停时间线（空格）",
      "Stop timeline": "停止播放时间线",
      "Next frame (Right arrow)": "下一帧（右方向键）",
      "Go to end (End)": "跳至终点 (End)",
      "Loop playback": "循环播放",
      "Mute monitor audio": "将监视器静音",
      "Unmute monitor audio": "取消监视器静音",
      "Timeline timecode": "时间线时间码",
      "Timeline tracks": "时间线轨道",
      "#32:7a1b1d6bb7d016fe": "片段对齐到播放头或边界",
      "Split clip at playhead (S)": "在播放头处分割片段 (S)",
      "#33:567704c021f8286d": "裁掉播放头左侧片段",
      "#34:11d7c5dafa441684": "裁掉播放头右侧片段",
      "#63:fd99a0e99b2d5c43": "裁掉播放头左侧并合拢轨道",
      "#64:2bb4c12f9dd0253e": "裁掉播放头右侧并合拢轨道",
      "Keyframe parameter": "关键帧参数",
      "Previous keyframe": "上一个关键帧",
      "Next keyframe": "下一个关键帧",
      "Add keyframe at playhead": "在播放头处添加关键帧",
      "Remove keyframe at playhead": "移除播放头处的关键帧",
      "Download timeline": "下载时间线",
      "Timeline track area": "时间线轨道区域",
      "Time ruler": "时间标尺",
      "Track name": "轨道名称",
      "Annotation transparency": "批注透明度",
      "Video transparency": "视频透明度",
      "Audio volume": "音频音量",
      "#92:f87bfcc8c25e05cb": "单击选择轨道，双击改名，Delete 或退格键删除轨道及片段。",
      "Annotation drawing surface": "批注绘制区域",
      "#191:76d1e7b6bc96970c": "按 Alt 从画布拖入素材，拖到轨道边缘即可新建轨道。Shift+滚轮平移，Ctrl/Cmd+Z 撤销，Ctrl/Cmd+Shift+Z 或 Ctrl/Cmd+Y 重做。Esc 取消拖动或清除选择。",
      "#169:b8f85d4941b44f35": "拖动或用左右键缩放，Shift 加大步长。Home/End 跳至起止位置，双击或 Enter 显示全长，Esc 取消。",
      "#168:3408d7f3b7b03e41": "拖动或用左右键平移，Shift 加大步长。Home/End 跳至起止位置，双击或 Enter 显示全长，Esc 取消。",
      "#45:ccc72e7604335512": "拖动或按上下键调节尺寸。",
      "#70:8280f07db95547ab": "停用并跳过轨道求值，状态保存在时间线中。",
      Transparency: "透明度",
      "#43:0f54c5d6221877f5": "启用轨道并保存此状态。"
    }
  },
  {
    selector: ".timeline-panel :is(.tl-button,.tl-parameter option,.tl-track-empty,.tl-playback-message,.tl-export-status,.tl-monitor-empty strong,.tl-monitor-empty small,.canvas-editing-notice,.tl-save)",
    fields: [
      "text"
    ],
    entries: {
      "Import Previous Timeline": "导入上一次的时间线",
      "Loading…": "正在加载…",
      "+ Add ▾": "+ 添加 ▾",
      "Timeline monitor": "时间线监视器",
      "#32:29bfd3ac28997c1d": "拖入视频或音频以添加到轨道。",
      Transparency: "透明度",
      Volume: "音量",
      "View only": "只读",
      "Unsaved changes": "有未保存的更改",
      "Drop video here": "将视频拖到这里",
      "Drop audio here": "将音频拖到这里",
      "Drag an annotation clip here": "将批注片段拖到这里",
      "#23:ab24eb6089fd71c1": "未能导出时间线。",
      "#26:534276be0daf4250": "已下载时间线视频。",
      "#29:9a4f3bb64ff7035a": "时间线已作为 MP4 放入画布。",
      "#27:04da27ac2c49f7b9": "只能查看此时间线。",
      "#30:3aca95bdf4376fd7": "正在载入时间线…",
      "#23:e8fe5a412a194737": "时间线已达上限。",
      "#55:830e15d17e077e6b": "将播放头放到选中片段的内部再切分。",
      "Media preview unavailable": "无法预览媒体",
      "Loading media…": "正在加载媒体…",
      "#36:50ad8f50da186443": "开始播放后启用音频。",
      "#45:016d60c088c665c8": "请选择有时长的音频或视频。",
      "#75:5212ee18a36d724a": "该位置已被占用，请使用空白位置或新轨道。",
      "#40:e6e861f91b2b40b0": "支持 MP4、MP3、WAV。",
      "#26:4e40128c0756eabe": "单个文件最大 512 MB。",
      "Importing…": "正在导入…",
      "#76:ba4e5a4d07d14c42": "请先恢复媒体文件，再移动或修剪片段。",
      "#35:908387f6b08ef702": "请选择空白处或换一条轨道。",
      "#34:08602a5bf2fe3bd8": "最多可添加 64 条轨道。",
      "Timeline unavailable": "时间线不可用",
      "#29:f121e2a8349bb66c": "无法访问时间线卡片。",
      "#43:1582a8fff6fe4ea7": "编辑结果自动写回时间线卡片。",
      "Preparing media…": "正在准备媒体…"
    }
  },
  {
    selector: '[role="menu"]:is([aria-label="Download timeline"],[aria-label="下载时间线"],[aria-label="Add to timeline"],[aria-label="添加到时间线"],[aria-label="Timeline actions"],[aria-label="时间线操作"],[aria-label="Keyframe actions"],[aria-label="关键帧操作"],[aria-label="Section actions"],[aria-label="片段操作"],[aria-label="Track actions"],[aria-label="轨道操作"]),[role="menu"]:is([aria-label="Download timeline"],[aria-label="下载时间线"],[aria-label="Add to timeline"],[aria-label="添加到时间线"],[aria-label="Timeline actions"],[aria-label="时间线操作"],[aria-label="Keyframe actions"],[aria-label="关键帧操作"],[aria-label="Section actions"],[aria-label="片段操作"],[aria-label="Track actions"],[aria-label="轨道操作"]) :is(button,.ue-menu-label,span)',
    fields: [
      "text",
      "aria-label",
      "title"
    ],
    entries: {
      "Download timeline": "下载时间线",
      "Add to timeline": "添加到时间线",
      "Timeline actions": "时间线操作",
      "Keyframe actions": "关键帧操作",
      "Section actions": "片段操作",
      "Track actions": "轨道操作",
      "Save Video to Canvas": "将视频保存到画布",
      Download: "下载",
      Undo: "撤销",
      Redo: "重做",
      "Go to keyframe": "跳至关键帧",
      "Delete keyframe": "删除关键帧",
      "Go to section start": "跳至片段起点",
      "Go to section end": "跳至片段终点",
      "Split section at playhead": "在播放头处分割片段",
      "Delete section": "删除片段",
      "Rename track": "重命名轨道",
      "Unmute track": "取消轨道静音",
      "Mute track": "将轨道静音",
      "Delete track and its sections": "删除轨道及其片段",
      "Media…": "媒体…",
      "Import video or audio…": "导入视频或音频…",
      "Add video track": "添加视频轨道",
      "Add audio track": "添加音频轨道",
      "Add annotation layer at playhead": "在播放头处添加批注层",
      "Fit timeline": "完整显示时间线",
      Annotation: "批注"
    }
  },
  {
    selector: '.agent-viewer-media div[style*="border-bottom"]:has(> button:nth-child(4)):not(:has(> :not(button))) > button',
    fields: [
      "text"
    ],
    entries: {
      Output: "输出",
      "Output ●": "输出 ●",
      Script: "脚本",
      Widgets: "控件",
      Variables: "变量",
      Log: "日志",
      Errors: "错误",
      "Errors ◦": "错误 ◦",
      "Errors ⚠": "错误 ⚠"
    }
  },
  {
    selector: '.agent-viewer-media div[style*="justify-content: center"][style*="align-items: center"],.agent-viewer-media div[style*="text-transform: uppercase"],.agent-viewer-media div[style*="border-right"] > button:not(:has(span)),.agent-viewer-media button[title],.agent-viewer-media span[title]',
    fields: [
      "text",
      "title",
      "placeholder"
    ],
    entries: {
      "No errors": "没有错误",
      "#48:209ffcc1019a9c0f": "运行节点后，这里会列出输出。",
      "Result has no renderable output": "结果没有可显示的输出",
      "#70:5aa499296ff4b4d2": "运行后在这里查看 print() 和 merlin.log() 的记录。",
      "On this card": "此卡片上的控件",
      "+ New widget": "+ 新建控件",
      Examples: "示例",
      "#141:dda94ac5c680b228": "通过脚本的 @setting 和 widget 声明在卡片上绘制控件。可使用左侧示例或从头创建。",
      "#40:502b1aa25eb7af04": "由卡片中的 widget(...) 声明绘制。",
      "#46:00bb06f53ead6a9c": "控件由此卡片保存的代码生成。",
      "#45:49b6de0328f8d9e9": "先复制示例到卡片，再编辑副本。",
      "#35:ad637188c4e8f3cf": "卡片中已存在同名控件。",
      "#53:d58ddd68b39f61da": "名称可含字母、数字、下划线和连字符，首字符须为字母或下划线。",
      "#80:c478668714de9e28": "将全部变量设为待重算，下次运行重新计算整个流程。",
      "#70:c4a0070c44778221": "下次运行将重算此项，点击可取消。",
      "#96:3534a81518f1e0d3": "强制下次运行重新计算此变量。",
      "#63:b6965da73f8344f0": "复制错误信息，便于粘贴至对话。",
      "Select a variable": "请选择变量",
      "#31:daabd3f9b23cf666": "变量尚未产生结果。",
      "Tracked values": "跟踪值"
    }
  },
  {
    selector: ':is(.merlin-inspector-panel div:has(> div > .cm-theme),.merlin-inspector-panel div:has(> div [title="Open Viewer"]),.merlin-inspector-panel div:has(> div [title="打开查看器"])) > label:has(> input[type="checkbox"]),:is(.merlin-inspector-panel div:has(> div > .cm-theme),.merlin-inspector-panel div:has(> div [title="Open Viewer"]),.merlin-inspector-panel div:has(> div [title="打开查看器"])) > div:not(:first-child),:is(.merlin-inspector-panel div:has(> div > .cm-theme),.merlin-inspector-panel div:has(> div [title="Open Viewer"]),.merlin-inspector-panel div:has(> div [title="打开查看器"])) > div > :is(span,button),:is(.merlin-inspector-panel div:has(> div > .cm-theme),.merlin-inspector-panel div:has(> div [title="Open Viewer"]),.merlin-inspector-panel div:has(> div [title="打开查看器"])) > div:last-child > div :is(div,button)',
    fields: [
      "text",
      "title"
    ],
    entries: {
      "Run live": "实时运行",
      "Status:": "状态：",
      "#48:b8c9eef7474b4334": "使用 merlin 的脚本需要手动运行。",
      "#87:129e62b9a6e0aad1": "摄像头输入每帧执行，视口输入请手动运行。",
      Settings: "设置",
      Script: "脚本",
      "Open Viewer": "打开查看器",
      "Read-only:": "只读：",
      Dependencies: "依赖项",
      "From code": "代码中声明的依赖",
      Add: "在脚本中加入",
      "#62:ab07db4eddfa388d": "，每行填写一个依赖，可指定版本范围，例如",
      "#5:4f42545e72f88981": "。",
      "on one line does not)": "等多个包名需要分行填写。",
      "Requirements file": "依赖文件",
      Clear: "清除",
      "Import requirements.txt…": "导入 requirements.txt…",
      "Conflicting versions for": "以下依赖的版本冲突：",
      "#40:1c96c73913d2cfe3": "。请只保留一个版本要求。"
    }
  },
  {
    selector: ".merlin-graph-inspector :is(.merlin-script-form-section,.merlin-script-form-section-head span,.merlin-script-form-prop,.merlin-script-form-prop-label span,.merlin-script-form-none:not([title]),.merlin-script-form-checkbox,.merlin-script-side-locked > span,.merlin-script-side-duplicate,input,textarea,.merlin-script-form-add,.merlin-script-form-dot.is-button,.merlin-script-form-remove,.merlin-skill-attach-add,.merlin-skill-attach-manage,.merlin-custom-category:first-child),.merlin-graph-inspector-subtype button,.merlin-graph-inspector .merlin-tags-field",
    fields: [
      "text",
      "title",
      "aria-label",
      "placeholder"
    ],
    entries: {
      Inputs: "输入",
      Outputs: "输出",
      "Model settings": "模型设置",
      Toolshelf: "工具架",
      "Show on toolshelf": "显示在工具架中",
      "Not shown": "不显示",
      "#56:86c98db2a50db695": "连到输出即可在工具架显示。",
      "Show in graph": "在节点图中显示",
      "Hide model settings": "隐藏模型设置",
      "Sub-type": "子类型",
      Description: "描述",
      "Graph description": "节点图描述",
      "Graph tags": "节点图标签",
      "Graph author": "节点图作者",
      "#78:76b2f6e9f82a5b7e": "说明节点图的功能，方便运行前查看。",
      "Delete input": "删除输入",
      "Delete output": "删除输出",
      "#115:28d307ef3e781e50": "右键节点选择「创建输入」，也可在这里添加输入后拖到图中。",
      "#107:e176399bd31cd521": "请将结果连到输出节点，卡片才能展示。",
      "Edit a Copy": "编辑副本",
      "#97:134ffde693927f62": "卡片已有结果，复制后可调整设置。",
      "#61:063dcf91c4f920cb": "请解锁画布后再编辑节点图。",
      General: "常规",
      Category: "分类",
      Author: "作者",
      Tags: "标签",
      Uncategorized: "未分类",
      "New category": "新建分类",
      "Who made this": "作者姓名",
      "Add a tag…": "添加标签…",
      "Add graph tags": "添加节点图标签",
      "+ Add input": "+ 添加输入",
      "+ Add output": "+ 添加输出",
      Skills: "技能",
      "No skills attached to": "尚未添加技能的位置：",
      "+ Attach skill": "+ 添加技能",
      "Manage in Toolbox": "在工具箱中管理",
      "#69:50af44b598806a58": "在工具箱里添加、编辑、重命名或删除技能。"
    }
  },
  {
    selector: '[role="tooltip"],[role="tooltip"] :is(div,span,p),.merlin-graph-inspector .merlin-sr-only',
    fields: [
      "text"
    ],
    entries: {
      "#233:3c6d91be7d6cd84c": "将节点所用模型的参数显示在输入旁。右键节点选择「显示模型设置」即可添加，更换模型时沿用可用参数。",
      "#479:48c32aeeae6a465b": "输入定义卡片的运行参数。右键节点或拖入新输入即可创建关联，多处可共享同一值。删除单个节点仍保留输入定义，点此处的 × 会一并删除全部关联节点。",
      "#142:30eb1ad134b1a62c": "将结果连到输出节点的引脚，卡片会展示标星的输出。",
      "#176:bf101b1a2478458a": "手动添加的技能供此画布及其嵌套画布中的智能体参考。工具权限继续沿用现有设置。"
    }
  }
];

// src/locales/script-authoring-extra.json
var script_authoring_extra_default = [
  {
    selector: ".merlin-script-editor-btn,.merlin-script-editor-btn > span,.merlin-script-editor-dirty,.merlin-script-editor-loading,.merlin-script-heading-edit",
    fields: [
      "text",
      "title",
      "aria-label"
    ],
    entries: {
      "Unsaved changes": "有未保存的更改",
      "unsaved changes": "有未保存的更改",
      Locked: "已锁定",
      "Save to the card (Ctrl+S)": "保存到卡片 (Ctrl+S)",
      "Save to the library (Ctrl+S)": "保存到资源库 (Ctrl+S)",
      "#59:2b0527454caeae89": "请先修复列出的 SKILL.md 错误。",
      "#39:61a3ca9a8ec90557": "请先检查名称和引脚名。",
      "Save script": "保存脚本",
      "Saving…": "正在保存…",
      Save: "保存",
      "Close the editor (Esc)": "关闭编辑器 (Esc)",
      "Close script editor": "关闭脚本编辑器",
      "Loading editor…": "正在加载编辑器…",
      "Rename script": "重命名脚本"
    }
  },
  {
    selector: '.merlin-script-form :is(.merlin-script-form-label,.merlin-script-form-add,.merlin-script-form-warn,.merlin-sr-only,.merlin-script-form-section,.merlin-script-form-prop,.merlin-script-form-checkbox,.merlin-script-form-none:not([title]),.merlin-script-side-duplicate),[role="tooltip"],[role="tooltip"] p',
    fields: [
      "text",
      "title",
      "aria-label"
    ],
    entries: {
      Inputs: "输入",
      Outputs: "输出",
      "+ Add input": "+ 添加输入",
      "+ Add output": "+ 添加输出",
      General: "常规",
      Category: "分类",
      Author: "作者",
      Tags: "标签",
      Description: "描述",
      Toolshelf: "工具架",
      "Show on toolshelf": "显示在工具架中",
      "Not shown": "不显示",
      "#56:86c98db2a50db695": "连到输出即可在工具架显示。",
      Duplicate: "创建副本",
      "#152:c4a92409918f6c38": "脚本按引脚名读取输入变量。未赋值时为 None，媒体与网格输入是文件路径。",
      "#113:efc49673d1418160": "把结果赋给同名变量即可输出。文件需先写入磁盘，再输出其路径。",
      "#42:788cabbff4c9ca86": "此脚本来自资源库，请在库中修改。",
      "#126:fc5f4e1958209723": "引脚名须为有效的 Python 标识符，首位不可用数字。输入名之间和输出名之间各自应唯一。"
    }
  },
  {
    selector: ".merlin-script-form :is(input,textarea,.merlin-tags-field,button),.merlin-script-heading-name",
    fields: [
      "title",
      "aria-label",
      "placeholder"
    ],
    entries: {
      "Double-click to rename": "双击重命名",
      "Python variable name": "Python 变量名",
      "#49:27d9b91fb989afad": "在已公开的设置中修改此项。",
      "input name": "输入名称",
      "output name": "输出名称",
      "input type": "输入类型",
      "output type": "输出类型",
      "Remove input": "移除输入",
      "Remove output": "移除输出",
      "Primary output": "主要输出",
      "Script description": "脚本描述",
      "#58:77c4027cd8fd11d4": "简述此脚本用于完成什么任务。",
      "Script author": "脚本作者",
      "Who made this": "作者姓名",
      "Script tags": "脚本标签",
      "Library script tags": "资源库脚本标签",
      "Add a tag…": "添加标签…",
      "New category": "新建分类"
    }
  }
];

// src/locales/menus-extra.json
var menus_extra_default = [
  {
    selector: ".tips-dialog-header h2,.tips-dialog-intro,.tips-dialog-entry *,.feature-hint-popover *",
    fields: [
      "text"
    ],
    entries: {
      "Tips & what’s new": "提示与新功能",
      "#43:791dae94689b5e7f": "再次打开这里可查看使用提示。",
      "Create a Timeline": "创建时间线",
      "#210:122333d2ed32701d": "用工具栏「+」或画布右键菜单创建时间线。双击卡片编排音视频，编辑会自动保存。",
      "Auto-align cards": "自动对齐卡片",
      "#131:262df8bb421ff774": "选中至少两张卡片，用「排列 → 自动对齐」等距排成一行。需要时可撤销。",
      "Explore a result’s history": "查看结果历史",
      "#175:f4a4cd27acf0a363": "在「历史记录」查看各版本的生成参数及可用的来源信息。",
      "Control canvas alignment": "调整画布对齐方式",
      "#229:fc14964e3724b36d": "移动或缩放时可对齐附近卡片的边缘和中心。按住 Shift 可临时略过卡片对齐。网格与吸附选项在偏好设置中。",
      Preferences: "偏好设置",
      "Wrapping rows in Structured Layout": "结构化布局中的自动换行",
      "#172:d7fd119eb3a3c4a3": "结构化框架会按宽度自动换行。拉宽可增加列数，将卡片拖到框外可自由摆放。",
      "Voice shortcut": "语音快捷键",
      Space: "空格",
      "#124:ced053a55bd7bd9d": "聚焦提示词框可开始听写，画布也支持语音聊天。可在听写设置中选择按住或切换录音。",
      "Dictation settings": "听写设置",
      "Compare from the hierarchy": "从层级视图比较卡片",
      "#211:9e30398dd79150fc": "在查看器层级中用 Shift+单击叠加比较对象，普通单击恢复单项查看。卡组固定封面会保留。",
      "Linked text in prompts": "在提示词中引用文本",
      "#230:5b122e33717fce2a": "将文字卡拖入提示词或用 @ 引用卡片，即可随源文本更新。可拖动调整引用顺序，移除引用会保留原卡片。",
      "Erase whole strokes": "擦除整条笔画",
      "#193:3414bc6a8d7bbd60": "笔画擦除可一次清除划过的完整标记，支持撤销。图像批注的像素擦除仅影响擦过的部分。",
      "Make agents easy to recognize": "区分不同的智能体",
      "#156:89b25e7f7b7fee2d": "右键智能体头像或对应菜单项，打开「外观」设置并保存角色和颜色。",
      "Locate agent work": "定位智能体正在处理的工作",
      "#221:3393da415e27dfa3": "智能体有可定位的结果、工作或审阅项时，点击名称旁的放大镜即可在画布中定位。",
      "Work on your own": "独立工作",
      "#208:071fd8206a104970": "点击 Zzz 可暂时自行使用工具架，后台工作会继续。需要协助时再选择智能体。",
      "Move floating panels": "移动浮动面板",
      "#151:9cffca9b769e6a78": "拖动标题栏空白处移动浮窗。聚焦后可用方向键微调，Shift 加大步长。",
      "Resize floating panels": "调整浮动面板大小",
      "#206:a0ef0dd44bd36ddd": "拖动聊天上下边缘调节高度，拖动工具架侧边调节宽度。聚焦边缘后可用方向键，Shift 加大步长。",
      "Choose skills for a conversation": "为对话选择技能",
      "#264:80969986a9f9aa1a": "在技能按钮中设置当前对话可用的技能。画布位置影响继承项；允许智能体添加技能后它可解释并添加相关项。已排除项继续生效，更改应用于后续消息。",
      "Keep references while browsing": "浏览时保留引用",
      "#258:0db54d361ff49c59": "用 @ 或「从画布选择」添加引用，固定后切换所选卡片仍然有效。聊天引用和草稿跟随对话，工具架独立管理输入。",
      "Work with an agent team": "与智能体团队协作",
      "#244:6c549ce4aa5765ff": "可以让智能体邀请队友。在侧栏选择成员查看进度，或联系负责人。「继续对话」可从生成的卡片返回对应聊天。",
      "Agents follow your canvas": "智能体跟随当前画布",
      "#256:6d00f1d40d51d405": "侧栏列出当前根画布及内部画布和节点图的智能体。用「重新打开智能体」找回其他对话或待办。",
      "Explore agent results": "查看智能体的工作结果",
      "#219:3e6d07b4823cd8bc": "点击聊天缩略图可定位结果，批量图像可逐张检查。智能体挥手表示正在等你回复。"
    }
  },
  {
    selector: '.merlin-app-menus,.merlin-app-bar [role="dialog"],.merlin-app-bar [role="menu"],.merlin-file-menu-section,.merlin-toolbar-floating-group,.toolbar-section,.merlin-toolbar-control-box,.merlin-toolbar-control-box [role],.merlin-toolbar-control-box button,.merlin-toolbar-control-box input,[role="dialog"].nodrag.nowheel,[data-testid="ask-pill-frame"] [role="menu"],.canvas-card-toolbar',
    fields: [
      "title",
      "aria-label"
    ],
    entries: {
      "App menus": "应用菜单",
      "Open or browse": "打开或浏览",
      "New / Open": "新建 / 打开",
      "Current Canvas": "当前画布",
      Save: "保存",
      "Tips & what’s new": "提示与新功能",
      "Connect an agent": "连接智能体",
      "About Unreal Canvas": "关于 Unreal Canvas",
      "Open canvas": "打开画布",
      Collaborate: "协作",
      "Graph toolbar": "节点图工具栏",
      Navigation: "导航",
      Editing: "编辑",
      "Filter and zoom": "筛选与缩放",
      Zoom: "缩放",
      "Double-click for 100%": "双击恢复至 100%",
      "Filter cards": "筛选卡片",
      "Canvas actions": "画布操作",
      "Card actions": "卡片操作"
    }
  },
  {
    selector: ".merlin-file-menu-heading,.merlin-app-menu-label,.merlin-file-menu-item,.generation-shelf-menu-option,.generation-shelf-menu-copy > span,.generation-shelf-menu.ue-menu",
    fields: [
      "text",
      "title",
      "aria-label"
    ],
    entries: {
      Help: "帮助",
      "Tips & what’s new": "提示与新功能",
      "Keyboard shortcuts": "键盘快捷键",
      "Connect an agent": "连接智能体",
      "About Unreal Canvas": "关于 Unreal Canvas",
      "New / Open": "新建 / 打开",
      "New Canvas": "新建画布",
      "Browse Canvases…": "浏览画布…",
      "Open Canvas File…": "打开画布文件…",
      "Current Canvas": "当前画布",
      "Rename Canvas…": "重命名画布…",
      "Collaborate…": "协作…",
      "Close Canvas": "关闭画布",
      "Share canvas…": "共享画布…"
    }
  },
  {
    selector: ".connect-agent-header h2,.connect-agent-header button,.connect-agent-intro,.connect-agent-note,.connect-agent-label,.connect-agent-row button",
    fields: [
      "text",
      "title",
      "aria-label"
    ],
    entries: {
      "Connect an agent": "连接智能体",
      "Close (Esc)": "关闭 (Esc)",
      "#210:ee93f8aeff773589": "将此地址配置给支持 MCP 的客户端。使用 Canvas 工具期间保持画布打开，应用重启后请检查连接地址。",
      "MCP server": "MCP 服务器",
      "Copy MCP server": "复制 MCP 服务器地址",
      "Copy Claude Code": "复制 Claude Code 命令",
      "Copy Codex": "复制 Codex 命令",
      Copy: "复制",
      Copied: "已复制",
      "#198:c55891d84cd4a484": "在智能体的工作目录执行所示命令。Claude Code 按目录配置，Codex 全局生效。现有会话需重启（使用",
      or: "或",
      "#24:3c8913aac0d5eef2": "可恢复对话）。"
    }
  },
  {
    selector: '[role="dialog"]:is([aria-label="About Unreal Canvas"],[aria-label="关于 Unreal Canvas"]) :is(span,nav [role="button"],div,p,h3,h4)',
    fields: [
      "text"
    ],
    entries: {
      "About Unreal Canvas": "关于 Unreal Canvas",
      "Third-Party Software": "第三方软件",
      "Transitive Notices": "间接依赖声明",
      "#64:3ded3b59abfd4956": "用节点图组织 AI 素材生成步骤。",
      "Frontend version": "前端版本",
      "Server version": "服务器版本",
      "Server build ID": "服务器构建标识",
      "AI Models root": "AI 模型根目录"
    }
  },
  {
    selector: '[role="dialog"]:is([aria-label="Open canvas"],[aria-label="打开画布"]) :is(input,section > div:first-child,div > span:first-child,span[aria-label],button[title],.ue-menu-label,.ue-menu-item)',
    fields: [
      "text",
      "title",
      "aria-label",
      "placeholder"
    ],
    entries: {
      "Open canvas": "打开画布",
      "Filter canvases": "筛选画布",
      Canvases: "画布列表",
      "#119:9e8058365d943a07": "对其他人隐藏画布列表项。共享目录的文件权限仍然适用。",
      "not shown to others": "对其他人隐藏",
      hidden: "已隐藏",
      "Rename, duplicate or delete": "重命名、创建副本或删除",
      Rename: "重命名",
      Duplicate: "创建副本",
      Delete: "删除",
      "Hide from others": "对其他人隐藏",
      "Show to others": "向其他人显示",
      "#38:e223a82ad2734a37": "在大家的画布列表中显示",
      "#112:18c003d5dd22c3d8": "仅从他人的画布列表隐藏，共享目录仍可访问。"
    }
  },
  {
    selector: '[role="dialog"]:is([aria-label="Collaborate"],[aria-label="协作"]) :is(h3,label,button,input,p)',
    fields: [
      "text",
      "placeholder",
      "title",
      "aria-label"
    ],
    entries: {
      Collaborate: "协作",
      "Your display name": "你的显示名称",
      "Start sharing this canvas": "开始共享此画布",
      "Join someone else's session": "加入他人的会话",
      "#27:5e4270cb566d81c6": "输入共享链接或房间 ID",
      Join: "加入",
      Close: "关闭",
      Copied: "已复制",
      Copy: "复制",
      "#44:45811545a525d69a": "共享已关闭，仅自己可使用。",
      "#34:933a69314e32f78c": "可把此共享码发给团队成员。"
    }
  },
  {
    selector: '.merlin-toolbar-control-box .ue-menu-label,.merlin-toolbar-control-box .ue-menu-item,[role="dialog"]:is([aria-label="Filter cards"],[aria-label="筛选卡片"]) > .ue-menu:first-child :is(.ue-menu-label,.ue-menu-heading,.ue-menu-item,.ue-menu-note)',
    fields: [
      "text",
      "title",
      "aria-label"
    ],
    entries: {
      "Zoom to 100%": "缩放至 100%",
      "Zoom to fit": "缩放至合适大小",
      "Show minimap": "显示小地图",
      "Hide minimap": "隐藏小地图",
      Fullscreen: "全屏",
      "Exit fullscreen": "退出全屏",
      "Filter by": "筛选条件",
      Person: "人员",
      Age: "时间",
      Votes: "投票",
      "Custom Filter…": "自定义筛选…",
      Saved: "已保存",
      "#60:449f6e30e468f5e2": "切换手动关系线的可见性。",
      "Show relationship connectors": "显示关系连线",
      "Activate a filter to enable": "启用筛选条件后可用",
      "#42:64d6d5fcff42ff4c": "只能选择符合筛选条件的卡片。",
      "Lock to selection": "锁定到筛选结果",
      "Clear all": "全部清除"
    }
  },
  {
    selector: '[data-testid="canvas-settings-popover"] > div:first-child > span:first-child,[data-testid="canvas-settings-popover"] :is(div,label,textarea,.merlin-script-form-none,button),[role="tooltip"]',
    fields: [
      "text",
      "placeholder",
      "title",
      "aria-label"
    ],
    entries: {
      Canvas: "画布",
      Background: "背景",
      "Choose image…": "选择图像…",
      Context: "上下文",
      "What this canvas is about": "画布用途",
      "#83:b061a5469d9a7f2d": "说明这个画布的工作目标，供脚本和智能体读取。",
      Skills: "技能",
      "No skills attached to": "尚未添加技能的位置：",
      "+ Attach skill": "+ 添加技能",
      "#69:50af44b598806a58": "在工具箱里添加、编辑、重命名或删除技能。",
      "Manage in Toolbox": "在工具箱中管理",
      "#140:7694dd46062fc0d0": "技能存于画布并由子画布继承。对话内的排除只作用于该对话。",
      "#191:eb81a90d9c04df04": "记录工作目标。子画布可继承和补充，脚本及智能体可用 get_canvas_context 查询。此说明不参与节点生成。"
    }
  },
  {
    selector: '[data-testid="ask-pill-frame"] :is(.ask-pill-recipient-trigger,footer button),[data-testid="ask-pill-composer"] div,.ask-pill-recipient-name,.canvas-card-ask-agent',
    fields: [
      "text",
      "title",
      "aria-label",
      "placeholder"
    ],
    entries: {
      "Ask the agent…": "询问智能体…",
      "Choose agent for this question": "选择回答此问题的智能体",
      "Ask the agent": "询问智能体",
      "Choose skills for this request": "为本次请求选择技能",
      Send: "发送"
    }
  },
  {
    selector: ".pill-menu-item,.pill-menu-item .ue-menu-label,.pill-menu-item .feature-hint-menu-label",
    fields: [
      "text",
      "title",
      "aria-label"
    ],
    entries: {
      Deck: "卡组",
      "Graph (Copy to)": "复制到新节点图",
      "Graph (Move to)": "移入新节点图",
      Subcanvas: "子画布",
      Paste: "粘贴",
      "Nothing copied yet": "剪贴板中暂无可粘贴内容",
      "#62:016d612c6e8c5126": "请选择两张以上卡片，或选择一张包含多个版本的卡片。",
      "#69:c26ab6ec3a70c951": "保留原卡片并复制到新节点图。",
      "#60:28f620c00e5033be": "移入节点图，跨边界的连线会创建对应端口。",
      "#35:19ced5f89affed38": "所选卡片将移至子画布。",
      "#72:a843d98f89810d8e": "创建可编辑的节点图副本，从空输出开始生成。",
      "#73:b3264356957269a9": "把卡片从卡组移到这里。",
      "Move Card": "移动卡片",
      "#92:f4a004c400725e5e": "将当前封面卡片从卡组移到此处。",
      "Copy Card": "复制卡片",
      "#75:05ad7d62aef15e2a": "在这里创建封面卡片及其结果的副本。",
      "Copy Deck": "复制卡组",
      "#42:2757825c8ae95d76": "在这里复制整个卡组及卡片。",
      "Reveal in Explorer": "在资源管理器中显示",
      "Save a Copy…": "另存副本…",
      "Send To": "发送到",
      "Finish Editing": "完成编辑",
      "#44:710699e0bc25b9e7": "请等待卡片运行完毕。",
      "Go to Source": "前往来源",
      "Custom Node": "自定义节点",
      "Update from Library": "从资源库更新",
      "Publish to Library…": "发布到资源库…",
      "#52:e2d6ce59a2f948a2": "保存到自定义节点库，供其他节点图使用。",
      "Export as File…": "导出为文件…",
      "#56:5a47ff3a225fe590": "导出节点定义为 .customnode JSON。",
      Graph: "节点图",
      "Add to Library": "添加到资源库",
      "#51:15209f0c50788792": "复制此节点图到工具箱。",
      "#39:ff34a80c5efe8b04": "导出节点图文件（.graph.json）。",
      "Export as Workspace File…": "导出为工作区文件…",
      "#90:52fca30e3c73ab33": "导出包含画布、框架和布局规则的扩展工作区文件。",
      Reference: "引用",
      Create: "创建",
      "#81:b6cc82c81a81d40a": "打开 Python 控制台，并为这个结果建立变量。",
      Copy: "复制",
      "Copy with Annotations": "连同批注复制",
      "#50:20044c2f09126c9c": "复制带有批注的合成图像。",
      "Duplicate Graph": "创建节点图副本",
      Arrange: "排列",
      "Fit to Aspect Ratio": "适配宽高比",
      "Reset Card Size": "重置卡片大小",
      "Fit to Text": "适应文本",
      "Re-create Graph as New Canvas": "将节点图重建为新画布",
      "#94:802c498e5156ae63": "在新画布打开来源节点图，修改后可再次生成。",
      "Import Level Snapshot": "导入关卡快照",
      "#96:ca5a9a10394f39b6": "将渲染时的关卡状态保存到内容浏览器，供检查或应用。",
      Edit: "编辑",
      "Remove Reroute": "移除重路由节点",
      "Restore Severed Wiring": "恢复断开的连线",
      "Stop Keeping Cached Result": "停止保留缓存结果",
      "#73:fc87c3d85c31dfbf": "参数或输入变化时允许重新执行。",
      "Keep Cached Result": "保留缓存结果",
      "#81:7feb90424d8705e4": "节点下次变更前使用已有结果。",
      Inspect: "检查",
      Compare: "比较",
      "Play videos together": "同步播放视频",
      Frame: "框架",
      Alignment: "对齐",
      "Auto-align": "自动对齐",
      "Text Card": "文本卡片",
      "Import File…": "导入文件…",
      "Canvas Settings": "画布设置"
    }
  },
  {
    selector: '[role="dialog"]:is([aria-label="Open canvas"],[aria-label="打开画布"]) section > div,[role="dialog"]:is([aria-label="Open canvas"],[aria-label="打开画布"]) button',
    fields: [
      "text",
      "title",
      "aria-label"
    ],
    entries: {
      Local: "本地画布",
      Shared: "共享画布",
      "#22:b4c378b052f5e685": "本机还没有画布。",
      "#16:bde07a2f8506682e": "还没有画布。",
      "#57:dc74f6028d9f0c2a": "当前会话无法读取共享画布列表，请查看上方消息。",
      "#98:b0174dd0df9b53f9": "尚未共享画布。可从「设置 → 协作」或「打开 → 共享画布」添加。",
      "Open shared canvas": "打开共享画布"
    }
  },
  {
    selector: '[role="dialog"]:is([aria-label="Rename canvas"],[aria-label="重命名画布"],[aria-label="Delete canvas?"],[aria-label="删除画布？"]),[role="dialog"]:is([aria-label="Rename canvas"],[aria-label="重命名画布"],[aria-label="Delete canvas?"],[aria-label="删除画布？"]) :is(button,input),[role="dialog"]:is([aria-label="Rename canvas"],[aria-label="重命名画布"],[aria-label="Delete canvas?"],[aria-label="删除画布？"]) > div:first-child',
    fields: [
      "text",
      "aria-label"
    ],
    entries: {
      "Rename canvas": "重命名画布",
      "#14:f671b187491f4f07": "确定删除画布？",
      "new canvas name": "新的画布名称",
      Cancel: "取消",
      "Renaming…": "正在重命名…",
      Rename: "重命名",
      "Deleting…": "正在删除…",
      Delete: "删除"
    }
  },
  {
    selector: '[role="dialog"]:is([aria-label="Collaborate"],[aria-label="协作"]) :is(div,p,button)',
    fields: [
      "text"
    ],
    entries: {
      "Reshare (same code)": "重新共享（沿用原共享码）",
      Unshare: "取消共享",
      "#7:dfb2b12b255de30c": "已复制到剪贴板",
      "Stop sharing": "停止共享",
      "#36:22a4e26db4132c12": "文件存放在共享目录中。",
      "#74:97c78af822439f5b": "项目成员可通过画布列表或共享码打开。",
      "#38:850896edf6471e94": "画布共享成功，以下文件需要另行处理：",
      "#137:9c9b19b82b5232ef": "关闭共享后，其他人将无法在 Canvas 列表看到画布；共享目录原有的文件访问权限仍然有效。"
    }
  },
  {
    selector: '[role="dialog"]:is([aria-label="Filter cards"],[aria-label="筛选卡片"]) .ue-menu:has(input[type="range"]) :is(input,span),[role="dialog"]:is([aria-label="Filter cards"],[aria-label="筛选卡片"]) .ue-menu-note,[role="dialog"]:is([aria-label="Filter cards"],[aria-label="筛选卡片"]) .ue-menu-inline-remove',
    fields: [
      "text",
      "title",
      "aria-label"
    ],
    entries: {
      "#54:c198ce30813971f7": "保留天数，滑到最右侧为不限。",
      today: "今天",
      "today only": "仅限今天",
      "any age": "不限时间",
      any: "不限",
      "#20:d3fddbc48e698c03": "没有可供选择的值。",
      "#69:9a4780096c8fcb8b": "尚无已保存的筛选。请在「自定义筛选」中命名并保存。",
      "Delete this saved filter": "删除此筛选条件"
    }
  },
  {
    selector: '[role="dialog"][aria-modal="true"],[role="dialog"]:is([aria-label="Custom Filter"],[aria-label="自定义筛选"]) > div,[role="dialog"]:is([aria-label="Custom Filter"],[aria-label="自定义筛选"]) > div:first-child > span:first-child,[role="dialog"]:is([aria-label="Custom Filter"],[aria-label="自定义筛选"]) input,[role="dialog"]:is([aria-label="Custom Filter"],[aria-label="自定义筛选"]) > div:last-child > button,[role="dialog"]:is([aria-label="Custom Filter"],[aria-label="自定义筛选"]) button.custom-select,[role="dialog"]:is([aria-label="Custom Filter"],[aria-label="自定义筛选"]) select option[value=""],[role="dialog"]:is([aria-label="Custom Filter"],[aria-label="自定义筛选"]) button.custom-select > span,[role="dialog"]:is([aria-label="Custom Filter"],[aria-label="自定义筛选"]) [role="group"] > button,[role="dialog"]:is([aria-label="Custom Filter"],[aria-label="自定义筛选"]) [role="group"] [role="group"] button',
    fields: [
      "text",
      "title",
      "aria-label",
      "placeholder"
    ],
    entries: {
      "Custom Filter": "自定义筛选",
      "#302:e96bb70aef520d84": "先添加字段，再填写条件或选取值。文本忽略大小写，可用「不等于」排除，多行可重复使用同一字段。「且」优先于「或」，编辑立即生效。",
      "+ Add field…": "+ 添加字段…",
      "Saved filter name": "筛选条件名称",
      "Name this filter…": "为筛选条件命名…",
      "#35:a090e7bbee0515c0": "至少添加一个条件才能保存。",
      "Save filter": "保存筛选条件",
      "Remove this criterion": "移除此条件",
      "Combine with the row above": "与上一行组合",
      "Combine with AND": "与上一行同时满足",
      "Combine with OR": "与上一行满足其一",
      and: "且",
      or: "或",
      is: "等于",
      "is not": "不等于"
    }
  },
  {
    selector: '.merlin-skill-picker,.merlin-skill-picker input,.merlin-skill-picker-list,.merlin-skill-picker-empty,.merlin-skill-attach [role="group"],button[data-graph-edit-lock],.canvas-card-toolbar .node-header-btn',
    fields: [
      "text",
      "aria-label",
      "placeholder",
      "title"
    ],
    entries: {
      "Attach a skill": "添加技能",
      "Search skills": "搜索技能",
      "Skills to attach": "可添加的技能",
      "Attached skills": "已添加的技能",
      "#19:6b096e5403455ad5": "找不到符合条件的技能。",
      "#42:1a4fb8bf8998402d": "尚无技能，点击工具箱的「+」创建。",
      "#24:3be9dca31e95a221": "可选技能均已添加。",
      "Loading skills…": "正在加载技能…",
      "Graph editing open": "节点图可编辑",
      "Graph editing locked": "节点图编辑已锁定",
      "Edit Script": "编辑脚本"
    }
  },
  {
    selector: '[role="dialog"]:is([aria-label="Rename canvas"],[aria-label="重命名画布"]) > div:nth-child(2) > div > div:first-child',
    fields: [
      "text"
    ],
    entries: {
      'New name for "': "画布“",
      '":': "”的新名称"
    }
  }
];

// src/locales/panels-extra.json
var panels_extra_default = [
  {
    selector: ".merlin-panel-title,.merlin-content-results,.merlin-bottom-dock-tabpanel,.merlin-content-modes button,.merlin-scripts-section,.merlin-scripts-results-head > span:first-child,.agent-message-switcher",
    fields: [
      "text",
      "title",
      "aria-label"
    ],
    entries: {
      Agents: "智能体",
      Library: "资源库",
      Toolbox: "工具箱",
      Inspector: "检查器",
      Operations: "操作记录",
      "Script details": "脚本详情",
      "Live logging": "实时日志",
      Execution: "执行",
      Results: "结果",
      Viewer: "查看器"
    }
  },
  {
    selector: ".merlin-content-browser,.merlin-content-modes,.merlin-bottom-dock-panel,.merlin-panel-chips,.merlin-panel-tabs,.merlin-ops-group,.merlin-rail-pin,.merlin-content-rail-grip,.merlin-panel-search-clear,.merlin-panel-control-btn",
    fields: [
      "aria-label",
      "title"
    ],
    entries: {
      "Canvas content": "画布内容",
      "Canvas content panels": "画布内容面板",
      "Bottom dock": "底部停靠栏",
      "Active filters": "已启用的筛选条件",
      "Operations scope": "操作记录范围",
      "In progress": "进行中",
      "Recently completed": "最近完成",
      "#34:25b2259fe434a530": "选定需要固定的卡片或框架。",
      "Pin this card": "固定此卡片",
      Pin: "固定",
      Unpin: "取消固定",
      "Resize panel": "调整面板大小",
      "Resize the bottom dock": "调整底部停靠栏大小",
      "#87:2798205eeeec4e09": "拖动或按左右键调节，拖到窗口边缘收起。",
      "#84:fb96686e2ec5d5bb": "拖动或按上下键调节，拖到窗口边缘收起。",
      "Clear search": "清除搜索",
      "Fill Canvas": "填满画布",
      "Restore Side Panel": "还原侧栏",
      "Move sidebar to the left": "将侧栏移到左侧",
      "Move sidebar to the right": "将侧栏移到右侧",
      "#59:c1264313c2965fe8": "左侧显示侧栏，右侧显示查看器",
      "#60:a86ea62c8e4036d1": "右侧显示侧栏，左侧显示查看器"
    }
  },
  {
    selector: ".media-library-empty strong,.media-library-empty p,.merlin-graphs-empty",
    fields: [
      "text"
    ],
    entries: {
      "No matching media": "没有匹配的媒体",
      "#42:11ada2206a3a14d1": "请更换关键词或放宽筛选。",
      "#30:7eae3b984f795f17": "没有符合条件的条目。",
      "#68:f9297584555fb3e4": "点击「+」创建节点图、Python 脚本或文件夹。",
      "#36:f2d88c93c88c066b": "点击「+」创建第一个脚本。"
    }
  },
  {
    selector: ".media-library-filter-trigger,.merlin-content-view-controls button,.merlin-scripts-columns-btn,.merlin-scripts-create-btn,.merlin-panel-settings-menu",
    fields: [
      "title",
      "aria-label"
    ],
    entries: {
      Grid: "网格",
      "Grid view": "网格视图",
      Table: "表格",
      "Table view": "表格视图",
      "Filter scripts": "筛选脚本",
      Columns: "显示列",
      "#65:5c8bc86183bc09e3": "新建节点图、脚本、子脚本、技能、个性配置或文件夹"
    }
  },
  {
    selector: ".merlin-scripts-cell,.merlin-panel-settings-menu .ue-menu-label,.merlin-scripts-results-sort",
    fields: [
      "text",
      "title"
    ],
    entries: {
      Type: "类型",
      Outputs: "输出",
      Source: "来源",
      Status: "状态",
      Usage: "使用情况",
      "Refresh library": "刷新资源库",
      "Sort:": "排序：",
      Name: "名称",
      "Most used": "使用最多",
      "Recently used": "最近使用"
    }
  },
  {
    selector: ".merlin-scripts-row-location,.merlin-graphs-tile-location,.merlin-scripts-row-lock,.merlin-graphs-tile-lock",
    fields: [
      "aria-label",
      "title"
    ],
    entries: {
      "Built-in": "内置",
      "Built-in: ships with Unreal Canvas": "内置，随 Unreal Canvas 提供",
      "#48:efef782d2ab99ab9": "内置脚本为只读，可复制到库后修改。",
      "Claude Code skill": "Claude Code 技能",
      "Invalid SKILL.md": "无效的 SKILL.md",
      "Shadowed by another library": "已被其他库中的同名技能覆盖",
      "#88:ddd0a3994b985d01": "存在同 ID 的优先技能，智能体将使用另一份。",
      "Changed on disk": "磁盘上的文件已更改",
      "#123:e2ef43c6d9d8738a": "本地和磁盘版本均已修改。右键可重载、保留本地版本或另存。",
      "File removed": "文件已移除",
      "#91:fea1f1c468bdbe16": "原文件已移除。修改仍在，继续编辑时会保存到本机。",
      "Edited — not shared": "本地修改尚未共享",
      "#97:8f33cfca0a2fed6e": "团队副本有待同步。右键选择「更新团队副本」写入团队目录。"
    }
  },
  {
    selector: ".merlin-scripts-create-panel,.merlin-scripts-create-kinds,.merlin-scripts-create-back,.merlin-scripts-create-form,.merlin-scripts-create-item,.merlin-scripts-create-panel .ue-menu-detail,.merlin-scripts-create-label,.merlin-scripts-create-submit,.merlin-scripts-create-input,.merlin-scripts-create-hint,.merlin-scripts-create-panel option,.merlin-scripts-create-panel [role=alert]",
    fields: [
      "text",
      "aria-label",
      "title",
      "placeholder"
    ],
    entries: {
      "Create a script": "创建脚本",
      Kinds: "类型",
      "Back to kinds": "返回类型选择",
      Graph: "节点图",
      "New graph": "新建节点图",
      "New python": "新建 Python 脚本",
      "New skill": "新建技能",
      "New subscript": "新建子脚本",
      Subscript: "子脚本",
      Skill: "技能",
      Folder: "文件夹",
      "Import…": "导入…",
      "#51:38ebbf44e9c73da7": "创建并打开一个空白节点图。",
      "#65:45666118fa5cc8ce": "创建带图像输入和输出的 Python 脚本。",
      "#88:ba64a64b4be2948a": "用 Python 调用 merlin.generate_image、merlin.op 等 Canvas 操作。",
      "#109:f62c13ff64c55df0": "保存可复用的智能体指令，供画布和对话选用。",
      "#55:9398397ed0781ea7": "创建文件夹以分类存放脚本。",
      "#100:95162c9b3f50f66c": "可导入 .graph.json、.customnode、.md，也支持把多项放入同一个 ZIP。",
      Name: "名称",
      "Folder name": "文件夹名称",
      "New Skill": "新技能",
      Library: "资源库",
      "Local (yours)": "本地（个人）",
      "Shared (the team's)": "共享（团队）",
      "#92:822203599f7a5109": "技能 ID 取自 Skills 下包含 SKILL.md 的目录名，支持小写字母、数字和连字符。",
      "#81:2cc7ee66e3ed5e60": "ID 可用小写字母、数字与单个连字符，例如 character-sheet。",
      "Create graph": "创建节点图",
      "Create script": "创建脚本",
      "Create Subscript": "创建子脚本",
      "Create skill": "创建技能",
      "Creating…": "正在创建…"
    }
  },
  {
    selector: ".agent-onboarding h2,.agent-onboarding-content > p,.agent-onboarding details p,.agent-onboarding summary,.agent-onboarding button,.agent-onboarding button > span,.agent-onboarding-choice small,.agent-onboarding-choice .onboarding-choice-copy > strong,.agent-onboarding-notice,.agent-onboarding-card > small,.agent-onboarding-card > span,.agent-onboarding label,.agent-onboarding li,.agent-onboarding option,.agent-onboarding,.agent-welcome,.agent-welcome-examples",
    fields: [
      "text",
      "aria-label",
      "title"
    ],
    entries: {
      "Connect your agent": "连接你的智能体",
      "Choose your connection": "选择连接方式",
      "#49:892258a8e6067855": "选择现有智能体或添加新连接。",
      "Checking installed agents…": "正在检查已安装的智能体…",
      "#28:dd7c26530750abc3": "连接本机命令行客户端",
      "Other providers": "其他提供商",
      "#36:b5ba46bd621f379d": "使用企业账号或 API 连接",
      "#62:3de66a40efe230e4": "沿用提供商原有的账号设置。",
      "Set up previously:": "此前已配置：",
      Connect: "连接",
      "another provider": "其他提供商",
      "#65:c89a8b3e22b3aba8": "先登录对话提供商，或添加连接凭据。",
      "#45:b3c2cc6c195658ad": "沿用本机已有配置。",
      "#51:a2b378eb9f4238a0": "连接服务器以发现智能体。",
      "Installed · account not checked": "已安装 · 账号尚未检查",
      "Not found": "未找到",
      "#104:dbaa865c5c9b1e6c": "沿用本机 CLI 的登录、连接及组织设置。",
      "Show sign-in steps": "查看登录步骤",
      "Show installation steps": "查看安装步骤",
      "I’ve finished · Check again": "已完成，重新检查",
      "Advanced · local configuration": "高级选项 · 本地配置",
      "Chat context": "对话上下文",
      "Personal configuration": "个人配置",
      "Clean context": "空白上下文",
      "#64:2785a45f2c7608c1": "本机尚无可用的对话提供商配置。",
      "Loading providers…": "正在加载提供商…",
      "Connect an external agent instead": "改用外部智能体",
      "#82:37c4ac535453e846": "在「帮助 → 连接智能体」中让外部 MCP 客户端连接 Canvas。",
      "Check connection": "检查连接",
      "#64:5d5fa45f34657cdb": "检查运行工具和模型目录，此步不发送对话。",
      "Checking your connection": "正在检查连接",
      "Waiting for a reply": "正在等待回复",
      "One last check": "最后检查",
      "Model for your first chat": "首次对话使用的模型",
      "Provider configuration loaded": "已加载提供商配置",
      "Local runtime connected": "已连接本地运行环境",
      "#33:3d0a30aad6252f0a": "账号响应尚待验证",
      "Send test message": "发送测试消息",
      "#99:e738fa2cb1363f93": "测试使用你的提供商账户，可能产生正常请求费用。测试仅验证连接。",
      "#38:e9ed0b37be8c0b45": "打开任一画布后可测试连接。",
      "#17:18fb99c4ce3a319d": "连接成功。",
      "#116:02ce1ffd17a1b0bc": "可开始对话。现有提供商设置已保留，模型、权限和推理强度可在对话中更改。",
      "Return to provider setup": "返回提供商设置",
      Done: "完成",
      "Set up another provider": "设置其他提供商",
      "Welcome to your canvas agent": "欢迎使用画布智能体",
      "Things I can help with": "我能帮你做什么"
    }
  },
  {
    selector: ".merlin-ops-group-action,.merlin-ops-stop,.merlin-ops-status-label,.merlin-rail-pin,.merlin-inspector-notice,.merlin-inspector-notice button,.merlin-rail-preview-label,.merlin-rail-preview-label-text,.merlin-rail-preview-grip,.agent-detail-actions > button,.agent-detail-tabs > button,.agent-detail-muted,.agent-detail-state",
    fields: [
      "text",
      "title",
      "aria-label"
    ],
    entries: {
      "#40:eba2cddf661296e6": "清除全部画布的已完成项",
      "#39:b5a4f97e8526682d": "清除当前画布的已完成项",
      "Started elsewhere": "在其他位置启动",
      "Stopping…": "正在停止…",
      Stopping: "正在停止",
      "Stop this operation": "停止此操作",
      "Unpin this card": "取消固定此卡片",
      "Pin this frame": "固定此框架",
      "Unpin this frame": "取消固定此框架",
      "#50:ab66c012b2f4e629": "固定此卡片，切换选择后仍可查看。",
      "#51:ab98676c51c600ac": "固定此框架，切换选择后仍可查看。",
      "#31:4315fd5a3282cb9a": "创建新版本的准备工作失败。",
      "#29:7936cb84fc50b21a": "新版本未能放到画布上。",
      "#91:f1a758c7fedf8763": "结果将另置于原卡片旁。此次运行没有输出时仍选中原卡片。",
      "#110:5d7f726baeb99b27": "原结果及其参数会保留，修改后运行将另建相邻版本。",
      "Unlock the canvas to run": "解锁画布后即可运行",
      "#49:f3986f9fad03989e": "按当前参数运行并另建版本",
      "Run as new take": "运行并创建新版本",
      "#71:57341ade82f422be": "执行中。完成后可查看结果、版本和来源。",
      "#81:5f233382a3ad1bec": "尚未执行，将使用下方输入和提示词。",
      "Hide the output preview": "隐藏输出预览",
      "Show the output preview": "显示输出预览",
      "Drag to resize the preview": "拖动以调整预览大小",
      Output: "输出",
      "Saved work": "已保存的工作",
      "Resume task": "继续任务",
      "View lead": "查看负责人",
      "No recent update": "最近没有更新",
      "#61:35ddb48d328b0771": "对话已关闭，历史消息仍可查看。"
    }
  },
  {
    selector: ".merlin-console-filter input,.merlin-console-filter button,.merlin-console-filter .custom-select span,.merlin-console-output,.merlin-console-empty,.session-toolbar button,.merlin-session-console > div,.merlin-session-console > div > button",
    fields: [
      "text",
      "aria-label",
      "title",
      "placeholder"
    ],
    entries: {
      "Filter live logs": "筛选实时日志",
      "Filter output": "筛选输出",
      "Log level": "日志级别",
      "All levels": "所有级别",
      Log: "日志",
      Info: "信息",
      Debug: "调试",
      Warnings: "警告",
      Errors: "错误",
      "Clear output": "清空输出",
      "Live Unreal Canvas output": "Unreal Canvas 实时输出",
      "#32:ef24debb882118fc": "没有符合条件的输出记录。",
      "Waiting for Unreal Canvas output…": "正在等待 Unreal Canvas 输出…",
      "Loading Python console…": "正在加载 Python 控制台…",
      "#44:357972a509a4f993": "在 Python 工作区交互调用 merlin API。",
      "New session": "新建会话",
      "#50:d84ec18dabcf9374": "创建独立的 Python 进程、变量空间与工作目录。",
      "Python session": "Python 会话"
    }
  },
  {
    selector: ".nodrag.nowheel:is([aria-label='Library filters'],[aria-label='资源库筛选'],[aria-label='Script filters'],[aria-label='脚本筛选'])",
    fields: [
      "aria-label"
    ],
    entries: {
      "Library filters": "资源库筛选",
      "Script filters": "脚本筛选"
    }
  },
  {
    selector: ".nodrag.nowheel:is([aria-label='Library filters'],[aria-label='资源库筛选'],[aria-label='Script filters'],[aria-label='脚本筛选']) > .ue-menu:first-child > :is(.ue-menu-heading,button),.nodrag.nowheel:is([aria-label='Library filters'],[aria-label='资源库筛选'],[aria-label='Script filters'],[aria-label='脚本筛选']) > .ue-menu:first-child > button > .ue-menu-label,.nodrag.nowheel .ue-menu-note",
    fields: [
      "text",
      "aria-label",
      "title"
    ],
    entries: {
      "Filter by": "筛选条件",
      Person: "人员",
      Age: "时间",
      Votes: "投票",
      "Custom Filter…": "自定义筛选…",
      Saved: "已保存",
      Starred: "已加星标",
      Tag: "标签",
      "Filter by folder": "按文件夹筛选",
      "Filter by location": "按位置筛选",
      "Filter by output": "按输出筛选",
      "Filter by tag": "按标签筛选",
      "Filter by type": "按类型筛选",
      "#32:ef54f2741a339fe9": "仅查看本画布引用的脚本",
      "#20:7ffd20a3f486ab70": "仅查看收藏的脚本",
      "#69:9a4780096c8fcb8b": "尚无已保存的筛选。请在「自定义筛选」中命名并保存。"
    }
  },
  {
    selector: ".media-library-empty strong,.media-library-empty p,.outliner-empty,.media-library-message,.media-library-results,.media-library-more",
    fields: [
      "text",
      "aria-label"
    ],
    entries: {
      "Nothing selected": "尚未选择内容",
      "#58:bef3b18b624105e6": "选择画布卡片或框架即可预览媒体。",
      "No media yet": "尚无媒体",
      "#67:31ee5e1c0e859164": "在这里添加媒体，或转到「位置 → 我的画布」。",
      "#52:6794a9060e64463d": "画布上导入与生成的媒体会在此列出。",
      "No matching saved hands": "没有匹配的已保存手牌",
      "No saved hands": "尚无已保存的手牌",
      "#70:d5b35a33a8011243": "可按手牌名称或卡片名称重新搜索。",
      "#182:6a58c1ab06c7b5c0": "在画布边缘右键手牌可将其存入库。已保存的手牌可再次拿取、粘贴或用作生成输入。",
      "Saved hands": "已保存的手牌",
      "Archived cards": "已归档的卡片",
      "No matching archived cards": "没有匹配的已归档卡片",
      "Nothing archived": "尚无已归档的卡片",
      "#19:f5be8a911636e01b": "换一个关键词再试。",
      "#171:dee51c9c4e3999a9": "含生成结果的卡片删除后会归档。恢复时会一并找回节点图、输入和输出。",
      "#16:3ced7a02ae09c6b0": "当前画布没有卡片。",
      "#16:1951eaac57c17323": "未找到结果。",
      "Discovering media…": "正在查找媒体…",
      "Show more (": "显示更多（剩余",
      "remaining)": "项）"
    }
  },
  {
    selector: ".media-library .merlin-panel-icon-button,.media-library-size,.media-library .merlin-key-picker,.media-library .merlin-content-view-controls button,.media-library input,.media-library-hand-save,.media-library-hand-card-remove,.merlin-navigator-tree-actions button,.merlin-panel-chip",
    fields: [
      "title",
      "aria-label",
      "placeholder"
    ],
    entries: {
      "Limited to the selected cards": "仅限选中的卡片",
      "#37:e59a654e2f383cc9": "只显示资源库所选项",
      "#29:6b54aac512a20d50": "归档卡片请使用平铺视图。",
      "Back to the Library": "返回资源库",
      "#96:2134e5868863a366": "查看并恢复仍含生成媒体的已删卡片。",
      "Search archived cards": "搜索已归档的卡片",
      "Search archived cards or canvases…": "搜索已归档的卡片或画布…",
      "Search hands or their cards…": "搜索手牌或其中的卡片…",
      "Search saved hands": "搜索已保存的手牌",
      "#30:7f476c1bb934c616": "在平铺视图仅显示选中项",
      "Thumbnail size — Tile view": "缩略图大小（平铺视图）",
      "#44:d1761aba66029bbe": "在列表中按画布框架分组",
      "Archived cards are one list": "已归档的卡片显示在同一个列表中",
      "#81:3ba590ab3519d73d": "复制边缘所有手牌到库，保留画布原件。",
      "#36:eec9920b120690ea": "从手牌副本移除此卡片。",
      "Expand all": "全部展开",
      "Collapse all": "全部折叠"
    }
  },
  {
    selector: ".merlin-session-console:not(.has-session) .session-toolbar .custom-select[data-value=''] > span > span[aria-hidden='false'],[role='listbox']:is([aria-label='Python session'],[aria-label='Python 会话']) > [role='option'][data-value=''] > span",
    fields: [
      "text"
    ],
    entries: {
      "no sessions": "暂无会话"
    }
  },
  {
    selector: ".session-toolbar button,.session-input-grip,.session-input button,.session-transcript button,.session-workspace > div:first-child,.session-transcript > div:has(> code):first-child",
    fields: [
      "text",
      "title",
      "aria-label"
    ],
    entries: {
      "#78:a871d0d81cc34b7c": "重启解释器并清空变量，保留工作区文件。",
      "#123:b2741360a428f3f4": "中止代码并退出解释器。变量将清空，文件会保留；点击播放键可重新启动。",
      "#87:b9d73a1e8731b091": "删除该会话及其工作区，保留已发送到画布的结果。",
      Workspace: "工作区",
      "Try:": "可以试试：",
      "— API overview": "— API 概览",
      "Your own .py helpers in": "存放在",
      "#15:36acfb8da9d6f3ea": "中的 Python 辅助文件可用模块名导入。",
      "#95:019c6c4de4f14269": "载入这条历史代码，Ctrl+Enter 执行。输入区内按上键可浏览历史。",
      "Drag to resize the input": "拖动以调整输入区大小",
      "#42:5adcde0e2b09c9cd": "打开并执行 .py 文件",
      "#47:29811ac4b2b505f0": "将本会话执行过的代码导出为 .py",
      "run .py": "运行 .py",
      "save .py": "保存 .py",
      Run: "运行"
    }
  },
  {
    selector: "[role='listbox']:is([aria-label='Log level'],[aria-label='日志级别']),[role='listbox']:is([aria-label='Log level'],[aria-label='日志级别']) > [role='option'][data-value] > span,.merlin-live-logs .custom-select > span > span",
    fields: [
      "text",
      "aria-label"
    ],
    entries: {
      "Log level": "日志级别",
      "All levels": "所有级别",
      Log: "日志",
      Info: "信息",
      Debug: "调试",
      Warnings: "警告",
      Errors: "错误"
    }
  },
  {
    selector: "[role='listbox']:is([aria-label='Python session'],[aria-label='Python 会话'])",
    fields: [
      "aria-label"
    ],
    entries: {
      "Python session": "Python 会话"
    }
  },
  {
    selector: ".merlin-key-picker[data-testid='thumbnails-sort-by'] .merlin-key-picker-value",
    fields: [
      "text"
    ],
    entries: {
      "Recently used": "最近使用",
      "Most used": "使用最多"
    }
  },
  {
    selector: ".merlin-scripts .merlin-panel-group-icon,.merlin-content-modes button",
    fields: [
      "aria-label",
      "title"
    ],
    entries: {
      "Sort by": "排序方式",
      "Group by": "分组方式",
      "Script details": "脚本详情"
    }
  },
  {
    selector: "body:has(.merlin-scripts :is([data-testid='thumbnails-sort-by'],[data-testid='thumbnails-group-by']):focus) .ue-menu.nokey.nodrag .ue-menu-item .ue-menu-label",
    fields: [
      "text"
    ],
    entries: {
      "Most used": "使用最多",
      "Recently used": "最近使用",
      Tag: "标签"
    }
  },
  {
    selector: ".merlin-rail-body-content:has(.merlin-scripts) > .ue-menu[data-portal-popup] > div > .ue-menu-item > .ue-menu-label",
    fields: [
      "text"
    ],
    entries: {
      Star: "加星标",
      Unstar: "取消星标",
      "Export as JSON…": "导出为 JSON…",
      "Export script": "导出脚本",
      "Export…": "导出…",
      "Reset Graph Card": "重置节点图卡片",
      "Copy to Shared": "复制到共享库",
      "Update Team copy": "更新团队副本",
      "Reload from file": "从文件重新加载",
      "Keep mine": "保留我的版本",
      "Save mine as a copy": "将我的版本另存为副本"
    }
  },
  {
    selector: ".media-library .merlin-panel-chips > .merlin-panel-chip:first-child",
    fields: [
      "title",
      "text"
    ],
    entries: {
      "On this canvas": "当前画布",
      "On my canvases": "我的画布",
      "In open tabs": "已打开的标签页",
      Archived: "已归档"
    }
  }
];

// src/locales/settings-extra.json
var settings_extra_default = [
  {
    selector: ".settings-window-body main span",
    fields: [
      "title"
    ],
    entries: {
      "#67:199139d3e1c3a05a": "新工作流与自定义节点的默认保存目标为本地库。",
      "#55:04d59ce8d290cab0": "此库的内容仅本机可用。",
      "#61:c0829118b4cf1631": "请先指定目录，工具面板才能显示其中的内容。",
      "#79:e7a17bc8739013e1": "已连接同一共享库的成员都可浏览你发布的项目。",
      "#92:f7d9798fd6ff4610": "目标库已有同 ID 画布。若要替换，请启用“覆盖”。",
      "#78:53e88ccb5dac2277": "导入时会一并复制下列子图和快照。",
      "#295:75a7add433a3286c": "受信任目录的更新若未增加权限请求，且无可执行代码或已通过目录审核，可按现有授权自动应用。其他情况需再次确认。"
    }
  },
  {
    selector: ".settings-window-body main input",
    fields: [
      "title"
    ],
    entries: {
      "#98:eaf598da6f459fe6": "这是当前用户的内置库，搜索始终包含它。工作流与自定义节点分目录保存。"
    }
  },
  {
    selector: ".settings-window-body main button",
    fields: [
      "title",
      "aria-label"
    ],
    entries: {
      "#43:399acae51577a7a7": "在资源管理器中查看本地库",
      "#37:e0320233b736df32": "在资源管理器中查看该目录",
      "#41:25651b7e7232bc35": "选作新建项目的保存位置",
      "#83:8e23b2c356f46c54": "取消使用此共享目录。已有文件继续保存在原处，默认目录需另行指定。",
      "Filter models": "筛选模型",
      "#39:9306166c83f743be": "此项能力默认使用的模型",
      "Move group up": "上移分组",
      "Move group down": "下移分组",
      "Delete group (fields become hidden)": "删除分组并隐藏其中的字段",
      "Show this field": "显示此字段"
    }
  },
  {
    selector: ".settings-window-body main input",
    fields: [
      "aria-label"
    ],
    entries: {
      "Search project reviews": "搜索项目审阅",
      "Search Dictation settings": "搜索语音输入设置",
      "Filter shortcuts": "筛选快捷键",
      "Search External Paths settings": "搜索外部路径设置",
      "Catalog folder or address": "目录文件夹或地址",
      "Search models": "搜索模型",
      "Search services": "搜索服务",
      "Search Default Models settings": "搜索默认模型设置"
    }
  },
  {
    selector: ".settings-window-body main input",
    fields: [
      "placeholder"
    ],
    entries: {
      "Search reasons and captured context": "搜索原因和记录的上下文",
      "Search Dictation…": "搜索语音输入…",
      "#27:5e4270cb566d81c6": "输入共享链接或房间 ID",
      "Search External Paths…": "搜索外部路径…",
      "#12:c67d894be64cfa06": "（由应用自动查找）",
      "#54:74654589214bf556": "（默认采用工作脚本旁的 .venv）",
      "#59:875fbbbf9ff0a174": "（默认路径为工作目录下的 langsam-worker/langsam_worker.py）",
      "Search the catalogs…": "搜索目录…",
      "Search the sources…": "搜索来源…",
      "#39:1a7c9089afe78ace": "输入目录路径或 HTTPS 网址",
      "Search models…": "搜索模型…",
      "Search services…": "搜索服务…",
      "Search Default Models…": "搜索默认模型…"
    }
  },
  {
    selector: ".settings-window-body main button",
    fields: [
      "aria-label"
    ],
    entries: {
      "Review decision filter": "按审阅决定筛选",
      "Review actor filter": "按审阅人筛选"
    }
  },
  {
    selector: ".settings-window-body main div",
    fields: [
      "text"
    ],
    entries: {
      "matching records": "条匹配记录",
      "#54:959cb972985b1942": "新增字段排在第一组末尾，初始仅在",
      "#188:34bd311c90890d3e": "布局中显示。节点图或提示布局可手动拖入。即使字段已弃用，已有元素仍可读取其旧值。",
      "#95:6f30732e80e50d26": "使用已有标签名会合并标签，并把引用转到保留项。",
      "#97:fa3dc2f65155a079": "使用已有用户名会合并用户，并把分配记录归到保留项。",
      "#73:d00a552de3b1d401": "当前目录就是导入来源。",
      "#256:c16832c96f09c380": "选择要导入的工作区。未选项留在原处。被选中画布引用的子图和快照会随它导入。",
      "#37:d987b1375e34a390": "浏览来自各个目录的扩展和插件。",
      "#44:839fb54f7eba7951": "请先到“来源”添加扩展目录。",
      "#112:3079a9b79f9b059b": "在这里管理“可获取”页面的来源。可使用本地文件夹，或提供以下文件的 HTTPS 目录：",
      "#35:870c7b7cfaa4b3b9": "（填写目录地址时请省略",
      "#31:d26f6cc1b659d0f3": "）。目录也可引用其他目录。",
      "#256:6b3bcfd39df1dd22": "受信任目录中的扩展安装后即可运行。其他来源须单独批准，子目录也要分别授权。已批准的扩展更新后，还应满足以下条件：",
      "#87:d4dd84de9be9105b": "权限请求未增加，而且无可执行代码或已通过目录审核",
      "#56:2706bedc321401d0": "请填写文件夹路径或 HTTPS 地址来添加第一个目录。"
    }
  },
  {
    selector: ".settings-window-body main p",
    fields: [
      "text"
    ],
    entries: {
      "#64:e3a388e409718024": "可为智能体聊天、提问与审阅反馈启用语音输入。",
      "#129:dc0729a0590284f1": "选择标签、团队、负责人、评分和自定义字段在各界面的显示方式。",
      "#245:fdd67e166041645a": "导出或导入画布的字段布局、组件、标签和人员等配置。导入会替换布局并补充缺项，已有条目会保留。",
      "#144:992ad50f59baca3e": "为当前画布扩展内置字段。各布局共用定义，显示位置可单独安排。",
      "#73:b957749d6bb40257": "在这里管理画布标签，也可以从卡片的标签选择器直接新增。",
      "#57:2149c1825fc06bb2": "管理此画布的团队。每张卡片只能分给一个团队。",
      "#62:7af005cb611def9c": "设置可分配人员，同一卡片可以有多位负责人。",
      "#193:caac1baf2b4e1621": "指定外部程序与 Python 工作进程的位置。数据根目录见“存储”，工作流库位置见“偏好设置”。",
      "#178:e3213af27d7945cf": "通过 TCP 接收 OpenCV 摄像头画面。采集节点会按需启动服务，也可手动启动。需要 Python 3 与 opencv-python。",
      "#226:f8d77be32df19b9c": "将旧用户目录中的画布、输出和截图复制到当前工程。源数据保留，已导入的数据块和索引版本会跳过。",
      "#139:6898c5e2c2225909": "查看可用模型、服务商路由和连接状态。星标可指定默认模型，也可开启模型审批。",
      "#171:341a57d6c1cbdc2f": "每个“模型＋服务商路由”对应一个 JSON 定义。可新建、复制派生、编辑或恢复默认定义。",
      "#64:fc33265db1b1c540": "每行代表一份可维护的模型定义，支持新增、派生、编辑及重置。打开",
      "#44:ca2cbf1217e7c712": "查看模型列表。",
      "#151:f508e60d01377fc1": "将检查器字段拖到所需分组。要取消显示，请拖到“隐藏”。",
      "#164:ca35644fac184224": "提示字段均为只读，按下方顺序排列，实际提示中省略组名。"
    }
  },
  {
    selector: ".settings-window-body main label",
    fields: [
      "text"
    ],
    entries: {
      "Speech recognition model": "语音识别模型",
      "Voice shortcut behavior": "语音快捷键行为",
      "Filtered-out card opacity": "筛选隐藏的卡片不透明度",
      "LangSAM CUDA GPU index": "LangSAM CUDA GPU 编号",
      Port: "端口",
      "Server status": "服务状态",
      Server: "服务",
      "#47:99eea010cb2ff9e0": "覆盖目标目录中的同 ID 画布",
      "Require model approval": "需要模型审批"
    }
  },
  {
    selector: ".settings-window-body button.custom-select span",
    fields: [
      "text"
    ],
    entries: {
      "#44:cffc8bac016c906f": "Base（默认），速度优先、内存需求低",
      "#42:cb34e27a55a5f00b": "Small，兼顾准确度与内存",
      "#51:c14a2f8d7af6687b": "Large v3 Turbo，多语言精度较高，需更多内存",
      "#49:95b5402458258670": "Distil Large v3.5，针对英语，需更多内存",
      "Listen while Ctrl is held": "按住 Ctrl 时录音",
      "Listen until stopped": "持续录音直至手动停止",
      "sam2.1_hiera_tiny (fastest, lower quality)": "sam2.1_hiera_tiny（速度最快，质量较低）",
      "sam2.1_hiera_small (balanced)": "sam2.1_hiera_small（均衡）",
      "#45:84d9b5b365dbb86a": "sam2.1_hiera_large（最高质量，耗时最长）"
    }
  },
  {
    selector: ".settings-window-body main > div > div div",
    fields: [
      "text"
    ],
    entries: {
      "#114:e96b83b74891f4a5": "查看 Canvas 快捷键，各行列明适用位置。",
      "#53:4a19b1bc777cbe9c": "用快捷键切换工具，Esc 切回选择。",
      "#20:f2525c7c17866fee": "锁定画布时",
      "#62:33d26a09069e7a7e": "锁定画布时，已执行而锁定的节点图例外",
      "Back to the Select tool": "返回选择工具",
      "#50:39ee8de2edeffb21": "退出当前的框架、文字、评论或连线工具。",
      "Middle-button drag to zoom continuously": "拖动鼠标中键连续缩放",
      "#147:764da16b98a5ac59": "按住 Alt 和中键或对应笔键拖动。向右或向上放大，反向缩小，缩放中心是起拖点。",
      "over the canvas": "鼠标位于画布上时",
      "#110:f5da266f935c3729": "将选中的卡片、框架或便签完整放入视野。未选择时显示整幅画布。",
      "#100:c0440d9628fcf7ad": "调整缩放以容纳整幅画布，选区不会改变取景范围。",
      "#36:c307a9436a635fea": "进入所选子画布或节点图",
      "#207:59b403a22c47b594": "进入子画布、工作流或其节点图，相当于点击卡片上的打开按钮。卡组另有展开按钮。",
      "#81:3d98102743645c99": "回到父画布，可连续使用直至顶层。",
      "#76:f74ee1fb83e18acf": "收回侧栏、查看器或卡组，或回到父画布",
      "#194:27138038e2eef6de": "依次收回全画布查看器、退出查看工具与对比、关闭查看器、由内向外折叠卡组，再回父画布。",
      "#66:a14fc2ef845a34fe": "编辑文字时全选文本，焦点在画布上时选择画布项目。",
      "#253:2f11eee01caf9a9f": "优先复制正在编辑的选中文字，否则复制所选卡片及连线或文本框。已离开文本框的旧选区会忽略。",
      "#100:e0fd34be9b3a21f9": "粘贴已复制的卡片或文本框。剪贴板中的图片会成为新卡片。",
      "#92:c7bd6aedc7847d7a": "画布锁定时，仍可向已执行而锁定的节点图粘贴文本框",
      "#108:20c3ab51f846f512": "按阅读顺序将至少两张卡片排列成等距的一行，也可使用“排列 → 自动对齐”。",
      "Delete the selection": "删除选中内容",
      "#152:bd15a3f90c85bfe4": "删除选中卡片及其连线。未选卡片时删除所选便签或连接线，锁定项保留。",
      "#23:74a9e1c707bcbd92": "卡片查看器打开时",
      "#40:08edcb67d171ac13": "自由缩放尺寸",
      "#205:19f31c3f7e3cda4d": "默认等比调整卡片以及图像、视频节点。拖动手柄时按住此键可拉伸，松开即可恢复等比。",
      "#32:33982b8df00b3a35": "放弃正在拖动的连接",
      "#80:cf16e0624a7d28ba": "中止连线操作并回到画布。",
      "while dragging a wire": "正在拖动连线时",
      "Card views, versions and compare": "卡片视图、版本和对比",
      "#60:0c7897fe69494870": "切换所选卡片或媒体库项目的查看器",
      "#141:8a1118305f757eca": "两个可配对项目使用 A/B 滑动对比，跨类型使用分屏。选择三项及以上时采用网格。",
      "Compare the selected cards": "对比选中的卡片",
      "#88:f2242170d44d98db": "两张卡片可滑动对照，三张以上按选择顺序网格排列。",
      "Step through versions": "切换版本",
      "#53:61d2df6bc0f2551b": "选中有多个版本的单张卡片时",
      "#33:02fd785e4e2f323f": "移动 A/B 对比的 B 侧",
      "while comparing two results": "对比两个结果时",
      "Jump to a bookmarked version": "跳转到带书签的版本",
      "#54:5ae563393c1eaab5": "切换到当前数字绑定的版本。",
      "#40:208def734cb64a69": "选择一张卡片或打开查看器时",
      "#37:413492d018c57207": "给指针所指版本添加书签",
      "#107:e7e3406d0a14ca9b": "指向版本栏中的一项，按数字键设置快捷书签，再按相同数字即可取消。",
      "Clear the hovered version's bookmark": "清除指针下版本的书签",
      "Step one video frame": "视频逐帧步进",
      "#63:74cc3dfaf5e214c0": "逐帧浏览时用逗号退一帧，用句号进一帧。",
      "in a video viewer": "在视频查看器中",
      "Toggle draw mode": "切换绘制模式",
      "while an image is maximized": "图像已最大化时",
      "Show or hide the annotation": "显示或隐藏批注",
      "#37:cd9dc06b45c92002": "批注图像处于最大化时",
      "#34:005cc8ba411baa6b": "撤销或恢复最近一笔",
      "in draw mode": "在绘制模式下",
      "#28:396e3ce6579bd425": "确认裁剪、旋转或翻转",
      "#56:7fb56d687888cce6": "Esc 放弃编辑并保留之前的结果。",
      "in crop mode": "在裁剪模式下",
      "Panels and search": "面板和搜索",
      "#180:5a11707b3f8e0922": "打开智能体提问框，并带入所选画布内容。若尚未配置智能体，可先保留问题再前往设置。各系统均使用 Ctrl。",
      "#37:03901a26c853cf40": "焦点位于输入框与工具架之外时",
      "Talk to the agent": "与智能体对话",
      "#547:8aac814f1d813a52": "在当前输入处听写。可用时优先写入浮动对话或消息面板，否则带选区打开提问框。审阅按钮可直接打开语音反馈。未配置智能体时可先保留问题。默认按住 Ctrl 录音、松开保存草稿，也可在语音设置改成持续录音。Enter 完成并发送，Esc 取消。",
      "Search this graph": "搜索当前节点图",
      "#78:d6b7aec0552b3a35": "在文本字段内也可打开节点图搜索，会接管浏览器的查找快捷键。",
      "Open the canvas browser": "打开画布浏览器",
      "#97:d553a8374cbeaac5": "列出可打开的画布。在正在输入的字段或代码编辑器内无效。",
      "Move the floating toolshelf": "移动浮动工具架",
      "#56:abf1574e5f72cf56": "每次移动 10 像素，配合 Shift 为 40 像素。",
      "#53:5c80a5210ef27525": "浮动工具架的移动手柄获得焦点时",
      "Resize the floating toolshelf horizontally": "水平调整浮动工具架的宽度",
      "#73:20fe3a889de41ecd": "每次移动当前边缘 10 像素，按住 Shift 时为 40 像素。",
      "#51:7cc13c2803c78aca": "浮动工具架的缩放手柄获得焦点时",
      "Generate from the toolshelf": "从工具架生成",
      "while editing toolshelf inputs": "正在编辑工具架输入项时",
      "#69:1cdfe38a55fc4983": "画布锁定、输入尚未填好或正在生成时",
      "Recall previous agent messages": "调出以往的智能体消息",
      "#98:96b2ffcb0a8f7539": "上键查更早的消息，下键向后翻直至空白草稿。开始修改即可退出浏览。",
      "#65:ac3eb58d05eff35a": "智能体输入框为空或正回看已发消息时",
      "#42:b15860040e48f8ec": "正在选择文字或选择要提及的对象时",
      "Stop the chat agent": "停止对话智能体",
      "#69:3c67153cbc008447": "同时收起等待批准的请求，保留输入框里的草稿。",
      "#86:e08370b65b3c89c7": "智能体运行时，焦点在浮窗、消息面板或工具架的输入框内",
      "#53:c79fa56e9c1c5d3a": "Esc 优先退出提及菜单或当前听写。",
      "Go to the next match": "转到下一处匹配",
      "in the search panel": "在搜索面板中",
      "Go to the previous match": "转到上一处匹配",
      "Close the search panel": "关闭搜索面板",
      "#109:a86ebd6c24428357": "在时间线内、且未编辑文字时可用。滚动条使用单独的导航键。",
      "Play or pause timeline": "播放或暂停时间线",
      "#43:70e785f7ddbc1a9c": "沿时间线单帧前进或后退",
      "outside the timeline scrollbar": "焦点在时间线滚动条之外时",
      "Go to timeline start": "转到时间线起点",
      "Go to timeline end": "转到时间线终点",
      "Split selected clip at playhead": "在播放头处拆分所选片段",
      "with a timeline clip selected": "已选中时间线片段时",
      "#51:5aa33fdbf18cfb93": "移除选中的轨道、区段或关键帧",
      "#122:b3b46683e260002a": "先选中轨道标题、区段或关键帧。删除轨道会连同其区段一起删除，可撤销。",
      "Undo timeline edit": "撤销时间线编辑",
      "Redo timeline edit": "重做时间线编辑",
      "#33:fa04d790b7fdcbeb": "选中片段并定位到片头",
      "with a timeline clip focused": "焦点在时间线片段上时",
      "#39:23b360514e8d2326": "中止时间线拖动或取消选择",
      "#81:285af7f470397c0a": "滚动条获得焦点时只取消拖动，当前选择仍保留。",
      "#40:520d77954488c9b7": "将画布媒体加入时间线",
      "#88:7014f199319c126a": "按住 Alt 拖动视频或音频到轨道。在轨道边缘松开可新建一轨。",
      "#49:09bb9646f2f28e25": "用鼠标滚轮横向浏览时间线",
      "over the timeline tracks": "鼠标在时间线轨道上时",
      "Adjust visible timeline range": "调整时间线的可见范围",
      "#35:0e9eebe6224f7bfc": "拖动中央可平移，两端可调整缩放。",
      "#41:18b92293e560b8d3": "时间线滚动条获得焦点时",
      "#45:73339d9458bd5e6f": "较大幅度地改变时间线显示范围",
      "Adjust timeline panel height": "调整时间线面板高度",
      "#36:a44fcd22a3f3cf35": "向上增加面板高度，向下减小。",
      "#40:da1fb3ea24260359": "面板顶部的缩放手柄获得焦点时",
      "#44:0ef775958c38b8a3": "以较大步长调整时间线高度",
      "#57:c94db2eab1335416": "将时间线滚动条定位到首端或末端",
      "Fit timeline in view": "让整条时间线适应视图",
      "#53:b72f00848cf5042b": "双击滚动条可一次显示全段。",
      "Open timeline context menu": "打开时间线右键菜单",
      "#131:e17ebb2f1480efd1": "右键打开所选轨道、区段或关键帧的菜单。用方向键浏览、Enter 执行、Esc 退出。",
      "Editing text": "编辑文本",
      "#84:f43a55869bd3658f": "双击便签或文本卡片后，可在编辑时使用此操作。",
      "Stop editing": "结束编辑",
      "#61:7aecdc449a9e7ed3": "保留当前选择，接下来可以直接拖动。",
      "Menus and pickers": "菜单和选择器",
      "Close the palette or dialog": "关闭面板或对话框",
      "Take the only remaining match": "选中唯一的匹配项",
      "#67:3b522671f5d16254": "筛选到单个结果后，按 Enter 确认。",
      "Place foreground points": "放置前景点",
      "#82:f56058cf58c3f107": "下一次点击将标出需要保留的前景区域。",
      "in the point picker": "在点选择器中",
      "Place background points": "放置背景点",
      "#85:25f75d302f82b49b": "下一次点击将标出要剔除的背景区域。",
      "Confirm the points": "确认选点",
      "Remove the selected points": "移除选中的点",
      "#38:62c2abda5c39795c": "取消点的选择，再退出",
      "#100:e5ced6394fabc564": "若有选中的点，先取消选择。再次使用即可关闭选点器。"
    }
  },
  {
    selector: ".settings-window-body .settings-group-header h3",
    fields: [
      "text"
    ],
    entries: {
      Tooltips: "悬浮提示",
      Cards: "卡片",
      Teams: "团队",
      Users: "用户",
      Components: "组件",
      Display: "显示",
      "Webcam Capture Server": "摄像头采集服务",
      "Model Approval": "模型审批",
      "Header Left": "标题栏左侧",
      "Header Right": "标题栏右侧",
      "Footer Left": "底栏左侧",
      "Footer Right": "底栏右侧"
    }
  },
  {
    selector: ".settings-window-body .settings-group-body > div > div",
    fields: [
      "text"
    ],
    entries: {
      tags: "个标签",
      "#23:8077c1d6087eb0ec": "还没有条目，可在这里添加",
      "#35:c4108a887c79c2fa": "，也可以到节点上新建",
      teams: "个团队",
      users: "位用户"
    }
  },
  {
    selector: ".settings-window-body .settings-group-body button.ui-btn",
    fields: [
      "text"
    ],
    entries: {
      tag: "标签",
      team: "团队",
      user: "用户",
      "+ Add group": "+ 添加分组"
    }
  },
  {
    selector: ".settings-window-body main span",
    fields: [
      "text"
    ],
    entries: {
      "#72:58010b8484368851": "启动中… 等待姿态拟合进程完成启动或重启"
    }
  },
  {
    selector: ".settings-window-body .settings-row-value span",
    fields: [
      "text"
    ],
    entries: {
      "Not running": "未运行"
    }
  },
  {
    selector: ".settings-window-body main button.ui-btn",
    fields: [
      "text"
    ],
    entries: {
      "Start Server": "启动服务"
    }
  },
  {
    selector: ".settings-window-body main section:not(.settings-group) div",
    fields: [
      "text"
    ],
    entries: {
      "Legacy source": "旧版来源",
      "cached result file(s),": "个缓存结果文件，",
      "#6:10d3e1f61f15a389": "。",
      Destination: "目标位置",
      "#23:9c8ebe6184ecd39c": "（个人数据）",
      "Canvases to import (": "要导入的画布（",
      of: "/",
      "pulled in automatically": "自动随同导入",
      "#78:913dd799b3e8103c": "的画布，以及属于该范围的缓存输出与截图。"
    }
  },
  {
    selector: ".settings-window-body main strong",
    fields: [
      "text"
    ],
    entries: {
      "Path:": "路径：",
      "Project id in source:": "来源项目 ID：",
      "Contents:": "内容：",
      "Project id:": "项目 ID："
    }
  },
  {
    selector: ".settings-window-body main em",
    fields: [
      "text"
    ],
    entries: {
      "none (no manifest)": "无（缺少清单）"
    }
  },
  {
    selector: ".settings-window-body main section:not(.settings-group) label > span[title]:not(:first-of-type)",
    fields: [
      "text"
    ],
    entries: {
      "already there": "已存在"
    }
  },
  {
    selector: '.settings-window-body main section:not(.settings-group) label > span[title="graph-library"]',
    fields: [
      "text"
    ],
    entries: {
      "Unplaced graphs": "未放置的节点图"
    }
  },
  {
    selector: ".settings-window-body main label",
    fields: [
      "title"
    ],
    entries: {
      "#150:e51be4c7d5a17730": "打开后可替换目标中的同 ID 画布。默认保留目标已有内容，便于多次导入共享目录。",
      "#117:1b366cc9be305fb9": "安装后须授权才能运行。画布会记录依赖的扩展，需要另行安装这些扩展。",
      "Start collapsed in the Inspector": "在检查器中默认折叠"
    }
  },
  {
    selector: ".settings-window-body main section:not(.settings-group) button.ui-btn",
    fields: [
      "text"
    ],
    entries: {
      Preview: "预览"
    }
  },
  {
    selector: ".settings-window-body main div",
    fields: [
      "aria-label"
    ],
    entries: {
      Extensions: "扩展",
      "What may happen without asking": "允许直接执行的操作",
      "Model catalog table": "模型目录表",
      "Model schemas table": "模型定义表"
    }
  },
  {
    selector: ".settings-window-body form label",
    fields: [
      "text"
    ],
    entries: {
      "Trust it": "信任此目录"
    }
  },
  {
    selector: '.settings-window-body form button[type="submit"]',
    fields: [
      "text"
    ],
    entries: {
      Add: "添加"
    }
  },
  {
    selector: ".settings-window-body .merlin-panel-summary",
    fields: [
      "text"
    ],
    entries: {
      "models ·": "个模型 ·",
      "ready to use": "个可用"
    }
  },
  {
    selector: '.settings-window-body main [role="region"] span',
    fields: [
      "text"
    ],
    entries: {
      "Replaced by": "替代模型",
      "✗ no credential": "✗ 缺少凭据"
    }
  },
  {
    selector: '.settings-window-body main [role="region"] div',
    fields: [
      "text"
    ],
    entries: {
      "· aka": "· 别名"
    }
  },
  {
    selector: ".settings-window-body main div",
    fields: [
      "title"
    ],
    entries: {
      "#103:c8d4f1d351b084a8": "此工作进程要由提供它的插件运行。单独复制定义无法启动。"
    }
  },
  {
    selector: ".settings-window-body main [data-zone-id] label",
    fields: [
      "text"
    ],
    entries: {
      collapsed: "默认折叠"
    }
  },
  {
    selector: ".settings-window-body main [data-zone-id] span",
    fields: [
      "text"
    ],
    entries: {
      "read-only": "只读",
      locked: "已锁定"
    }
  },
  {
    selector: ".settings-window-body main [data-zone-id] > div",
    fields: [
      "text"
    ],
    entries: {
      Hidden: "隐藏"
    }
  },
  {
    selector: '.settings-window-body main [role="region"] span',
    fields: [
      "title"
    ],
    entries: {
      "resolver-selected route": "解析器选定的路由"
    }
  },
  {
    selector: ".settings-window-body main .ue-menu",
    fields: [
      "aria-label"
    ],
    entries: {
      "Install an extension": "安装扩展"
    }
  },
  {
    selector: ".settings-window-body main .settings-group > p",
    fields: [
      "text"
    ],
    entries: {
      "#324:546b73434649fb33": "安排卡片底栏两侧的内容与顺序。底栏只占一行，组名不显示。左侧第一项固定为带类型色的卡片类型，其余字段可排在后面并使用淡色。",
      "#259:b3eeae8d0f915e6f": "组件用于标记结果的制作角色，例如遮罩、深度或干净底片。内置组件只读。自建组件可供不同媒体分配，也可搜索和筛选。"
    }
  },
  {
    selector: ".settings-window-body main [data-zone-id] button",
    fields: [
      "title",
      "aria-label"
    ],
    entries: {
      "#53:2c24e8c285035453": "本组有固定字段，需保留整组。"
    }
  },
  {
    selector: '.settings-window-body main [data-field-id="sys:cardType"]',
    fields: [
      "title"
    ],
    entries: {
      "#66:4914e8de6f35d9fa": "第一项固定为卡片类型，后续位置可添加字段。"
    }
  },
  {
    selector: ".settings-window-body main .settings-group-body > div > div",
    fields: [
      "text"
    ],
    entries: {
      "built-in": "内置",
      components: "组件",
      "#24:9b7d0a51780797e7": "本画布使用的组件",
      my: "我的",
      "#166:93c28fa6bc1e6a1a": "系统维护这些内置组件的名称、适用类型与启用状态，所有画布均可使用。",
      "#70:98f608c6a7ac1c21": "，也可在节点中选择个人组件，应用会把定义复制到当前画布",
      "#252:3bfda73f383c1590": "停用会从选择器隐藏组件，已有画布和工作流仍可按 ID 找到它。",
      "#60:0119df44dd54676a": "尚无组件。添加新组件或从下方保留画布已有组件。",
      "#282:91f02534849522be": "个人库可供本机各画布共用。选用后定义会存入画布，便于分享。日后删除个人库中的条目，已有画布仍可使用。"
    }
  },
  {
    selector: ".settings-window-body main .settings-group-body button.ui-btn",
    fields: [
      "text"
    ],
    entries: {
      component: "组件",
      components: "组件",
      "+ Add to my": "+ 添加到我的"
    }
  },
  {
    selector: '.settings-window-body main [data-def-id] button[role="switch"]',
    fields: [
      "text",
      "title",
      "aria-label"
    ],
    entries: {
      image: "图像",
      video: "视频",
      mesh: "网格",
      splat: "高斯泼溅",
      audio: "音频"
    }
  },
  {
    selector: '.settings-window-body main [data-def-id] button[role="switch"]',
    fields: [
      "title"
    ],
    entries: {
      "#56:7cdeed9f8f9650ad": "组件需要至少一个适用的内容类型。"
    }
  },
  {
    selector: '.settings-window-body main [data-def-id]:has(button[role="switch"]:disabled):not(:has(button[role="switch"]:enabled)) > div > span:only-of-type',
    fields: [
      "text"
    ],
    entries: {
      Source: "源素材",
      Annotation: "标注",
      Beauty: "最终合成",
      Depth: "深度",
      Normal: "法线",
      Mask: "遮罩",
      Edge: "边缘",
      Pose: "姿态",
      Cutout: "抠像",
      "Clean plate": "干净底片",
      Panorama: "全景",
      "Front view": "正视图",
      "Back view": "后视图",
      "Left view": "左视图",
      "Right view": "右视图",
      Music: "音乐",
      Ambience: "环境音",
      Speech: "语音"
    }
  },
  {
    selector: ".settings-window-body main input.ui-field",
    fields: [
      "placeholder"
    ],
    entries: {
      "#29:4e26b91ee71e4adf": "示例路径 C:\\Tools\\ffmpeg\\bin\\ffmpeg.exe",
      "#80:3cf5d69a40dbdbc2": "自动查找 Blender，也可指定安装目录中的 blender.exe",
      "#63:871ff25d06c6a221": "自动查找 Krita，也可指定安装目录中的 bin\\krita.exe"
    }
  }
];

// src/locales/viewers-extra.json
var viewers_extra_default = [
  {
    selector: "[data-scroll-passthrough] > div > button[title][aria-label]",
    fields: [
      "title",
      "aria-label"
    ],
    entries: {
      "Zoom in": "放大",
      "Zoom out": "缩小",
      "Reset view": "重置视图"
    }
  },
  {
    selector: "[data-scroll-passthrough] > div,.nodrag.nowheel[data-scroll-passthrough] > div > span,.nodrag.nowheel[data-scroll-passthrough] > div > button,.nodrag.nowheel[data-scroll-passthrough] input[type='range']",
    fields: [
      "text",
      "title",
      "aria-label"
    ],
    entries: {
      "Loading panorama…": "正在加载全景图…",
      "Failed to load panorama image": "无法加载全景图",
      "#21:65529032d8852cbf": "高斯泼溅场景加载失败。",
      "Can’t display this mesh": "无法显示此网格",
      "#24:1b8cbab8822e1ada": "文件未能打开。",
      "#39:d6fffd34d75bbdaa": "可下载原文件，或将其导入 UE 使用。",
      "Show skeleton": "显示骨架",
      "Hide skeleton": "隐藏骨架",
      "Mesh opacity behind the skeleton": "骨架后方网格的不透明度",
      Bones: "骨骼"
    }
  },
  {
    selector: ".nodrag.nowheel:has(button:is([aria-label='USD camera'],[aria-label='USD 摄像机'])) > div > span,.nodrag.nowheel:has(button:is([aria-label='USD camera'],[aria-label='USD 摄像机'])) > div > button,.nodrag.nowheel:has(button:is([aria-label='USD camera'],[aria-label='USD 摄像机'])) [role='alert'] > button,.nodrag.nowheel:has(button:is([aria-label='USD camera'],[aria-label='USD 摄像机'])) [role='status'],.nodrag.nowheel:has(button:is([aria-label='USD camera'],[aria-label='USD 摄像机'])) .merlin-pane-collapse,.merlin-pane-collapse[aria-expanded]",
    fields: [
      "text",
      "aria-label",
      "title"
    ],
    entries: {
      "Preview unavailable": "预览不可用",
      "Opening USD scene…": "正在打开 USD 场景…",
      "Retry preview": "重试预览",
      "Loading scene children…": "正在加载场景子项…",
      Retry: "重试",
      "Show scene": "显示场景",
      "Hide scene": "隐藏场景"
    }
  },
  {
    selector: "button.custom-select[role='combobox'],[role='listbox']:is([aria-label='USD camera'],[aria-label='USD 摄像机']),[role='listbox']:is([aria-label='USD camera'],[aria-label='USD 摄像机']) > [role='option'][data-value=''] > span,.custom-select:is([aria-label='USD camera'],[aria-label='USD 摄像机'])[data-value=''] > span > span[aria-hidden='false']",
    fields: [
      "text",
      "aria-label"
    ],
    entries: {
      "USD camera": "USD 摄像机",
      "Inspection camera": "检查摄像机"
    }
  },
  {
    selector: "button[aria-label='Preview information'],button[aria-label='预览信息'],[role='tooltip'] output,[role='tooltip'] div",
    fields: [
      "text",
      "title",
      "aria-label"
    ],
    entries: {
      "Preview information": "预览信息",
      "Authored USD time code": "USD 场景中记录的时间码",
      "#27:4a046eed040ed66d": "当前仅能预览部分内容。",
      "#80:a9583153629607d7": "无法读取场景默认相机的姿态，已改用检查相机。"
    }
  },
  {
    selector: ".nowheel:has(video) button[title][aria-label],.nowheel:has(audio) button[title][aria-label],.nodrag.nowheel:has(button:is([aria-label='USD camera'],[aria-label='USD 摄像机'])) button[title][aria-label],button[aria-label]:has(> svg:is([data-icon='step-back'],[data-icon='step-forward'],[data-icon='loop'],[data-icon='grab-frame']))",
    fields: [
      "title",
      "aria-label"
    ],
    entries: {
      "Previous frame": "上一帧",
      "Next frame": "下一帧",
      Pause: "暂停",
      Play: "播放",
      Stop: "停止",
      Mute: "静音",
      Unmute: "取消静音",
      Loop: "循环播放",
      "Grab frame": "截取当前帧",
      "Capture animation to video": "将动画录制为视频",
      "Cancel video capture": "取消录制视频"
    }
  },
  {
    selector: ".nowheel:has(video) span[title],.nodrag.nowheel:has(button:is([aria-label='USD camera'],[aria-label='USD 摄像机'])) span[title]",
    fields: [
      "title"
    ],
    entries: {
      "#29:a2a474e3e405194f": "逗号退一帧，句号进一帧。"
    }
  },
  {
    selector: ".nodrag.nowheel[data-scroll-passthrough] .info-panel-row > .info-panel-cell.label-cell",
    fields: [
      "text"
    ],
    entries: {
      "Camera position:": "摄像机位置：",
      "Camera look-at:": "摄像机注视点：",
      "Camera up:": "摄像机上方向：",
      "Camera mode:": "摄像机模式：",
      "Cursor position:": "光标位置：",
      "FPS:": "帧率：",
      "Rendering::": "渲染：",
      "Sort time:": "排序耗时：",
      "Render window:": "渲染窗口：",
      "Focal adjustment:": "焦点调整：",
      "Splat scale:": "高斯泼溅大小：",
      "Point cloud mode:": "点云模式："
    }
  },
  {
    selector: ".nodrag.nowheel[data-scroll-passthrough] :is([class*='messageContainerPrimary'],[class*='messageContainerMin'])",
    fields: [
      "text"
    ],
    entries: {
      "Loading...": "正在加载…",
      "Optimizing data structures...": "正在优化数据结构…",
      "Processing splats...": "正在处理高斯泼溅数据…",
      "Processing...": "正在处理…",
      "Downloading...": "正在下载…"
    }
  },
  {
    selector: ".nodrag.nowheel img[alt]",
    fields: [
      "alt"
    ],
    entries: {
      "USD scene preview": "USD 场景预览"
    }
  }
];

// src/dictionary.ts
var dictionary = [...generation_extra_default, ...editors_extra_default, ...script_authoring_extra_default, ...viewers_extra_default, ...menus_extra_default, ...panels_extra_default, ...settings_extra_default, ...zh_CN_default];

// src/index.ts
if (!loadSignal.aborted) {
  const stop = localize(document, dictionary);
  loadSignal.addEventListener("abort", stop, { once: true });
  console.info("[unreal-canvas-zh-cn] 简体中文已加载");
}
