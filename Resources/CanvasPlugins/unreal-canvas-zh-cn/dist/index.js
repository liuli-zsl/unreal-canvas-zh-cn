// src/index.ts
import { loadSignal, useCanvasStore } from "@merlin/plugin-api";

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

// src/host-fiber.ts
function renderedFiber(element) {
  const property = Object.keys(element).find((key) => key.startsWith("__reactFiber$"));
  return property ? Object.getOwnPropertyDescriptor(element, property)?.value : void 0;
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
var viewportScripts = /* @__PURE__ */ new Map([
  ["Modify Viewport (Spatial)", { id: "b88aa71e-c1eb-4302-a9f1-d370fa1fc9b1", label: "修改视口（空间）" }],
  ["Viewport Render", { id: "b7f96a53-c341-4f12-a3de-a8801e610c7c", label: "视口渲染" }],
  ["Viewport Snapshot", { id: "a104f84a-29f0-44e6-9c20-c75c25a1d69c", label: "视口快照" }],
  ["Sequence Render", { id: "0100c861-07be-4c12-b12e-a97271962ee5", label: "序列渲染" }]
]);
function shelfScriptLists(fiber) {
  for (let owner = fiber; owner; owner = owner.return ?? void 0) {
    const scripts = owner.memoizedProps?.scripts;
    if (!Array.isArray(scripts)) continue;
    const alternate = owner.alternate?.memoizedProps?.scripts;
    return Array.isArray(alternate) && alternate !== scripts ? [scripts, alternate] : [scripts];
  }
  return [];
}
function isBuiltinViewportScript(script) {
  return script?.params?.builtinGraph === true && viewportScripts.get(script.name)?.id === script.id;
}
var toolboxScriptNameSelector = ".merlin-scripts-row-name,.merlin-graphs-tile-label";
function translateToolboxScriptName(element, field, value, readCanvas) {
  const script = viewportScripts.get(value);
  if (!script || field !== "text" || !element.matches(toolboxScriptNameSelector)) return;
  const row = element.closest('.merlin-scripts :is(.merlin-scripts-row.is-table,.merlin-graphs-tile.merlin-scripts-tile)[role="button"]');
  const wrapper = row?.parentElement;
  if (!wrapper?.hasAttribute("data-tooltip-owner") || renderedFiber(wrapper)?.return?.key !== "graph:" + script.id) return;
  const matches = readCanvas?.().canvases["graph-library"]?.nodes.filter((node) => node.id === script.id);
  if (matches?.length === 1 && matches[0].name === value && isBuiltinViewportScript(matches[0])) return script.label;
}
function translateViewportScript(element, field, value) {
  const entry = viewportScripts.get(value);
  if (entry && field === "text" && element.matches('button[role="menuitemradio"] > .ue-menu-label') && element.parentElement) {
    const fiber2 = renderedFiber(element.parentElement);
    if (fiber2?.key !== entry.id) return;
    const lists2 = shelfScriptLists(fiber2);
    if (lists2.length && lists2.every((scripts) => scripts.some((script) => script?.name === value && isBuiltinViewportScript(script)))) return entry.label;
  }
  if (value !== "Viewport") return;
  const folder = field === "aria-label" && element.matches(".generation-shelf-workflow-folder") ? element : field === "text" && element.matches(".generation-shelf-workflow-folder-name > .ue-menu-label") ? element.closest(".generation-shelf-workflow-folder") : null;
  if (!folder) return;
  const fiber = renderedFiber(folder);
  if (fiber?.key !== "folder:Viewport") return;
  const lists = shelfScriptLists(fiber);
  const onlyBuiltin = lists.length > 0 && lists.every((scripts) => {
    const group = scripts.filter((script) => {
      const category = script?.params?.category;
      const path = typeof category === "string" ? category.split("/").map((segment) => segment.trim()).filter(Boolean) : [];
      return path[0] === "Viewport";
    });
    return group.length > 0 && group.every(isBuiltinViewportScript);
  });
  if (onlyBuiltin) return "视口";
}
function footer(element, field, value) {
  const id = element.getAttribute("data-field");
  if (id === "rating" && field === "title" && value === "Rating") return "评分";
  if (id === "votes" && field === "title" && value === "Votes") return "票数";
  if (id === "sys:childCount") {
    const count = /^(Contents )?(\d+) cards?$/.exec(value);
    if (count) return (count[1] ? "内容：" : "") + count[2] + " 张卡片";
  }
  if (id === "sys:runStatus") {
    const label2 = value.startsWith("Run ") ? value.slice(4) : value;
    const state = runStates.get(label2);
    if (state) return (label2 === value ? "" : "运行状态：") + state;
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
    if (field === "text" && element.matches('.generation-shelf-workflow-menu-tools .merlin-panel-settings > [role="menu"] > button[role="menuitem"] > .ue-menu-label')) {
      if (value === "Collapse all folders") return "折叠所有文件夹";
      if (value === "Expand all folders") return "展开所有文件夹";
    }
    const viewportLabel = translateViewportScript(element, field, value);
    if (viewportLabel) return viewportLabel;
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
        const label2 = media.get(mode[0].toUpperCase() + mode.slice(1));
        if (label2) return "搜索" + label2 + "脚本";
      }
    }
    if (element.classList.contains("generation-shelf-reference-pick")) {
      const label2 = /* @__PURE__ */ new Map([["Start Frame reference", "起始帧参考素材"], ["End Frame reference", "结束帧参考素材"], ["Image reference", "参考图像"]]);
      return label2.get(value);
    }
  }
  if (field === "text" && element.matches(".generation-shelf-script > strong")) {
    if (value === "Choose a script") return "选择脚本";
    if (value === "Agent chooses a script") return "由智能体选择脚本";
  }
}

// src/menu-dynamic.ts
var browserScope = '[role="dialog"]:is([aria-label="Open canvas"],[aria-label="打开画布"])';
var canvasMenu = '[role=menu]:is([aria-label="Canvas actions"],[aria-label="画布操作"])';
var extensionGraphDialogBody = `[role="dialog"]:is([aria-label="Graphs from extensions can't be edited"],[aria-label="扩展提供的节点图不可编辑"]) > [data-confirm-body]`;
var elapsedUnits = { s: "秒", m: "分钟", h: "小时", d: "天" };
var customNodeCommands = /* @__PURE__ */ new Map([
  ["Custom Node", "自定义节点"],
  ["Update from Library", "从资源库更新"],
  ["Publish to Library…", "发布到资源库…"],
  ["Export as file…", "导出为文件…"]
]);
var nestedTrigger = 'body > .ue-submenu > div > button[aria-haspopup="menu"]';
var nestedCommand = "body > .ue-submenu > div > .ue-submenu > button.ue-menu-item";
var canvasActionLabels = /* @__PURE__ */ new Map([
  ["bake-text", ["Reference (Text)", "引用（文本）"]],
  ["bake-audio", ["Reference (Audio)", "引用（音频）"]],
  ["bake-video", ["Reference (Video)", "引用（视频）"]],
  ["bake-video-frame", ["Reference (Current Frame)", "引用（当前帧）"]],
  ["bake-multiple-images", ["References", "引用各输出"]],
  ["bake-layered-image", ["Layered Reference", "分层引用"]],
  ["dcc-edit-in", ["Send to", "发送到"]],
  ["dcc-edit-in-imageEditor", ["Image editor", "图像编辑器"]],
  ["dcc-finish", ["Finish editing", "完成编辑"]],
  ["graph-add-to-library", ["Add to Library", "添加到资源库"]],
  ["graph-export-file", ["Export as file…", "导出为文件…"]],
  ["recreate-graph-from-artifact", ["Re-create graph as new canvas", "将节点图重建为新画布"]],
  ["grab-into-console", ["Grab into Console", "载入控制台"]],
  ["go-to-original", ["Go to source", "前往来源"]]
]);
var canvasActionTitles = /* @__PURE__ */ new Map([
  ["#94:acd39b2f01c47aab", ["bake-image", "在旁边创建引用卡片，保留与原卡片输出的关联。"]],
  ["#62:b171e5bd14d3f4d2", ["bake-text", "在旁边为文本结果创建引用卡片。"]],
  ["#70:73a7aa983666461f", ["bake-audio", "在旁边为当前音频结果创建引用卡片。"]],
  ["#70:1ef68d5dbcb72000", ["bake-video", "在旁边为当前视频结果创建引用卡片。"]],
  ["#84:e2081b6b1b7c152b", ["bake-video-frame", "在旁边为当前显示的视频帧创建图像引用卡片。"]],
  ["#76:5910dcf9f2851e40", ["bake-video-frame", "为所选视频各自显示的当前帧创建图像引用卡片。"]],
  ["#49:d1a2cc24981e5eed", ["bake-multiple-images", "为卡片的每个输出创建一张引用卡片。"]],
  ["#62:8ce60ae663cd6b67", ["bake-layered-image", "创建包含所有图层的引用卡片，并保留图层切换控件。"]],
  ["#111:1499c939b221200d", ["dcc-edit-in-imageEditor", "未自动找到图像编辑器。请在「设置 → 外部路径 → 图像编辑器路径」中选择程序。"]],
  ["#51:15209f0c50788792", ["graph-add-to-library", "将节点图副本保存到工具箱，供以后使用。"]],
  ["#39:ff34a80c5efe8b04", ["graph-export-file", "将节点图导出为 .graph.json 文件。"]],
  ["#60:d073ad792e80f49e", ["multi-create-subcanvas", "将所选卡片移入节点图，跨边界的连线会创建对应端口。"]],
  ["#35:177176e9056b1e98", ["multi-collapse-subcanvas", "将所选卡片移入子画布。"]]
]);
function getRenderedMenuAction(button) {
  for (let owner = renderedFiber(button); owner; owner = owner.return ?? void 0) {
    const action = owner.memoizedProps?.action;
    if (action?.id && (owner.key === action.id || owner.return?.key === action.id)) return action;
  }
}
function translateEditorActionHint(action, english, key) {
  const name = action.label;
  if (!action.id.startsWith("dcc-edit-in-") || !name) return;
  if (key === "#44:5c9dc21452fe59e9") return "请等待卡片运行完毕。";
  const path = /^([\s\S]+)Settings ▸ External paths ▸ "([^"]+)"\.$/.exec(english);
  if (!path) return;
  const lead = path[1];
  const location = "「设置 → 外部路径 → " + path[2] + "」";
  if (lead.startsWith(name) && copyKey(lead.slice(name.length)) === "#51:20e20b5f91793c9c") {
    return "未自动找到「" + name + "」。请在" + location + "中选择程序。";
  }
  const start = "Choose the program ";
  if (lead.startsWith(start + name) && copyKey(start + lead.slice(start.length + name.length)) === "#29:1ac6ec9acf4ab05d") {
    return "请在" + location + "中选择「" + name + "」使用的程序。";
  }
}
function translateMenuActionCopy(action, field, english) {
  if (field === "title" || field === "data-title-tip") {
    if (action.title !== english) return;
    const key = copyKey(english);
    const copy2 = canvasActionTitles.get(key);
    if (copy2 && (action.id === copy2[0] || action.id === "create-reference" && copy2[0].startsWith("bake-"))) return copy2[1];
    return translateEditorActionHint(action, english, key);
  }
  if (field !== "text" || action.label !== english) return;
  const copy = canvasActionLabels.get(action.id);
  if (copy?.[0] === english) return copy[1];
  if (action.id === "dcc-reimport" && english.startsWith("Reimport from ")) return "从" + english.slice(14) + "重新导入";
  if (action.id === "bake-video-frame") {
    const count = /^(\d+) References \(Current Frame\)$/.exec(english);
    if (count) return "创建 " + count[1] + " 张引用卡片（当前帧）";
  }
  if (action.id === "grab-into-console") {
    const count = /^Grab (\d+) into Console$/.exec(english);
    if (count) return "载入 " + count[1] + " 项到控制台";
  }
}
function translateCanvasAction(element, field, english) {
  const label2 = field === "text" && element.matches(".ue-menu-label,.feature-hint-menu-label");
  const hint = (field === "title" || field === "data-title-tip") && element.matches("button");
  if (!label2 && !hint) return;
  const button = element.closest("button.ue-menu-item");
  if (!button?.closest(canvasMenu + ",body > .ue-submenu") || !element.ownerDocument.querySelector(canvasMenu)) return;
  const action = getRenderedMenuAction(button);
  return action && translateMenuActionCopy(action, field, english);
}
function isCustomNodeMenu(element) {
  const activeGroup = element.ownerDocument.querySelector(
    canvasMenu + " > button[aria-expanded=true] > .feature-hint-menu-label"
  )?.textContent;
  if (activeGroup !== "Inspect" && activeGroup !== "检查") return false;
  const row = element.closest("button");
  if (row?.matches(nestedTrigger)) return true;
  if (!row?.matches(nestedCommand)) return false;
  const submenu = row.parentElement?.previousElementSibling?.querySelector(".feature-hint-menu-label")?.textContent;
  return submenu === "Custom Node" || submenu === "自定义节点";
}
function translateMenuDynamic(element, field, english) {
  const canvasAction = translateCanvasAction(element, field, english);
  if (canvasAction !== void 0) return canvasAction;
  if (field === "text" && english.startsWith("Comes with the ") && element.matches('[role="tooltip"][data-portal-popup][id]')) {
    const start = "Comes with the ".length;
    const end = english.lastIndexOf(" extension — locked.");
    const trigger = [...element.ownerDocument.querySelectorAll("span[aria-describedby]:has(> button[data-graph-edit-lock])")].find((wrapper) => wrapper.getAttribute("aria-describedby")?.split(/\s+/).includes(element.id));
    if (trigger && end > start && copyKey(english.slice(0, start) + english.slice(end)) === "#72:d59ddf8ec23d900e") {
      return "此节点图由「" + english.slice(start, end) + "」扩展提供，现已锁定。复制后即可编辑副本。";
    }
  }
  if (field === "text" && english.startsWith("This graph comes with the ")) {
    const start = "This graph comes with the ".length;
    const dialog = element.matches(extensionGraphDialogBody);
    const inspector = element.matches(".merlin-graph-inspector .merlin-script-side-locked > span");
    const end = english.lastIndexOf(dialog ? " extension and changes only when " : " extension, so its settings ");
    if (dialog && end > start && copyKey(english.slice(0, start) + english.slice(end)) === "#142:287aed80dd143695") {
      return "此节点图由「" + english.slice(start, end) + "」扩展提供，随扩展更新。在工具箱中复制它，即可编辑副本。";
    }
    if (inspector && end > start && copyKey(english.slice(0, start) + english.slice(end)) === "#129:731a0436349e0feb") {
      return "此节点图由「" + english.slice(start, end) + "」扩展提供，设置已锁定。在工具箱中复制它，即可编辑副本。";
    }
  }
  const command = field === "text" && customNodeCommands.get(english);
  if (command && element.matches(".feature-hint-menu-label,.ue-menu-label") && isCustomNodeMenu(element)) return command;
  if (field === "title" && element.matches(nestedCommand) && isCustomNodeMenu(element)) {
    const key = copyKey(english);
    if (key === "#51:e2f6181aece37205") return "将此卡片保存到自定义节点库，供以后复用。";
    if (key === "#56:c45701dd2f709202") return "将此卡片的定义导出为 .customnode JSON 文件。";
    const start = english.indexOf('"');
    const end = english.lastIndexOf('"');
    if (start >= 0 && end > start && copyKey(english.slice(0, start + 1) + english.slice(end)) === "#142:998c292fdfcf2cb8") {
      return "将资源库中“" + english.slice(start + 1, end) + "”的新版定义应用到此卡片。保留仍然存在的引脚连线和你的设置值。此操作可撤销。";
    }
  }
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
    const label2 = /^(root canvas|subcanvas|nested canvas|graph) (“[\s\S]*”)$/.exec(english);
    if (field === "text" && label2 && element.matches(".merlin-script-form-none")) {
      return (label2[1] === "graph" ? "节点图" : label2[1] === "root canvas" ? "根画布" : "子画布") + label2[2];
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

// src/graph-context.ts
var graphMenu = '.ue-menu[data-merlin-punch-cover][popover="manual"]:not([role]):not(:has(.merlin-panel-search))';
var graphSubmenu = '.ue-submenu[data-merlin-punch-cover][popover="manual"]';
var labels = /* @__PURE__ */ new Map([
  ["create-reference", { Reference: "引用" }],
  ["create-deck", { Deck: "卡组" }],
  ["copy-to-workflow-graph", { "Graph (Copy to)": "复制到新节点图" }],
  ["multi-create-subcanvas", { "Graph (Move to)": "移入新节点图" }],
  ["multi-collapse-subcanvas", { Subcanvas: "子画布" }],
  ["clear-results", { "Clear results": "清除结果" }],
  ["graph-input-toggle", { "Create input": "创建输入", "Remove input": "移除输入" }],
  ["toggle-required-input", {
    "Make input required": "设为必填输入",
    "Make input optional": "设为可选输入",
    "Required by model": "模型要求此输入"
  }],
  ["graph-settings-toggle", { "Show model settings": "显示模型设置", "Hide model settings": "隐藏模型设置" }],
  ["restore-severed-wiring", { "Restore severed wiring": "恢复断开的连线" }],
  ["remove-reroute", { "Remove reroute": "移除重定向连线" }],
  ["inspect-menu", { Inspect: "检查" }],
  ["forward", { "Bring forward": "上移一层", "Bring Forward": "上移一层" }],
  ["backward", { "Send backward": "下移一层", "Send Backward": "下移一层" }],
  ["fit-aspect", { "Fit to aspect ratio": "适配宽高比" }],
  ["fit-text", { "Fit to text": "适应文本" }],
  ["reset-card-size", { "Reset card size": "重置卡片大小" }],
  ["keep-cached-result", { "Keep cached result": "保留缓存结果" }],
  ["stop-keeping-cached-result", { "Stop keeping cached result": "停止保留缓存结果" }],
  ["copy-with-annotations", { "Copy with annotations": "复制带批注的图像" }],
  ["duplicate-graph", { "Duplicate graph": "创建节点图副本" }],
  ["import-level-snapshot", { "Import Level Snapshot": "导入关卡快照" }],
  ["custom-node-menu", { "Custom Node": "自定义节点" }],
  ["custom-node-publish", { "Publish to Library…": "发布到资源库…" }],
  ["custom-node-export", { "Export as file…": "导出为文件…" }]
]);
var hints = /* @__PURE__ */ new Map([
  ["#46:f1f7191aaa25ea86", "请先停止所选节点，再清除结果。"],
  ["#114:b1d46301269a188d", "清除所选节点的结果历史。输入、设置和连线会保留，可撤销以恢复结果。"],
  ["#74:78405a7bfd57099e", "将选中项合为一个卡组。所选卡组也会合并到其中，避免嵌套。"],
  ["#62:016d612c6e8c5126", "请选择至少两张卡片，或选择一张有多个版本的卡片。"],
  ["#69:c8ec072e046393f1", "将所选节点复制到新的节点图，原项仍留在当前画布。"],
  ["#80:b71ffd94360a43a0", "所选项包含跨边界的连线。子画布没有用于连接的引脚。"],
  ["#81:b6cc82c81a81d40a", "打开控制台，并将此结果作为变量载入当前 Python 会话。"],
  ["#63:664c02c9b129ea4e", "从节点图的输入列表移除此节点。节点仍留在图中。"],
  ["#91:8d2562d7142456b6", "将此节点设为节点图输入。可在节点图检查器中查看、排序和设置类型。"],
  ["#69:bf1cf820a560d979", "在节点图卡片和工具架中隐藏此节点的设置。"],
  ["#116:0592a56b127948e3", "在节点图的输入旁显示所选模型的设置。切换模型后会同步调整。"],
  ["#98:101d44fb45e40e88", "允许此输入留空。连接到它的节点将按引脚未连接的情况运行。"],
  ["#58:6996db3f4772b739", "填写此输入后，工作流才能运行。"],
  ["#77:b354f634faa5c02f", "参数或输入与当前结果不符时，允许重新运行此卡片。"],
  ["#81:3c90e3b7e5a33a8a", "在结果更新前复用此卡片的缓存结果。"],
  ["#72:a843d98f89810d8e", "将节点图复制到新卡片。副本暂无输出，可以编辑和生成。"],
  ["#50:20044c2f09126c9c", "复制图像并将批注合成到图像中。"],
  ["#96:ca5a9a10394f39b6", "将渲染采集的关卡快照保存到内容浏览器，便于查看或应用。"],
  ["#51:e2f6181aece37205", "将此卡片保存到自定义节点库，供以后复用。"],
  ["#56:c45701dd2f709202", "将此卡片的定义导出为 .customnode JSON 文件。"]
]);
var requiredModelSuffixes = [
  [48, "#48:777c6e4234ffc95e"],
  [47, "#47:782ce99a1d43a145"]
];
var inputBadge = '.graph-node-body div[style*="letter-spacing: 0.1em"]:has(> div > span[data-app-tooltip] > button)';
var inputBadgeLabels = /* @__PURE__ */ new Map([
  ["INPUT", "输入"],
  ["INPUT · REQUIRED", "输入 · 必填"],
  ["INPUT · REQUIRED (BY MODEL)", "输入 · 模型要求必填"]
]);
var inputToggleLines = /* @__PURE__ */ new Map([
  ["#92:bd559d10f992ac1d", "工作流需要填写此输入。点击可设为可选。"],
  ["#142:dcdb5e6c3d59dfc1", "此输入可留空。连接到它的节点将按引脚未连接的情况运行。点击可设为必填。"]
]);
var inputToggleModelLines = [
  [61, "#61:1081d30149973964", "要求填写此输入。选用该模型时无法设为可选。"],
  [72, "#72:bc3d001a95b448d6", "被选用时会要求填写此输入。点击可立即设为必填。"]
];
function translateInputBadge(element, field, english) {
  if (field !== "text") return;
  const badgeLabel = inputBadgeLabels.get(english);
  if (badgeLabel && element.matches(inputBadge + " > span:first-child")) return badgeLabel;
  if (!element.matches('[role="tooltip"][data-portal-popup][id]') || !/^(?:Optional input:|Required input:|Required by )/.test(english)) return;
  const trigger = [...element.ownerDocument.querySelectorAll(inputBadge + " > div > span[data-app-tooltip][aria-describedby]")].find((wrapper) => wrapper.getAttribute("aria-describedby")?.split(/\s+/).includes(element.id));
  if (!trigger) return;
  const caption = inputToggleLines.get(copyKey(english));
  if (caption) return caption;
  const prefix = "Required by ";
  if (!english.startsWith(prefix)) return;
  for (const [length, key, message] of inputToggleModelLines) {
    if (english.length > prefix.length + length && copyKey(english.slice(-length)) === key) {
      const model = english.slice(prefix.length, -length);
      return (model === "the selected model" ? "所选模型" : "「" + model + "」") + message;
    }
  }
}
function translateGraphContext(element, field, english) {
  const input = translateInputBadge(element, field, english);
  if (input !== void 0) return input;
  const label2 = field === "text" && element.matches(".ue-menu-label,.feature-hint-menu-label");
  const hint = (field === "title" || field === "data-title-tip") && element.matches("button");
  if (!label2 && !hint) return;
  const button = element.closest("button.ue-menu-item");
  if (!button) return;
  if (!button.closest(graphMenu) && !(button.closest(graphSubmenu) && element.ownerDocument.querySelector(graphMenu + ' > button[aria-expanded="true"]'))) return;
  const action = getRenderedMenuAction(button);
  if (!action) return;
  const shared = translateMenuActionCopy(action, field, english);
  if (shared !== void 0) return shared;
  if (label2) return action.label === english ? labels.get(action.id)?.[english] : void 0;
  if (action.title !== english) return;
  const fixed = hints.get(copyKey(english));
  if (fixed !== void 0) return fixed;
  if (action.id === "toggle-required-input" && action.label === "Required by model") {
    for (const [length, key] of requiredModelSuffixes) {
      if (english.length > length && copyKey(english.slice(-length)) === key) {
        const model = english.slice(0, -length);
        return (model === "The selected model" ? "所选模型" : "「" + model + "」") + "要求填写此输入。";
      }
    }
  }
  if (action.id === "create-deck") {
    const takes = /^Hold this card's (\d+) takes as a deck of cards$/.exec(english);
    if (takes) return "将此卡片的 " + takes[1] + " 个版本汇集为卡组。";
  }
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
    if (element.closest(':is(.agent-onboarding-select[role=combobox],[role=listbox]):is([aria-label="Model for your first chat"],[aria-label="首次对话使用的模型"])')) return null;
    if (element.matches(".agent-onboarding-content > p")) {
      const parts = element.childNodes;
      if (parts.length > 1) {
        if (parts.length === 2 && node === parts[1] && copyId(english) === "dbd98086296d67df") {
          return "已就绪。发送测试消息即可检查所选模型。";
        }
        if (parts.length === 4 && node === parts[1] && english === "replied successfully. Your first chat will use") return "已回复。首次对话将使用";
        if (parts.length === 4 && node === parts[3] && english === ".") return "。";
        if (parts.length === 3 && node === parts[0] && english === "Set up previously:") return "此前已配置：";
        if (parts.length === 3 && node === parts[2] && copyId(english) === "62970e1b3528296c") return "。选择一项即可检查或更改连接。";
        if (parts.length !== 3 && node === parts[0] && english === "API connection") return "API 连接";
        return null;
      }
      if (element.getAttribute("role") === "status") {
        const connecting = /^Connecting to (.+) and loading its models…$/.exec(english);
        if (connecting) return "正在连接 " + (connecting[1] === "API connection" ? "API 连接" : connecting[1]) + " 并加载模型列表…";
        const testing = /^(.+) is responding to the connection test…$/.exec(english);
        if (testing) return (testing[1] === "API connection" ? "API 连接" : testing[1]) + " 正在响应连接测试…";
      }
    }
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
    if (element.matches(".merlin-scripts > .merlin-panel-footer")) {
      const count = /^(\d+) tools?$/.exec(english);
      if (count) return `${count[1]} 个工具`;
    }
    if (element.matches(".media-library > .merlin-panel-footer")) {
      const count = /^(\d+) (item|card)s?$/.exec(english);
      if (count) return count[1] + (count[2] === "card" ? " 张卡片" : " 项");
    }
    return void 0;
  }
  if (field === "aria-label" && element.matches(".merlin-content-modes .merlin-rail-badge[role=status]")) {
    const labels3 = english.split("; ").map((part) => {
      const waiting = /^(\d+) agents? needs? your input$/.exec(part);
      if (waiting) return `${waiting[1]} 个智能体等待你输入`;
      const updates = /^(\d+) agents? (?:has|have) updates$/.exec(part);
      if (updates) return `${updates[1]} 个智能体有更新`;
    });
    if (labels3.every(Boolean)) return labels3.join("，");
  }
  if (field !== "aria-label" && field !== "title") return void 0;
  if (element.matches(".media-library-size,.media-library .merlin-panel-slider-button > button.merlin-panel-icon-button")) {
    const size = /^Thumbnail size: (\d+)px$/.exec(english);
    if (size) return `缩略图大小：${size[1]} 像素`;
  }
  if (classes.contains("merlin-script-output-icons") && english.startsWith("Outputs: ")) {
    const types2 = english.slice("Outputs: ".length).split(", ");
    return "输出：" + types2.map((type) => Object.prototype.hasOwnProperty.call(outputTypes, type) ? outputTypes[type] : type).join("、");
  }
  if (classes.contains("merlin-panel-control-btn")) {
    for (const [name, label2] of Object.entries(panelNames)) {
      if (english === "Close " + name) return "关闭" + label2;
      if (english === "Fill Canvas with " + name) return "用" + label2 + "填满画布";
      if (english === "Restore " + name + " Side Panel") return "还原" + label2 + "侧栏";
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
  "Footer Right": "底栏右侧",
  "Footer left": "底栏左侧",
  "Footer right": "底栏右侧"
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
  const label2 = builtInFields.get(row.getAttribute("data-field-id") ?? "");
  const display = (name) => label2?.[0] === name ? label2[1] : name;
  if (field === "text" && element.parentElement === row && label2?.[0] === english) return label2[1];
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
    const progress2 = /^Downloading: (\d+(?:\.\d+)?%)$/.exec(english);
    if (progress2) return "正在下载：" + progress2[1];
  }
  return void 0;
}

// src/canvas-actions-022.ts
var closeGraphButton = '[data-merlin-canvas-surface] > [data-merlin-punch-cover] > span > button:has(> svg[data-icon="close"])';
var toolbarButton = ":is(.canvas-tool-palette,.merlin-toolbar-control-box) button[data-app-tooltip]";
var toolbarTooltipLine = '[role="tooltip"][data-portal-popup] > div:only-child > div:first-child > div:not(:has(*))';
var toolbarTools = [
  { title: "Select", label: "选择", key: "#27:5324499e7f3fb863", detail: "选择、移动卡片并调整大小" },
  { title: "Annotate", label: "批注", key: "#47:ad5834405fadb661", detail: "在画布和卡片上绘制形状与标记" },
  { title: "Connector", label: "连接线", key: "#40:cf3d70940b3e5fb2", detail: "在画布对象之间绘制连接线" },
  { title: "Frame", label: "框架", key: "#43:24ed411515102f59", detail: "拖出框架以组织和排列卡片" },
  { title: "Comment", label: "评论", key: "#26:a227813f159a07f2", detail: "给卡片添加评论" },
  { title: "Insert", label: "插入", key: "#51:a154afaea67fdcc6", detail: "添加文本便笺、卡片、节点图、容器和文件" },
  { title: "History lines", label: "历史连线", key: "#52:c697c64dca046c23", detail: "用连线显示各卡片的来源" },
  { title: "Filter cards", label: "筛选卡片", key: "#44:7cecf1636162963c", detail: "仅显示符合筛选条件的卡片" },
  { title: "Zoom out", label: "缩小", key: "#43:3db5504db72c4c10", detail: "缩小视图以查看更多画布内容" },
  { title: "Zoom level", label: "缩放比例", key: "#44:5642cf966f61773d", detail: "双击恢复到 100%" },
  { title: "Zoom in", label: "放大", key: "#34:ebd6b302151daf65", detail: "放大视图以查看细节" },
  { title: "Zoom and view options", label: "缩放与视图选项", key: "#50:c9fb293d7fc5f78e", detail: "适应视图、恢复 100%、小地图和全屏" }
];
function translateToolbar(element, field, english) {
  const button = (field === "aria-label" || field === "aria-description") && element.matches(toolbarButton);
  const line = field === "text" && element.matches(toolbarTooltipLine);
  if (!button && !line) return;
  const nextLine = element.nextElementSibling;
  const title = button ? field === "aria-label" ? english : element.getAttribute("aria-label") : nextLine ? english : element.previousElementSibling?.textContent;
  const detail = button ? field === "aria-description" ? english : element.getAttribute("aria-description") : nextLine ? nextLine.textContent : english;
  if (!title || !detail) return;
  const shortcut = / \(.+\)$/.exec(title)?.[0] ?? "";
  const name = title.slice(0, title.length - shortcut.length);
  const tool = toolbarTools.find((tool2) => tool2.title === name || tool2.label === name);
  if (!tool || detail !== tool.detail && copyKey(detail) !== tool.key) return;
  return (button ? field === "aria-label" : !!nextLine) ? tool.label + shortcut : tool.detail;
}
function currentGraphName(button) {
  const surface = button.closest("[data-merlin-canvas-surface]");
  const crumbs = surface?.querySelector(':scope > div > [data-merlin-punch-cover]:has(> svg[data-icon="chevron-right"])');
  return crumbs?.lastElementChild?.lastElementChild?.textContent;
}
function translateCanvasAction2(element, field, english) {
  const toolbar = translateToolbar(element, field, english);
  if (toolbar !== void 0) return toolbar;
  if (field === "text" && element.closest("button[data-result-index]")) {
    if (element.closest("button[data-result-index] > span:first-child > span:nth-child(2),button[data-result-index] > span:nth-child(n+2)")) {
      return english;
    }
  }
  if (field === "title" && english.startsWith("Navigate to ") && element.matches('[data-merlin-canvas-surface] [data-merlin-punch-cover]:has(> svg[data-icon="chevron-right"]) > span[title]')) {
    const name = element.lastElementChild?.textContent;
    if (name && english === "Navigate to " + name) return "前往“" + name + "”";
  }
  if (field === "aria-label" && english.startsWith("Close ") && element.matches(closeGraphButton)) {
    const name = currentGraphName(element);
    if (name && english === "Close " + name) return "关闭“" + name + "”";
  }
  if (field === "text" && english.startsWith("Close ") && english.endsWith(" and go back up") && element.matches('[role="tooltip"][id]')) {
    for (const button of element.ownerDocument.querySelectorAll(closeGraphButton)) {
      if (!button.parentElement?.getAttribute("aria-describedby")?.split(/\s+/).includes(element.id)) continue;
      const name = currentGraphName(button);
      if (name && english === "Close " + name + " and go back up") return "关闭“" + name + "”并返回上一级";
    }
  }
  if (field === "aria-label" && element.matches(".frame-color-swatches button")) {
    const color = /^Suggested (#[0-9a-f]{6})$/i.exec(english);
    if (color) return "推荐颜色 " + color[1];
  }
  if (field === "aria-label" && element.matches(".annotation-toolbar button")) {
    const swatch = /^(Outline|Fill) (#[0-9a-f]{6})$/i.exec(english);
    if (swatch) return (swatch[1] === "Outline" ? "描边 " : "填充 ") + swatch[2];
  }
  if (field === "aria-label" && element.matches(".react-flow__handle")) {
    const pin = /^(input|output) pin ([\s\S]+)$/.exec(english);
    if (pin) return (pin[1] === "input" ? "输入引脚 " : "输出引脚 ") + pin[2];
  }
  if (field === "title" && element.matches(".graph-node-header-title span[title]")) {
    const suffix = " — Double-click to rename";
    if (english.endsWith(suffix)) return english.slice(0, -suffix.length) + " — 双击重命名";
  }
  if (field === "text" && element.matches('.ue-menu:has(button:is([aria-label="Close search"],[aria-label="关闭搜索"])) .merlin-panel-search-count')) {
    const results = /^(\d+) results?$/.exec(english);
    if (results) return results[1] + " 个结果";
  }
}

// src/panel-actions-022.ts
var types = new Map(Object.entries({
  Text: "文本",
  Float: "浮点数",
  Integer: "整数",
  Boolean: "布尔值",
  Choice: "选项",
  "Vector 2": "二维向量",
  "Vector 3": "三维向量",
  Image: "图像",
  Video: "视频",
  Mesh: "网格",
  Audio: "音频",
  Splat: "高斯泼溅",
  File: "文件",
  Other: "其他",
  Graph: "节点图",
  text: "文本",
  float: "浮点数",
  int: "整数",
  boolean: "布尔值",
  image: "图像",
  video: "视频",
  mesh: "网格",
  splat: "高斯泼溅",
  audio: "音频",
  file: "文件",
  sceneJson: "场景 JSON",
  objectRef: "对象引用",
  any: "任意类型",
  usd: "USD",
  USD: "USD"
}));
var subtypes = new Map(Object.entries({
  source: ["Source", "源"],
  annotation: ["Annotation", "标注"],
  beauty: ["Beauty", "最终合成"],
  depth: ["Depth", "深度"],
  normal: ["Normal", "法线"],
  mask: ["Mask", "遮罩"],
  edge: ["Edge", "边缘"],
  pose: ["Pose", "姿势"],
  cutout: ["Cutout", "抠像"],
  plate: ["Clean plate", "干净背景"],
  panorama: ["Panorama", "全景图"],
  splat: ["Splat", "高斯泼溅"],
  view_front: ["Front view", "前视图"],
  view_back: ["Back view", "后视图"],
  view_left: ["Left view", "左视图"],
  view_right: ["Right view", "右视图"],
  music: ["Music", "音乐"],
  ambience: ["Ambience", "环境声"],
  speech: ["Speech", "语音"]
}));
var locations = new Map(Object.entries({ "Team library": "团队资源库", "My scripts": "我的脚本", "Built-in": "内置" }));
var builtInGroups = { Default: "默认", Advanced: "高级", "Default inputs": "默认输入", "Advanced inputs": "高级输入" };
var requirements = new Map(Object.entries({
  "Optional": "可选",
  "Required": "必填",
  "Required — click to make optional": "必填，点击改为可选",
  "Optional — click to make required": "可选，点击改为必填",
  "Required by the model this input feeds": "使用此输入的模型要求必填"
}));
var filterDialog = '[role="dialog"]:is([aria-label="Custom Filter" i],[aria-label="自定义筛选"])';
var unsavedDialog = '[role="dialog"]:is([aria-label="Unsaved changes"],[aria-label="未保存的更改"])';
var unsavedKinds = /* @__PURE__ */ new Map([
  ["graph", "节点图"],
  ["script", "脚本"],
  ["Python script", "Python 脚本"],
  ["Subscript script", "子脚本"],
  ["skill", "技能"]
]);
function unsavedChangesMessage(english) {
  const match = /^This (.+) has changes\. Discard them(, or save them as a copy(?: or save them)?|, or save them)?\?$/.exec(english);
  if (!match) return;
  const kind = unsavedKinds.get(match[1]);
  if (!kind) return;
  if (!match[2]) return "要放弃此" + kind + "未保存的更改吗？";
  const copy = match[2].includes("as a copy");
  const save = match[2].endsWith(" or save them");
  const intro = "此" + kind + "有未保存的更改。";
  if (copy && save) return intro + "你可以放弃更改、另存为副本或保存并关闭。";
  return intro + "要放弃更改，还是" + (copy ? "另存为副本" : "保存并关闭") + "？";
}
var filterFields = new Map(Object.entries({
  name: ["Name", "名称"],
  notes: ["Notes", "备注"],
  status: ["Status", "状态"],
  team: ["Team", "团队"],
  person: ["Person", "人员"],
  tags: ["Tags", "标签"],
  votes: ["Votes", "投票"],
  rating: ["Rating", "评分"],
  kind: ["Kind", "种类"],
  outputType: ["Type", "类型"],
  id: ["ID", "ID"],
  "sys:prompt": ["Prompt", "提示词"],
  "sys:negativePrompt": ["Negative", "负面提示词"],
  "sys:duration": ["Run time", "运行耗时"],
  "sys:mediaDuration": ["Duration", "媒体时长"],
  "sys:sequence": ["Sequence", "序列"],
  "sys:resolution": ["Resolution", "分辨率"],
  "sys:model": ["Model", "模型"],
  "sys:seed": ["Seed", "随机种子"],
  "sys:cardType": ["Card type", "卡片类型"],
  "sys:source": ["Source", "来源"],
  "sys:description": ["Description", "描述"],
  "sys:kindLabel": ["Kind name", "种类名称"],
  "sys:runStatus": ["Run", "运行状态"],
  "sys:sourceFile": ["File", "文件"],
  "sys:childCount": ["Contents", "内容"],
  "sys:c2pa": ["Provenance", "来源凭证"]
}));
function fieldOption(element, english) {
  const option = element.parentElement?.closest('[role="option"][data-value]');
  const list = option?.closest('[role="listbox"][id]');
  const control = list ? Array.from(element.ownerDocument.querySelectorAll(filterDialog + " button[aria-controls]")).find((button) => button.getAttribute("aria-controls") === list.id) : element.closest("button.custom-select");
  if (!control?.closest(filterDialog) || control.closest('[role="group"]') || control.getAttribute("data-value") !== "") return void 0;
  if (!option) {
    if (element.getAttribute("aria-hidden") === "false" && english === "+ Add field…") return "＋ 添加字段…";
    return void 0;
  }
  const id = option.getAttribute("data-value") ?? "";
  if (!id && english === "+ Add field…") return "＋ 添加字段…";
  const pair = filterFields.get(id);
  return pair && english === pair[0] ? pair[1] : null;
}
function dataType(label2) {
  if (label2.endsWith("[]")) {
    const single = types.get(label2.slice(0, -2));
    if (single) return single + "数组";
  }
  return types.get(label2);
}
function scriptOption(element, english) {
  let control = element.closest("button.custom-select");
  const option = element.closest('[role="option"][data-value]');
  if (!control && option) {
    const list = option.closest('[role="listbox"][id]');
    if (list) control = Array.from(element.ownerDocument.querySelectorAll(".merlin-script-form-row button[aria-controls]")).find((button) => button.getAttribute("aria-controls") === list.id) ?? null;
  }
  if (!control?.closest(".merlin-script-form-row")) return void 0;
  if (control.closest(".merlin-graph-inspector-subtype")) {
    const id = option?.getAttribute("data-value") ?? control.getAttribute("data-value");
    if (id?.startsWith("x:") && (option || element.getAttribute("aria-hidden") === "false")) return null;
    const pair = id && subtypes.get(id);
    return pair && english === pair[0] ? pair[1] : void 0;
  }
  if (control.parentElement?.parentElement?.classList.contains("merlin-script-form-row")) return dataType(english);
  return void 0;
}
function translatePanelActions(element, field, english) {
  if (field === "text" && english.startsWith("This ") && element.closest(unsavedDialog + " [data-confirm-body]")) {
    const message = unsavedChangesMessage(english);
    if (message) return message;
  }
  const selectLabel = element.localName === "span" && element.parentElement?.parentElement?.classList.contains("custom-select");
  const optionLabel = element.parentElement?.getAttribute("role") === "option";
  if (field === "text" && (selectLabel || optionLabel)) {
    const filter = fieldOption(element, english);
    if (filter !== void 0) return filter;
    return scriptOption(element, english);
  }
  if (field === "aria-label" && element.closest(filterDialog)) {
    const criterion = /^Criterion (\d+): (.+)$/s.exec(english);
    if (criterion) return `条件 ${criterion[1]}：${criterion[2]}`;
    const remove = /^Remove criterion (\d+)$/.exec(english);
    if (remove) return `移除第 ${remove[1]} 个条件`;
    if (english.endsWith(" polarity")) return english.slice(0, -9) + "的匹配方式";
    if (english.endsWith(" is not")) return english.slice(0, -7) + "不等于";
    if (english.endsWith(" is")) return english.slice(0, -3) + "等于";
  }
  const classes = element.classList;
  if (field === "text" && classes.contains("outliner-name") || (field === "aria-label" || field === "title") && classes.contains("outliner-row")) return null;
  if (locations.has(english) && (field === "aria-label" || field === "text") && (classes.contains("ue-menu-label") || classes.contains("ue-menu-item"))) {
    const facet = element.closest(".nodrag.nowheel > .ue-menu:not(:first-child)");
    const active = facet?.previousElementSibling?.querySelector('button[aria-expanded="true"]');
    if (active?.matches('[aria-label="Filter by location"],[aria-label="按位置筛选"]')) return locations.get(english);
  }
  if (classes.contains("merlin-panel-chip-count") && field === "text") {
    const count = /^(\d+) (cards?|items?|tools?|hands?)$/.exec(english);
    if (count) {
      const units = count[2].startsWith("card") ? "张卡片" : count[2].startsWith("tool") ? "个工具" : count[2].startsWith("hand") ? "组手牌" : "个项目";
      return `${count[1]} ${units}`;
    }
  }
  if (field === "aria-label" && element.parentElement?.classList.contains("merlin-panel-chip") && english.startsWith("Remove filter ")) {
    const filter = english.slice("Remove filter ".length);
    return "移除筛选条件：" + (filter === "Archived" && element.parentElement === element.parentElement.parentElement?.firstElementChild ? "已归档" : filter);
  }
  if (classes.contains("merlin-script-form-inline-status") && field === "text" && english.startsWith("Appears under: ")) {
    const category = english.slice("Appears under: ".length);
    return "显示在工具架分类：" + (types.get(category) ?? category);
  }
  if (classes.contains("merlin-script-form-group")) {
    const locked = element.closest(".merlin-script-form")?.querySelector(".merlin-script-side-locked > span")?.textContent;
    if (locked && (locked.startsWith("This is a built-in graph,") || locked.startsWith("此节点图为内置模板"))) {
      return builtInGroups[english];
    }
  }
  if (field !== "aria-label" && field !== "title") return void 0;
  if (classes.contains("merlin-script-form-name") && english.endsWith(" name")) return english.slice(0, -5) + "的名称";
  if (classes.contains("custom-select") && element.parentElement?.parentElement?.classList.contains("merlin-script-form-row") && english.endsWith(" type")) return english.slice(0, -5) + "的类型";
  if (classes.contains("merlin-script-form-dot")) {
    const tile = /^Click to find “(.+)”; drag to place\b.*$/s.exec(english);
    if (tile) return `点击定位“${tile[1]}”，拖动可放置另一个关联图块`;
    const inGraph = /^Click to find “(.+)” in the graph$/s.exec(english);
    if (inGraph) return `点击在节点图中定位“${inGraph[1]}”`;
  }
  if (classes.contains("merlin-script-form-star") && field === "aria-label") {
    if (english.endsWith(" is the primary output")) return english.slice(0, -" is the primary output".length) + "是主要输出";
    const mark = /^Mark (.+) as primary output$/s.exec(english);
    if (mark) return `将 ${mark[1]} 设为主要输出`;
    for (const [state, zh] of requirements) if (english.endsWith(": " + state)) return english.slice(0, -(state.length + 2)) + "：" + zh;
  }
  return void 0;
}

// src/settings-actions-022.ts
function translateSettingsActions(element, field, english) {
  if (field !== "text") return;
  if (element.matches(".provider-onboarding > h2") && english.startsWith("Connect ")) {
    return "连接 " + english.slice("Connect ".length);
  }
  const accepted = " accepted the connection check.";
  if (element.matches(".provider-onboarding > p") && english.endsWith(accepted)) {
    return english.slice(0, -accepted.length) + " 已通过连接检查。";
  }
  if (element.matches('.settings-window-body main [role="dialog"]:has(> div > h3) > div > div[style*="color: var(--color-danger-muted)"]')) {
    for (const [prefix, label2] of [
      ["Invalid JSON in file: ", "文件中的 JSON 格式无效："],
      ["Invalid JSON: ", "JSON 格式无效："]
    ]) {
      if (english.startsWith(prefix)) return label2 + english.slice(prefix.length);
    }
  }
}

// src/settings-preview2.ts
var sections = {
  "Canvas & interaction": "画布与交互",
  "Grid & alignment": "网格与对齐",
  "Toolbox library paths": "工具箱资源库路径",
  "Custom fields": "自定义字段",
  "Editors & tools": "编辑器与工具",
  "Local servers": "本地服务器",
  "Webcam capture server": "摄像头采集服务器",
  "Media providers": "媒体服务商",
  "Model approval": "模型审批",
  "By capability": "按能力"
};
var categories = {
  "External paths": "外部路径",
  "Model providers": "模型服务商",
  "Model catalog": "模型目录",
  "Model schemas": "模型定义",
  "Default models": "默认模型"
};
var pinTypes = new Map(Object.entries({
  text: "文本",
  int: "整数",
  float: "浮点数",
  image: "图像",
  video: "视频",
  audio: "音频"
}));
var comfyPinPicker = 'div:has(> div > textarea[placeholder*="ComfyUI"]) [role=combobox]:is([title="Pin type"],[title="引脚类型"],[data-title-tip="Pin type"],[data-title-tip="引脚类型"])';
var catalogDialog = '[role="dialog"][aria-modal="true"]:is([aria-label^="Browse "],[aria-label^="浏览"]):has(> .merlin-panel-search)';
var catalogCategories = new Map(Object.entries({
  "image generation": "图像生成",
  "image upscaling": "图像放大",
  "video generation": "视频生成",
  "video upscaling": "视频放大",
  "audio generation": "音频生成",
  "text generation (llm)": "文本生成（LLM）",
  "mesh generation": "网格生成",
  "splat generation": "高斯泼溅生成",
  "rigging (auto-rig)": "自动绑定",
  "depth estimation": "深度估计"
}));
var modelCapabilityLabels = new Map(Object.entries({
  "audio-generator": "audio generation",
  "depth-estimator": "depth estimation",
  "image-generator": "image generation",
  "image-upscaler": "image upscaling",
  "mesh-generator": "mesh generation",
  "rigging": "rigging (auto-rig)",
  "splat-generator": "splat generation",
  "text-generator": "text generation (llm)",
  "video-generator": "video generation",
  "video-upscaler": "video upscaling"
}).map(([id, label2]) => [id, catalogCategories.get(label2)]));
var modelCapabilitySlot = '.settings-window-body > main [data-service-id] > div:first-child > div:nth-child(2),.settings-window-body > main [role="region"]:is([aria-label="Model catalog table"],[aria-label="模型目录表"]) button > div:has(> div:first-child > [data-testid="provider-icon"]) > div:nth-child(2)';
function catalogText(element, field, english, node) {
  if (field === "text" && element.closest("[role=option]")) {
    const list = element.closest("[role=listbox]");
    if (list?.id && Array.from(element.ownerDocument.querySelectorAll(catalogDialog + " [role=combobox][aria-controls]")).some((source) => source.getAttribute("aria-controls") === list.id)) return null;
  }
  const dialog = element.closest(catalogDialog);
  if (!dialog) return;
  if (field === "aria-label" && element === dialog || field === "text" && dialog.querySelector(":scope > div:first-child > span") === element) {
    if (english === "Browse models") return "浏览模型";
    const title = /^Browse (.+) models$/.exec(english);
    if (title) return "浏览" + (catalogCategories.get(title[1]) ?? title[1]) + "模型";
  }
  const body = dialog.lastElementChild;
  if (field === "text" && element.getAttribute("role") === "tab") return catalogCategories.get(english.toLowerCase());
  if (field === "text" && element.closest("[role=combobox]")) return null;
  if (field === "text" && element.matches("span:first-child") && element.parentElement?.nextElementSibling?.classList.contains("merlin-panel-search")) {
    return node === element.firstChild && english === "From" ? "来源：" : null;
  }
  if (element.parentElement?.parentElement === body && field === "text") {
    if (element.tagName === "BUTTON" && /^Set up /.test(english)) return "配置 " + english.slice(7);
    if (element.tagName === "SPAN") {
      if (element.parentElement?.firstElementChild?.tagName === "DIV") return null;
      if (element.parentElement?.getAttribute("role") === "alert") {
        return node === element.firstChild ? void 0 : null;
      }
      if (element.nextElementSibling?.tagName === "BUTTON") {
        const parts = element.childNodes;
        if (parts.length === 2 && node === parts[0]) return null;
        if (parts.length === 5 && (node === parts[1] || node === parts[3])) return null;
      }
    }
  }
  if (element.parentElement === body && field === "text") {
    const empty = /^No catalog here offers (.+) models\.$/.exec(english);
    if (empty) return "此处没有提供" + (catalogCategories.get(empty[1]) ?? empty[1]) + "模型的目录。";
    if (element.childNodes.length === 4) {
      if (english === "more match" && node === element.childNodes[1]) return "个其他";
      if (english === "es" && node === element.childNodes[2]) return "匹配项";
    }
  }
  const column = element.parentElement;
  if (column?.parentElement?.parentElement === body && column === column.parentElement.firstElementChild && column.nextElementSibling?.tagName === "DIV") return null;
}
function translateSettingsPreview2(element, field, english, node) {
  const capability2 = field === "text" ? modelCapabilityLabels.get(english) : void 0;
  if (capability2 && node === element.childNodes[2] && node.previousSibling?.nodeValue === " · " && element.matches(modelCapabilitySlot)) return capability2;
  const catalog = catalogText(element, field, english, node);
  if (catalog !== void 0) return catalog;
  if (field === "text" && pinTypes.has(english)) {
    if (element.closest(comfyPinPicker)) return pinTypes.get(english);
    const menu = element.closest("[role=option]")?.closest("[role=listbox]");
    if (menu?.id && Array.from(element.ownerDocument.querySelectorAll(comfyPinPicker + "[aria-controls]")).some((picker) => picker.getAttribute("aria-controls") === menu.id)) return pinTypes.get(english);
  }
  if (field === "text" && english.startsWith("Model '") && element.matches(".generation-shelf-status > span")) {
    const missing = /^Model '(.+)' has no confirmed credentials\. .*?(?:its key \("(.+)"\)|the Claude API key).*$/.exec(english);
    if (missing) return "模型“" + missing[1] + "”尚无已确认的凭据。请在“设置 → 模型服务商”中登录或添加" + (missing[2] ? "密钥“" + missing[2] + "”" : " Claude API 密钥") + "，然后重试。";
  }
  if (field === "text" && english.startsWith("Workflow loaded") && element.matches(':is(.canvas-card-preview,.graph-node-body) div:has(> svg[data-icon="file-download"]) > span')) {
    const loaded = /^Workflow loaded · (\d+) nodes?$/.exec(english);
    if (loaded) return "已载入工作流（" + loaded[1] + " 个节点）";
  }
  if (field === "text" && /^\d+ nodes parsed$/.test(english) && element.matches('div:has(> textarea[placeholder*="ComfyUI"]) > div')) {
    return "已解析 " + english.split(" ")[0] + " 个节点";
  }
  if (!element.closest(".settings-window-body")) return;
  if (element.matches(".settings-group-header h3, .settings-group-header h3 span") && field === "text") return sections[english];
  if (element.matches(".settings-group-header button[aria-expanded]") && (field === "title" || field === "aria-label")) {
    const toggle = /^(Expand|Collapse) (.+)$/.exec(english);
    if (toggle && sections[toggle[2]]) return (toggle[1] === "Expand" ? "展开" : "折叠") + "“" + sections[toggle[2]] + "”";
  }
  if (element.matches('.settings-pane-header input[type="search"]') && (field === "aria-label" || field === "placeholder")) {
    const search = /^Search (.+?)(?: settings|…)$/.exec(english);
    if (search && categories[search[1]]) return "搜索" + categories[search[1]] + (field === "placeholder" ? "…" : "设置");
  }
  if (field === "text" && element.matches('.settings-window-body [role="region"] button > div > div')) {
    const missing = /^no credential for (.+?);.*? to run "(.+)"$/.exec(english);
    if (missing) return "缺少 " + missing[1] + " 的凭据。请在“设置 → 模型服务商”中登录或添加密钥，以运行“" + missing[2] + "”。";
    const disabled = /^no provider is allowed to run "(.+)"$/.exec(english);
    if (disabled) return "没有获准运行“" + disabled[1] + "”的服务商。";
  }
  if (field === "text" && element.matches(".settings-row-value div[id], .settings-row-value span")) {
    const noServer = /^No ComfyUI server is saved for (.+?),.*$/.exec(english);
    if (noServer) return "尚未为 " + noServer[1] + " 保存 ComfyUI 服务器，Unreal Canvas 不会在该地址启动服务。";
    const args = /^(\d+) arguments?$/.exec(english);
    if (args) return args[1] + " 个参数";
  }
}

// src/shelf-actions.ts
var counts = { "Batch slot": "批量插槽", Batch: "批量输入" };
var namedAgentLabel = '.generation-shelf-menu:is([aria-label="Agent"],[aria-label="智能体"]) button.generation-shelf-menu-option[role="menuitemradio"]:is([aria-label^="Work with "],[aria-label^="Working with "]) > .generation-shelf-menu-copy > span';
var outputControl = ".generation-shelf-output > span button.generation-shelf-menu-trigger,.generation-shelf-output > button.generation-shelf-menu-trigger";
var shelfMenu = '.generation-shelf-menu[role="menu"]';
var outputRow = ".generation-shelf-menu-row > button.generation-shelf-menu-option";
var outputRowLabel = outputRow + " > .generation-shelf-menu-copy > span:first-child";
var outputRowHint = outputRow + " > .generation-shelf-menu-copy > .ue-menu-detail";
var outputChoices = /* @__PURE__ */ new Map([
  ["Create new card", "创建新卡片"],
  ["Create new deck", "创建新卡组"],
  ["Add to deck", "添加到卡组"],
  ["Agent chooses", "由智能体选择"]
]);
function optionProps(button) {
  if (!button) return;
  for (let owner = renderedFiber(button); owner; owner = owner.return ?? void 0) {
    if (owner.memoizedProps?.option) return owner.memoizedProps.option;
  }
}
function selectedBatchOutput(button) {
  const propKey = Object.keys(button).find((key) => key.startsWith("__reactProps$"));
  const liveProps = propKey && Object.getOwnPropertyDescriptor(button, propKey)?.value;
  const mounted = renderedFiber(button);
  const committed = mounted?.memoizedProps === liveProps ? mounted : mounted?.alternate?.memoizedProps === liveProps ? mounted?.alternate : void 0;
  for (let owner = committed; owner; owner = owner.return ?? void 0) {
    const deck = owner.memoizedProps?.options?.find((option) => option.id === "same");
    if (deck) return deck.children?.some((option) => option.id === "sources" && option.selected);
  }
}
function outputSummary(value, button) {
  if (value === "Create new card") return "输出到新卡片";
  if (value === "Create new deck") return "输出到新卡组";
  if (value === "Agent chooses") return "输出目标由智能体选择";
  const deckPrefix = "Add to deck · ";
  if (!value.startsWith(deckPrefix)) return;
  const name = value.slice(deckPrefix.length);
  return name === "From batch" && button && selectedBatchOutput(button) ? "输出到各批量输入所属的卡组" : "输出到卡组“" + name + "”";
}
function shelfOutput(element, field, value) {
  if ((field === "aria-label" || field === "title" || field === "data-title-tip") && element.matches(outputControl)) {
    if (value.startsWith("Output: ")) return outputSummary(value.slice("Output: ".length), element);
    if (value === "Choose an available deck or Create new card to continue.") return "先选择可用的卡组，或创建新卡片以继续。";
    if (value === "Choose an available deck or Create new deck to continue.") return "先选择可用的卡组，或创建新卡组以继续。";
  }
  if (field === "text" && element.matches(".generation-shelf-output-name")) {
    return outputChoices.get(value) ?? outputSummary(value, element.closest(outputControl) ?? void 0);
  }
  const label2 = field === "text" && element.matches(outputRowLabel);
  const description = field === "text" && element.matches(outputRowHint);
  const aria = field === "aria-label" && element.matches(shelfMenu + "," + outputRow);
  if (!label2 && !description && !aria) return;
  const menu = element.closest(shelfMenu);
  const root = menu?.parentElement?.closest(shelfMenu) ?? menu;
  const trigger = root?.id && Array.from(element.ownerDocument.querySelectorAll(outputControl)).find((button) => button.getAttribute("aria-controls") === root.id);
  if (!trigger) return;
  if (aria && element === root && value.startsWith("Output: ")) return outputSummary(value.slice("Output: ".length), trigger);
  if (aria && element === menu && value === "Add to deck") return "添加到卡组";
  if (description) {
    const pick = /^Click to use ([\s\S]+); hover to choose a deck$/.exec(value);
    if (menu === root && pick) return "点击使用“" + pick[1] + "”，悬停可选择卡组。";
    if (menu !== root && value === "This card was removed") return "此卡片已移除。";
    return;
  }
  if (menu === root) return outputChoices.get(value);
  if (optionProps(element.closest(outputRow))?.id === "sources" && value === "From batch") return "来自批量输入";
  return value;
}
var voiceInstructions = {
  "Keep Ctrl held while speaking.": "说话时请按住 Ctrl 键。",
  "Press again to stop.": "再按一次即可停止。"
};
var progressPhases = new Map(Object.entries({
  start: ["Opening your workspace", "正在打开工作区"],
  read: ["Reading canvas", "正在读取画布"],
  "expand-tree": ["Loading graphs", "正在加载节点图"],
  migrate: ["Upgrading canvas", "正在升级画布"],
  normalize: ["Preparing canvas", "正在准备画布"],
  versions: ["Reading history", "正在读取历史记录"],
  register: ["Opening canvas", "正在打开画布"],
  results: ["Restoring results", "正在恢复结果"],
  "background results": ["Restoring results", "正在后台恢复结果"]
}));
function progress(element, field, value) {
  const title = field === "title" ? value : element.getAttribute("title") ?? "";
  const separator = title.lastIndexOf(" — ");
  const phase = separator < 0 ? "" : title.slice(separator + 3);
  const definition = progressPhases.get(phase) ?? (field === "text" ? [...progressPhases.values()].find((pair) => pair[1] === phase) : void 0);
  if (definition && field === "title") return title.slice(0, separator) + " — " + definition[1];
  if (field !== "text") return;
  const options = definition ? [definition] : [...progressPhases.values()];
  for (const [source, translated] of options) {
    if (!value.startsWith(source)) continue;
    const suffix = value.slice(source.length);
    if (/^(…| \d+…| \d+\/\d+\+?)?$/.test(suffix)) return translated + suffix;
  }
}
function batchPosition(label2) {
  const reference = /^Reference (\d+)$/.exec(label2);
  return reference ? "参考素材 " + reference[1] : label2;
}
function outputTooltipControl(popup) {
  for (let owner = renderedFiber(popup); owner; owner = owner.return ?? void 0) {
    const wrapper = owner.stateNode;
    if (wrapper?.nodeType !== 1 || !wrapper.hasAttribute("data-tooltip-owner")) continue;
    const button = wrapper.firstElementChild;
    return button?.matches(outputControl) ? button : void 0;
  }
}
function tooltip(element, value) {
  const parent = element.parentElement;
  const popup = parent?.parentElement;
  if (!parent || !popup?.matches('[role="tooltip"]')) return;
  const footer2 = parent.lastElementChild?.textContent?.trim();
  if (["Choose where results land", "选择结果的输出位置"].includes(footer2 ?? "")) {
    if (element === parent.firstElementChild && value === "Output") return "输出";
    if (element !== parent.lastElementChild) return outputChoices.get(value) ?? outputSummary(value, outputTooltipControl(popup));
  }
  if (element === parent.firstElementChild && value.startsWith("Settings · ") && ["Click to hide the settings", "Click to change them", "点击收起设置", "点击修改设置"].includes(footer2 ?? "")) {
    return "设置 · " + value.slice("Settings · ".length);
  }
  if (element === parent.firstElementChild && value.startsWith("Working with ") && (copyId(footer2 ?? "") === "13503ee6df5fc76a" || footer2?.startsWith("切换智能体或独立工作"))) {
    return "正在与“" + value.slice("Working with ".length) + "”协作";
  }
  const voice = /^Press (.+?) to dictate\b.*?\. (Keep Ctrl held while speaking\.|Press again to stop\.)$/.exec(value);
  if (voice) return "按 " + voice[1] + " 可在此处听写，或在画布中打开语音聊天。" + voiceInstructions[voice[2]];
  const runs = /^Batch · (\d+) runs?$/.exec(value);
  if (runs && element === parent.firstElementChild) return "批量 · " + runs[1] + " 次运行";
}
function translateShelfAction(element, field, value) {
  const output = shelfOutput(element, field, value);
  if (output !== void 0) return output;
  if (field === "text" && element.matches(namedAgentLabel)) return value;
  if (field === "text" && value === "Browse models…" && element.matches('.ue-menu [role="listbox"] .ue-menu-item[role="option"][data-value] > span:last-child')) {
    const option = element.parentElement?.getAttribute("data-value");
    if (option?.startsWith("\0footer-action-")) return "浏览模型…";
  }
  const cls = element.classList;
  if (cls.contains("label") && element.matches("#splash .loading-status .label")) return progress(element, field, value);
  if (element.localName === "button" && element.hasAttribute("title") && element.matches(".merlin-generation-host > div > div > div > button")) {
    if (field === "title" && copyId(value) === "ce624c5d25d02c89") return "查看加载耗时明细（也可在控制台运行 __merlinLoad.log()）";
    const result = progress(element, field, value);
    if (result) return result;
  }
  if (field === "text" && element.parentElement?.parentElement?.getAttribute("role") === "tooltip") {
    return tooltip(element, value);
  }
  if (cls.contains("canvas-card-facet-star") && (field === "title" || field === "aria-label")) {
    const stars = /^Rate ([1-5])$/.exec(value);
    if (stars) return "评为 " + stars[1] + " 星";
    if (value === "Clear your rating") return "清除我的评分";
  }
  if (field === "text" && element.matches("[data-add-reference-popover] > div:last-child > button:is(.pill-menu-item,.ue-menu-item)")) {
    const selected = /^Use selected \((\d+)\)$/.exec(value);
    if (selected) return "使用所选内容（" + selected[1] + " 项）";
  }
  if (field === "aria-description" && cls.contains("generation-shelf-selection-item")) {
    const descriptions = {
      "5ada1addbf0016dd": "拖动或按 Alt 加左右方向键排序。",
      "b04d6f31170506c0": "按空格键加入批次。",
      "ef3e4c580953dd56": "拖动或按 Alt 加左右方向键排序，按空格键加入批次。"
    };
    return descriptions[copyId(value)];
  }
  if (field === "aria-label") {
    if (cls.contains("generation-shelf-batch-slot") || cls.contains("generation-shelf-batch-well")) {
      const count = /^(Batch slot|Batch): (\d+) inputs?$/.exec(value);
      if (count) return counts[count[1]] + "：" + count[2] + " 项输入";
    }
    if (cls.contains("generation-shelf-selection-item") && element.getAttribute("data-batch") === "true" && value.startsWith("Batch position · ")) return "批量输入位置 · " + batchPosition(value.slice("Batch position · ".length));
    if (element.matches(".generation-shelf-batch-member button,.generation-shelf-batch-well button")) {
      const move = /^Move (.+) out of batch$/.exec(value);
      if (move) return "将“" + move[1] + "”移出批量输入";
      const remove = /^Remove (.+) from inputs$/.exec(value);
      if (remove) return "从输入中移除“" + remove[1] + "”";
    }
    if ((cls.contains("generation-shelf-generate-options") || cls.contains("generation-shelf-menu")) && value.startsWith("Output: Add to Deck · ") && value !== "Output: Add to Deck · From Batch") {
      return "输出到卡组“" + value.slice("Output: Add to Deck · ".length) + "”";
    }
    if (cls.contains("generation-shelf-reference-pick") && value.endsWith(" reference")) {
      const reference = /^Reference (\d+) reference$/.exec(value);
      if (reference) return "参考素材 " + reference[1];
    }
  }
  if (field === "text") {
    if (cls.contains("generation-shelf-selection-badge") && element.closest('[data-batch="true"]')) {
      const reference = /^Reference (\d+)$/.exec(value);
      if (reference) return "参考素材 " + reference[1];
    }
    if (cls.contains("generation-shelf-well-title") && value.startsWith("Batch · ")) return "批量 · " + value.slice("Batch · ".length);
    if (element.matches(".generation-shelf-batch-popover > p,.generation-shelf-batch-well p")) {
      const each = /^Each batch card runs here, as (.+?)\.(?: (Drag (?:this tile|it onto)\b.*\.))?$/.exec(value);
      if (each) return "每张批量卡片都会作为“" + batchPosition(each[1]) + "”运行。" + (each[2] ? "拖动可更改输入位置。" : "");
    }
    if (cls.contains("generation-shelf-generate") || cls.contains("generation-shelf-generate-label")) {
      const batch = /^Send batch · (\d+) inputs?$/.exec(value);
      if (batch) return "发送批量输入 · " + batch[1] + " 项";
      const run = /^Run (\d+) (Images?|Items?)$/.exec(value);
      if (run) return "运行并生成 " + run[1] + (run[2].startsWith("Image") ? " 张图像" : " 项结果");
      const generate = /^Generate · (\d+) (images?|items?)$/.exec(value);
      if (generate) return "生成 " + generate[1] + (generate[2].startsWith("image") ? " 张图像" : " 项结果");
    }
  }
}

// src/locales/workspace-details.json
var workspace_details_default = {
  translations: {
    "#62:79a7b024c350d9dc": "（按资产补偿 glTF 与 UE 的正面朝向差异）",
    "#40:f4d0aed7b77bf0d2": "（留空以使用定序器当前打开的序列）",
    "#20:ef18a3fa5ddd7aa0": "（取去掉扩展名的文件名）",
    "+ Add Image": "+ 添加图像",
    "+ Add input": "+ 添加输入",
    "#54:b5313adf324aa7c9": "＋添加输入，点击或将连线拖到接口圆点",
    "+ Add output": "+ 添加输出",
    "#55:ad374fbb345e8610": "＋添加输出，点击或将连线拖到接口圆点",
    "0 = unlimited": "0 表示无限制",
    "#29:592d289632575ba6": "填 0 即使用从当前位置到片尾的全部内容。",
    "1 per pixel": "每像素 1 次",
    "1 · red": "1 · 红",
    "10 (fast)": "10（快速）",
    "10 seconds": "10 秒",
    "1024 × 1024 (square)": "1024 × 1024（正方形）",
    "1080 × 1920 (vertical)": "1080 × 1920（竖屏）",
    "16 per pixel": "每像素 16 次",
    "1920 × 1080 (HD)": "1920 × 1080（高清）",
    "2 · blue": "2 · 蓝",
    "20 (recommended)": "20（推荐）",
    "2048 × 2048 (square)": "2048 × 2048（正方形）",
    "262K (max quality)": "262K（最高质量）",
    "3 · green": "3 · 绿",
    "32K (fastest)": "32K（最快）",
    "3840 × 2160 (UHD)": "3840 × 2160（超高清）",
    "4 per pixel": "每像素 4 次",
    "4 · orange": "4 · 橙",
    "5 seconds": "5 秒",
    "5 · pink": "5 · 粉",
    "6 · purple": "6 · 紫",
    "7 · cyan": "7 · 青",
    "720 × 1280 (vertical)": "720 × 1280（竖屏）",
    "8 · lime": "8 · 黄绿",
    AR: "阿拉伯语",
    "#40:ac0223608540d7e2": "支持算式，例如 1920/512。",
    Add: "相加",
    "Add USD scene": "添加 USD 场景",
    "#43:f4812ea0f3580fa7": "从画布、磁盘或剪贴板导入 USD 场景",
    "Add a task…": "添加任务…",
    "Add additional providers": "添加更多服务商",
    "Add audio": "添加音频",
    "#39:3dc20ff5dfef957d": "从画布、磁盘或剪贴板导入音频",
    "#129:4c8582e382f0bede": "在目标内部标前景点，在需要排除的位置标背景点。坐标以源图像素计。",
    "Add image": "添加图像",
    "#39:5081216f6aea5e5e": "从画布、磁盘或剪贴板导入图像",
    "Add mesh": "添加网格",
    "#38:14d2de54cb5e9906": "从画布、磁盘或剪贴板导入网格",
    "Add provider": "添加服务商",
    "Add task (Enter)": "添加任务（Enter）",
    "Add video": "添加视频",
    "#39:552ba26bd2cd3bd0": "从画布、磁盘或剪贴板导入视频",
    Aggregator: "聚合方式",
    "Align to image": "与图像对齐",
    "Allow Overwrite": "允许覆盖",
    "#111:beac051b71025325": "额外从原始几何体烘焙环境光遮蔽。原网格缺少遮蔽贴图时会采用烘焙结果。",
    "#121:4b59784bab7d7ea2": "可将生成的序列同时存到 /Game/Merlin/RepositionSequence，供定序器打开。默认关闭。",
    "Ambient Occlusion": "环境光遮蔽",
    "#194:4edb2da01f55e2f4": "UE 离屏运行时按给定宽高输出。使用可见窗口时保留视口大小，并等比缩放到目标范围内。",
    "Android OpenGL High": "Android OpenGL 高画质",
    "Android OpenGL Low": "Android OpenGL 低画质",
    "Android OpenGL Mid": "Android OpenGL 中画质",
    "Android Vulkan High": "Android Vulkan 高画质",
    "Android Vulkan Low": "Android Vulkan 低画质",
    "Android Vulkan Mid": "Android Vulkan 中画质",
    Annotated: "已批注",
    Annotations: "批注",
    Any: "任意",
    "#43:55abbad72de02e73": "接受任意值，请到详情面板指定类型。",
    "Aperture size": "孔径大小",
    "#162:58d2b798aab3c8a2": "把骨骼用于原始分辨率的带纹理网格。导入 UE 时建议保留此项。",
    "#88:8b13039ae460d8a3": "渲染采用视口当前的显示标志，可控制雾、地形、粒子或网格线等。",
    "#196:037be524fa65bdb0": "渲染沿用视口模式，如光照、无光照或线框等。缓冲区可视化由 MRG 作为数据通道单独输出。",
    "Aspect Ratio": "宽高比",
    Asset: "资产",
    "Asset Name": "资产名称",
    "Asset Path": "资产路径",
    "Asset orientation": "资产朝向",
    "#136:80837529dbbc1509": "K 限定每步候选数。减小 K 可使骨架更稳定，增大可增加多样性。",
    Audio: "音频",
    "Audio File": "音频文件",
    Auto: "自动",
    "Auto (detect)": "自动检测",
    "Auto-detect": "自动检测",
    "#71:632cc84e7be15a45": "自动判断导入类型。有绑定的 GLB 或 FBX 按骨骼网格体处理，其他文件按静态网格体处理。",
    BG: "背景",
    Background: "背景",
    "Background Color": "背景颜色",
    Bake: "烘焙",
    Balanced: "均衡",
    "Bank sampler": "视图库采样器",
    "Base Model": "基础模型",
    BaseColor: "基础颜色",
    "#127:7e76ada0560c013d": "增大束宽会同时尝试更多骨架，可能提高完整性并增加耗时。",
    Beams: "束搜索宽度",
    Beauty: "最终合成",
    "Bias to cam roll": "偏向相机滚转角",
    Black: "黑色",
    Boolean: "布尔值",
    Bottom: "下",
    "Box threshold": "检测框阈值",
    Browse: "浏览",
    "Cam prior (narrow grid)": "相机先验（窄网格）",
    "#240:f50203ab176880d2": "相机先验使用 45 个视角，预热约 3 秒。适用于 Tripo 3.1 的 align_image。cam_prior 以 3×3×5 采样，偏航 ±5°、俯仰和滚转各 ±25°。",
    Camera: "相机",
    "Camera Cuts Track": "相机切换轨道",
    "Camera Rotation": "相机旋转",
    CameraSource: "相机来源",
    "Canny (classical, thresholded)": "Canny（经典阈值法）",
    "Canny Edges": "Canny 边缘",
    Canvas: "画布",
    Capture: "采集",
    "Capture stage": "采集阶段",
    "#222:a025985003ec29e7": "cam_prior 以输入相机在 UE 世界坐标中的滚转角为搜索中心，适合倾斜相机。fibonacci 采样忽略此项。",
    "Checking…": "正在检查…",
    "#35:39febc428643d894": "指定渲染时要使用的相机。",
    "Choose…": "选择…",
    "#106:f417834180423247": "对蒙皮权重进行体素平滑，以改善变形效果。",
    "#46:df10faca100769d5": "点击预设以载入参数，再按各资产单独微调",
    "#10:8fd1ee4971931fc1": "顺时针方向。",
    "#45:2c6f2f1bb1fcf40e": "闭合此路径，使末点连回起点",
    Coarse: "粗略",
    Coarser: "更粗略",
    "Coarsest — major boundaries only": "最粗（仅主要边界）",
    Color: "颜色",
    "Colour group": "颜色组",
    "#239:72702cb7633566bc": "校正资产正面相对 UE Actor 的 +X 偏角。Tripo 3.1 使用 align_image 时可从 90° 起调，也可按 45° 间隔尝试其他角度。",
    Compression: "压缩",
    "Configured checks": "已配置的检查项",
    "Connect Image to pick pixel": "连接图像以选择像素",
    "#58:92fcbd9db6bdc016": "将视口渲染节点或其烘焙帧接到",
    "#41:de50f86d740a1817": "将视频接到背景输入以显示预览。",
    "#27:5c0fdaddfeae7228": "接入视频以显示预览。",
    "#42:fc5be90b22e39603": "将图像接到背景输入以显示预览。",
    "#28:a7499a865b9af2ec": "接入图像以显示预览。",
    Connected: "已连接",
    Connection: "连接",
    Count: "数量",
    Creative: "创意",
    "Crop (% of source)": "裁剪（占原图百分比）",
    Custom: "自定义",
    Cutout: "抠像",
    DE: "德语",
    Darken: "变暗",
    "Decrease font size": "减小字号",
    Depth: "深度",
    "Depth Estimation": "深度估计",
    "Depth aggregator": "深度聚合",
    "#242:3b603774d70cc7b9": "单张图像推算的是无单位的相对深度。接入 UE 的原始深度可换算成厘米。模型在本机执行，首次会安装 Python 依赖。",
    DepthMap: "深度图",
    Destination: "目标位置",
    "Destination Path": "目标路径",
    Detail: "细节",
    "DexiNed (perceptual, no calibration)": "DexiNed（感知式，无需校准）",
    Dialog: "对话框",
    Difference: "差值",
    "Disable PBR": "禁用 PBR",
    Disappear: "消失",
    "Double-click to edit": "双击编辑",
    "Double-click to rename": "双击重命名",
    "#30:9f1d11d4a234078c": "设为 2 可使长和宽各扩大一倍。",
    "#38:44145690b3bd997e": "拖动可改变尺寸，双击可还原。",
    Duration: "时长",
    "Duration (s)": "时长（秒）",
    EN: "英语",
    ES: "西班牙语",
    "#27:2cefdf7c0b06e523": "每一项都应填写数值。",
    "Edge Detection": "边缘检测",
    Edges: "边",
    "Editor world (no PIE)": "编辑器世界（无 PIE）",
    "Editor's platform": "编辑器所在平台",
    Emissive: "自发光",
    "#74:2b1a168de0d757ab": "自发光强度取 0 到 10。超出范围会在生成时取最近的界限值。",
    Enabled: "已启用",
    Encoding: "编码",
    "End (s)": "终点（秒）",
    End_frame: "结束帧",
    "Ends early": "前景提前结束时",
    "Enhance Details": "增强细节",
    EstimatedDepth: "估计深度",
    "Exact size": "精确尺寸",
    "Expected aspect:": "预期宽高比：",
    "Export Images": "导出图像",
    "Expose as input pin": "公开为输入引脚",
    "External file": "外部文件",
    FG: "前景",
    "FIGMA FETCH": "获取 Figma 设计",
    "FLUX.1-Krea-dev (realistic)": "FLUX.1-Krea-dev（写实）",
    "FLUX.1-dev (stylized)": "FLUX.1-dev（风格化）",
    FPS: "帧率",
    FR: "法语",
    "Face limit": "面数上限",
    "Far cm": "远端（厘米）",
    "Fibonacci (uniform)": "斐波那契（均匀）",
    "#226:0488cc9e2d1aa132": "斐波那契方案使用 300 个均匀分布的视角，预热约 5–8 秒。适用于朝向未知的网格，如 Rodin、Meshy、Trellis 或未启用 align_image 的 Tripo。",
    Fill: "填充",
    "Fill opacity": "填充不透明度",
    Fine: "精细",
    "Finest — includes texture": "最细（含纹理）",
    "First frame": "第一帧",
    Fit: "适应",
    "#197:6b6689af025d015b": "适应会保留整图和比例，空余处露出背景。填充会等比放大并裁边。拉伸则分别调整宽和高。",
    "Flip horizontal": "水平翻转",
    "Flip vertical": "垂直翻转",
    Float: "浮点数",
    "Font size (8–48)": "字号（8–48）",
    Foreground: "前景",
    Frame: "框架",
    "Frame number": "帧编号",
    "Frame rate": "帧率",
    "Frame to extract": "要提取的帧",
    "Fused (default, balanced)": "融合（默认，均衡）",
    Gap: "间距",
    "Generic (fibonacci)": "通用（斐波那契）",
    "Google Search": "Google 搜索",
    Grain: "颗粒",
    "Graph inputs": "节点图输入",
    "Graph outputs": "节点图输出",
    Guide: "引导图",
    "H.264 output": "H.264 输出",
    HI: "印地语",
    "HTML source": "HTML 源码",
    "#120:b6a10ccd83a948b3": "设置 cam_prior 向上和向下搜索的角度。Tripo 资产通常可先试 ±25°。",
    "#171:f4d0339e27084d0b": "设置 cam_prior 沿相机视轴左右滚转的搜索角度。Tripo 资产可从 ±25° 开始。",
    "#144:0bfa88d99db3a6ab": "设置 cam_prior 在中心偏航角两侧各搜索多少度。开启 align_image 时通常可先试 ±5°。",
    Halo: "光晕",
    Height: "高度",
    "High threshold": "高阈值",
    "#63:7f33a06867ebc82b": "增大数值能更好地保留原图结构。",
    "#50:54a0038d5cd8b021": "增大数值允许模型更自由地创作。",
    "Hold last frame": "保持最后一帧",
    Host: "主机",
    "#175:9c1949b060a9031b": "重复惩罚过大会漏掉手指或尾部等骨骼。出现此情况可试用 1.1–1.3。",
    "#249:ec697229f6d438c2": "前景可选适应、填充或拉伸。适应保留整幅前景，填充等比裁边，拉伸单独匹配背景宽高。",
    "#286:6e40eb4534442bef": "将遮罩内的深度汇总为 depth_estimate_m。min 取最近点，median 取中位数，pNN 表示第 NN 百分位。默认 p5 侧重前表面，遮罩边缘有误差时比中位数更合适。",
    IT: "意大利语",
    Image: "图像",
    "Image 1": "图像 1",
    "Image A": "图像 A",
    "Image B": "图像 B",
    "Image Scale": "图像缩放比例",
    "Image[]": "图像数组",
    Images: "图像",
    Imagination: "想象力",
    Import: "导入",
    "#65:ea5c765a8dbe4d86": "使用指定的资产名和目标路径直接导入",
    In: "输入",
    "Increase font size": "增大字号",
    "Indexed instance": "按索引选择实例",
    "#30:ba5c96c3f746b97d": "请填写整数索引。",
    InitialTransform: "初始变换",
    Inputs: "输入",
    "#84:66420fe547b70207": "把父画布的值经输入引脚送到子画布。",
    Int: "整数",
    Intensity: "强度",
    JA: "日语",
    KO: "韩语",
    "Keep scene state": "保留场景状态",
    "#226:aeec6d88ef13f43b": "调整卡片光照时可实时预览编辑器视口、UE 视口卡片及编辑器世界渲染。每个编辑器仅预览一张卡片，关闭后还原关卡光照。",
    "L2 gradient": "L2 梯度",
    Language: "语言",
    "Largest score": "最高分",
    "Last frame": "最后一帧",
    "Last run": "上次运行",
    Layout: "布局",
    "#36:9658df68934a7e2e": "留空使用模型预设。",
    "#68:531f5ad352d32c50": "留空沿用原帧率，指定新帧率可启用补帧。",
    "#40:98fc44b233fc0650": "留空以采用 Canvas 的默认值",
    Left: "左",
    "#50:3dab86785159c5ed": "设置 A 到 B 的时长。使用 Seedance 时至少为 4 秒。",
    "Level Sequence": "关卡序列",
    Lighten: "变亮",
    Lighting: "光照",
    Lists: "列表",
    "Loc X": "X 位置",
    "Loc Y": "Y 位置",
    "Loc Z": "Z 位置",
    "Location (cm)": "位置（厘米）",
    Look: "外观",
    Loop: "循环播放",
    Loudness: "响度",
    "Low threshold": "低阈值",
    "#117:05e1d89f35646f90": "未找到目标可调低检测阈值。多个标签用逗号分开，例如",
    "MCP Tool": "MCP 工具",
    "MCP URL": "MCP 地址",
    MD: "Markdown",
    "MRG Preset": "MRG 预设",
    "Markdown source": "Markdown 源码",
    Mask: "遮罩",
    "Match Aspect": "匹配宽高比",
    "Match Visibility": "匹配可见性",
    "Match preset": "匹配预设",
    "#216:69b3feb9b6d22c58": "可沿用 MRG 预设或填写自定义宽高。1080p、1440p 和 2160p 为 16:9。匹配相机宽高比时，所选尺寸确定长边。",
    "Match size": "匹配尺寸",
    "#157:bf756a474452dbae": "按编辑器中的可见状态渲染 Actor。编辑器里隐藏的对象不参与，在编辑器中显示但设为游戏中隐藏的对象仍会渲染。",
    "Material IDs": "材质 ID",
    Matte: "遮罩",
    "Max Tokens": "最大词元数",
    Medium: "中等",
    Merge: "合成",
    Mesh: "网格模型",
    "Mesh Source": "网格来源",
    "Mesh Type": "网格类型",
    "#89:6ac478a97913d136": "将重新展开 UV 的网格接到“网格”，原始带纹理的网格接到“来源”。",
    MetallicRoughness: "金属度与粗糙度",
    Method: "方法",
    Metric: "公制",
    Mode: "模式",
    Model: "模型",
    "More options (": "更多选项（",
    "#48:9ed95722ed6e357d": "提高采样数可让贴图更平滑，也会增加烘焙时间。",
    "Move X (px)": "X 向位移（像素）",
    "Move Y (px)": "Y 向位移（像素）",
    Multiply: "正片叠底",
    "#20:a49982e2aed77f67": "偏航、俯仰和滚转方向的采样数量",
    NL: "荷兰语",
    Name: "名称",
    "Near cm": "近端（厘米）",
    "No file selected": "未选择文件",
    "No models available": "没有可用模型",
    "#70:26225f44ffca1d55": "当前没有引脚。点击下方横条或将连线接到圆点即可新增。",
    "No tasks yet": "暂无任务",
    "#235:a741c90f45c937b8": "DexiNed 生成边缘概率图，无需阈值。细节参数可选七个内部图之一，也可接入整数引脚。请先在设置中指定模型目录。",
    "No tool selected": "尚未选择工具",
    Noise: "噪声",
    Normal: "法线",
    "#118:865f1d7424e8e875": "P 决定累计概率覆盖范围，减小它可收窄候选集。",
    "#46:3575f0cf619c22b6": "cam_prior 沿俯仰方向的采样数量。",
    "#85:d1937965274524b6": "每个偏航和俯仰位置的滚转采样数。总视角数为三个轴的采样数相乘。",
    "#44:e6a59b5c5139c0a5": "cam_prior 沿偏航方向的采样数量。",
    "#37:68ac20425923e04b": "用逗号或换行分隔多个数字",
    Occlusion: "遮蔽",
    "#12:8f3c27b29a7a6e7e": "停用后采用 H.265 编码。",
    "#193:17e820fc501f60eb": "开启后按渲染相机比例输出并消除黑边，分辨率仅决定大小。关闭则按指定宽高输出，必要时补黑边。",
    "#50:75f58383097bdb62": "每行输入一组 RGB 或 RGBA 数值，以逗号分隔。每个分量在 0 到 1 之间。",
    "#30:96aad74d3785cb01": "每行输入一对索引",
    "#24:d4c6a3acd0108d45": "每行输入一个二维点 x, y",
    "#27:311a1904a4be90b1": "每行输入一个三维点 x, y, z",
    "#138:621b7a9c22726aeb": "每行一组 x, y 表示顶点，空行分隔多边形。单独一行减号表示接下来输入上一多边形的孔。",
    "#97:8364adf17b18e916": "每行填一个变换。先填位移 x, y, z，可以用分号依次接上旋转 pitch, yaw, roll 和缩放 x, y, z。",
    "#43:3b008fb108e45d01": "每行输入构成一个三角形的三个顶点索引",
    "#35:5feb1fb382932e15": "需先开启“跳过对话框”",
    "Opacity (%)": "不透明度（%）",
    Operation: "操作",
    "#40:fb49e49072e1a21f": "可选填希望增加的图片细节…",
    "#44:558a9a1210df82df": "可选填模型回复要求。",
    "#65:ad17fdc94f75b8f4": "可省略网格输入，操作将以空网格为起点。",
    "Original Size": "原始尺寸",
    Out: "输出",
    Output: "输出",
    "#104:c94bdedc7aa92d9f": "导出带背景声音的 H.264 MP4。仅在当前页面无法播放 MP4 时生成额外的 WebM。",
    "#82:eed569a7a821c1d1": "输出可放大 2–8 倍，支持小数。",
    Over: "正常叠加",
    "#467:5e1f5962814325d3": "正常按透明度叠放，滤色可提亮，相加可产生辉光并以白色为上限。变亮和变暗逐通道取较亮或较暗值，正片叠底压暗，差值将相同颜色显示成黑色。",
    PL: "波兰语",
    PT: "葡萄牙语",
    Padding: "内边距",
    Parameters: "参数",
    "Pick a mesh from Unreal…": "从 UE 选择网格…",
    Piloted: "当前驾驶的相机",
    Pitch: "音高",
    "Pitch ± (°)": "俯仰 ±（°）",
    "#122:8332119d6f736bcc": "默认以公告板底部为枢轴并吸附地面。悬挂牌或壁画可取消此项，改用中心枢轴。",
    Pixel: "像素",
    "Pixel X": "像素 X",
    "Pixel Y": "像素 Y",
    Platform: "平台",
    "Play In Editor": "在编辑器中播放（PIE）",
    "#290:ac3ca218fef30914": "需要物理、蓝图或序列事件时使用“在编辑器中播放”。大型关卡可能等待数分钟。快速预览可选“编辑器世界”，直接采用现有光照和时刻。",
    "#80:8114e411ef5dafd7": "播放后捕获当前视口的一帧，然后停止。",
    PointCloud: "点云",
    "Points (": "标记点（",
    PolyGroups: "多边形组",
    Port: "端口",
    "#98:f57de92c9eeb3337": "用 DINOv2 与 PnP 拟合姿态，结合经仿射对齐的单目深度恢复实际尺度。请连接",
    "#20:38f89e27b336c8ae": "正数表示向下偏移。",
    "Post-final (after FXAA/SMAA)": "最终处理后（FXAA/SMAA 之后）",
    "Post-process rig": "后处理骨骼绑定",
    "Post-tonemap (after TSR/TAA)": "色调映射后（TSR/TAA 之后）",
    "Pre-postprocess (HDR, no AA)": "后期处理前（HDR，无抗锯齿）",
    Precise: "精确",
    "Preserve original mesh": "保留原始网格",
    Preset: "预设",
    Preview: "预览",
    Prompt: "提示词",
    "#106:c3f83f9afcf91dd3": "输入要朗读的文字，可用 @Audio1、@Audio2、@Audio3 指代接入的音频。",
    "#131:92a223d6b16da9f7": "从输入视频选取静帧。有无损 MP4 时优先使用，以便准确选帧。",
    "Quad topology": "四边形拓扑",
    RICH: "富文本",
    RU: "俄语",
    Radius: "半径",
    "Radius (cm)": "半径（厘米）",
    "#122:a1fe5876c0537055": "调低随机性可得到较稳定的骨架，调高可探索更多结构。",
    RawDepth: "原始深度",
    "Recover Detail": "恢复细节",
    Reference: "引用",
    "Reference image": "参考图像",
    "Refresh asset list from Unreal": "从 UE 刷新资产列表",
    "#62:66e9f0b680c8e0da": "加载序列后，从 UE 重新读取相机",
    "#33:a55fbdfd1f6b55f2": "向 Bridge 重新请求工具清单",
    "Remove pin": "移除引脚",
    "Render in": "渲染环境",
    "Repetition penalty": "重复惩罚",
    Reposition: "重定位",
    "Reposition clip": "位置变化片段",
    "Reset all": "全部重置",
    Resolution: "分辨率",
    "Resolution (px)": "分辨率（像素）",
    Result: "结果",
    "Rich text editor": "富文本编辑器",
    Right: "右",
    "Roll ± (°)": "滚转 ±（°）",
    "Rot Pitch": "俯仰角",
    "Rot Roll": "滚转角",
    "Rot Yaw": "偏航角",
    "Rotate (°)": "旋转（°）",
    "Rotation (deg)": "旋转（度）",
    "#106:b49893d5a2a1170f": "运行节点生成底图，再双击打开，按 D 用批注工具绘制。",
    "#38:dc6f1d723a462a88": "运行后可查看输出列表。",
    "#42:e09dcd0644f67d7e": "运行后可查看数值结果。",
    "#39:824cdcc3c729d63e": "运行后可查看校验结果。",
    "#138:aded24c3ee35ea77": "一次处理音画并导出 H.264 MP4，音频随片段一起裁切。页面无法播放 MP4 时另生成 WebM。",
    "#102:7c612186c6322fc8": "用 cv2.Canny 处理每帧并导出 H.264 MP4。页面不支持 MP4 播放时另生成 WebM。",
    "SPEECH TO TEXT": "语音转文本",
    "Sample Rate": "采样率",
    Sampler: "采样器",
    Samples: "采样数",
    "Sampling Steps": "采样步数",
    "Save sequence": "保存序列",
    Scale: "缩放",
    "Scale %": "缩放（%）",
    "Scale Factor": "缩放倍数",
    "Scale X": "X 向缩放",
    "Scale Y": "Y 向缩放",
    "Scale Z": "Z 向缩放",
    Scene: "场景",
    "Scene State": "场景状态",
    Screen: "滤色",
    Screenshot: "截图",
    "Seam ΔE threshold:": "接缝 ΔE 阈值：",
    "Search…": "搜索…",
    Seed: "随机种子",
    Segmentation: "分割",
    Sequence: "序列",
    "Set the time of day": "设置当天时刻",
    Show: "显示",
    "Show Flags": "显示标志",
    "Show in Unreal": "在 UE 中显示",
    Size: "大小",
    "Size (cm)": "尺寸（厘米）",
    "Size X": "X 向尺寸",
    "Size Y": "Y 向尺寸",
    "Size Z": "Z 向尺寸",
    "Skeletal Mesh": "骨骼网格体",
    "Skeleton Type": "骨架类型",
    "Skip Dialog": "跳过对话框",
    "Snap to floor": "吸附到地面",
    "Snapshot only": "仅拍摄快照",
    Source: "源素材",
    "Source (after crop)": "源尺寸（裁剪后）",
    "Spatial Prompt Synthesis": "空间提示词合成",
    "Speech Rate": "语速",
    Sphere: "球体",
    Splat: "高斯泼溅",
    "Splat Count": "高斯点数量",
    "#115:5dc0c9523e46729e": "给引脚加星号后，与之连接的节点可控制工作流图的缩略图、内嵌控件与详情。",
    "Start (s)": "起点（秒）",
    Start_frame: "起始帧",
    "Static Mesh": "静态网格体",
    Steps: "步数",
    Stretch: "拉伸",
    Structure: "结构",
    Summary: "摘要",
    Sync: "同步",
    "#44:ddb9e175d4711a7c": "从 UE 读取最新的渲染通道与变量",
    "System Prompt": "系统提示词",
    "#282:dbe5922232252638": "启用后随渲染保存关卡快照，供比较物体位移或保存为关卡快照。大型关卡每次可多耗约一分钟与数百 MB。若需重定位，应在移动物体前开启。",
    Target: "目标",
    "Target FPS": "目标帧率",
    "Target Resolution Size": "目标分辨率",
    Temperature: "采样温度",
    Text: "文本",
    "Text Segment": "文本分段",
    "Text color": "文字颜色",
    "Text threshold": "文本阈值",
    "#251:7a88874185693f92": "用指定时刻渲染这张卡片。会暂时调整关卡日间序列并在完成后还原。关闭时沿用编辑器当前时间。",
    "#15:f82f875fd39b615b": "索引的数据类型",
    "#85:7c17818a18a0295d": "选择用于烘焙的 UV 通道。UV 展开的默认目标是通道 0。",
    "#66:7be1d86cb788e3de": "源素材裁剪后的尺寸已经匹配。",
    "Time (s)": "时间（秒）",
    "Time of day": "当天时刻",
    "#30:eab3b60b6d73edf2": "一天中的小时和分钟",
    "#141:a8a8aa10eb969e28": "可先用变换节点调整前景。将背景接到“匹配尺寸”，底色设为透明。",
    Tolerance: "容差",
    Tool: "工具",
    Top: "上",
    "#52:fe8d410391fd9e69": "Topaz 视频超分（fal.ai）需要视频输入。",
    Transform: "变换",
    Transparent: "透明",
    Tree: "树状结构",
    Triangles: "三角形",
    Trim: "修剪",
    "Tripo 3.1 (optimized)": "Tripo 3.1（已优化）",
    Type: "类型",
    UK: "乌克兰语",
    URL: "网址",
    "UV Channel": "UV 通道",
    "Union (all matches)": "合并所有匹配项",
    "#79:b4d8fae7417310de": "填写 Bridge 的 MCP 服务地址。默认连接当前 UE 编辑器的 MCP 端点。",
    "Unreal asset": "UE 资产",
    "#102:d605fccb12e5ef79": "指定 UE 的关卡序列资产路径。留空即使用定序器里打开的序列。",
    "#184:f265af6931bcde4f": "填写影片渲染图预设的资产路径，例如 /Game/Presets/Render.Render。留空沿用编辑器偏好设置里 Unreal Canvas Bridge 的默认值。",
    "#124:8774f520efa134e8": "选择内容浏览器里的静态或骨骼网格体，填写完整资产路径。执行节点时会导出 GLB。",
    "Unreal not reachable": "无法连接 UE",
    "Unreal offline": "UE 离线",
    "#70:e6b17dc631f5e784": "输入未连接时采用此处的数字，用逗号或换行分隔。",
    "#83:dda57af841ba8a15": "输入未连接时使用此处的颜色。每行一组 RGB 或 RGBA，以逗号分隔，各分量范围为 0 到 1。",
    "#63:f792049317610cf8": "输入未连接时采用此处的索引对，每行一对。",
    "#60:5daa6d58f006744a": "输入未连接时采用此处的三维点，每行一组 x, y, z。",
    "#57:ff9fe8d718895578": "输入未连接时采用此处的二维点，每行一组 x, y。",
    "#171:4f80e45fbfb7fd6e": "输入未连接时从此处读取多边形。每行填一个二维顶点，用空行分隔多边形，用单独一行减号开始填写孔。",
    "#130:fe43d98f2b10bab7": "输入未连接时从此处读取变换。每行依次填写位移、可选旋转和可选缩放，各组三元数用分号分隔。",
    "#76:e2774dae3d11e8de": "输入未连接时采用此处的三角形，每行填三个顶点索引。",
    "#76:7ba3c6e8f30b7c61": "输入未连接时采用此处的整数，用逗号或换行分隔。",
    Validation_report: "验证报告",
    Value: "明度",
    Values: "数值",
    Vector2: "二维向量",
    Vector3: "三维向量",
    Vertices: "顶点",
    "Via pin": "通过引脚输入",
    Video: "视频",
    "Video A": "视频 A",
    "Video B": "视频 B",
    "#53:7b6774c547b7b292": "视频无法保留透明通道，透明区域会输出为黑色。",
    "View Mode": "视图模式",
    "Viewport Look": "视口外观",
    "#79:e4cf5da3490510f0": "前景视频先播完时，选择剩余时段的显示方式。",
    "#192:e428050668864f28": "选择提取颜色并合成模板的后期阶段。所选通道不可用时，UE 依次尝试最终处理后、色调映射后和后期处理前。",
    "#39:51f25e8bea630c36": "选择执行骨骼绑定的 GPU。",
    White: "白色",
    "#43:8e9eb420d590a4e8": "用逗号或换行分隔多个整数",
    Width: "宽度",
    "#61:a83e87575aaf8f08": "在“匹配尺寸”端接入视频或图片以沿用它的宽高。",
    "Wire it in a graph": "请在节点图中连线输入",
    "Yaw offset": "偏航偏移",
    "Yaw offset (°)": "偏航偏移（°）",
    "Yaw ± (°)": "偏航 ±（°）",
    ZH: "中文",
    "bed, chair, floor, walls…": "床、椅子、地板、墙壁…",
    "#300:80a877d5b010f225": "cam_prior 在预期相机方向附近密集取样，适合已用 align_image 对齐的资产。fibonacci 用 300 个均匀视角覆盖整球，耗时更长但可找到预期外的方向。",
    center: "中心",
    false: "假",
    "frame max": "当前帧最大值",
    "frame min": "当前帧最小值",
    "hardcoded (pin overrides)": "固定值（引脚优先）",
    "iOS High": "iOS 高画质",
    "iOS Low": "iOS 低画质",
    "iOS Mid": "iOS 中画质",
    "#192:f3c8fbc425aceb54": "输入端。节点将快照与当前场景对比，渲染物体从旧位置到新位置的过程，相机也会从已存姿态移至当前视口。",
    "#18:7d89ec264ea75b64": "请检查 UE 是否已启动。",
    "node into the": "节点连接至",
    "#30:e9e3626f07727203": "接口。选用下方预设后，各资产通常只需微调",
    "string value…": "字符串值…",
    true: "真",
    "#33:67241c9fdb8aaeea": "。",
    "— pick a group —": "— 选择颜色组 —",
    "#26:0368a54677c00855": "— 请在节点上指定工具 —",
    "→ preview unavailable (": "→ 无法预览（",
    "Match aspect": "匹配宽高比",
    "Target resolution size": "目标分辨率",
    "Match visibility": "匹配可见性",
    "Show flags": "显示标志",
    "View mode": "视图模式",
    "MRG preset": "MRG 预设",
    "MRG variables": "MRG 变量",
    "→ computing…": "→ 正在计算…",
    "Can't reach Unreal": "无法连接 UE",
    "Connected to Unreal": "已连接到 UE",
    "#69:2911f6b1986798fa": "无法连接 UE。请确认编辑器已启动，再尝试同步。",
    "#218:8c73bf32b41f62d7": "匹配预设时使用 MRG 配置的分辨率。1080p、1440p 和 2160p 为 16:9，也可自定义宽高。启用“匹配宽高比”时，此处只指定长边，宽高比由渲染相机决定。",
    "Camera Cuts track": "相机切换轨道",
    "#36:72f118445323c48b": "— 此处的「匹配宽高比」不起作用。",
    "#122:57756b999518d0f3": "相机切换轨道没有绑定单一相机。请选择具体相机以匹配其宽高比。",
    "#84:d0946f48120c9d28": "视口未报告宽高比。请选择具体相机以匹配其宽高比。",
    "#33:84437dbdb300b3dd": "未找到，当前显示的是",
    "#49:c708889cd3983a8f": "的宽高比。请重新选择相机。",
    "#45:c45296b6324313b1": "未找到，渲染将采用",
    "#30:89f6034d192334ed": "中的相机。请重新选择相机。",
    "#55:93259f9d634f10d9": "— 目标分辨率与相机的宽高比不同，将采用",
    "#16:86171a5606ec625c": ":1。"
  },
  defaults: {
    audioGenerator: {
      "Audio Generator": "音频生成器"
    },
    audioInput: {
      "Audio Input": "音频输入"
    },
    autoRig: {
      "Auto-Rig": "自动绑定骨骼"
    },
    boolConstant: {
      Boolean: "布尔值"
    },
    cannyEdgesImage: {
      "Canny Edges (Image)": "Canny 边缘（图像）"
    },
    cannyEdgesVideo: {
      "Canny Edges (Video)": "Canny 边缘（视频）"
    },
    canvasInput: {
      Inputs: "画布输入"
    },
    canvasOutput: {
      Outputs: "画布输出"
    },
    choice: {
      Choice: "选项"
    },
    consoleLog: {
      "Console Log": "控制台日志"
    },
    constant: {
      Constant: "常量"
    },
    convert: {
      Convert: "转换"
    },
    createStaticMeshAsset: {
      "Create Static Mesh Asset": "创建静态网格体资产"
    },
    cubeMesh: {
      "Cube Mesh": "立方体网格"
    },
    depthEstimation: {
      "Depth Estimation": "深度估计"
    },
    doodle: {
      Doodle: "涂鸦"
    },
    edgeDetectionImage: {
      "Edge Detection (Image)": "边缘检测（图像）"
    },
    edgeDetectionVideo: {
      "Edge Detection (Video)": "边缘检测（视频）"
    },
    figmaFetch: {
      "Figma Fetch": "从 Figma 获取"
    },
    floatConstant: {
      Float: "浮点数"
    },
    icpAlign: {
      "ICP Align": "ICP 对齐"
    },
    imageGenerator: {
      "Image Generator": "图像生成器"
    },
    imageGrid: {
      "Image Grid": "图像网格"
    },
    imageInput: {
      "Image Input": "图像输入"
    },
    imageMerge: {
      "Merge (Image)": "合并图像"
    },
    imageTransform: {
      "Transform (Image)": "图像变换"
    },
    imageUpscaler: {
      "Image Upscaler": "图像超分辨率"
    },
    imageValidator: {
      "Image Validator": "图像校验"
    },
    imageViewer: {
      "Image Viewer": "图像查看器"
    },
    intConstant: {
      Integer: "整数"
    },
    mcpTool: {
      "MCP Tool": "MCP 工具"
    },
    meshBake: {
      "Bake Textures": "烘焙纹理"
    },
    meshGenerator: {
      "Mesh Generator": "网格生成器"
    },
    meshInput: {
      "Mesh Input": "网格输入"
    },
    meshOp: {
      "UV Unwrap": "UV 展开",
      Remesh: "重构网格",
      Simplify: "简化网格",
      "Recompute Normals": "重算法线",
      "Fill Holes": "填补孔洞",
      "Weld Edges": "焊接边",
      Solidify: "实体化"
    },
    meshViewer: {
      "Mesh Viewer": "网格查看器"
    },
    panoramaViewer: {
      "Panorama Viewer": "全景查看器"
    },
    pointCloud: {
      "Point Cloud": "点云"
    },
    pointCorrespondencePoseFit: {
      "Point Correspondence Pose Fit": "通过对应点拟合姿态"
    },
    projectedWorldTransformAt: {
      "Projected World Transform At": "指定位置的投影世界变换"
    },
    repositionRender: {
      "Reposition Render": "调整渲染位置"
    },
    segmentation: {
      Segmentation: "分割"
    },
    select: {
      Select: "选择"
    },
    sequenceRender: {
      "Sequence Render": "序列渲染"
    },
    setCamera: {
      "Set Camera": "设置摄像机"
    },
    simpleAlign: {
      "Simple Align": "简单对齐"
    },
    spatialMaskGuide: {
      "Spatial Mask Guide": "空间遮罩引导"
    },
    spatialPromptSynthesis: {
      "Spatial Prompt Synthesis": "空间提示词合成"
    },
    spawnCutoutAt: {
      "Spawn Cutout At": "在指定位置生成剪影"
    },
    spawnMeshAt: {
      "Spawn Mesh At": "在指定位置生成网格"
    },
    speechToText: {
      "Speech to Text": "语音转文本"
    },
    sphereMesh: {
      "Sphere Mesh": "球体网格"
    },
    splatGenerator: {
      "Splat Generator": "高斯泼溅生成器"
    },
    stringConstant: {
      String: "字符串"
    },
    switch: {
      Switch: "切换"
    },
    task: {
      Tasks: "任务"
    },
    textInput: {
      "Text Input": "文本输入"
    },
    textSegment: {
      "Text Segment": "文本分段"
    },
    textureGenerator: {
      "Texture Generator": "纹理生成器"
    },
    unrealRender: {
      "Viewport Render": "视口渲染"
    },
    usdInput: {
      "USD Input": "USD 输入"
    },
    vector2Constant: {
      "Vector 2": "二维向量"
    },
    vector3Constant: {
      "Vector 3": "三维向量"
    },
    videoFrameExtract: {
      "Extract Frame": "提取帧"
    },
    videoGenerator: {
      "Video Generator": "视频生成器"
    },
    videoInput: {
      "Video Input": "视频输入"
    },
    videoMerge: {
      "Merge (Video)": "合并视频"
    },
    videoTransform: {
      "Transform (Video)": "视频变换"
    },
    videoUpscaler: {
      "Video Upscaler": "视频超分辨率"
    },
    videoViewer: {
      "Video Viewer": "视频查看器"
    },
    viewportCapture: {
      "UE Viewport": "UE 视口"
    },
    webcamCapture: {
      "Webcam Capture": "摄像头采集"
    }
  },
  nodes: {
    appendBundles: {
      title: [
        "Double-click to rename"
      ]
    },
    audioGenerator: {
      "aria-label": [
        "Loudness",
        "Pitch",
        "Sample Rate",
        "Speech Rate"
      ],
      field: [
        "Count",
        "Loudness",
        "Model",
        "Pitch",
        "Sample Rate",
        "Speech Rate"
      ],
      pin: [
        "Audio",
        "Prompt",
        "Reference image"
      ],
      title: [
        "Expose as input pin"
      ],
      body: [
        "#106:c3f83f9afcf91dd3"
      ]
    },
    audioInput: {
      button: [
        "Add audio"
      ],
      pin: [
        "Audio"
      ],
      title: [
        "#39:3dc20ff5dfef957d"
      ]
    },
    autoRig: {
      "aria-label": [
        "Beams",
        "Post-process rig",
        "Preserve original mesh",
        "Repetition penalty",
        "Temperature"
      ],
      field: [
        "#162:58d2b798aab3c8a2",
        "#136:80837529dbbc1509",
        "#127:7e76ada0560c013d",
        "Beams",
        "#106:f417834180423247",
        "#175:9c1949b060a9031b",
        "Model",
        "#118:865f1d7424e8e875",
        "Post-process rig",
        "Preserve original mesh",
        "#122:a1fe5876c0537055",
        "Repetition penalty",
        "Temperature",
        "#39:51f25e8bea630c36"
      ],
      pin: [
        "Mesh",
        "Screenshot",
        "Skeleton Type"
      ],
      title: [
        "Expose as input pin"
      ]
    },
    boolConstant: {
      body: [
        "false",
        "true"
      ],
      pin: [
        "Boolean"
      ]
    },
    bundle: {
      title: [
        "Double-click to rename"
      ]
    },
    cannyEdgesImage: {
      "aria-label": [
        "High threshold",
        "L2 gradient",
        "Low threshold"
      ],
      field: [
        "Aperture size",
        "High threshold",
        "L2 gradient",
        "Low threshold"
      ],
      params: [
        "Canny Edges"
      ],
      pin: [
        "Edges",
        "Image"
      ],
      title: [
        "Expose as input pin"
      ]
    },
    cannyEdgesVideo: {
      "aria-label": [
        "High threshold",
        "L2 gradient",
        "Low threshold"
      ],
      field: [
        "Aperture size",
        "High threshold",
        "L2 gradient",
        "Low threshold"
      ],
      params: [
        "Canny Edges",
        "#102:7c612186c6322fc8"
      ],
      pin: [
        "Edges",
        "Video"
      ],
      title: [
        "Expose as input pin"
      ]
    },
    canvasInput: {
      button: [
        "+ Add input"
      ],
      params: [
        "Graph inputs",
        "#84:66420fe547b70207",
        "#70:26225f44ffca1d55"
      ],
      title: [
        "#54:b5313adf324aa7c9"
      ]
    },
    canvasOutput: {
      button: [
        "+ Add output"
      ],
      params: [
        "Graph outputs",
        "#70:26225f44ffca1d55",
        "#115:5dc0c9523e46729e"
      ],
      title: [
        "#55:ad374fbb345e8610"
      ]
    },
    consoleLog: {
      field: [
        "Value"
      ],
      pin: [
        "Value"
      ],
      placeholder: [
        "hardcoded (pin overrides)"
      ]
    },
    constant: {
      pin: [
        "Value"
      ],
      placeholder: [
        "#43:55abbad72de02e73"
      ]
    },
    convert: {
      pin: [
        "In",
        "Out"
      ]
    },
    createStaticMeshAsset: {
      "aria-label": [
        "Allow Overwrite",
        "Asset Name",
        "Destination Path",
        "Skip Dialog"
      ],
      choice: [
        "Auto (detect)",
        "Skeletal Mesh",
        "Static Mesh"
      ],
      field: [
        "Allow Overwrite",
        "Asset Name",
        "Destination Path",
        "Mesh Type",
        "Skip Dialog"
      ],
      params: [
        "Destination",
        "Dialog",
        "Import"
      ],
      pin: [
        "Asset Name",
        "Asset Path",
        "Destination Path",
        "Mesh"
      ],
      placeholder: [
        "#20:ef18a3fa5ddd7aa0"
      ],
      title: [
        "#71:632cc84e7be15a45",
        "Expose as input pin",
        "#65:ea5c765a8dbe4d86",
        "#35:5feb1fb382932e15"
      ]
    },
    cubeMesh: {
      field: [
        "Size X",
        "Size Y",
        "Size Z"
      ],
      params: [
        "Size (cm)"
      ],
      pin: [
        "Mesh",
        "Screenshot",
        "Size X",
        "Size Y",
        "Size Z"
      ]
    },
    depthEstimation: {
      field: [
        "Model"
      ],
      params: [
        "Depth Estimation",
        "#242:3b603774d70cc7b9"
      ],
      pin: [
        "DepthMap",
        "Image",
        "Mask",
        "RawDepth"
      ]
    },
    doodle: {
      params: [
        "Background Color",
        "Canvas",
        "Resolution (px)",
        "#106:b49893d5a2a1170f"
      ],
      pin: [
        "Image"
      ]
    },
    edgeDetectionImage: {
      choice: [
        "Canny (classical, thresholded)",
        "Coarse",
        "Coarser",
        "Coarsest — major boundaries only",
        "DexiNed (perceptual, no calibration)",
        "Fine",
        "Finest — includes texture",
        "Fused (default, balanced)",
        "Medium"
      ],
      field: [
        "Detail",
        "Method"
      ],
      params: [
        "Edge Detection",
        "#235:a741c90f45c937b8"
      ],
      pin: [
        "Edges",
        "Image"
      ],
      title: [
        "Expose as input pin"
      ]
    },
    edgeDetectionVideo: {
      choice: [
        "Canny (classical, thresholded)",
        "Coarse",
        "Coarser",
        "Coarsest — major boundaries only",
        "DexiNed (perceptual, no calibration)",
        "Fine",
        "Finest — includes texture",
        "Fused (default, balanced)",
        "Medium"
      ],
      field: [
        "Detail",
        "Method"
      ],
      params: [
        "Edge Detection",
        "#235:a741c90f45c937b8"
      ],
      pin: [
        "Edges",
        "Video"
      ],
      title: [
        "Expose as input pin"
      ]
    },
    figmaFetch: {
      field: [
        "Depth",
        "Export Images",
        "Image Scale",
        "URL"
      ],
      params: [
        "FIGMA FETCH"
      ],
      pin: [
        "Image",
        "Summary",
        "Tree",
        "URL"
      ],
      title: [
        "0 = unlimited",
        "Remove pin"
      ]
    },
    floatConstant: {
      pin: [
        "Float"
      ]
    },
    icpAlign: {
      pin: [
        "InitialTransform",
        "Mesh",
        "PointCloud",
        "Transform"
      ]
    },
    imageGenerator: {
      choice: [
        "Auto"
      ],
      field: [
        "Aspect Ratio",
        "Count",
        "Google Search",
        "Model",
        "Resolution",
        "Seed"
      ],
      pin: [
        "Image",
        "Image[]",
        "Prompt"
      ],
      title: [
        "#40:ac0223608540d7e2",
        "Expose as input pin"
      ]
    },
    imageGrid: {
      button: [
        "+ Add Image"
      ],
      field: [
        "Background",
        "Color",
        "Enabled",
        "Gap",
        "Original Size",
        "Padding",
        "Scale %",
        "Width"
      ],
      params: [
        "Frame",
        "Image 1",
        "Images",
        "Layout"
      ],
      pin: [
        "Image",
        "Image 1"
      ]
    },
    imageInput: {
      button: [
        "Add image"
      ],
      pin: [
        "Image"
      ],
      title: [
        "#39:5081216f6aea5e5e"
      ]
    },
    imageMerge: {
      button: [
        "Reset all"
      ],
      choice: [
        "Add",
        "Darken",
        "Difference",
        "Fill",
        "Fit",
        "Lighten",
        "Multiply",
        "Over",
        "Screen",
        "Stretch"
      ],
      field: [
        "Fit",
        "#249:ec697229f6d438c2",
        "Mode",
        "Opacity (%)",
        "#467:5e1f5962814325d3"
      ],
      params: [
        "#42:fc5be90b22e39603",
        "Merge",
        "Preview",
        "#141:a8a8aa10eb969e28"
      ],
      pin: [
        "Background",
        "Foreground",
        "Image"
      ],
      title: [
        "Expose as input pin"
      ]
    },
    imageTransform: {
      button: [
        "Reset all"
      ],
      choice: [
        "1024 × 1024 (square)",
        "1080 × 1920 (vertical)",
        "1920 × 1080 (HD)",
        "2048 × 2048 (square)",
        "3840 × 2160 (UHD)",
        "720 × 1280 (vertical)",
        "Black",
        "Custom",
        "Fill",
        "Fit",
        "Source (after crop)",
        "Stretch",
        "Transparent",
        "White"
      ],
      field: [
        "Background",
        "Bottom",
        "#10:8fd1ee4971931fc1",
        "Fit",
        "#197:6b6689af025d015b",
        "Flip horizontal",
        "Flip vertical",
        "Left",
        "Move X (px)",
        "Move Y (px)",
        "#20:38f89e27b336c8ae",
        "Right",
        "Rotate (°)",
        "Scale",
        "Size",
        "Top",
        "#61:a83e87575aaf8f08"
      ],
      params: [
        "#28:a7499a865b9af2ec",
        "Crop (% of source)",
        "Output",
        "Preview",
        "Transform"
      ],
      pin: [
        "Image",
        "Match size"
      ],
      title: [
        "Expose as input pin",
        "#66:7be1d86cb788e3de"
      ]
    },
    imageUpscaler: {
      "aria-label": [
        "Base Model",
        "Enhance Details",
        "Imagination",
        "Preset",
        "Prompt",
        "Scale Factor",
        "Steps",
        "Structure"
      ],
      choice: [
        "Balanced",
        "Creative",
        "FLUX.1-Krea-dev (realistic)",
        "FLUX.1-dev (stylized)",
        "Precise"
      ],
      control: [
        "#40:fb49e49072e1a21f"
      ],
      field: [
        "Base Model",
        "Count",
        "Enhance Details",
        "#63:7f33a06867ebc82b",
        "#50:54a0038d5cd8b021",
        "Imagination",
        "Model",
        "#82:eed569a7a821c1d1",
        "Preset",
        "Prompt",
        "Scale Factor",
        "Seed",
        "Steps",
        "Structure"
      ],
      pin: [
        "Image"
      ],
      title: [
        "#40:ac0223608540d7e2",
        "Expose as input pin"
      ]
    },
    imageValidator: {
      params: [
        "Configured checks",
        "Last run",
        "#39:824cdcc3c729d63e",
        "Expected aspect:",
        "Seam ΔE threshold:"
      ],
      pin: [
        "Image",
        "Validation_report"
      ]
    },
    imageViewer: {
      pin: [
        "Image",
        "Image A",
        "Image B"
      ]
    },
    intConstant: {
      pin: [
        "Int"
      ]
    },
    mcpTool: {
      body: [
        "No tool selected"
      ],
      button: [
        "Search…"
      ],
      field: [
        "MCP URL",
        "Name",
        "#79:b4d8fae7417310de"
      ],
      params: [
        "Connection",
        "MCP Tool",
        "Tool"
      ],
      title: [
        "#33:a55fbdfd1f6b55f2"
      ],
      control: [
        "#26:0368a54677c00855"
      ]
    },
    meshBake: {
      "aria-label": [
        "Ambient Occlusion",
        "Samples",
        "UV Channel"
      ],
      choice: [
        "1 per pixel",
        "16 per pixel",
        "4 per pixel"
      ],
      control: [
        "Via pin"
      ],
      field: [
        "#111:beac051b71025325",
        "Ambient Occlusion",
        "Mesh",
        "#48:9ed95722ed6e357d",
        "Resolution",
        "Samples",
        "Source",
        "#85:7c17818a18a0295d",
        "UV Channel"
      ],
      params: [
        "Bake",
        "Inputs",
        "#89:6ac478a97913d136"
      ],
      pin: [
        "Ambient Occlusion",
        "BaseColor",
        "Emissive",
        "Mesh",
        "MetallicRoughness",
        "Normal",
        "Occlusion",
        "Screenshot",
        "Source"
      ],
      title: [
        "#40:ac0223608540d7e2",
        "Expose as input pin",
        "Remove pin"
      ]
    },
    meshGenerator: {
      "aria-label": [
        "Align to image",
        "Disable PBR",
        "Face limit",
        "Quad topology"
      ],
      field: [
        "Align to image",
        "Count",
        "Disable PBR",
        "Face limit",
        "Model",
        "Quad topology",
        "Seed"
      ],
      pin: [
        "Image",
        "Mesh",
        "Prompt",
        "Screenshot"
      ],
      title: [
        "#40:ac0223608540d7e2",
        "Expose as input pin"
      ]
    },
    meshInput: {
      button: [
        "Add mesh"
      ],
      choice: [
        "External file",
        "Skeletal Mesh",
        "Static Mesh",
        "Unreal asset"
      ],
      field: [
        "Asset",
        "Source",
        "Type"
      ],
      params: [
        "Mesh Source"
      ],
      pin: [
        "Asset",
        "Mesh",
        "Screenshot"
      ],
      placeholder: [
        "Pick a mesh from Unreal…"
      ],
      title: [
        "#38:14d2de54cb5e9906",
        "Refresh asset list from Unreal",
        "#124:8774f520efa134e8"
      ]
    },
    meshOp: {
      control: [
        "#38:dc6f1d723a462a88",
        "Via pin",
        "Wire it in a graph"
      ],
      field: [
        "Mesh",
        "Operation"
      ],
      params: [
        "#45:2c6f2f1bb1fcf40e",
        "#27:2cefdf7c0b06e523",
        "#30:ba5c96c3f746b97d",
        "Inputs",
        "Lists",
        "Operation",
        "#65:ad17fdc94f75b8f4",
        "Parameters",
        "#42:e09dcd0644f67d7e",
        "#15:f82f875fd39b615b",
        "#70:e6b17dc631f5e784",
        "#83:dda57af841ba8a15",
        "#63:f792049317610cf8",
        "#60:5daa6d58f006744a",
        "#57:ff9fe8d718895578",
        "#171:4f80e45fbfb7fd6e",
        "#130:fe43d98f2b10bab7",
        "#76:e2774dae3d11e8de",
        "#76:7ba3c6e8f30b7c61",
        "Values"
      ],
      pin: [
        "Mesh",
        "Screenshot"
      ],
      title: [
        "#40:ac0223608540d7e2",
        "Expose as input pin",
        "Remove pin"
      ],
      choice: [
        "Any",
        "Choose…",
        "Edges",
        "Material IDs",
        "PolyGroups",
        "Triangles",
        "Vertices"
      ],
      button: [
        "More options ("
      ],
      placeholder: [
        "#37:68ac20425923e04b",
        "#50:75f58383097bdb62",
        "#30:96aad74d3785cb01",
        "#24:d4c6a3acd0108d45",
        "#27:311a1904a4be90b1",
        "#138:621b7a9c22726aeb",
        "#97:8364adf17b18e916",
        "#43:3b008fb108e45d01",
        "#43:8e9eb420d590a4e8"
      ]
    },
    meshViewer: {
      pin: [
        "Mesh",
        "Screenshot"
      ]
    },
    panoramaViewer: {
      pin: [
        "Image"
      ]
    },
    pointCloud: {
      pin: [
        "Camera",
        "Image",
        "Mask",
        "PointCloud",
        "RawDepth",
        "Screenshot"
      ]
    },
    pointCorrespondencePoseFit: {
      button: [
        "Generic (fibonacci)",
        "Tripo 3.1 (optimized)"
      ],
      choice: [
        "Cam prior (narrow grid)",
        "Fibonacci (uniform)"
      ],
      field: [
        "Aggregator",
        "Bias to cam roll",
        "#20:a49982e2aed77f67",
        "Pitch ± (°)",
        "Roll ± (°)",
        "Sampler",
        "Yaw offset (°)",
        "Yaw ± (°)"
      ],
      params: [
        "#62:79a7b024c350d9dc",
        "Asset orientation",
        "Bank sampler",
        "#46:df10faca100769d5",
        "Depth aggregator",
        "#98:f57de92c9eeb3337",
        "Preset",
        "Yaw offset",
        "node into the",
        "#30:e9e3626f07727203",
        "#33:67241c9fdb8aaeea"
      ],
      pin: [
        "Camera",
        "EstimatedDepth",
        "Image",
        "Mask",
        "Mesh",
        "RawDepth",
        "Transform"
      ],
      title: [
        "#240:f50203ab176880d2",
        "#222:a025985003ec29e7",
        "#239:72702cb7633566bc",
        "#226:0488cc9e2d1aa132",
        "#120:b6a10ccd83a948b3",
        "#171:f4d0339e27084d0b",
        "#144:0bfa88d99db3a6ab",
        "#286:6e40eb4534442bef",
        "#46:3575f0cf619c22b6",
        "#85:d1937965274524b6",
        "#44:e6a59b5c5139c0a5",
        "#300:80a877d5b010f225"
      ]
    },
    projectedWorldTransformAt: {
      "aria-label": [
        "Camera Rotation",
        "Pixel X",
        "Pixel Y"
      ],
      field: [
        "Camera Rotation",
        "Pixel X",
        "Pixel Y"
      ],
      params: [
        "Pixel",
        "Transform"
      ],
      pin: [
        "Camera",
        "Image",
        "RawDepth",
        "Transform"
      ],
      placeholder: [
        "center"
      ],
      body: [
        "Connect Image to pick pixel",
        "center"
      ]
    },
    repositionRender: {
      "aria-label": [
        "Save sequence"
      ],
      field: [
        "#121:4b59784bab7d7ea2",
        "Duration (s)",
        "#50:3dab86785159c5ed",
        "Save sequence"
      ],
      params: [
        "#58:92fcbd9db6bdc016",
        "Reposition clip",
        "Scene State",
        "#192:f3c8fbc425aceb54"
      ],
      pin: [
        "Beauty",
        "Depth",
        "Normal",
        "Scene State"
      ]
    },
    segmentation: {
      choice: [
        "BG",
        "FG"
      ],
      field: [
        "Model"
      ],
      params: [
        "#129:4c8582e382f0bede",
        "Segmentation",
        "Points ("
      ],
      pin: [
        "Image",
        "Mask"
      ]
    },
    sequenceRender: {
      button: [
        "Camera Cuts Track",
        "Sync",
        "Camera Cuts track"
      ],
      choice: [
        "Android OpenGL High",
        "Android OpenGL Low",
        "Android OpenGL Mid",
        "Android Vulkan High",
        "Android Vulkan Low",
        "Android Vulkan Mid",
        "Custom",
        "Editor's platform",
        "Match preset",
        "iOS High",
        "iOS Low",
        "iOS Mid"
      ],
      field: [
        "#88:8b13039ae460d8a3",
        "#196:037be524fa65bdb0",
        "Camera",
        "Level Sequence",
        "Match Aspect",
        "Match Visibility",
        "#157:bf756a474452dbae",
        "Platform",
        "Preset",
        "Show Flags",
        "Target Resolution Size",
        "View Mode",
        "Match aspect",
        "Target resolution size",
        "Match visibility",
        "Show flags",
        "View mode",
        "Size"
      ],
      params: [
        "MRG Preset",
        "Sequence",
        "Viewport Look",
        "→ preview unavailable (",
        "#18:7d89ec264ea75b64",
        "MRG preset",
        "MRG variables",
        "→ computing…",
        "#36:72f118445323c48b",
        "#122:57756b999518d0f3",
        "#84:d0946f48120c9d28",
        "#33:84437dbdb300b3dd",
        "#49:c708889cd3983a8f",
        "#45:c45296b6324313b1",
        "#30:89f6034d192334ed",
        "#55:93259f9d634f10d9",
        "#16:86171a5606ec625c"
      ],
      pin: [
        "Beauty",
        "Depth",
        "Level Sequence",
        "Normal",
        "Resolution"
      ],
      placeholder: [
        "#40:f4d0aed7b77bf0d2",
        "#40:98fc44b233fc0650"
      ],
      title: [
        "#35:39febc428643d894",
        "Expose as input pin",
        "#216:69b3feb9b6d22c58",
        "#193:17e820fc501f60eb",
        "Refresh asset list from Unreal",
        "#62:66e9f0b680c8e0da",
        "Remove pin",
        "#44:ddb9e175d4711a7c",
        "#102:d605fccb12e5ef79",
        "#184:f265af6931bcde4f",
        "Unreal not reachable",
        "Connected to Unreal",
        "#69:2911f6b1986798fa",
        "#218:8c73bf32b41f62d7"
      ],
      body: [
        "Unreal offline",
        "Checking…",
        "Connected",
        "Can't reach Unreal"
      ]
    },
    setCamera: {
      pin: [
        "Camera"
      ]
    },
    simpleAlign: {
      pin: [
        "Mesh",
        "PointCloud",
        "Screenshot",
        "Transform"
      ]
    },
    spatialMaskGuide: {
      choice: [
        "1 · red",
        "2 · blue",
        "3 · green",
        "4 · orange",
        "5 · pink",
        "6 · purple",
        "7 · cyan",
        "8 · lime",
        "— pick a group —"
      ],
      field: [
        "Colour group",
        "Fill opacity",
        "Tolerance"
      ],
      params: [
        "Look",
        "Target"
      ],
      pin: [
        "Frame",
        "Guide",
        "Matte",
        "Reference"
      ]
    },
    spatialPromptSynthesis: {
      "aria-label": [
        "Max Tokens",
        "System Prompt",
        "Temperature"
      ],
      control: [
        "#44:558a9a1210df82df"
      ],
      field: [
        "Max Tokens",
        "Model",
        "System Prompt",
        "Temperature"
      ],
      params: [
        "Spatial Prompt Synthesis"
      ],
      pin: [
        "Annotated",
        "Annotations",
        "Scene",
        "Text"
      ],
      title: [
        "#40:ac0223608540d7e2",
        "Expose as input pin"
      ]
    },
    spawnCutoutAt: {
      "aria-label": [
        "Intensity",
        "Loc X",
        "Loc Y",
        "Loc Z",
        "MCP URL",
        "Rot Pitch",
        "Rot Roll",
        "Rot Yaw",
        "Snap to floor"
      ],
      field: [
        "Intensity",
        "Loc X",
        "Loc Y",
        "Loc Z",
        "MCP URL",
        "Rot Pitch",
        "Rot Roll",
        "Rot Yaw",
        "Snap to floor"
      ],
      params: [
        "Connection",
        "Cutout",
        "Location (cm)",
        "Rotation (deg)"
      ],
      pin: [
        "Image",
        "Transform"
      ],
      title: [
        "#74:2b1a168de0d757ab",
        "#122:8332119d6f736bcc"
      ]
    },
    spawnMeshAt: {
      "aria-label": [
        "Loc X",
        "Loc Y",
        "Loc Z",
        "MCP URL",
        "Rot Pitch",
        "Rot Roll",
        "Rot Yaw",
        "Scale X",
        "Scale Y",
        "Scale Z"
      ],
      field: [
        "Loc X",
        "Loc Y",
        "Loc Z",
        "MCP URL",
        "Rot Pitch",
        "Rot Roll",
        "Rot Yaw",
        "Scale X",
        "Scale Y",
        "Scale Z"
      ],
      params: [
        "Connection",
        "Location (cm)",
        "Rotation (deg)",
        "Scale"
      ],
      pin: [
        "Mesh",
        "Result",
        "Transform"
      ]
    },
    speechToText: {
      button: [
        "Browse"
      ],
      choice: [
        "AR",
        "Auto-detect",
        "DE",
        "EN",
        "ES",
        "FR",
        "HI",
        "IT",
        "JA",
        "KO",
        "NL",
        "PL",
        "PT",
        "RU",
        "UK",
        "ZH"
      ],
      params: [
        "Audio File",
        "Language",
        "Model",
        "SPEECH TO TEXT"
      ],
      pin: [
        "Audio",
        "Text"
      ],
      placeholder: [
        "No file selected"
      ]
    },
    sphereMesh: {
      field: [
        "Radius (cm)"
      ],
      params: [
        "Sphere"
      ],
      pin: [
        "Mesh",
        "Radius",
        "Screenshot"
      ]
    },
    splatGenerator: {
      "aria-label": [
        "Sampling Steps",
        "Splat Count"
      ],
      choice: [
        "10 (fast)",
        "20 (recommended)",
        "262K (max quality)",
        "32K (fastest)"
      ],
      field: [
        "Count",
        "Model",
        "Sampling Steps",
        "Seed",
        "Splat Count"
      ],
      pin: [
        "Image",
        "Splat"
      ],
      title: [
        "#40:ac0223608540d7e2",
        "Expose as input pin"
      ]
    },
    stringConstant: {
      pin: [
        "Text"
      ],
      placeholder: [
        "string value…"
      ]
    },
    task: {
      body: [
        "No tasks yet"
      ],
      placeholder: [
        "Add a task…"
      ],
      title: [
        "Add task (Enter)"
      ]
    },
    textInput: {
      blankText: [
        "Double-click to edit"
      ],
      button: [
        "MD",
        "RICH"
      ],
      pin: [
        "Text"
      ],
      title: [
        "Decrease font size",
        "Font size (8–48)",
        "HTML source",
        "Increase font size",
        "Markdown source",
        "Rich text editor",
        "Text color"
      ]
    },
    textSegment: {
      "aria-label": [
        "Box threshold",
        "Text threshold"
      ],
      choice: [
        "Indexed instance",
        "Largest score",
        "Union (all matches)"
      ],
      field: [
        "Box threshold",
        "Mode",
        "Prompt",
        "Text threshold"
      ],
      params: [
        "#117:05e1d89f35646f90",
        "Text Segment"
      ],
      pin: [
        "Image",
        "Mask",
        "Prompt"
      ],
      placeholder: [
        "bed, chair, floor, walls…"
      ],
      title: [
        "#38:44145690b3bd997e"
      ]
    },
    textureGenerator: {
      field: [
        "Count",
        "Seed"
      ],
      pin: [
        "Image",
        "Mesh",
        "Screenshot"
      ],
      title: [
        "#40:ac0223608540d7e2",
        "Expose as input pin"
      ]
    },
    unrealRender: {
      "aria-label": [
        "Set the time of day",
        "Show in Unreal",
        "Time of day",
        "#30:eab3b60b6d73edf2"
      ],
      button: [
        "Piloted",
        "Show",
        "Sync"
      ],
      choice: [
        "Android OpenGL High",
        "Android OpenGL Low",
        "Android OpenGL Mid",
        "Android Vulkan High",
        "Android Vulkan Low",
        "Android Vulkan Mid",
        "Custom",
        "Editor world (no PIE)",
        "Editor's platform",
        "Match preset",
        "Play In Editor",
        "iOS High",
        "iOS Low",
        "iOS Mid"
      ],
      field: [
        "#88:8b13039ae460d8a3",
        "#196:037be524fa65bdb0",
        "Camera",
        "Keep scene state",
        "#226:aeec6d88ef13f43b",
        "Match Aspect",
        "Match Visibility",
        "#157:bf756a474452dbae",
        "Platform",
        "Preset",
        "Render in",
        "Show Flags",
        "Show in Unreal",
        "#282:dbe5922232252638",
        "Target Resolution Size",
        "#251:7a88874185693f92",
        "Time of day",
        "View Mode",
        "Match aspect",
        "Target resolution size",
        "Match visibility",
        "Show flags",
        "View mode",
        "Size"
      ],
      params: [
        "Lighting",
        "MRG Preset",
        "Reposition",
        "Viewport Look",
        "→ preview unavailable (",
        "#18:7d89ec264ea75b64",
        "MRG preset",
        "MRG variables",
        "→ computing…",
        "#36:72f118445323c48b",
        "#122:57756b999518d0f3",
        "#84:d0946f48120c9d28",
        "#33:84437dbdb300b3dd",
        "#49:c708889cd3983a8f",
        "#45:c45296b6324313b1",
        "#30:89f6034d192334ed",
        "#55:93259f9d634f10d9",
        "#16:86171a5606ec625c"
      ],
      pin: [
        "Beauty",
        "Camera",
        "CameraSource",
        "Depth",
        "Normal",
        "RawDepth",
        "Time of day"
      ],
      placeholder: [
        "#40:98fc44b233fc0650"
      ],
      title: [
        "#35:39febc428643d894",
        "Expose as input pin",
        "#226:aeec6d88ef13f43b",
        "#216:69b3feb9b6d22c58",
        "#193:17e820fc501f60eb",
        "#290:ac3ca218fef30914",
        "Refresh asset list from Unreal",
        "#62:66e9f0b680c8e0da",
        "Set the time of day",
        "#44:ddb9e175d4711a7c",
        "#184:f265af6931bcde4f",
        "Unreal not reachable",
        "Connected to Unreal",
        "#69:2911f6b1986798fa",
        "#218:8c73bf32b41f62d7"
      ],
      body: [
        "Unreal offline",
        "Checking…",
        "Connected",
        "Can't reach Unreal"
      ]
    },
    usdInput: {
      button: [
        "Add USD scene"
      ],
      title: [
        "#43:f4812ea0f3580fa7"
      ]
    },
    vector2Constant: {
      pin: [
        "Vector2"
      ]
    },
    vector3Constant: {
      pin: [
        "Vector3"
      ]
    },
    videoFrameExtract: {
      choice: [
        "First frame",
        "Frame number",
        "Last frame",
        "Time (s)"
      ],
      field: [
        "Frame"
      ],
      params: [
        "Frame to extract",
        "#131:92a223d6b16da9f7"
      ],
      pin: [
        "Image",
        "Video"
      ]
    },
    videoGenerator: {
      "aria-label": [
        "Duration",
        "Loop"
      ],
      choice: [
        "10 seconds",
        "5 seconds",
        "Auto"
      ],
      field: [
        "Aspect Ratio",
        "Count",
        "Duration",
        "Loop",
        "Model",
        "Resolution"
      ],
      pin: [
        "End_frame",
        "Prompt",
        "Start_frame",
        "Video"
      ],
      title: [
        "Expose as input pin"
      ]
    },
    videoInput: {
      button: [
        "Add video"
      ],
      pin: [
        "Video"
      ],
      title: [
        "#39:552ba26bd2cd3bd0"
      ]
    },
    videoMerge: {
      button: [
        "Reset all"
      ],
      choice: [
        "Add",
        "Darken",
        "Difference",
        "Disappear",
        "Fill",
        "Fit",
        "Hold last frame",
        "Lighten",
        "Loop",
        "Multiply",
        "Over",
        "Screen",
        "Stretch"
      ],
      field: [
        "Ends early",
        "Fit",
        "#249:ec697229f6d438c2",
        "Mode",
        "Opacity (%)",
        "#467:5e1f5962814325d3",
        "#79:e4cf5da3490510f0"
      ],
      params: [
        "#41:de50f86d740a1817",
        "Merge",
        "Preview",
        "#141:a8a8aa10eb969e28",
        "#104:c94bdedc7aa92d9f"
      ],
      pin: [
        "Background",
        "Foreground",
        "Video"
      ],
      title: [
        "Expose as input pin"
      ]
    },
    videoTransform: {
      button: [
        "Reset all"
      ],
      choice: [
        "1024 × 1024 (square)",
        "1080 × 1920 (vertical)",
        "1920 × 1080 (HD)",
        "2048 × 2048 (square)",
        "3840 × 2160 (UHD)",
        "720 × 1280 (vertical)",
        "Black",
        "Custom",
        "Fill",
        "Fit",
        "Source",
        "Source (after crop)",
        "Stretch",
        "Transparent",
        "White"
      ],
      field: [
        "#29:592d289632575ba6",
        "Background",
        "Bottom",
        "#10:8fd1ee4971931fc1",
        "End (s)",
        "Fit",
        "#197:6b6689af025d015b",
        "Flip horizontal",
        "Flip vertical",
        "Frame rate",
        "Left",
        "Move X (px)",
        "Move Y (px)",
        "#20:38f89e27b336c8ae",
        "Right",
        "Rotate (°)",
        "Scale",
        "Size",
        "Start (s)",
        "Top",
        "#53:7b6774c547b7b292",
        "#61:a83e87575aaf8f08"
      ],
      params: [
        "#27:5c0fdaddfeae7228",
        "Crop (% of source)",
        "Output",
        "Preview",
        "#138:aded24c3ee35ea77",
        "Transform",
        "Trim"
      ],
      pin: [
        "Match size",
        "Video"
      ],
      title: [
        "Expose as input pin",
        "#66:7be1d86cb788e3de"
      ]
    },
    videoUpscaler: {
      "aria-label": [
        "Compression",
        "Grain",
        "H.264 output",
        "Halo",
        "Noise",
        "Recover Detail",
        "Scale Factor",
        "Target FPS"
      ],
      field: [
        "Compression",
        "#30:9f1d11d4a234078c",
        "Grain",
        "H.264 output",
        "Halo",
        "#36:9658df68934a7e2e",
        "#68:531f5ad352d32c50",
        "Model",
        "Noise",
        "#12:8f3c27b29a7a6e7e",
        "Recover Detail",
        "Scale Factor",
        "Target FPS"
      ],
      pin: [
        "Video"
      ],
      title: [
        "#40:ac0223608540d7e2",
        "Expose as input pin"
      ],
      body: [
        "#52:fe8d410391fd9e69"
      ]
    },
    videoViewer: {
      pin: [
        "Video",
        "Video A",
        "Video B"
      ]
    },
    viewportCapture: {
      "aria-label": [
        "Exact size",
        "FPS",
        "Far cm",
        "Host",
        "Near cm",
        "Port",
        "Snapshot only"
      ],
      choice: [
        "Metric",
        "Post-final (after FXAA/SMAA)",
        "Post-tonemap (after TSR/TAA)",
        "Pre-postprocess (HDR, no AA)"
      ],
      field: [
        "Capture stage",
        "Encoding",
        "Exact size",
        "FPS",
        "Far cm",
        "Height",
        "Host",
        "Near cm",
        "Port",
        "Snapshot only",
        "Width"
      ],
      params: [
        "Capture",
        "Color",
        "Connection",
        "Depth"
      ],
      pin: [
        "Camera",
        "Depth",
        "Frame",
        "Normal"
      ],
      placeholder: [
        "frame max",
        "frame min"
      ],
      title: [
        "#194:4edb2da01f55e2f4",
        "Expose as input pin",
        "#80:8114e411ef5dafd7",
        "#192:e428050668864f28"
      ]
    },
    webcamCapture: {
      pin: [
        "Frame"
      ]
    }
  },
  meshOperations: {
    "UVs.AutoGenerateXAtlasMeshUVs": "UV Unwrap",
    "Remesh.ApplyUniformRemesh": "Remesh",
    "Simplify.ApplySimplifyToTriangleCount": "Simplify",
    "Normals.RecomputeNormals": "Recompute Normals",
    "Repair.FillAllMeshHoles": "Fill Holes",
    "Repair.WeldMeshEdges": "Weld Edges",
    "Voxel.ApplyMeshSolidify": "Solidify"
  }
};

// src/locales/geometry-menu.json
var geometry_menu_default = {
  categories: {
    "Basic Edits": "基础编辑",
    "Bone Weights": "骨骼权重",
    Booleans: "布尔运算",
    Comparison: "网格比较",
    Containment: "包围体",
    Decomposition: "网格分解",
    Deformation: "变形",
    "List Math": "列表运算",
    Lists: "列表",
    "Material IDs": "材质 ID",
    Modeling: "建模",
    Normals: "法线",
    Paths: "路径",
    "Point Sets": "点集",
    Polygon: "多边形",
    "Polygon Lists": "多边形列表",
    PolyGroups: "多边形组",
    Primitives: "基本体",
    Queries: "查询",
    Remeshing: "重新网格化",
    Repair: "修复",
    "Sculpt Layers": "雕刻层",
    Selection: "选择",
    "Selection Queries": "选区查询",
    Simplification: "简化",
    Subdivision: "细分",
    Transforms: "变换",
    UVs: "UV 坐标",
    "Vertex Colors": "顶点颜色",
    Voxel: "体素"
  },
  operations: {
    "Add Triangles to Mesh": "向网格添加三角形",
    "Add Vertices to Mesh": "向网格添加顶点",
    "Append Mesh": "追加网格",
    "Append Mesh Repeated": "重复追加网格",
    "Append Mesh Transformed": "追加变换后的网格",
    "Delete Selected Triangles from Mesh": "从网格删除选中的三角形",
    "Delete Triangles from Mesh": "从网格删除三角形",
    "Delete Vertices from Mesh": "从网格删除顶点",
    "Discard Mesh Attributes": "丢弃网格属性",
    "Merge Mesh Vertices in Selections": "合并选区中的网格顶点",
    "Set All Mesh Vertex Positions": "设置所有网格顶点的位置",
    "Compute Smooth Bone Weights": "计算平滑骨骼权重",
    "Copy Bones from Mesh": "从网格复制骨骼",
    "Discard Bones from Mesh": "从网格移除骨骼",
    "Get Bone Info": "获取骨骼信息",
    "Get Max Bone Weight Index": "获取蒙皮权重使用的最大骨骼索引",
    "Get Root Bone Name": "获取根骨骼名称",
    "Mesh Copy Bone Weights": "在网格的蒙皮配置之间复制骨骼权重",
    "Mesh Create Bone Weights": "创建网格骨骼权重属性",
    "Mesh Has Bone Weights": "检查网格是否具有骨骼权重",
    "Transfer Bone Weights from Mesh": "从网格传递骨骼权重",
    "Apply Mesh Boolean": "对网格执行布尔运算",
    "Apply Mesh Iso Curves": "在网格上生成等值曲线",
    "Apply Mesh Mirror": "镜像网格",
    "Apply Mesh Plane Cut": "按平面切割网格",
    "Apply Mesh Plane Slice": "按平面切片网格",
    "Apply Mesh Self Union": "对网格执行自身并集",
    "Is Intersecting Mesh": "判断网格是否相交",
    "Is Same Mesh As": "判断两个网格是否相同",
    "Measure Distances Between Meshes": "测量网格之间的距离",
    "Compute Mesh Convex Decomposition": "计算网格凸分解",
    "Compute Mesh Convex Hull": "计算网格凸包",
    "Compute Mesh Oriented Box": "计算网格有向包围盒",
    "Compute Mesh Swept Hull": "计算网格扫掠包络",
    "Copy Mesh Selection to Mesh": "将网格选区复制到网格",
    "Split Mesh by Connected Islands": "按连通区域拆分网格",
    "Split Mesh by Material IDs": "按材质 ID 拆分网格",
    "Split Mesh By PolyGroups": "按多边形组拆分网格",
    "Split Mesh by Vertex Overlap": "按顶点重叠拆分网格",
    "Apply Bend Warp to Mesh": "对网格应用弯曲变形",
    "Apply Displace from Per Vertex Vectors": "根据逐顶点向量进行位移",
    "Apply Displace from Texture Map": "根据纹理贴图进行位移",
    "Apply Flare Warp to Mesh": "对网格应用扩口变形",
    "Apply Implicit Smoothing to Mesh": "对网格应用隐式平滑",
    "Apply Iterative Smoothing to Mesh": "对网格应用迭代平滑",
    "Apply Math Warp to Mesh": "对网格应用数学变形",
    "Apply Perlin Noise to Mesh": "对网格应用柏林噪声",
    "Apply Twist Warp to Mesh": "对网格应用扭转变形",
    "Compute Perlin Noise": "计算柏林噪声",
    "Constant Scalar Multiply": "标量列表乘常数",
    "Constant Scalar Multiply in Place": "标量列表原地乘常数",
    "Constant Vector Multiply": "向量列表乘常数",
    "Constant Vector Multiply in Place": "向量列表原地乘常数",
    "Scalar Blend": "混合标量列表",
    "Scalar Blend in Place": "原地混合标量列表",
    "Scalar Invert": "标量列表取倒数",
    "Scalar Invert in Place": "标量列表原地取倒数",
    "Scalar Multiply": "标量列表相乘",
    "Scalar Multiply in Place": "标量列表原地相乘",
    "Scalar Vector Multiply": "标量与向量列表相乘",
    "Scalar Vector Multiply in Place": "标量与向量列表原地相乘",
    "Vector Blend": "混合向量列表",
    "Vector Blend in Place": "原地混合向量列表",
    "Vector Cross": "向量叉积",
    "Vector Dot": "向量点积",
    "Vector Inverse Transform in Place": "原地对向量应用逆变换",
    "Vector Length": "计算向量长度",
    "Vector Normalize in Place": "原地归一化向量",
    "Vector Plane Project in Place": "原地将向量投影到平面",
    "Vector to Scalar": "将向量转换为标量",
    "Vector Transform in Place": "原地变换向量",
    "Clear Color List": "清空颜色列表",
    "Clear Index List": "清空索引列表",
    "Clear Scalar List": "清空标量列表",
    "Clear UVList": "清空 UV 列表",
    "Clear Vector List": "清空向量列表",
    "Convert Array to Color List": "将数组转换为颜色列表",
    "Convert Array to Index List": "将数组转换为索引列表",
    "Convert Array to Scalar List": "将数组转换为标量列表",
    "Convert Array to Triangle List": "将数组转换为三角形列表",
    "Convert Array to UVList": "将数组转换为 UV 列表",
    "Convert Array to Vector List": "将数组转换为向量列表",
    "Convert Color List to Array": "将颜色列表转换为数组",
    "Convert Index List to Array": "将索引列表转换为数组",
    "Convert Scalar List to Array": "将标量列表转换为数组",
    "Convert Triangle List to Array": "将三角形列表转换为数组",
    "Convert UVList to Array": "将 UV 列表转换为数组",
    "Convert Vector List to Array": "将向量列表转换为数组",
    "Duplicate Color List": "复制颜色列表",
    "Duplicate Index List": "复制索引列表",
    "Duplicate Scalar List": "复制标量列表",
    "Duplicate UVList": "复制 UV 列表",
    "Duplicate Vector List": "复制向量列表",
    "Extract Color List Channel": "提取颜色列表通道",
    "Extract Color List Channels": "提取颜色列表的多个通道",
    "Extract UVList Component": "提取 UV 列表分量",
    "Extract Vector List Component": "提取向量列表分量",
    "Extract Vector List Components As UVs": "将向量列表分量提取为 UV",
    "Get Color List Item": "获取颜色列表项",
    "Get Color List Last Index": "获取颜色列表末尾索引",
    "Get Color List Length": "获取颜色列表长度",
    "Get Index List Item": "获取索引列表项",
    "Get Index List Last Index": "获取索引列表末尾索引",
    "Get Index List Length": "获取索引列表长度",
    "Get Scalar List Item": "获取标量列表项",
    "Get Scalar List Last Index": "获取标量列表末尾索引",
    "Get Scalar List Length": "获取标量列表长度",
    "Get Triangle List Last Triangle": "获取三角形列表的最后一个三角形",
    "Get Triangle List Length": "获取三角形列表长度",
    "Get UVList Item": "获取 UV 列表项",
    "Get UVList Last Index": "获取 UV 列表末尾索引",
    "Get UVList Length": "获取 UV 列表长度",
    "Get Vector List Item": "获取向量列表项",
    "Get Vector List Last Index": "获取向量列表末尾索引",
    "Get Vector List Length": "获取向量列表长度",
    "Set Color List Channel from Scalars": "用标量设置颜色列表通道",
    "Set Color List Channels From UVs": "用 UV 设置颜色列表通道",
    "Set Color List Channels from Vectors": "用向量设置颜色列表通道",
    "Set Color List Item": "设置颜色列表项",
    "Set Index List Item": "设置索引列表项",
    "Set Scalar List Item": "设置标量列表项",
    "Set UVList Component from Scalars": "用标量设置 UV 列表分量",
    "Set UVList Item": "设置 UV 列表项",
    "Set Vector List Component from Scalars": "用标量设置向量列表分量",
    "Set Vector List Components From UVs": "用 UV 设置向量列表分量",
    "Set Vector List Item": "设置向量列表项",
    "Clear Material IDs": "清除材质 ID",
    "Delete Triangles by Material ID": "按材质 ID 删除三角形",
    "Enable Material IDs": "启用材质 ID",
    "Get Material IDs Of All Triangles": "获取所有三角形的材质 ID",
    "Get Material IDs Of Triangles": "获取三角形的材质 ID",
    "Get Max Material ID": "获取最大材质 ID",
    "Get Triangles by Material ID": "按材质 ID 获取三角形",
    "Remap Material IDs": "重新映射材质 ID",
    "Set Material IDs On All Triangles": "设置所有三角形的材质 ID",
    "Set Material ID For Mesh Selection": "设置网格选区的材质 ID",
    "Set Material ID On Triangles": "设置三角形的材质 ID",
    "Set PolyGroup Material ID": "设置多边形组的材质 ID",
    "Apply Mesh Bevel Edge Selection": "对选中边倒角",
    "Apply Mesh Bevel Region Selection": "对选中区域倒角",
    "Apply Mesh Disconnect Faces": "断开网格面",
    "Apply Mesh Disconnect Faces Along Edges": "沿边断开网格面",
    "Apply Mesh Inset Outset Faces": "向内或向外偏移选中的面",
    "Apply Mesh Linear Extrude Faces": "线性挤出网格面",
    "Apply Mesh Offset": "偏移网格",
    "Apply Mesh Offset Faces": "偏移网格面",
    "Apply Mesh PolyGroup Bevel": "对多边形组倒角",
    "Apply Mesh Shell": "生成网格壳体",
    "Auto Repair Normals": "自动修复法线",
    "Compute Split Normals": "计算分离法线",
    "Compute Tangents": "计算切线",
    "Discard Tangents": "丢弃切线",
    "Flip Normals": "翻转法线",
    "Flip Triangle Selection Normals": "翻转所选三角形的法线",
    "Get Mesh Has Tangents": "检查网格是否具有切线",
    "Get Mesh Normal Element Values": "获取网格法线元素值",
    "Get Mesh Per Corner Normal Element IDs": "获取网格各角点的法线元素 ID",
    "Get Mesh Per Corner Tangent Element IDs": "获取网格各角点的切线元素 ID",
    "Get Mesh Per Vertex Normals": "获取网格的逐顶点法线",
    "Get Mesh Per Vertex Tangents": "获取网格的逐顶点切线",
    "Get Mesh Tangent Element Values": "获取网格切线元素值",
    "Recompute Normals": "重算法线",
    "Recompute Normals for Mesh Selection": "重新计算网格选区的法线",
    "Set Mesh To Per Vertex Normals (From List)": "从列表设置网格的逐顶点法线",
    "Set Mesh Per Vertex Tangents": "设置网格的逐顶点切线",
    "Set Mesh To Facet Normals": "将网格设置为逐面法线",
    "Set Mesh To Per Vertex Normals (Computed)": "计算并设置网格的逐顶点法线",
    "Set Split Normals Along Selected Edges": "沿选中边设置分离法线",
    "Array Of Vector2D To PolyPath": "将二维向量数组转换为折线路径",
    "Array Of Vector To PolyPath": "将向量数组转换为折线路径",
    "PolyPath To Array Of Vector": "将折线路径转换为向量数组",
    "PolyPath To Array Of Vector2D": "将折线路径转换为二维向量数组",
    "Convert Array Of Vector 2DTo Poly Path": "将二维向量数组转换为折线路径",
    "Convert Array to Poly Path": "将数组转换为折线路径",
    "Convert Poly Path to Array": "将折线路径转换为数组",
    "Convert Poly Path to Array Of Vector 2D": "将折线路径转换为二维向量数组",
    "Create Arc Path 2D": "创建二维圆弧路径",
    "Create Arc Path 3D": "创建三维圆弧路径",
    "Create Circle Path 2D": "创建二维圆形路径",
    "Create Circle Path 3D": "创建三维圆形路径",
    "Flatten To 2D On Axis": "沿指定轴展平到二维",
    "Get Nearest Vertex Index": "获取最近顶点索引",
    "Get Poly Path Arc Length": "获取折线路径弧长",
    "Get Poly Path Last Index": "获取折线路径末尾索引",
    "Get Poly Path Num Vertices": "获取折线路径顶点数",
    "Get Poly Path Tangent": "获取折线路径切线",
    "Get Poly Path Vertex": "获取折线路径顶点",
    "Downsample Points": "对点集降采样",
    "Flatten Points": "展平点集",
    "Get Points from Index List": "按索引列表获取点",
    "KMeans Cluster to IDs": "使用 K 均值聚类生成簇 ID",
    "Make Bounding Box from Points": "从点集创建包围盒",
    "Offset Transforms": "偏移变换列表",
    "Transforms to Points": "将变换转换为点",
    "Unflatten Points": "将展平的点集还原到三维",
    "Add Polygon Vertex": "添加多边形顶点",
    "Array Of Vector2D To Simple Polygon": "将二维向量数组转换为简单多边形",
    "Array Of Vector To Simple Polygon": "将向量数组转换为简单多边形",
    "Simple Polygon To Array Of Vector": "将简单多边形转换为向量数组",
    "Simple Polygon To Array Of Vector2D": "将简单多边形转换为二维向量数组",
    "Get Polygon Arc Length": "获取多边形周长",
    "Get Simple Polygon Area": "获取简单多边形面积",
    "Get Polygon Bounds": "获取多边形边界",
    "Get Polygon Vertex Count": "获取多边形顶点数",
    "Append Polygon List": "追加多边形列表",
    "Create Polygons from Path Offset": "用路径偏移创建多边形",
    "Get Area of Polygon in List": "获取列表中指定多边形的面积",
    "Get Polygon Count": "获取多边形数量",
    "Get Polygon Hole Count": "获取多边形孔洞数",
    "Get Polygon List Area": "获取多边形列表面积",
    "Get Polygon List Bounds": "获取多边形列表边界",
    "Get Polygon Vertices": "获取多边形顶点",
    "Get Simple Polygon": "获取简单多边形",
    "Polygons Difference": "计算多边形差集",
    "Polygons Exclusive Or": "计算多边形异或",
    "Polygons Intersection": "计算多边形交集",
    "Polygons Morphology Close": "对多边形执行形态学闭运算",
    "Polygons Morphology Open": "对多边形执行形态学开运算",
    "Polygons Offset": "偏移多边形",
    "Polygons Offsets": "对多边形进行多次偏移",
    "Polygons Union": "计算多边形并集",
    "Add Named PolyGroup Layer": "添加命名多边形组图层",
    "Clear PolyGroups": "清除多边形组",
    "Compute PolyGroups From Angle Threshold": "按角度阈值计算多边形组",
    "Compute PolyGroups From Polygon Detection": "通过检测多边形生成多边形组",
    "Convert Connected Islands To PolyGroups": "将连通区域转换为多边形组",
    "Convert UV Islands To PolyGroups": "将 UV 岛转换为多边形组",
    "Copy PolyGroups Layer": "复制多边形组图层",
    "Delete Triangles In PolyGroup": "删除多边形组中的三角形",
    "Enable PolyGroups": "启用多边形组",
    "Find Extended PolyGroup Layer By Name": "按名称查找扩展多边形组图层",
    "Get All Triangle PolyGroup IDs": "获取所有三角形的多边形组 ID",
    "Get PolyGroup Bounding Box": "获取多边形组包围盒",
    "Get PolyGroup IDs In Mesh": "获取网格中的多边形组 ID",
    "Get PolyGroup UV Bounding Box": "获取多边形组的 UV 包围盒",
    "Get PolyGroup UV Centroid": "获取多边形组的 UV 质心",
    "Get Triangles In PolyGroup": "获取多边形组中的三角形",
    "Set Num Extended PolyGroup Layers": "设置扩展多边形组图层数",
    "Set PolyGroup For Mesh Selection": "为网格选区设置多边形组",
    "Append Bounding Box": "追加包围盒",
    "Append Box": "追加长方体",
    "Append Capsule": "追加胶囊体",
    "Append Cone": "追加圆锥体",
    "Append Curved Stairs": "追加弧形楼梯",
    "Append Cylinder": "追加圆柱体",
    "Append Delaunay Triangulation 2D": "追加二维德劳内三角剖分",
    "Append Disc": "追加圆盘",
    "Append Linear Stairs": "追加直线楼梯",
    "Append Oriented Box": "追加有向包围盒",
    "Append Polygon List Triangulation": "追加多边形列表的三角剖分",
    "Append Rectangle XY": "在 XY 平面追加矩形",
    "Append Revolve Path": "追加由路径旋转生成的网格",
    "Append Revolve Polygon": "追加由多边形旋转生成的网格",
    "Append Round Rectangle XY": "在 XY 平面追加圆角矩形",
    "Append Simple Extrude Polygon": "追加简单多边形挤出体",
    "Append Simple Swept Polygon": "追加简单多边形扫掠体",
    "Append Sphere Box": "追加由立方体细分生成的球体",
    "Append Sphere Lat Long": "追加经纬球体",
    "Append Spiral Revolve Polygon": "追加螺旋旋转多边形",
    "Append Sweep Polygon": "追加多边形扫掠体",
    "Append Sweep Polyline": "追加折线扫掠体",
    "Append Torus": "追加圆环体",
    "Append Triangulated Polygon": "追加三角化多边形",
    "Append Triangulated Polygon 3D": "追加三角化三维多边形",
    "Append Voronoi Diagram 2D": "追加二维沃罗诺伊图",
    "Create Constrained Edges Chain": "创建约束边链",
    "Create Constrained Edges Loop": "创建闭合约束边环",
    "Get All Boundary Edge IDs": "获取所有边界边 ID",
    "Get All Bowtie Vertex IDs": "获取所有蝴蝶结顶点 ID",
    "Get All Degenerate Triangle IDs": "获取所有退化三角形 ID",
    "Get All Normal Seam Edge IDs": "获取所有法线接缝边 ID",
    "Get All PolyGroup Boundary Edge IDs": "获取所有多边形组边界边 ID",
    "Get All Triangle IDs": "获取所有三角形 ID",
    "Get All Triangle Indices": "获取所有三角形顶点索引",
    "Get All Unset UVTriangle IDs": "获取所有未设置 UV 的三角形 ID",
    "Get All UVBowtie Vertex IDs": "获取所有 UV 蝴蝶结顶点 ID",
    "Get All UVSeam Edges": "获取所有 UV 接缝边",
    "Get All Vertex IDs": "获取所有顶点 ID",
    "Get All Vertex Positions": "获取所有顶点位置",
    "Get All Vertex Positions at Edges": "获取指定边的所有端点位置",
    "Get Has Material IDs": "检查是否具有材质 ID",
    "Get Has PolyGroups": "检查是否具有多边形组",
    "Get Has Triangle IDGaps": "检查三角形 ID 是否存在间断",
    "Get Has Triangle Normals": "检查是否具有三角形法线",
    "Get Has Vertex Colors": "检查是否具有顶点颜色",
    "Get Has Vertex IDGaps": "检查顶点 ID 是否存在间断",
    "Get Is Closed Mesh": "检查网格是否闭合",
    "Get Is Dense Mesh": "检查网格 ID 是否紧密排列",
    "Get Mesh Bounding Box": "获取网格包围盒",
    "Get Mesh Has Attribute Set": "检查网格是否具有属性集",
    "Get Mesh Info String": "获取网格信息字符串",
    "Get Mesh UV Area": "获取网格 UV 面积",
    "Get Mesh Volume Area": "获取网格体积与表面积",
    "Get Mesh Volume Area Center": "获取网格体积、表面积和质心",
    "Get Num Connected Islands": "获取连通区域数量",
    "Get Num Extended PolyGroup Layers": "获取扩展多边形组图层数",
    "Get Num Open Border Edges": "获取开放边界边数",
    "Get Num Open Border Loops": "获取开放边界环数",
    "Get Num Triangle IDs": "获取三角形 ID 数量",
    "Get Num UV Islands": "获取 UV 岛数量",
    "Get Num UV Channels": "获取 UV 通道数量",
    "Get Num Vertex IDs": "获取顶点 ID 数量",
    "Get UVSet Bounding Box": "获取 UV 集包围盒",
    "Get Vertex Count": "获取顶点数",
    "Get Weight Map Handle By Name": "按名称获取权重图句柄",
    "Apply Adaptive Remesh": "执行自适应重新网格化",
    "Apply Uniform Remesh": "执行均匀重新网格化",
    "Compact Mesh": "压紧网格索引",
    "Fill All Mesh Holes": "填补所有网格孔洞",
    "Remove Hidden Triangles": "移除隐藏三角形",
    "Remove Small Connected Islands": "移除较小的连通区域",
    "Remove Unused Vertices": "移除未使用的顶点",
    "Repair Mesh Degenerate Geometry": "修复网格中的退化几何体",
    "Resolve Mesh TJunctions": "修复网格 T 形接点",
    "Snap Mesh Open Boundaries": "吸附网格开放边界",
    "Split Mesh Bowties": "拆分网格中的蝴蝶结顶点",
    "Weld Mesh Edges": "焊接网格边",
    "Discard Sculpt Layers": "丢弃雕刻层",
    "Enable Sculpt Layers": "启用雕刻层",
    "Get Active Sculpt Layer": "获取活动雕刻层",
    "Get Num Sculpt Layers": "获取雕刻层数量",
    "Get Sculpt Layer Weights Array": "获取雕刻层权重数组",
    "Merge Sculpt Layers": "合并雕刻层",
    "Set Active Sculpt Layer": "设置活动雕刻层",
    "Set Sculpt Layer Weight": "设置雕刻层权重",
    "Set Sculpt Layer Weights Array": "设置雕刻层权重数组",
    "Combine Mesh Selections": "组合网格选区",
    "Convert Index Array to Mesh Selection": "将索引数组转换为网格选区",
    "Convert Index List to Mesh Selection": "将索引列表转换为网格选区",
    "Convert Mesh Selection": "转换网格选区类型",
    "Convert Mesh Selection to Index Array": "将网格选区转换为索引数组",
    "Convert Mesh Selection to Index List": "将网格选区转换为索引列表",
    "Create Select All Mesh Selection": "创建包含整个网格的选区",
    "Expand Contract Mesh Selection": "扩展或收缩网格选区",
    "Expand Mesh Selection to Connected": "将网格选区扩展到连通元素",
    "Get Mesh Selection Info": "获取网格选区信息",
    "Get Mesh Unique Selection Info": "获取去重后的网格选区信息",
    "Invert Mesh Selection": "反转网格选区",
    "Select Mesh Boundary Edges": "选择网格边界边",
    "Select Mesh Elements by Material ID": "按材质 ID 选择网格元素",
    "Select Mesh Elements by Normal Angle": "按法线角度选择网格元素",
    "Select Mesh Elements by Polygroup": "按多边形组选择网格元素",
    "Select Mesh Elements in Box": "选择盒内的网格元素",
    "Select Mesh Elements Inside Mesh": "选择网格内部的元素",
    "Select Mesh Elements in Sphere": "选择球内的网格元素",
    "Select Mesh Elements with Plane": "使用平面选择网格元素",
    "Select Mesh PolyGroup Boundary Edges": "选择多边形组边界边",
    "Select Mesh Sharp Edges": "选择网格锐边",
    "Select Mesh Split Normal Edges": "选择网格的法线分离边",
    "Select Mesh UV Seam Edges": "选择网格 UV 接缝边",
    "Select Selection Boundary Edges": "选择选区边界边",
    "Get Mesh Selection Bounding Box": "获取网格选区包围盒",
    "Apply Cluster Simplify to Edge Length": "按边长执行聚类简化",
    "Apply Editor Simplify to Triangle Count": "用编辑器简化器按三角形数简化",
    "Apply Editor Simplify to Vertex Count": "用编辑器简化器按顶点数简化",
    "Apply Simplify to Edge Length": "按目标边长简化",
    "Apply Simplify to Planar": "简化共面区域",
    "Apply Simplify To PolyGroup Topology": "按多边形组拓扑简化",
    "Apply Simplify to Tolerance": "按误差容限简化",
    "Apply Simplify to Triangle Count": "按目标三角形数简化",
    "Apply Simplify to Vertex Count": "按目标顶点数简化",
    "Apply PN Tessellation": "应用 PN 三角形曲面细分",
    "Apply Selective Tessellation": "细分选中区域",
    "Apply Uniform Tessellation": "应用均匀细分",
    "Inverse Transform Mesh": "对网格应用逆变换",
    "Inverse Transform Mesh Selection": "对网格选区应用逆变换",
    "Rotate Mesh": "旋转网格",
    "Rotate Mesh Selection": "旋转网格选区",
    "Scale Mesh": "缩放网格",
    "Scale Mesh Selection": "缩放网格选区",
    "Transform Mesh": "变换网格",
    "Transform Mesh Selection": "变换网格选区",
    "Translate Mesh": "平移网格",
    "Translate Mesh Selection": "平移网格选区",
    "Translate Pivot to Location": "将轴心平移到指定位置",
    "Apply Texel Density UVScaling": "按纹素密度缩放 UV",
    "Auto Generate Patch Builder Mesh UVs": "使用分片构建器自动生成网格 UV",
    "Auto Generate XAtlas Mesh UVs": "使用 XAtlas 自动生成网格 UV",
    "Clear UV Channel": "清除 UV 通道",
    "Copy Mesh UV Channel To Mesh": "将网格 UV 通道复制到其他网格",
    "Copy UV Channel": "复制 UV 通道",
    "Get Mesh Per Vertex UVs": "获取网格的逐顶点 UV",
    "Get Mesh UVDistortion Metrics": "获取网格 UV 畸变指标",
    "Get Mesh UVSize Info": "获取网格 UV 尺寸信息",
    "Layout Mesh UVs": "排列网格 UV",
    "Recompute Mesh UVs": "重新计算网格 UV",
    "Repack Mesh UVs": "重新打包网格 UV",
    "Rotate Mesh UVs": "旋转网格 UV",
    "Scale Mesh UVs": "缩放网格 UV",
    "Set Mesh UVs from Box Projection": "通过盒状投影设置网格 UV",
    "Set Mesh UVs from Cylinder Projection": "通过柱面投影设置网格 UV",
    "Set Mesh UVs from Planar Projection": "通过平面投影设置网格 UV",
    "Set Num UV Channels": "设置 UV 通道数量",
    "Set UV Seams Along Selected Edges": "沿选中边设置 UV 接缝",
    "Transfer Mesh UVs by Projection": "通过投影传递网格 UV",
    "Translate Mesh UVs": "平移网格 UV",
    "Blur Mesh Vertex Colors": "模糊网格顶点颜色",
    "Convert Mesh Vertex Colors Linear to SRGB": "将顶点颜色从线性空间转换为 sRGB",
    "Convert Mesh Vertex Colors SRGBTo Linear": "将顶点颜色从 sRGB 转换为线性空间",
    "Get Mesh Per Vertex Colors": "获取网格的逐顶点颜色",
    "Set Mesh Constant Vertex Color": "设置网格的统一顶点颜色",
    "Set Mesh Per Vertex Colors": "设置网格的逐顶点颜色",
    "Set Mesh Selection Vertex Color": "设置网格选区的顶点颜色",
    "Transfer Vertex Colors from Mesh": "从网格传递顶点颜色",
    "Apply Mesh Morphology (Voxel Offset)": "应用网格形态学运算（体素偏移）",
    "Apply Mesh Solidify (Voxel Wrap)": "实体化网格（体素包裹）"
  }
};

// src/workspace-details.ts
var words = new Map(Object.entries(workspace_details_default.translations));
var helpLengths = new Set(Array.from(words.keys(), keyLength));
var defaultNames = new Map(
  Object.entries(workspace_details_default.defaults).map(([kind, names]) => [kind, new Map(Object.entries(names))])
);
var nodeRules = new Map(
  Object.entries(workspace_details_default.nodes).map(([kind, roles]) => [kind, Object.fromEntries(Object.entries(roles).map(([role, names]) => [role, new Set(names)]))])
);
var operationLabels = new Map(Object.entries(geometry_menu_default.operations));
var operationGroups = new Map(Object.entries(geometry_menu_default.categories));
var meshOperations = new Map(Object.entries(workspace_details_default.meshOperations));
var englishRename = " — Double-click to rename";
var chineseRename = " — 双击重命名";
var bridgeRequirement = "Needs the Unreal Editor (Unreal Canvas Bridge).";
var bridgeStatus = "Not connected: could not reach ";
var platformHelpLength = 284;
function isPlatformHelp(value) {
  return value.length >= platformHelpLength && value.startsWith("Render as ") && copyId(value.slice(0, platformHelpLength)) === "2ab094780cb80e80";
}
var platformNoteZh = "临时切换编辑器的预览平台后渲染，首次切换可能需要编译着色器。";
var pinToggle = '.merlin-param-control > button:is([title="Expose as input pin"],[title="Remove pin"],[title="公开为输入引脚"],[title="移除引脚"])';
var standardRenderPasses = /* @__PURE__ */ new Map([["beauty", "Beauty"], ["depth", "Depth"], ["normal", "Normal"]]);
var resolutionSources = /* @__PURE__ */ new Map([["viewport", "视口"], ["camera", "相机"]]);
var missingCameraPrefix = "Unreal couldn't find ";
var missingCameraSuffixLength = 61;
var previewMessages = /* @__PURE__ */ new Map([["Generating…", "正在生成…"], ["Loading…", "正在加载…"]]);
var workflowStatuses = /* @__PURE__ */ new Map([
  ["error", ["Run failed", "运行失败"]],
  ["notice", ["Nothing to do", "没有需要处理的内容"]],
  ["running", ["Generating", "正在生成"]],
  ["needs-input", ["Needs an input before it can run", "提供输入后才能运行"]],
  ["ready", ["Ready to generate", "可以开始生成"]]
]);
var workflowStatusLabels = new Set([...workflowStatuses.values()].map(([name]) => name));
function translateWorkflowPreview(element, field, value) {
  const message = field === "text" && previewMessages.get(value);
  if (message && element.matches(".canvas-card-body span")) {
    const props2 = renderedFiber(element)?.return?.return?.memoizedProps;
    if (props2?.message === value && typeof props2.hasPreview === "boolean") return message;
  }
  if (!workflowStatusLabels.has(value)) return;
  const row = field === "title" || field === "data-title-tip" ? element : field === "text" ? element.parentElement : null;
  if (!row?.matches(".canvas-card-body div:is([title],[data-title-tip])") || field === "text" && element !== row.lastElementChild) return;
  const props = renderedFiber(row)?.return?.return?.memoizedProps;
  const label2 = props?.status && typeof props.name === "string" ? workflowStatuses.get(props.status) : void 0;
  if (label2?.[0] === value) return label2[1];
}
function isRenderVariableLabel(element) {
  return element.classList.contains("merlin-param-label") && !!element.closest(".merlin-param-row:not([data-param-key])")?.querySelector(":scope > " + pinToggle);
}
function renderResolutionHint(element, value, text) {
  if (!element.matches(".graph-node-params div:not([class])") || !element.textContent?.startsWith("→")) return;
  const match = /^· matches (viewport|camera) (\d+(?:\.\d+)?):1$/.exec(value);
  if (match) return "· 匹配" + resolutionSources.get(match[1]) + "宽高比 " + match[2] + ":1";
  if (value.startsWith(missingCameraPrefix) && copyKey(value.slice(-missingCameraSuffixLength)) === "#61:479349e67677b7c0") {
    const name = value.slice(missingCameraPrefix.length, -missingCameraSuffixLength);
    return "UE 找不到“" + name + "”。它可能已重命名或删除，请重新选择相机。";
  }
  const source = resolutionSources.get(value);
  const lead = text?.previousSibling?.nodeValue?.trim();
  if (source && lead && ["#33:84437dbdb300b3dd", "#45:c45296b6324313b1"].some((key) => words.get(key) === lead || copyKey(lead) === key)) return source;
}
function renderPassLabel(element, field, value, popupOwner, node) {
  const pass = standardRenderPasses.get(value);
  if (!pass) return;
  const names = node.params?.mrgPassNames;
  const dataType2 = node.kind === "sequenceRender" ? "video" : "image";
  const standard = Array.isArray(names) && names.length ? names.includes(pass) || names.includes(value) : node.pins?.some((pin) => pin.direction === "output" && pin.dataType === dataType2 && pin.id === value && pin.name === value);
  if (!standard) return;
  const label2 = words.get(pass);
  if (element.matches(".graph-node-body .nodrag > button[aria-pressed]:is([title],[data-title-tip])")) {
    const title = element.getAttribute("title") ?? element.getAttribute("data-title-tip");
    if (field !== "text" || title === value || title === label2) return label2;
  }
  if (field !== "text") return;
  if (popupOwner?.closest(".graph-node-body") && element.closest('[role="option"]')?.getAttribute("data-value") === value) return label2;
  if (element.matches('.graph-node-body button.custom-select[role="combobox"] > span > span[aria-hidden]')) return label2;
}
function ownerOfList(element) {
  const list = element.closest('[role="listbox"][id]');
  if (!list) return;
  for (const button of element.ownerDocument.querySelectorAll('.react-flow__node [role="combobox"][aria-controls]')) {
    if (button.getAttribute("aria-controls")?.split(/\s+/).includes(list.id)) return button;
  }
}
function uiRole(element, field, isPopup) {
  if (isPopup) return field === "text" ? "choice" : field;
  if (element.classList.contains("merlin-pin-label")) return "pin";
  if (element.classList.contains("merlin-param-label")) return "field";
  if (field !== "text") return field;
  if (element.matches(".text-input-rich[data-merlin-text-surface] > span:only-child")) return "blankText";
  if (element.closest("[contenteditable],pre,code,textarea,[data-merlin-text-surface]")) return;
  if (element.closest('[role="combobox"]')) return "choice";
  if (element.closest('button,[role="button"]')) return "button";
  if (element.closest(".merlin-param-control")) return "control";
  if (element.closest(".graph-node-params")) return "params";
  if (element.closest(".graph-node-body")) return "body";
}
function createWorkspaceTranslator(readCanvas) {
  const indexes = /* @__PURE__ */ new WeakMap();
  function displayedNode(id) {
    const state = readCanvas?.();
    const nodes = state?.activeCanvasId && state.canvases[state.activeCanvasId]?.nodes;
    if (!nodes) return;
    let index = indexes.get(nodes);
    if (!index) {
      index = new Map(nodes.map((node) => [node.id, node]));
      indexes.set(nodes, index);
    }
    return index.get(id);
  }
  return (element, field, value, text) => {
    const preview = translateWorkflowPreview(element, field, value);
    if (preview !== void 0) return preview;
    const header = element.matches(".graph-node-header-title span[title]");
    const rename = header && field === "title" && value.endsWith(englishRename);
    const dynamic = value.startsWith(bridgeRequirement) || isPlatformHelp(value) || value.startsWith("Could not fetch MCP tool list from ") || value.startsWith("Error — Could not fetch MCP tool list from ");
    const resolutionHint = field === "text" && (value.startsWith("· matches ") || value.startsWith(missingCameraPrefix) || resolutionSources.has(value));
    const renderPass = (field === "text" || field === "title" || field === "data-title-tip") && standardRenderPasses.has(value);
    const key = words.has(value) || !helpLengths.has(value.length) ? value : copyKey(value);
    const translation = words.get(key);
    const geometryName = operationLabels.get(value) ?? operationGroups.get(value);
    if (!translation && !geometryName && !header && !dynamic && !resolutionHint && !renderPass) return;
    const popupOwner = ownerOfList(element);
    const owner = (popupOwner ?? element).closest(".react-flow__node[data-id]");
    const id = owner?.getAttribute("data-id");
    const node = id ? displayedNode(id) : void 0;
    if (!node) return;
    if (header && (rename || field === "text")) {
      const original = rename ? value.slice(0, -englishRename.length) : value;
      let kindName = defaultNames.get(node.kind)?.get(original);
      if (node.kind === "meshOp" && original !== meshOperations.get(String(node.params?.meshOp))) {
        const selector = owner?.querySelector('[role="combobox"][data-value]');
        const selected = selector?.querySelector('[aria-hidden="false"]')?.textContent;
        kindName = operationLabels.get(original);
        if (!kindName || selector?.getAttribute("data-value") !== node.params.meshOp || selected !== original && selected !== kindName) return;
      }
      if (kindName && !node.name) return rename ? kindName + chineseRename : kindName;
      if (rename && kindName && original === node.name) return original + "（" + kindName + "）" + chineseRename;
      return;
    }
    const rules = nodeRules.get(node.kind);
    if (!rules) return;
    if (node.kind === "unrealRender" || node.kind === "sequenceRender") {
      if (resolutionHint) {
        const hint = renderResolutionHint(element, value, text);
        if (hint !== void 0) return hint;
      }
      if (renderPass) return renderPassLabel(element, field, value, popupOwner, node);
      if ((field === "text" || field === "title") && isRenderVariableLabel(element)) return null;
    }
    if (dynamic && element.closest(".graph-node-body")) {
      if (value.startsWith(bridgeRequirement) && field === "text") {
        const rest = value.slice(bridgeRequirement.length).replace(bridgeStatus, "未连接，无法访问 ");
        return "此节点需要连接虚幻编辑器（Unreal Canvas Bridge）。" + rest.trimStart();
      }
      if ((node.kind === "sequenceRender" || node.kind === "unrealRender") && field === "title" && isPlatformHelp(value)) {
        return platformNoteZh + value.slice(platformHelpLength).replace("Could not read the editor's list: ", "无法读取编辑器平台列表：");
      }
      if (node.kind === "mcpTool" && (field === "text" || field === "title")) {
        return value.replace(/^(Error — )?Could not fetch MCP tool list from /, "无法获取 MCP 工具列表，服务地址为 ");
      }
    }
    if (geometryName && field === "text" && node.kind === "meshOp") {
      const selector = popupOwner ?? element.closest('[role="combobox"]');
      const row = selector?.closest(".merlin-param-row:not([data-param-key])");
      const fieldLabel = row?.querySelector(":scope > .merlin-param-label")?.textContent;
      if ((fieldLabel === "Operation" || fieldLabel === "操作") && selector?.getAttribute("data-value") === node.params.meshOp) return geometryName;
    }
    if (field === "text" && translation && (value === "Add provider" || value === "Add additional providers" || value === "No models available")) {
      const button = popupOwner ?? element.closest('[role="combobox"]');
      const key2 = button?.closest("[data-param-key]")?.getAttribute("data-param-key");
      const isModel = key2 === "model" || key2 === "modelId" || node.kind === "spatialPromptSynthesis" && ["Model", "模型"].includes(button?.getAttribute("aria-label") ?? "");
      if (!isModel) return;
      const option = element.closest('[role="option"]');
      if (popupOwner) {
        if (option?.getAttribute("data-value") === "\0footer-action") return translation;
      } else if (button && element.parentElement?.parentElement === button) {
        const container = element.parentElement;
        if (value !== "No models available" && element === container.lastElementChild) return translation;
        if (value === "No models available" && element === container.firstElementChild && container.children.length === 2 && ["Add provider", "添加服务商"].includes(container.lastElementChild?.textContent ?? "")) return translation;
      }
    }
    const role = uiRole(element, field, !!popupOwner);
    if (!role || !translation || !rules[role]?.has(key)) return;
    if (role === "blankText" && node.params?.markdown) return;
    if (role === "pin") {
      const pinId = element.parentElement?.querySelector(":scope > [data-pin-dot]")?.getAttribute("data-pin-dot");
      const pin = node.pins.find((item) => item.id === pinId);
      if (!pin || !pin.systemManaged && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(pin.id)) return;
    }
    if (role === "body" && node.kind === "task" && Array.isArray(node.params?.tasks) && node.params.tasks.length) return;
    if (role === "body" && node.kind === "mcpTool" && node.params?.toolName && node.params.toolName !== "None") return;
    if (role === "choice") {
      const button = popupOwner ?? element.closest('[role="combobox"]');
      const rowKey = button?.closest("[data-param-key]")?.getAttribute("data-param-key");
      if (rowKey === "modelId" || rowKey === "model" || ["Model", "模型"].includes(button?.getAttribute("aria-label") ?? "")) return;
    }
    return translation;
  };
}

// src/media-details.ts
var mediaTypes = {
  Image: "图像",
  Video: "视频",
  Audio: "音频",
  Mesh: "网格",
  Text: "文本",
  File: "文件",
  Splat: "高斯泼溅"
};
function translateMediaTypeLabel(english) {
  if (Object.prototype.hasOwnProperty.call(mediaTypes, english)) return mediaTypes[english];
}
var cardTypes = new Map(Object.entries({
  Action: "操作",
  Deck: "卡组",
  "Component Card": "组件卡片",
  Reference: "引用",
  Tool: "工具",
  Component: "组件"
}));
var cardSubtypes = new Map(Object.entries({
  Graph: "节点图",
  Model: "模型",
  ImageGen: "生成图像",
  VideoGen: "生成视频",
  AudioGen: "生成音频",
  MeshGen: "生成网格",
  SplatGen: "生成高斯泼溅",
  TextGen: "生成文本"
}));
function translateCardTypeLabel(english) {
  const type = cardTypes.get(english);
  if (type) return type;
  const derived = /^([^(]+) \((.+)\)$/.exec(english);
  const parent = derived && cardTypes.get(derived[1]);
  if (derived && parent) return parent + "（" + (cardSubtypes.get(derived[2]) ?? derived[2]) + "）";
}
function libraryCardTitle(card, english) {
  const name = card.querySelector(".media-library-caption strong")?.textContent;
  if (!name || !english.startsWith(name + "\n")) return;
  const detail = english.slice(name.length + 1);
  if (card.classList.contains("media-library-archived-card")) {
    const archive = /^(?:(.+)\n)?Archived (.+)\nWas on ([\s\S]*)\nRight-click to restore\b.*$/.exec(detail);
    if (archive) {
      const type = archive[1] ? "\n" + (translateCardTypeLabel(archive[1]) ?? archive[1]) : "";
      return name + type + "\n归档时间：" + archive[2] + "\n原画布：" + archive[3] + "\n右键可恢复，或拖到画布上恢复";
    }
    return;
  }
  const lines = detail.split("\n");
  if (lines.length < 3 || !(lines[0] in mediaTypes)) return;
  lines[0] = mediaTypes[lines[0]];
  if (lines.length === 4) lines[2] = lines[2].replace(/^Used in (\d+) places: /, "共 $1 处引用：");
  return [name, ...lines].join("\n");
}
function archiveDialogTitle(english) {
  const single = /^Delete “([\s\S]*)” permanently\?$/.exec(english);
  if (single) return "永久删除“" + single[1] + "”？";
  const multi = /^Delete (\d+) archived cards permanently\?$/.exec(english);
  if (multi) return "永久删除 " + multi[1] + " 张已归档卡片？";
}
function translateMediaDetails(element, field, english, node) {
  if (field === "title" && element.classList.contains("media-library-card")) return libraryCardTitle(element, english);
  if ((field === "title" || field === "aria-label") && element.matches(".card-version-tray button")) {
    const choose = /^Show ([\s\S]+) as the component card's face$/.exec(english);
    if (choose) return "将“" + choose[1] + "”显示在组件卡片正面";
    const active = /^([\s\S]+) — the component card's face$/.exec(english);
    if (active) return "组件卡片正面当前显示“" + active[1] + "”";
  }
  if (field === "aria-label") {
    if (element.classList.contains("media-library-select") && english.startsWith("Select ")) return "选择“" + english.slice(7) + "”";
    if (element.classList.contains("media-library-locate") && english.startsWith("Show ") && english.endsWith(" on the canvas")) {
      return "在画布中定位“" + english.slice(5, -14) + "”";
    }
    if (element.classList.contains("media-library-open-viewer")) {
      const viewer = /^Open [Vv]iewer — ([\s\S]+)$/.exec(english);
      if (viewer) return "在查看器中打开“" + viewer[1] + "”";
    }
    if (element.matches('.media-library-type-icon[role="img"]')) return translateMediaTypeLabel(english);
    if (element.classList.contains("media-library-usage")) {
      const used = /^Used in (\d+) places?$/.exec(english);
      if (used) return "共 " + used[1] + " 处引用";
    }
    if (element.matches('.media-library-results [role="dialog"]')) return archiveDialogTitle(english);
  }
  if (field !== "text") return;
  if (element.matches('.media-library-results [role="dialog"] > div:first-child')) return archiveDialogTitle(english);
  if (element.matches(".media-library-archived-card :is(.media-library-caption,.media-library-card-meta) > span") && element.firstChild === node && english === "Archived") return "归档于";
  if (element.matches(".media-library-archived-card .media-library-card-meta > span:first-child:not(:only-child)")) {
    return translateCardTypeLabel(english);
  }
  if (element.classList.contains("ue-menu-label") && element.closest(".ue-menu")?.parentElement?.querySelector(".media-library")) {
    const prefix = element.firstChild?.nodeValue?.trim();
    if ((prefix === "Show in" || prefix === "定位到") && element.childNodes.length === 4 && element.childNodes[2].nodeValue === " · ") {
      return node === element.firstChild ? "定位到" : english;
    }
    const restore = /^Restore (\d+) cards$/.exec(english);
    if (restore) return "恢复 " + restore[1] + " 张卡片";
    const remove = /^Delete (\d+) cards permanently$/.exec(english);
    if (remove) return "永久删除 " + remove[1] + " 张卡片";
    const files = /^Copy (\d+) file paths$/.exec(english);
    if (files) return "复制 " + files[1] + " 个文件路径";
  }
  if (element.localName === "button" && element.childNodes.length === 5 && !element.hasAttribute("title") && element.closest(".nodrag.nowheel:has(.merlin-pane-collapse[aria-expanded])")) {
    const prefix = element.firstChild?.nodeValue;
    if (prefix !== "Load more (" && prefix !== "加载更多（已显示 ") return;
    if (node === element.firstChild) return "加载更多（已显示 ";
    if (node === element.childNodes[2] && english === "of") return "/";
    if (node === element.lastChild && english === ")") return "）";
  }
}

// src/editor-connection.ts
var chipPrefix = "Unreal Editor: ";
var chipStates = [
  [/^connected to (.+), which is still loading\.$/, "已连接到 $1，编辑器仍在加载。"],
  [/^connected to (.+), without Unreal Canvas Bridge\..*\bnodes\b.*$/, "已连接到 $1。该编辑器没有 Unreal Canvas Bridge，部分 Unreal 节点不可用。打开菜单可查看详情。"],
  [/^connected to (.+), without Unreal Canvas Bridge\..*\bcards\b.*$/, "已连接到 $1。该编辑器没有 Unreal Canvas Bridge，部分 Unreal 卡片不可用。打开菜单可查看详情。"],
  [/^connected to (.+), but it isn't answering\..*$/, "已连接到 $1，但编辑器没有响应。打开菜单可查看详情。"],
  [/^connected to (.+), but Unreal nodes can't run in it\..*$/, "已连接到 $1，但该编辑器无法运行 Unreal 节点。打开菜单可查看详情。"],
  [/^connected to (.+), but Unreal cards can't run in it\..*$/, "已连接到 $1，但该编辑器无法运行 Unreal 卡片。打开菜单可查看详情。"],
  [/^connected to (.+)\. Renders, imports\b.*$/, "已连接到 $1。渲染、导入和视口操作将发送到该编辑器。"],
  [/^not connected\. One editor is running;.*$/, "尚未连接。有一个编辑器正在运行，选择后即可向它发送渲染、导入和视口操作。"],
  [/^not connected\. (\d+) editors are running;.*$/, "尚未连接。有 $1 个编辑器正在运行，请选择接收渲染、导入和视口操作的编辑器。"],
  [/^not connected\. (.+) (?:is|are) running without an MCP server;.*$/, "尚未连接。$1 正在运行，但未启动 MCP 服务。打开菜单可查看详情。"],
  [/^not connected\. Renders, imports\b.*$/, "尚未连接。请在虚幻编辑器中打开工程，以便渲染、导入和使用视口。"],
  [/^(.+) is running but has no MCP server\b.*$/, "$1 正在运行，但没有 MCP 服务，无法连接。打开菜单可查看详情。"],
  [/^starting (.+)\. It connects once it has loaded\.$/, "正在启动 $1。加载完成后将自动连接。"],
  [/^(.+) is opening (.+)\.$/, "$1 正在打开 $2。"]
];
var capability = [
  [/^(.+) has Unreal Canvas Bridge: every Unreal node works\.$/, "$1 已启用 Unreal Canvas Bridge，所有 Unreal 节点均可使用。"],
  [/^(.+) has Unreal Canvas Bridge: every Unreal card works\.$/, "$1 已启用 Unreal Canvas Bridge，所有 Unreal 卡片均可使用。"],
  [/^(.+) has Unreal Canvas Bridge, but can't run Python for Unreal Canvas\.$/, "$1 已启用 Unreal Canvas Bridge，但无法为 Unreal Canvas 运行 Python。"],
  [/^(.+) is still loading\.$/, "$1 仍在加载。"],
  [/^(.+) isn't answering\.$/, "$1 没有响应。"],
  [/^(.+) doesn't have Unreal Canvas Bridge\.$/, "$1 未启用 Unreal Canvas Bridge。"],
  [/^(.+) has neither Unreal Canvas Bridge nor engine Python\.$/, "$1 未启用 Unreal Canvas Bridge，也未启用引擎 Python。"],
  [/^(.+) is running, but it has no MCP server\.$/, "$1 正在运行，但没有 MCP 服务。"],
  [/^(.+) didn't open (.+)\.$/, "$1 未能打开 $2。"]
];
function matchMessage(value, messages) {
  for (const [pattern, replacement] of messages) {
    if (pattern.test(value)) return value.replace(pattern, replacement);
  }
}
function editorVersion(label2) {
  return label2.replace(/^(UE [\d.]+) \(source\)$/, "$1（源码版）");
}
function describeRow(value) {
  const newline = value.indexOf("\n");
  if (newline < 0) return;
  const lines = value.slice(newline + 1);
  const path = value.slice(0, newline + 1);
  const engine = /^Opens with (.+?), (.+)$/.exec(lines);
  if (engine) return path + "使用 " + editorVersion(engine[1]) + " 打开，路径：" + engine[2];
  if (copyId(lines) === "a22f81473ffecbf7") return path + "此电脑未安装工程使用的引擎，请选择一个引擎打开它。";
  const process = /^(?:Unreal Engine ([^\n,]+), )?process (\d+), MCP port (\d+)(?:\n(Found by its MCP server:[^\n]+))?$/.exec(lines);
  if (process) return path + (process[1] ? "虚幻引擎 " + process[1] + "，" : "") + "进程 " + process[2] + "，MCP 端口 " + process[3] + (process[4] ? "\n通过 MCP 服务发现。Unreal Canvas Bridge 未列出此编辑器，其中的渲染、导入和视口功能可能不可用。" : "");
  if (lines.startsWith("This editor has no MCP server, so Unreal Canvas")) return path + "此编辑器没有 MCP 服务，Unreal Canvas 无法连接。请在“编辑 → 插件”中启用 Model Context Protocol 和可用的 Unreal Canvas Bridge，然后重启编辑器。";
}
var detailStates = [
  [/^These won't work: (.+)\.$/, "以下节点不可用：$1。"],
  [/^Its MCP server didn't respond \(([\s\S]+)\)\. A busy editor\b.*$/, "MCP 服务没有响应（$1）。编辑器正在加载或编译着色器时可能繁忙，空闲后会恢复响应。"],
  [/^If it stays\b.*? Details: ([\s\S]+)$/, "如果一直没有响应，请重启编辑器。详细信息：$1"],
  [/^Renders, imports\b.*?\bPython instead\. These won't work: (.+)\.$/, "渲染、导入和生成对象将通过引擎 Python 执行。以下节点不可用：$1。"],
  [/^Renders, imports\b.*?\bPython instead\.$/, "渲染、导入和生成对象将通过引擎 Python 执行。"],
  [/^Unreal nodes can't run in it: (.+)\.$/, "以下 Unreal 节点无法在此编辑器中运行：$1。"],
  [/^Unreal cards can't run in it: (.+)\.$/, "以下 Unreal 卡片无法在此编辑器中运行：$1。"]
];
var pythonHelp = "检查 Bridge 的蓝图执行设置，或启用 EditorToolset 和 Python 后重启。";
function changeAction(value) {
  if (value === "quit" || value === "Quit") return "退出编辑器";
  if (value === "Quitting") return "退出编辑器";
  return value.replace(/^(?:open|Open|Opening) (.+)$/, "打开 $1");
}
function translateEditorConnection(el, field, value, node) {
  if (el.classList.contains("unreal-editor-chip") && field === "aria-label" && value.startsWith(chipPrefix)) {
    const status = matchMessage(value.slice(chipPrefix.length), chipStates);
    if (status) return "虚幻编辑器：" + status;
  }
  if (field === "title" && copyId(value) === "b697adbe21e20ffc" && el.matches(":is(.pill-menu,.ue-menu):has(.merlin-panel-search) button,.ue-submenu > button")) {
    return "需要在虚幻编辑器中运行 Python。" + pythonHelp;
  }
  const tip = el.closest('[role="tooltip"]');
  if (tip?.id && field === "text") {
    const chip = el.ownerDocument.querySelector(".unreal-editor-chip");
    if (chip?.getAttribute("aria-describedby")?.split(/\s+/).includes(tip.id)) {
      if (value === "Unreal Editor") return "虚幻编辑器";
      if (copyId(value) === "7e481c7ef0ae84fc") return "连接虚幻编辑器并打开工程";
      return matchMessage(value.charAt(0).toLowerCase() + value.slice(1), chipStates);
    }
  }
  if (!el.closest(".unreal-editor-menu")) return;
  if (field === "title" && el.matches("button,.unreal-editor-menu-starting")) {
    if (copyId(value) === "3f8a09e9464431a3") return "当前编辑器无法为 Unreal Canvas 运行 Python。" + pythonHelp;
    return describeRow(value);
  }
  if (field === "aria-label") {
    if (el.classList.contains("unreal-editor-menu-forget")) return value.replace(/^Remove (.+) from recent projects$/, "从最近工程中移除“$1”");
    if (el.classList.contains("unreal-editor-menu-quit")) return value.replace(/^Quit (.+)$/, "退出 $1");
  }
  if (field === "placeholder" && el.closest(".unreal-level-picker-search")) {
    const n = /^Search (\d+) levels$/.exec(value);
    if (n) return "搜索 " + n[1] + " 个关卡";
  }
  if (field !== "text") return;
  if (el.closest('[role="alert"]') && !el.classList.contains("unreal-editor-menu-note")) return null;
  const cls = el.classList;
  if (cls.contains("unreal-editor-menu-status-title")) return matchMessage(value, capability);
  if (cls.contains("unreal-editor-menu-status-detail")) {
    if (copyId(value) === "11e3055b87885f7d") return pythonHelp;
    if (value.startsWith("To fix: enable") && value.includes("Unreal Canvas Bridge")) {
      return "请启用 Unreal Canvas Bridge 并重启。仅使用渲染与导入等功能时，也可检查 EditorToolset、Python 和 Movie Render Queue。";
    }
    return matchMessage(value, detailStates);
  }
  if (el.matches(".unreal-editor-menu-row .ue-menu-count:not(.unreal-editor-menu-path)")) return value === "No engine" ? "未找到引擎" : editorVersion(value);
  if (el.closest('.unreal-editor-menu-path,button[role="menuitemradio"] .ue-menu-label,.unreal-editor-menu-row .ue-menu-label,button[role="menuitemradio"] .ue-menu-detail,[aria-disabled="true"] .ue-menu-label')) return null;
  if (el.matches('.unreal-editor-menu-starting[role="status"] .ue-menu-label')) return matchMessage(value, [
    [/^Saving, then quitting (.+)…$/, "正在保存，随后退出 $1…"],
    [/^Quitting (.+)…$/, "正在退出 $1…"]
  ]);
  if (el.childNodes.length > 1) {
    if (cls.contains("ue-menu-heading")) {
      if (node === el.firstChild && value === "Open a level in") return "打开此工程中的关卡：";
      if (node === el.firstChild && value === "Open") return "选择打开工程";
      if (node === el.lastChild && value === "with") return "所用的引擎";
      return null;
    }
    if (cls.contains("unreal-editor-menu-note")) {
      if (node === el.firstChild && ["Open now:", "Didn't open", "Didn't quit"].includes(value)) return value === "Open now:" ? "当前关卡：" : value === "Didn't open" ? "未能打开" : "未能退出";
      if (node === el.lastChild && copyId(value) === "5bad8359f1866095") return "项未显示。输入部分名称或文件夹名可查找关卡。";
      if (node === el.lastChild && value === ". A large level takes a while.") return "。大型关卡可能需要一些时间。";
      if (node === el.firstChild && value === "Saving, then opening") return "正在保存，随后打开";
      if (node === el.firstChild && value === "Opening") return "正在打开";
      if (node.previousSibling && value === "has unsaved changes in") return "有未保存的更改，涉及";
      if (node === el.lastChild && value === "drops them unless they are saved first.") return "将丢弃这些更改，请先保存。";
      if (node === el.lastChild && value === "without saving, or cancel.") return "且不保存，或取消。";
      if (node.previousSibling && value === "was never saved. Save it as") return "尚未保存，请另存为";
      if (node.previousSibling && copyId(value) === "6904898a54d24aa6") return "尚未保存，也不是当前打开的关卡，无法在此保存。你可以";
      const following = node.nextSibling?.textContent?.trim();
      if (following && ["drops them unless they are saved first.", "without saving, or cancel.", "将丢弃这些更改，请先保存。", "且不保存，或取消。"].includes(following)) return changeAction(value);
      return null;
    }
    if (cls.contains("ue-menu-label")) {
      if (el.closest(".unreal-editor-menu-starting")) {
        if (node === el.firstChild && value === "Opening") return "正在打开";
        if (node === el.firstChild && value === "Starting") return "正在启动";
        if (node.previousSibling && value === "in the background") return "（后台）";
        return null;
      }
      if (node === el.firstChild && value === "Save and") return "保存并";
      if (node === el.lastChild && value === "without saving") return "且不保存";
      return changeAction(value);
    }
  }
}

// src/geometry-menu.ts
var categories2 = new Map(Object.entries(geometry_menu_default.categories));
var operations = new Map(Object.entries(geometry_menu_default.operations));
var nodePicker = '.pill-menu:has(.merlin-panel-search),.ue-menu:has(input:is([aria-label="Search nodes"],[aria-label="搜索节点"]))';
var logicNodes = /* @__PURE__ */ new Map([
  ["Format String", { kind: "formatString", label: "格式化字符串" }],
  ["Text Extract", { kind: "textExtract", label: "提取文本" }]
]);
function isBuiltinLogicRow(element, english, kind) {
  const button = element.parentElement;
  if (!button?.matches(".ue-submenu button.ue-menu-item") || !element.classList.contains("ue-menu-label") || !button.closest(nodePicker)) return false;
  const row = renderedFiber(button)?.return;
  if (row?.key !== kind || row.memoizedProps?.label !== english) return false;
  for (let group = row.return; group; group = group.return) {
    const entries = group.memoizedProps?.entries;
    if (!Array.isArray(entries)) continue;
    const matching = entries.filter((entry) => entry?.label === english && (entry.source?.key ?? entry.customNodeId ?? entry.kind) === kind);
    return matching.length === 1 && matching[0].kind === kind && matching[0].category === "Logic" && !matching[0].customNodeId && !matching[0].source;
  }
  return false;
}
function translateGeometryMenu(element, field, english) {
  if (field !== "text") return;
  const logic = logicNodes.get(english);
  if (logic) return isBuiltinLogicRow(element, english, logic.kind) ? logic.label : void 0;
  const category = categories2.get(english);
  const operation = operations.get(english);
  if (!category && !operation) return;
  const isLabel = element.classList.contains("ue-menu-label");
  const isCategoryHint = element.classList.contains("ue-menu-count");
  if (!isLabel && !isCategoryHint || !element.closest(nodePicker)) return;
  const button = element.parentElement;
  if (!button || button.tagName !== "BUTTON") return;
  const swatch = button.querySelector(":scope > .ue-menu-icon > span");
  if (swatch?.style.backgroundColor !== "rgb(110, 231, 183)") return;
  return isCategoryHint || button.hasAttribute("aria-haspopup") ? category : operation;
}

// src/locales/node-hover.json
var node_hover_default = {
  imageInput: {
    "#104:25fc869a86ae9a74": "从本地文件、剪贴板或拖放导入图像，并输出给后续节点。"
  },
  audioInput: {
    "#59:f6f52bbc14c199da": "从本地文件导入音频，并输出为音频片段。"
  },
  fileInput: {
    "#102:490d2a86cbdcacf0": "载入由扩展查看器打开的文件，例如 CSV 表格，并输出给后续节点。"
  },
  usdInput: {
    "#60:e7e4ec480f5ae241": "导入 USD 场景，包括图层、动画和相机。"
  },
  meshInput: {
    "#74:ba4386604a71c25b": "从本地导入 GLB 等格式的 3D 模型，并输出网格。"
  },
  splatInput: {
    "#86:a976c3ff697b7942": "载入本地高斯泼溅文件（PLY 或 SPZ），并输出高斯泼溅数据。"
  },
  doodle: {
    "#122:6ce7434cdccd8269": "在纯色背景上使用批注工具绘制。将背景和笔画合成为一张图像输出。"
  },
  webcamCapture: {
    "#83:fb5069acb5cde6cc": "从已连接的摄像头拍摄静态画面或采集实时画面，并输出图像。"
  },
  viewportCapture: {
    "#155:76e75de860a23c4f": "实时输出虚幻编辑器视口画面，也可输出由编辑器 3D 批注生成的模板遮罩和批注通道。"
  },
  textInput: {
    "#105:6519dffad0f1b4d7": "提供提示词、操作说明、字幕等文本，并输出给接收文本的节点。"
  },
  imageGenerator: {
    "#122:32cc41ae5a264351": "根据提示词生成图像，可添加参考图像。在节点中选择模型并调整设置。"
  },
  imageUpscaler: {
    "#75:2d9d009f9416456a": "提升图像分辨率，并补充细节。"
  },
  videoGenerator: {
    "#89:8a82d66fcd45a081": "根据提示词生成视频，可提供起始帧或参考帧。"
  },
  videoUpscaler: {
    "#43:4d18a5d1cd8d211f": "逐帧提升视频分辨率。"
  },
  audioGenerator: {
    "#65:6b9366324e816c9d": "根据提示词生成音乐、语音或音效。"
  },
  meshGenerator: {
    "#51:73680e300ef33453": "根据图像或提示词生成 3D 网格。"
  },
  splatGenerator: {
    "#90:2522ecf536ae6205": "根据图像或视频生成高斯泼溅场景，并输出高斯泼溅文件。"
  },
  textureGenerator: {
    "#84:62593399fa0f80f4": "根据提示词为已有网格生成纹理，并输出带纹理的模型。"
  },
  autoRig: {
    "#121:be99431890c7f5e8": "使用选定的绑定模型为网格添加骨骼和蒙皮权重，输出可用于动画的模型。"
  },
  segmentation: {
    "#134:29cb92483c38b1a2": "利用本地 SAM2 分割你指定的物体，并输出黑白遮罩。在最大化视图中放置提示点。"
  },
  speechToText: {
    "#55:55f3f897cdf41bd6": "使用本地 Whisper 将音频片段转录为文本。"
  },
  imageViewer: {
    "#93:37c31217cd2a3eeb": "显示接入的图像，便于查看处理结果。"
  },
  videoViewer: {
    "#76:abc5401f43e745f0": "播放接入的视频，支持拖动进度和播放控制。"
  },
  meshViewer: {
    "#67:552ade6ebaa4b8a7": "在可环绕和缩放的交互视口中查看 3D 模型。"
  },
  panoramaViewer: {
    "#63:de604f9ff1ad4a9c": "把等距柱状投影图像显示为可转动的 360° 全景。"
  },
  formatString: {
    "#138:d2bbe0b234998120": "用输入填充文本模板。每个 {token} 对应一个文本输入引脚，输出替换后的完整文本。"
  },
  textExtract: {
    "#110:1ac0c94405743abb": "按分隔符或正则表达式从字符串中截取内容，并输出提取的文本。"
  },
  subgraph: {
    "#83:249dea3ed3bc5d2e": "将嵌套的节点图作为单个节点运行，用于归组和复用处理流程。"
  },
  subcanvas: {
    "#66:0cf7a6c8c71a59e2": "在卡片中容纳单独的画布，用于归组。子画布本身不执行。"
  },
  deck: {
    "#172:01e56d1e68079595": "将同一成果的备选卡片放入卡组，并以固定卡片作为封面。展开可就地查看，按住 Shift 双击进入卡组。"
  },
  componentDeck: {
    "#218:35ece3491ac3b53e": "在卡组中收纳同一成果的各个组成部分，包括来源卡片、批注、遮罩和其他输出。组成部分可复制或删除，仅保留一项时恢复成单张卡片。"
  },
  unrealRender: {
    "#117:50878f069d80f530": "使用影片渲染图渲染虚幻编辑器中的实时场景，并将最终合成、深度和法线通道分别输出为图像。"
  },
  sequenceRender: {
    "#95:54c9818c2ca306a3": "渲染已有的虚幻关卡序列，并将各渲染通道分别输出为视频。"
  },
  repositionRender: {
    "#129:d0940a479f345477": "比较已捕获的场景状态与当前场景，将变化的物体渲染成动画，保持相机位置不变。"
  },
  videoFrameExtract: {
    "#89:8b70161f76c5ede6": "从视频中提取一帧静态图像，可选择第一帧、最后一帧或指定时刻。"
  },
  workflow: {
    "#87:7eb2f5a5bbfc6f74": "将可复用的节点图放到画布上，并公开它声明的输入和输出。"
  },
  canvasInput: {
    "#73:39e8e88f142e28cb": "将值传入节点图，对应外层容器公开的一个输入。"
  },
  canvasOutput: {
    "#71:11c1ab835a75b509": "将值传出节点图，作为容器返回给父级的结果。"
  },
  bundle: {
    "#111:447b999207f73b91": "将多个同类型输入按顺序合成数据束，供接收列表的节点使用。"
  },
  appendBundles: {
    "#74:2e2064862af9adca": "按顺序拼接多个数据束，得到一个更长的数据束。"
  },
  figmaFetch: {
    "#132:ec47c2beceb13ced": "通过 Figma API 获取画框结构和导出的图像，输出 JSON 控件树和可读摘要。"
  },
  sphereMesh: {
    "#75:60fbcc647373c471": "生成参数化球体网格，可用作建模基元或对齐目标。"
  },
  cubeMesh: {
    "#73:85d8c0a1d39952c1": "生成参数化立方体网格，可用作建模基元或对齐目标。"
  },
  spawnMeshAt: {
    "#112:d5fb72f426b09348": "按输入引脚的变换或节点中设置的坐标，在正在运行的虚幻关卡中生成网格。"
  },
  spawnCutoutAt: {
    "#100:a7df79b8b5e40302": "从透明背景 PNG 创建始终面向相机的 RGBA 图板，并放入正在运行的虚幻关卡。"
  },
  mcpTool: {
    "#135:c228b37288e13b7b": "按工具名称和参数调用 Unreal Canvas Bridge 的 MCP 工具，可执行尚无专用节点的虚幻编辑器操作。"
  },
  createStaticMeshAsset: {
    "#96:7688474b83fda606": "将网格导入正在运行的虚幻编辑器并生成静态网格体资产，输出资产路径。"
  },
  retargetAnimation: {
    "#177:b85ea8df144e32f7": "将 AnimSequence 或动画文件重定向到 UE5 默认人形、MetaHuman、画布中已绑定的角色或其他人形骨骼网格体。"
  },
  setCamera: {
    "#61:56a26973611e4214": "按指定变换移动虚幻编辑器的视口相机。"
  },
  projectedWorldTransformAt: {
    "#81:1689544a12c9396c": "结合图像坐标、深度与相机数据，将图像上的点投影到世界空间，输出对应变换。"
  },
  pointCloud: {
    "#102:376705587470ecc0": "根据图像和深度图反投影得到 3D 点云，可用遮罩限定计算区域。"
  },
  depthEstimation: {
    "#170:aa9a530db76a22c6": "利用所选模型估算单张图像的深度，默认使用本机模型。输出可查看的深度图和原始深度数据。"
  },
  textSegment: {
    "#115:2839a04a4c66fc1c": "根据提示词分割图像中的物体并输出遮罩，无需在图上标点。"
  },
  spatialMaskGuide: {
    "#125:ae835182614ce08e": "只给捕获帧中的一个批注组着色，标出后续图像编辑应处理的区域。"
  },
  cannyEdgesImage: {
    "#104:03c8b516026337b8": "提取图像的 Canny 边缘，输出黑白边缘图作为结构引导。"
  },
  cannyEdgesVideo: {
    "#88:bcfcd96c9fef522e": "逐帧提取视频中的 Canny 边缘，可用作结构引导。"
  },
  imageTransform: {
    "#170:c8504bf98da3671a": "裁剪、缩放、旋转、翻转或平移图像，也可按指定分辨率或另一输入的尺寸适配、填充或拉伸。可在详情面板实时预览。"
  },
  videoTransform: {
    "#171:4e0af5f9bed3a0e6": "修剪视频或调整帧率，也可裁剪、缩放、旋转、翻转、平移，并按指定分辨率或其他输入尺寸适配、填充或拉伸。"
  },
  imageMerge: {
    "#160:b6c44bcb8a8eebb3": "以指定不透明度将前景叠加到背景上，支持正常叠加、滤色、相加、变亮、变暗、正片叠底及差值。结果尺寸沿用背景。"
  },
  meshOp: {
    "#147:0e406c7c53ddb2c2": "对网格运行虚幻 GeometryScript 操作，例如 UV 展开、重构网格、简化或填孔，并输出 GLB。"
  },
  meshBake: {
    "#172:2c036d416cebad42": "将原网格的纹理和表面细节烘焙到重拓扑、重构、简化或展开 UV 后的新网格，输出带纹理的 GLB 和各张贴图。"
  },
  videoMerge: {
    "#143:ce07f68adcf44339": "按指定混合模式和不透明度将前景图像或视频叠加到背景视频上。结果继承背景的尺寸、时长和音频。"
  },
  imageValidator: {
    "#140:ae229bb971945f51": "检查图像是否满足宽高比或全景接缝等规则，继续输出原图，并报告未通过的检查项。"
  },
  simpleAlign: {
    "#98:dacd52f9418328f7": "通过匹配质心和总体尺寸，让网格快速近似对齐点云。"
  },
  icpAlign: {
    "#99:4828d1c9a30d616a": "用迭代最近点算法将网格对齐点云，并优化位置、旋转和缩放。"
  },
  pointCorrespondencePoseFit: {
    "#113:ef4cb8d5e59e6fa3": "由图像、深度和相机信息估计网格在场景中的姿态，输出拟合后的变换。"
  },
  consoleLog: {
    "#60:3c8236eff51d3023": "在控制台打印引脚输入，便于调试连线上的值。"
  },
  floatConstant: {
    "#57:89ff069ac45cfffd": "提供固定小数，连接到需要浮点数的输入。"
  },
  intConstant: {
    "#58:75e7cfbed6bd809f": "提供固定整数，连接到需要整数的输入。"
  },
  stringConstant: {
    "#53:1740301c4ce177fb": "提供固定文本，连接到需要字符串的输入。"
  },
  boolConstant: {
    "#61:2146d038f89e3c98": "提供固定的真或假，连接到需要布尔值的输入。"
  },
  vector2Constant: {
    "#54:4e847080d8de28d9": "提供含两个数值的固定向量，可表示 X/Y 坐标或尺寸。"
  },
  vector3Constant: {
    "#65:92b4919545ce59c9": "提供含三个数值的固定向量，可表示 X/Y/Z 位置、旋转或缩放。"
  },
  choice: {
    "#142:7c4cb76e59a0820e": "在一组选项里保存当前选择，可驱动选择或切换节点，也可直接连接下拉参数。"
  },
  select: {
    "#116:59fc9115eec6a00a": "通过选择器从多个同类型输入中选择一个输出，用于汇合多条分支。"
  },
  switch: {
    "#109:b89072da5a6c1aa2": "通过选择器将单个输入送往一个输出，用于分开后续路径。"
  },
  constant: {
    "#65:7390320b4ca0adeb": "提供固定值，类型随所连接的引脚调整。"
  },
  convert: {
    "#108:4d0f7d9174448f55": "把输入值转换为目标类型。目标类型由输出引脚或下游节点确定。"
  },
  videoInput: {
    "#58:43e5d1d51512d52b": "从本地文件导入视频，并输出为视频片段。"
  },
  llm: {
    "#77:641e0d768380ebe6": "将文本及可选图像发送给语言模型，输出模型回复。"
  },
  spatialPromptSynthesis: {
    "#141:f12251e16814eff4": "通过视觉模型结合实际场景补全简短的 3D 批注提示词，为每个批注组输出一条可读指令。"
  },
  comfyui: {
    "#113:8dad47685d43f09a": "在已连接的服务器上运行 ComfyUI 工作流，将此节点的引脚对应到工作流的输入和输出。"
  },
  blueprintCall: {
    "#132:8aed4dd92162beeb": "调用正在运行的虚幻编辑器中的蓝图函数。其引脚来自函数签名，并可在详情面板同步。"
  },
  imageGrid: {
    "#90:09ed56d1279da515": "将接入的图像平铺成一张总览图，可设置边距和边框。"
  },
  task: {
    "#110:11a5b77713403f1e": "在画布上记录待办事项，也可交给智能体处理。任务卡本身不执行。"
  },
  inputReference: {
    "#70:9aeb3bc6888acf2a": "在其他位置引用同一个节点图输入，共用原输入的值。"
  },
  reroute: {
    "#73:5d5c63e34af4a9f7": "整理连线的走向，并原样传递输入值。"
  },
  script: {
    "#156:7bec261a6b8f1d5d": "运行 Python，并通过自己的输入和输出引脚传递值。可通过代码调用 Unreal Canvas 操作来编排流程。"
  }
};

// src/node-hover.ts
var tooltip2 = '[role="tooltip"][data-portal-popup]';
var lookup = new Map(Object.entries(node_hover_default));
var defaultNames2 = new Map(Object.entries(workspace_details_default.defaults).map(([kind, labels3]) => [kind, new Map(Object.entries(labels3))]));
var extraNames = /* @__PURE__ */ new Map([
  ["appendBundles", ["Append Bundles", "追加数据束"]],
  ["blueprintCall", ["Blueprint Call", "调用蓝图"]],
  ["bundle", ["Bundle", "数据束"]],
  ["canvasInput", ["Canvas Input", "画布输入"]],
  ["canvasOutput", ["Canvas Output", "画布输出"]],
  ["componentDeck", ["Component Card", "组件卡片"]],
  ["deck", ["Deck", "卡组"]],
  ["fileInput", ["File", "文件"]],
  ["formatString", ["Format String", "格式化字符串"]],
  ["inputReference", ["Linked Input", "链接的输入"]],
  ["meshOp", ["Mesh Op", "网格操作"]],
  ["reroute", ["Reroute", "重定向连线"]],
  ["script", ["Subscript", "子脚本"]],
  ["subcanvas", ["Subcanvas", "子画布"]],
  ["subgraph", ["Graph", "节点图"]],
  ["textExtract", ["Text Extract", "提取文本"]],
  ["workflow", ["Graph", "节点图"]]
]);
var dataTypes = new Map(Object.entries({
  any: "任意类型",
  audio: "音频",
  boolean: "布尔值",
  choice: "选项",
  file: "文件",
  float: "浮点数",
  image: "图像",
  int: "整数",
  mesh: "网格模型",
  objectRef: "对象引用",
  sceneJson: "场景 JSON",
  splat: "高斯泼溅",
  text: "文本",
  usd: "USD 场景",
  vector2: "二维向量",
  vector3: "三维向量",
  video: "视频"
}));
var stalePins = /* @__PURE__ */ new Map([
  ["#80:002034be8aa37091", "失效引脚：卡片当时已停用此输入，运行时未传入任何值。"],
  ["#145:86fc3f5a06d439f9", "失效引脚：卡片已停用此输入。请改接到可用输入，或右键移除此引脚。"],
  ["#70:0712f3f90bec24ea", "失效引脚：卡片当时已停用此输出，没有传出任何值。"],
  ["#163:139c2c7424852f05", "失效引脚：卡片已停用此输出。同步或更新后若重新提供该输出，引脚会恢复，也可右键移除。"]
]);
function translateInactivePin(value) {
  const prefix = "Not used by ";
  if (!value.startsWith(prefix)) return;
  const suffix = value.lastIndexOf(". Wire kept; ");
  const retained = suffix > 0 && copyKey(value.slice(suffix)) === "#71:f96cdee98802789b";
  const model = value.slice(prefix.length, retained ? suffix : void 0);
  const name = model === "the current model" ? "当前模型" : "“" + model + "”";
  return name + "未使用此引脚" + (retained ? "。已保留连线，切换到使用此引脚的模型时会恢复。按住 Alt 单击可移除保留的连线。" : "");
}
function translatePinHover(element, value) {
  if (!element.matches(".react-flow__handle[data-pin-dot][data-node-id]")) return;
  const id = element.getAttribute("data-pin-dot");
  const nodeId = element.getAttribute("data-node-id");
  for (let fiber = renderedFiber(element); fiber; fiber = fiber.return ?? void 0) {
    const props = fiber.memoizedProps;
    if (props?.nodeId !== nodeId) continue;
    if (props?.pin?.id === id) {
      if (props.pin.stale && value.startsWith("Stale pin: ")) return stalePins.get(copyKey(value));
      if (props.inactive && props.inactiveHint === value) return translateInactivePin(value);
      return;
    }
    const entry = props?.entry;
    if (entry) {
      const bundle = entry.family?.bound === true;
      if (value === "Wire to add a " + (bundle ? "bundle " : "") + entry.label + " port") {
        return "拖动连线以添加“" + entry.label + "”" + (bundle ? "数据束" : "") + "端口";
      }
    }
  }
}
function hoverNode(content) {
  const props = renderedFiber(content)?.return?.memoizedProps;
  if (props?.view === "graphTooltip" || props?.view === "canvasTooltip") return props.node;
}
function nodeKindLabel(kind, value) {
  const extra = extraNames.get(kind);
  return extra?.[0] === value ? extra[1] : defaultNames2.get(kind)?.get(value);
}
function translateNodeHover(element, field, value) {
  if ((field === "title" || field === "data-title-tip") && /^(?:Stale pin: |Not used by |Wire to add a )/.test(value)) {
    return translatePinHover(element, value);
  }
  if (field !== "text" || !element.matches(`${tooltip2} > div > div,${tooltip2} > div > div > span`)) return;
  const content = element.closest(tooltip2)?.firstElementChild;
  if (!content) return;
  const node = hoverNode(content);
  if (!node) return;
  if (element.parentElement === content && !element.firstElementChild) {
    const name = value === node.name?.trim() && !node.label && !node.params?.sourceCustomNodeId ? nodeKindLabel(node.kind, value) : void 0;
    return name ? value + "（" + name + "）" : null;
  }
  const row = element.parentElement;
  if (!row || element !== row.lastElementChild || element === row.firstElementChild) return;
  const fieldId = renderedFiber(row)?.key;
  if (fieldId === "sys:description") return lookup.get(node.kind)?.[copyKey(value)] ?? null;
  if (fieldId === "sys:kindLabel" || fieldId === "kind") return nodeKindLabel(node.kind, value) ?? null;
  if (fieldId === "type") {
    const output = node.pins?.find((pin) => pin.direction === "output" && pin.dataType !== "any")?.dataType;
    if (output && value === output.charAt(0).toUpperCase() + output.slice(1)) return dataTypes.get(output) ?? null;
    return nodeKindLabel(node.kind, value);
  }
  if (fieldId === "notes") return null;
}

// src/panel-details.ts
var skillModes = {
  selected: ["Selected only", "仅使用所选技能"],
  suggest: ["Suggest", "建议启用"],
  auto: ["Add automatically", "自动添加"]
};
function inspectorNodeField(element, value) {
  const mounted = renderedFiber(element);
  if (!mounted) return;
  const propKey = Object.keys(element).find((key) => key.startsWith("__reactProps$"));
  const live = propKey ? Object.getOwnPropertyDescriptor(element, propKey)?.value : void 0;
  if (!live) return;
  const visible = mounted.memoizedProps === live ? mounted : mounted.alternate?.memoizedProps === live ? mounted.alternate : void 0;
  for (let owner = visible; owner; owner = owner.return) {
    const props = owner.memoizedProps;
    if (props?.fieldId !== owner.key) continue;
    const kind = props?.node?.kind;
    if (kind && props?.targetKind === "node") {
      if (owner.key === "sys:kindLabel") return nodeKindLabel(kind, value);
      if (owner.key === "type") {
        const media2 = translateMediaTypeLabel(value);
        const pinsMatch = media2 && [props.node, props.sysNode].some((node) => node?.pins?.find((pin) => pin.direction === "output" && pin.dataType !== "any")?.dataType === value.toLowerCase());
        return pinsMatch ? media2 : nodeKindLabel(kind, value);
      }
    }
    return;
  }
}
function skillStatus(english) {
  const count = /^(\d+) active skills?$/.exec(english);
  if (count) return `已启用 ${count[1]} 项技能`;
  switch (english) {
    case "No active skills":
      return "没有启用的技能";
    case "Loading skills":
      return "正在加载技能";
    case "Skills could not be loaded":
      return "无法加载技能";
  }
}
function translatePanelDetails(element, field, english, node) {
  if ((field === "text" || field === "title" || field === "data-title-tip") && element.matches(".merlin-inspector-panel span:is([title],[data-title-tip]):last-child")) {
    const copy = field === "text" ? null : /^([^\n]+)\n\n\(right-click to copy\)$/.exec(english);
    const value = field === "text" ? english : copy?.[1];
    if (value) {
      const label2 = element.previousElementSibling?.textContent;
      const translated = element.closest(".merlin-inspector-summary") && (label2 === "Card type" || label2 === "卡片类型") ? translateCardTypeLabel(value) : inspectorNodeField(element, value);
      if (translated) return copy ? translated + "\n\n（右键复制）" : translated;
    }
  }
  if (field === "text") {
    if (element.matches(".agent-retry-status > div > span")) {
      const recovering = /^(\d+) requests recovering\. (Active retry|Next retry)$/.exec(english);
      if (recovering) return recovering[1] + " 个请求正在恢复。" + (recovering[2] === "Next retry" ? "下次重试" : "正在重试");
      const delay = /^in (\d+)s…$/.exec(english);
      if (delay) return delay[1] + " 秒后重试…";
    }
    if (element.matches(".generation-shelf-approval > strong") && element.childNodes.length === 3) {
      if (node === element.firstChild && english === "Allow organization on") return "是否允许整理画布";
      if (node === element.lastChild && english === "?") return "？";
      return null;
    }
    if (element.matches(".generation-shelf-approval > small")) {
      if (english === "Local CLI action on the server computer") return "在服务器所在电脑上执行的本地命令行操作";
      if (english.startsWith("Canvas: ")) return "画布：" + english.slice(8);
    }
    if (element.matches(".agent-history-list > button[data-follower] > span > strong + small") && node === element.firstChild) {
      if (english === "Closed") return "已关闭";
      if (english === "Open") return "已打开";
    }
    if (element.matches(".agent-mcp-servers > p[role=status]") && element.childNodes.length === 3) {
      if (node === element.firstChild && english === "Finish signing in to") return "请在浏览器中完成登录：";
      if (node === element.lastChild && copyId(english) === "7fb86d60be24c1c7") return "。连接成功后，即可在本次对话中使用其工具。";
      return null;
    }
    if (element.matches(".agent-mcp-servers li > small") && node === element.firstChild && element.childNodes.length === 2 && english === "The sign-in did not finish:") return "登录未完成：";
    if (element.matches(".agent-process-session > p:first-of-type") && node === element.firstChild) {
      if (english === "No active turn") return "没有正在进行的交互";
      if (english === "Agent turn active") return "智能体正在处理请求";
      if (english === "Closed") return "已关闭";
    }
    if (element.matches(".mini-agent-chat-empty") && node === element.firstChild && english === "Start a conversation with") {
      return "开始对话：";
    }
    if (element.matches(".merlin-skill-attach > .merlin-script-form-none")) {
      if (node === element.firstChild && english === "No skills attached to") return "尚未挂接技能的位置：";
      if (node === element.childNodes[1]) {
        const scope = /^(root canvas|subcanvas|graph) “(.+)”$/s.exec(english);
        if (scope) {
          const label2 = scope[1] === "root canvas" ? "根画布" : scope[1] === "subcanvas" ? "子画布" : "节点图";
          return label2 + "“" + scope[2] + "”";
        }
      }
    }
    if (element.matches('.mini-agent-chat-compose [contenteditable="true"][role="textbox"] + [role="separator"] + div:not([contenteditable])') && english.startsWith("Message ") && english.endsWith("…")) {
      return "发消息给 " + english.slice(8);
    }
    if (element.matches(".agent-task-filters > button:nth-child(2)") && english.endsWith("’s tasks")) {
      return english.slice(0, -"’s tasks".length) + "的任务";
    }
    if (element.matches(".agent-activity-presence > summary")) {
      const disconnected = /^· (\d+) disconnected$/.exec(english);
      if (disconnected) return `· ${disconnected[1]} 个已断开`;
    }
    if (element.matches(".chat-skills-heading > span")) return skillStatus(english);
    const option = element.closest('[role="listbox"]:is([aria-label="Skill selection"],[aria-label="技能选择"]) > [role="option"][data-value]');
    const mode = option && skillModes[option.getAttribute("data-value")];
    if (mode && mode[0] === english) return mode[1];
  }
  if (field === "aria-label") {
    if (english.startsWith("Working with ") && element.classList.contains("agent-squad-select")) {
      if (english === "Working with Choose an agent" && !element.querySelector(".agent-squad-current > strong[title]")) return "选择协作的智能体";
      return "正在与 " + english.slice(13) + " 协作";
    }
    if (english.startsWith("Reopen ") && element.matches(".agent-history-list > button")) return "重新打开 " + english.slice(7);
    if (element.matches(".agent-nav-team-toggle")) {
      if (english.startsWith("Expand team under ")) return "展开团队：" + english.slice(18);
      if (english.startsWith("Collapse team under ")) return "收起团队：" + english.slice(20);
    }
    if (english.startsWith("Following ") && element.matches(".agent-message-switcher ul")) return "跟随 " + english.slice(10);
    if (element.matches(".agent-mcp-servers li > button")) {
      if (english.startsWith("Signing in to ")) return "正在登录 " + english.slice(14);
      if (english.startsWith("Sign in to ")) return "登录 " + english.slice(11);
    }
    if (element.matches(".agent-detail-shell") && english.endsWith(" details")) return english.slice(0, -8) + "的详情";
    if (element.matches(".agent-action-menu") && english.startsWith("Manage ")) return "管理 " + english.slice(7);
    if (element.matches(".merlin-skill-attach-remove") && english.startsWith("Detach ")) return "解除挂接：" + english.slice(7);
    if (element.matches('.agent-nav-identity button, .mini-agent-chat-compose [contenteditable="true"]') && english.startsWith("Message ")) return "发消息给 " + english.slice(8);
    if (element.matches('.mini-agent-chat-compose [role="separator"]') && english.startsWith("Resize Message ")) return "调整给 " + english.slice(15) + " 的消息输入框大小";
    if (element.matches(".mini-agent-chat-skills") && english.startsWith("Skills: ")) {
      const [status, policy] = english.slice(8).split(" · ");
      const label2 = skillStatus(status);
      if (label2 && !policy) return "技能：" + label2;
      if (label2 && policy === "Agent can suggest skills") return "技能：" + label2 + " · 智能体可以建议技能";
      if (label2 && policy === "Agent can choose skills") return "技能：" + label2 + " · 智能体可以选择技能";
    }
  }
  if (field === "title" && element.matches(".agent-task-owner-input .agent-assignee-picker") && english.startsWith("Assign to: ")) {
    return "分派给：" + english.slice(11);
  }
  if (field === "title" && english.startsWith("Following ") && element.matches(".agent-history-list > button")) return "跟随 " + english.slice(10);
}

// src/agent-chat.ts
var statusText = new Map(Object.entries({
  "Ready": "就绪",
  "Closed · work retained": "已关闭 · 工作内容已保留",
  "Disconnected": "已断开连接",
  "Connecting": "正在连接",
  "Waiting for your approval": "等待你批准",
  "Needs your input": "需要你提供信息",
  "Working with local Codex": "本地 Codex 正在处理",
  "Working with local Claude Code": "本地 Claude Code 正在处理",
  "Waiting for model response": "正在等待模型回复",
  "Waiting for child reports": "正在等待子智能体反馈",
  "The reply reached the output limit; continuing": "回复已达到输出上限，正在继续",
  "Stopping after the current step": "当前步骤结束后停止",
  "Preparing context": "正在准备上下文",
  "Background work failed; telling the agent": "后台任务失败，正在通知智能体",
  "Waiting for a result": "正在等待结果",
  "Waiting for teammates": "正在等待队友",
  "Waiting for your team decision": "等待你确认是否组队",
  "Preparing team assignments": "正在分配团队任务",
  "Reading a file": "正在读取文件",
  "Editing files": "正在编辑文件",
  "Running a command": "正在运行命令",
  "Searching for information": "正在搜索信息",
  "Working": "正在处理",
  "Generating": "正在生成",
  "Thinking": "正在思考",
  "Idle": "空闲",
  "New": "新建",
  "Unread message": "有未读消息",
  "Failed": "失败",
  "Interrupted": "已中断",
  "Persistence error": "保存失败"
}));
var skillSelection = new Map(Object.entries({
  "Selected only": "仅使用所选技能",
  "Suggest": "建议启用",
  "Add automatically": "自动添加"
}));
function translateSkillNotice(english) {
  const skills = /^Skills for this prompt: (.+)\. Skill selection: (Selected only|Suggest|Add automatically)\.(?: Unavailable: (.+)\.)?$/s.exec(english);
  if (skills) {
    const list = skills[1] === "None" ? "无" : skills[1];
    return `本次提示词使用的技能：${list}。技能选择：${skillSelection.get(skills[2])}。` + (skills[3] ? `不可用的技能：${skills[3]}。` : "");
  }
  const used = /^Agent reported using: (.+)\.$/s.exec(english);
  if (used) return `智能体报告使用了以下技能：${used[1]}。`;
  if (english.startsWith("Added skill: ")) return "已添加技能：" + english.slice("Added skill: ".length);
  const handoff = /^Continues from “(.+)”\. Its conversation and cards (were|are)\b.*\.$/s.exec(english);
  if (handoff) return `接续“${handoff[1]}”的工作。${handoff[2] === "were" ? "对话和卡片已随你的第一条消息转交给此智能体。" : "发送第一条消息时，对话和卡片将一并转交给此智能体。"}`;
}
var userAuthor = '.agent-chat-message[data-role="user"] > .agent-chat-message-author';
var userContext = '.agent-chat-message[data-role="user"] > .agent-chat-message-inputs';
var restoreButton = '.agent-chat-message[data-role="user"] > .agent-chat-message-bubble > button[title]';
var delivery = new Map(Object.entries({
  Queued: "已排队",
  "Not sent": "未发送",
  "Delivery unconfirmed": "送达状态未知",
  Delivered: "已送达"
}));
var nodeRequest = /* @__PURE__ */ new Map([
  ["Ready to look at", "待查看"],
  ["Feedback requested", "待反馈"],
  ["Saved for later", "稍后处理"]
]);
var requestButton = ".node-agent-head[data-agent-preview-trigger]";
var requestDescription = requestButton + " + span[hidden][id]";
var requestLabel = requestButton + " > .node-agent-request-label";
function isAgentChatChrome(element, field) {
  if (field === "aria-label") return element.matches(userContext);
  if (field === "title") return element.matches(restoreButton);
  return field === "text" && element.matches(userAuthor + "," + restoreButton);
}
function translateAgentChat(element, field, english, node) {
  const classes = element.classList;
  if (field === "text" && element.matches(requestLabel)) {
    return nodeRequest.get(english);
  }
  if (field === "text" && element.matches(requestDescription)) return english;
  if (field === "aria-label" && element.matches(requestButton)) {
    const description = element.nextElementSibling;
    const name = description?.matches("span[hidden][id]") && description.firstChild?.nodeType === 3 ? description.firstChild.nodeValue : null;
    if (!name) return;
    if (english === "Check in with " + name) return "查看智能体“" + name + "”的状态";
    const prefix = name + " · ";
    const request = english.startsWith(prefix) && nodeRequest.get(english.slice(prefix.length));
    if (request) return prefix + request;
  }
  if (field === "text") {
    if (classes.contains("agent-status-text") && element.matches(".agent-chat-status > .agent-status > span")) {
      const base = english.replace(/(?:…|\.\.\.)$/, "");
      const translated = statusText.get(base);
      if (translated) return translated + (english === base ? "" : "…");
      if (base.startsWith("Waiting for approval: ")) return "等待批准：" + english.slice("Waiting for approval: ".length);
    }
    if (classes.contains("shelf-skills-notice") && element.getAttribute("role") === "note") return translateSkillNotice(english);
    if (classes.contains("agent-chat-message-author") && element.matches(userAuthor)) {
      if (english === "You") return "你";
      if (english.startsWith("You → ")) return "你" + english.slice(3);
      if (english.startsWith("You · ")) {
        const state = delivery.get(english.slice("You · ".length));
        if (state) return "你 · " + state;
      }
    }
    if (classes.contains("mini-agent-chat-receipt") && element.getAttribute("role") === "status" && english === "Queued") return "已排队";
    if (classes.contains("generation-shelf-jump-recent") && english === "Jump to recent") return "跳至最新消息";
    if (classes.contains("mini-agent-chat-empty") && english === "Start a conversation with the agent.") return "与智能体开始对话。";
    if (element.matches(".generation-shelf-activity-toggle > span")) {
      if (english === "activity") return "条活动";
      if (english === "update" || english === "updates") return "更新";
    }
    if (element.matches(restoreButton) && english === "Restore to draft") return "恢复为草稿";
    if (element.matches(".chat-skills-inherited > span > small") && node === element.lastChild && english === "· active through your Personal context") return "· 已通过个人上下文启用";
    if (element.matches('.chat-skills-chips > span[role="alert"]')) {
      if (english === "Skills could not be loaded.") return "无法加载技能。";
      if (english === "attached") return "项已挂接的";
      if (english === "skill is" || english === "skills are") return "技能";
      if (english === "unavailable") return "不可用";
    }
  }
  if (field === "aria-label") {
    if (english === "Message context" && element.matches(userContext)) return "消息上下文";
    if (element.closest(".chat-skills-entry") && element.matches('input,button,[role="switch"],[role="checkbox"]')) {
      if (english.startsWith("Enable ")) return "启用 " + english.slice(7);
      if (english.startsWith("Inherited ")) return "继承的技能：" + english.slice(10);
    }
  }
  if (field === "title" && element.matches(restoreButton)) {
    if (copyId(english) === "8356c07c3afad5d1") return "请先检查对话，避免重复发送。";
    if (copyId(english) === "cf620984371fb920") return "放回草稿，等待手动发送。";
  }
  if ((field === "aria-label" || field === "title") && classes.contains("mini-agent-chat-send")) {
    if (english === "Stop agent") return "停止智能体";
    if (english === "Stop agent (Esc)") return "停止智能体（Esc）";
    if (english === "Send") return "发送";
  }
}

// src/locales/agent-setup.json
var agent_setup_default = {
  labels: {
    "Agent setup": "智能体设置",
    "Agent setup details": "智能体设置详情",
    Setup: "设置",
    Model: "模型",
    Permission: "权限",
    "Always ask": "始终询问",
    "Ask if risky": "有风险时询问",
    Autonomous: "自主执行",
    Effort: "推理强度",
    Light: "轻量",
    Standard: "标准",
    Thorough: "深入",
    Custom: "自定义",
    Customize: "自定义",
    "Reset to defaults": "恢复默认设置",
    Done: "完成",
    Back: "返回",
    Behavior: "行为",
    Teams: "团队协作",
    "Allow graph creation": "允许创建节点图",
    "Response style": "回答风格",
    Concise: "简洁",
    Guided: "分步指导",
    Deliberative: "深入讨论",
    Investigation: "调查范围",
    "Resolve important gaps": "补全重要信息",
    "Look at alternatives": "探索其他方案",
    "Skill selection": "技能选择",
    "Selected only": "仅使用所选技能",
    Suggest: "建议启用",
    "Add automatically": "自动添加",
    "Memory and review": "记忆与复核",
    "Read memories across conversations": "读取跨对话记忆",
    "Manage memories": "管理记忆",
    "Read context from other agents": "读取其他智能体的上下文",
    "Check its work": "检查工作结果",
    "Don't check": "不检查",
    "Check and fix": "检查并修复",
    "Check, second opinion, and fix": "检查、征求第二意见并修复",
    "Feedback on results": "征求结果反馈",
    Guidance: "自定义指令",
    "Tool access": "工具访问权限",
    "New conversation": "新建对话",
    "Reset to preset": "恢复预设",
    "Canvas reach": "画布访问范围",
    "Root canvas only": "仅根画布",
    "Root canvas and graph interiors": "根画布和节点图内部",
    "Tools ·": "工具 ·",
    "Unavailable saved tools (": "已保存但不可用的工具 (",
    "Unavailable saved tools": "已保存但不可用的工具",
    "Select all in": "全选此组工具：",
    "No model": "无模型",
    "Not installed": "未安装",
    "Loading models…": "正在加载模型…",
    "No models available": "没有可用模型",
    Unavailable: "不可用",
    "Choose model": "选择模型",
    "Chat models": "对话模型",
    "Search models": "搜索模型",
    "Search models…": "搜索模型…",
    "Local Codex": "本地 Codex",
    "Local Claude Code": "本地 Claude Code",
    Environment: "运行环境",
    Context: "上下文",
    "Agent environment": "智能体运行环境",
    "Agent context": "智能体上下文",
    "App-managed (API)": "应用托管（API）",
    "Local · Codex": "本地 · Codex",
    "Local · Claude Code": "本地 · Claude Code",
    Personal: "个人配置",
    "Personal (default)": "个人配置（默认）",
    Clean: "空白上下文",
    "Clean (default)": "空白上下文（默认）",
    "Manage connections": "管理连接"
  },
  modelAndSetupLabels: {
    "691b83413e87415e": "选中这个智能体以开始配置。",
    a7f052c0e2b65b85: "按需调查",
    "12fee6d2a01fd909": "例如：简要回答，并沿用我的用词。",
    "317817e849685d38": "工具列表已经手动配置。新增的内置工具需要自行开启。",
    "67037d0dcd36bb89": "当前采用预设工具。修改勾选后，只会授权选中的工具。",
    "53852b02948964e9": "当前版本未提供这些工具。会记住名称，等待工具可用后再授权。",
    "4ba431d21ee8435c": "暂不可用，仅保留工具名",
    "1c71ea4bea582fb5": "请在运行环境中选用此 CLI，以读取它的模型列表。",
    "6f4545142c055b09": "配置或改用此提供商",
    "2112af0cb3ac361f": "要使用其他提供商，请新建智能体。",
    "18d0cb92c01ee039": "Unreal Canvas API · 托管上下文",
    c45880d7d6d89bd6: "智能体已切换，请重新打开模型选择器。",
    c3a02d813e673ed4: "设置从本次对话的下一条请求起生效。续办任务将沿用它开始时的行为设置。"
  },
  hints: {
    "36022156d9f5211d": "选择本次对话的模型。同一提供商下可在对话中切换。",
    ea7bac5f4f3561f9: "指定哪些操作需要你同意。",
    d544d0abb7f83666: "调整检查和修正结果的力度。",
    f89dc05c638497f5: "修改或生成前均会先询问。",
    f34b57f8e5e7ab55: "一般修改可直接执行，高风险和生成操作须先确认。",
    "86e2152ad80447e6": "可自行修改并生成内容。",
    "69f7c58c58b97337": "直接完成请求，跳过结果复核。",
    "826ff0deff81b7ef": "建议合适的技能，检查结果并请你反馈。",
    "488e9e7dbf1cb55b": "比较方案，复核结果并按需修正。",
    a4fe7c543bcf1885: "收起设置，稍后可从输入栏调整。",
    e783ab664195064a: "允许提议组队，获得许可后可启动协作智能体。",
    "2455666a2548a78b": "允许新建和编辑节点图。",
    "1beb0a66a40266ed": "选择回答的详细程度和呈现方式。",
    "88b2ee2a02c80524": "选择何时补查信息或比较方案。",
    "1dd024eca85ac53b": "指定技能的推荐与启用方式。",
    "2586cda7bed2e972": "允许读取之前保存的偏好、画布记忆和审核。",
    b676cd843fa73eeb: "允许参考其他智能体的笔记及卡片评论。",
    "2222a7343126e1ef": "设置交付前的自查程度。",
    fe9c912cab4e8ea9: "在结果上请求评分、意见或进一步修改。",
    f5e217d84443995b: "在这里填写本次对话的额外要求。",
    "8d05ae84c44eaf72": "设置可用的工具与操作。",
    "6edb19b7793b9fc1": "管理已保存的记忆。",
    "606dac6233eab925": "切换提供商时，已开始的对话可能需要重新建立。",
    a588b415df2672a4: "使用 Canvas 提供的工具与上下文。"
  },
  contextHints: {
    "1c63e1a2897142bb": "加载 Claude Code 的用户设置、钩子、规则、插件、技能、命令和 CLAUDE.md，也加载用户级和插件提供的 MCP 服务。文件与终端工具限于 Claude 工作目录。",
    f28bd7ed8c6d06c8: "沿用 Claude Code 的账号与连接，在 Canvas 内使用专用设置和工具。工作目录的记忆仍可能生效。",
    "7c6eb6384c07c37c": "载入 Codex 的本机配置，包括 MCP、插件、钩子、规则、记忆、AGENTS.md 和技能。",
    "287e3fcf7e61a0de": "只沿用 Codex 登录与模型设置，其他本地扩展和记忆不会载入。仅存在系统密钥环中的凭据不可沿用。"
  }
};

// src/locales/agent-setup-tool-groups.json
var agent_setup_tool_groups_default = {
  labels: {
    "Tools from extensions": "扩展提供的工具",
    "Graphs · Write": "节点图 · 编辑",
    "Graphs · Run": "节点图 · 运行",
    "Scripts · Read and use": "脚本 · 读取与使用",
    "Scripts · Author": "脚本 · 编写",
    "Cards and layout": "卡片与布局",
    "Media edits": "媒体编辑",
    Frames: "框架",
    "Subcanvases and containers": "子画布与容器",
    "Canvas files and lifecycle": "画布文件管理",
    Skills: "技能",
    Personalities: "智能体个性",
    Extensions: "扩展",
    "Models and services": "模型与服务",
    "Review and assessment": "评审与评估",
    "Delegation and tasks": "委派与任务",
    "Memory and preferences": "记忆与偏好",
    "Unreal Editor": "虚幻编辑器",
    "Viewer and presentation": "查看器与展示",
    "Graphs · Read": "节点图 · 读取",
    "Other Unreal Canvas tools": "其他 Unreal Canvas 工具"
  },
  descriptions: {
    ad7ba1c3a77039e1: "管理扩展提供的工具，可在对应面板中执行或调用其 Python 代码。",
    "481a2f2eecdc675a": "修改节点、引脚、参数和连线。",
    a563ace2df26f111: "启动或停止卡片及工作流。",
    "8f037210721380fd": "查找可复用脚本与工作流，并放入画布、设置输入。",
    "86543448dfb772e2": "编写 Python 脚本、子脚本和可复用脚本定义。",
    "0d5c80e71a67b978": "操作卡片、版本、画布图文与布局，可执行右键菜单命令。",
    "08b629159146de46": "对媒体进行裁剪、变换、剪辑或调色，可与外部编辑器交换结果。",
    "72078854e7a4fefe": "添加、修改或删除画布框架。",
    dfee40b15d8b003a: "管理子画布、子图、卡组及工作区。",
    f89f58c5655c485f: "管理画布文件，包括保存、复制与关闭。",
    e5f0eca204d28478: "读取并确认本次对话选用的技能。",
    "8b08a30f66d685f1": "创建、查看或维护智能体个性。",
    "9b86203cd7bc4418": "浏览扩展、试运行草稿、诊断加载状态或打开扩展面板。",
    f7bc2414d3de9c88: "查看模型定义、服务商路由与服务能力。",
    b23c314f8bef3b95: "评估结果并记录审核意见。",
    b95589228577e007: "创建协作智能体、分配任务并联系团队成员。",
    ff1ba0b01346b098: "读写画布记忆与个人偏好。",
    c1a9e64cff0ab92d: "在已连接的编辑器内查找并执行工具。",
    ba9b0248e3c47214: "操作查看器或展示已有结果。",
    "865b5993810a67bf": "查看节点图、卡片状态、布局、输入和生成记录。",
    ef111d8c84a878b1: "收录其余 Canvas 内置工具。"
  }
};

// src/locales/agent-setup-tools.json
var agent_setup_tools_default = {
  acknowledge_skills: "确认已使用的技能",
  add_card: "添加卡片",
  add_card_comment: "添加卡片评论",
  add_graph_to_library: "将节点图添加到资源库",
  add_image_slot: "添加图像插槽",
  apply_media_steps: "应用媒体处理步骤",
  arrange_canvas_items: "排列画布项目",
  arrange_graph: "整理节点图",
  ask_at: "在指定位置提问",
  auto_align: "自动对齐",
  bake_to_image_input: "烘焙为图像输入",
  capture_extension_panel: "截取扩展面板",
  capture_realtime: "捕获实时画面",
  choose_shelf_output: "选择工具架输出",
  close_canvas: "关闭画布",
  close_subagent: "关闭子智能体",
  collapse_frame_to_subcanvas: "将框架折叠为子画布",
  context_menu: "操作右键菜单",
  control_viewer: "控制查看器",
  create_agent_task: "创建智能体任务",
  create_annotation_edit_subgraph: "创建标注编辑子图",
  create_canvas: "创建画布",
  create_clean_plate_subgraph: "创建干净底片子图",
  create_code_script: "创建代码脚本",
  create_connector: "创建连接器",
  create_cutout_png_subgraph: "创建 PNG 抠图子图",
  create_deck: "创建卡组",
  create_equirect_world_subgraph: "创建等距柱状全景世界子图",
  create_extension_draft: "创建扩展草稿",
  create_frame: "创建框架",
  create_generate_and_place_subgraph: "创建生成并放置资产的子图",
  create_graph: "创建节点图",
  create_graph_script: "创建节点图脚本",
  create_image_edit_subgraph: "创建图像编辑子图",
  create_image_grid_restyle_subgraph: "创建图像网格风格转换子图",
  create_image_to_mesh_subgraph: "创建图像转网格子图",
  create_mrg_image_edit_subgraph: "创建 MRG 图像编辑子图",
  create_mrg_image_gen_subgraph: "创建 MRG 图像生成子图",
  create_mrg_mesh_placement_subgraph: "创建 MRG 网格放置子图",
  create_object_meshes_from_scene: "从场景创建对象网格",
  create_object_reposition_subgraph: "创建对象重新定位子图",
  create_pipeline: "创建流程",
  create_prompt_loop_subgraph: "创建提示词循环子图",
  create_reference: "创建引用",
  create_scene_analysis_subgraph: "创建场景分析子图",
  create_script_node: "创建脚本节点",
  create_skill: "创建技能",
  create_spatial_annotation_edit_subgraph: "创建空间标注编辑子图",
  create_spatial_mask_loop_subgraph: "创建空间遮罩循环子图",
  create_spatial_prompt_synthesis_subgraph: "创建空间提示词合成子图",
  create_subagent: "创建子智能体",
  create_subcanvas: "创建子画布",
  create_subgraph: "创建子图",
  create_video_grid_restyle_subgraph: "创建视频网格风格转换子图",
  crop_node_image: "裁剪节点图像",
  customize_extension: "自定义扩展",
  define_custom_field: "定义自定义字段",
  delete_canvas: "删除画布",
  delete_connector: "删除连接器",
  delete_frame: "删除框架",
  delete_node: "删除节点",
  delete_skill: "删除技能",
  delete_text_note: "删除文本便笺",
  describe_local_server: "查看本地服务器信息",
  duplicate_canvas: "复制画布",
  duplicate_cards: "复制卡片",
  edit_deck: "编辑卡组",
  edit_graph_inputs: "编辑节点图输入",
  edit_script_card: "编辑脚本卡片",
  edit_subscript_face: "编辑子脚本面板",
  edit_text_note: "编辑文本便笺",
  execute_python: "执行 Python",
  export_result: "导出结果",
  expose_pin: "公开引脚",
  find_node_kinds: "查找节点类型",
  freeze_render_passes: "冻结渲染通道",
  generate_from_annotations: "根据标注生成",
  get_call_result: "获取调用结果",
  get_canvas_context: "获取画布上下文",
  get_canvas_debug: "获取画布调试信息",
  get_canvas_layout: "获取画布布局",
  get_card_context: "获取卡片上下文",
  get_extension_status: "获取扩展状态",
  get_generation_history: "获取生成历史",
  get_graph_docs: "获取节点图文档",
  get_help: "获取帮助",
  get_node_debug: "获取节点调试信息",
  get_node_kind_pins: "获取指定节点类型的引脚",
  get_node_pins: "获取节点引脚",
  get_node_status: "获取节点状态",
  get_pipeline_docs: "获取流程文档",
  get_route: "获取路由",
  get_selection: "获取选中项",
  get_service_meta_schema: "获取服务元架构",
  get_service_schema: "获取服务架构",
  get_skill: "获取技能",
  get_spatial_annotations: "获取空间标注",
  get_subagent_status: "获取子智能体状态",
  get_tool_schemas: "获取工具架构",
  get_unreal_console_variable: "获取虚幻引擎控制台变量",
  get_unreal_selection: "获取虚幻编辑器中的选中项",
  get_unreal_viewport_camera: "获取虚幻编辑器视口摄像机",
  import_to_unreal: "导入虚幻编辑器",
  inspect_node_output: "查看节点输出",
  inspect_script: "查看脚本",
  inspect_task_results: "检查任务结果",
  inspect_toolshelf: "查看工具架",
  inspect_usd: "查看 USD",
  inspect_viewer: "检查查看器",
  isolate_annotation_group: "仅显示指定标注组",
  launch_subagent: "启动子智能体",
  list_agent_tasks: "列出智能体任务",
  list_audio_models: "列出音频模型",
  list_canvases: "列出画布",
  list_connectors: "列出连接器",
  list_extensions: "列出扩展",
  list_image_models: "列出图像模型",
  list_media_tools: "列出媒体工具",
  list_models: "列出模型",
  list_scripts: "列出脚本",
  list_skill_activations: "列出技能启用记录",
  list_skills: "列出技能",
  list_squad_members: "列出团队成员",
  list_unreal_levels: "列出虚幻引擎关卡",
  list_video_models: "列出视频模型",
  list_workspaces: "列出工作区",
  manage_agent_personalities: "管理智能体个性",
  manage_canvas_memory: "管理画布记忆",
  manage_user_preferences: "管理用户偏好",
  manage_versions: "管理版本",
  message_squad_lead: "向团队负责人发消息",
  message_squad_member: "向团队成员发消息",
  motion_capture_readiness: "检查动作捕捉是否就绪",
  move_canvas_items: "移动画布项目",
  name_agent: "为智能体命名",
  open_canvas: "打开画布",
  open_extension_panel: "打开扩展面板",
  open_unreal_level: "打开虚幻引擎关卡",
  organization_session: "管理画布整理会话",
  package_extension: "打包扩展",
  pause_realtime: "暂停实时处理",
  place_result: "放置结果",
  place_script: "放置脚本",
  place_workspace: "放置工作区",
  prepare_graph_version: "准备节点图版本",
  present_nodes: "展示节点",
  present_unreal: "在虚幻编辑器中展示",
  preview_usd: "预览 USD",
  propose_service_schema: "提出服务架构方案",
  propose_team: "提出团队方案",
  publish_extension: "发布扩展",
  query_mrg_passes: "查询 MRG 渲染通道",
  read_graph: "读取节点图",
  record_review_feedback: "记录评审反馈",
  release_inherited_review_criteria: "解除继承的评审标准",
  reload_extension: "重新加载扩展",
  remove_stale_pin: "移除过期引脚",
  rename_canvas: "重命名画布",
  rename_node: "重命名节点",
  repair_service_schema: "修复服务架构",
  request_provider_setup: "请求配置提供商",
  resize_cards: "调整卡片大小",
  resolve_skills: "解析技能",
  resume_subagent: "恢复子智能体",
  run_node: "运行节点",
  run_unreal_console_command: "运行虚幻引擎控制台命令",
  save_canvas: "保存画布",
  save_workspace_to_extension: "将工作区保存到扩展",
  search_extensions: "搜索扩展",
  search_help: "搜索帮助",
  search_project_reviews: "搜索项目评审",
  search_unreal_console_variables: "搜索虚幻引擎控制台变量",
  send_extension_changes: "发送扩展更改",
  send_to_app: "发送到外部应用",
  set_canvas_gating_mode: "设置画布执行限制模式",
  set_card_params: "设置卡片参数",
  set_local_server_start_command: "设置本地服务器启动命令",
  set_models_in_pickers: "设置选择器中的模型",
  set_node_assignees: "设置节点负责人",
  set_node_semantics: "设置节点语义",
  set_node_tags: "设置节点标签",
  set_script_inputs: "设置脚本输入",
  set_script_metadata: "设置脚本元数据",
  set_unreal_console_variable: "设置虚幻引擎控制台变量",
  set_unreal_skybox: "设置虚幻引擎天空盒",
  set_unreal_viewport_camera: "设置虚幻编辑器视口摄像机",
  set_unreal_work_targets: "设置虚幻编辑器工作目标",
  set_visible_annotation_groups: "设置可见标注组",
  show_all_annotation_groups: "显示所有标注组",
  spawn_cutout_in_unreal: "在虚幻编辑器中生成抠图",
  start_local_server: "启动本地服务器",
  start_realtime: "启动实时处理",
  stop_realtime: "停止实时处理",
  stop_run: "停止运行",
  submit_task_assessment: "提交任务评估",
  tail_server_log: "查看最新服务器日志",
  unpack_subcanvas: "展开子画布",
  unreal_editor_mcp: "调用虚幻编辑器 MCP",
  update_agent_task: "更新智能体任务",
  update_code_script: "更新代码脚本",
  update_connector: "更新连接器",
  update_frame: "更新框架",
  update_outdated_cards: "更新过期卡片",
  update_skill: "更新技能",
  wait_for_squad_messages: "等待团队消息",
  wait_subagents: "等待子智能体",
  wrap_in_subgraph: "封装为子图",
  write_board_elements: "编辑画布元素",
  write_frame_sections: "编辑框架分区",
  write_graph: "编辑节点图",
  write_text_card: "写入文本卡片",
  write_usd: "写入 USD"
};

// src/agent-settings.ts
var labels2 = new Map(Object.entries(agent_setup_default.labels));
var extendedLabels = new Map(Object.entries(agent_setup_default.modelAndSetupLabels));
var contexts = new Map(Object.entries(agent_setup_default.contextHints));
var groupHelp = new Map(Object.entries(agent_setup_tool_groups_default.descriptions));
function label(value) {
  return labels2.get(value) ?? extendedLabels.get(copyId(value));
}
var hints2 = new Map(Object.entries(agent_setup_default.hints));
var groups = new Map(Object.entries(agent_setup_tool_groups_default.labels));
var tools = new Map(Object.entries(agent_setup_tools_default));
var setupScope = ".agent-setup-strip,.agent-setup-popover";
function translateHint(source) {
  const parts = /^(.*?)( (?:Available when|The chat keeps|You can change) .*)?$/.exec(source);
  if (!parts) return;
  const id = copyId(parts[1]);
  const hint = hints2.get(id) ?? contexts.get(id);
  if (!hint || !parts[2]) return hint;
  switch (copyId(parts[2])) {
    case "e601b6e7c7c2e9c3":
      return hint + " 本轮完成后即可更改。";
    case "601322e14408f534":
      return hint + " 对话已开始，将沿用当前上下文。";
    case "e22436cbf10bfc3d":
      return hint + " 开始对话前仍可调整。";
    default:
      return void 0;
  }
}
function translateModeSummary(source) {
  const match = /^(?:(.+) · )?(Always ask|Ask if risky|Autonomous) · (Light|Standard|Thorough|Custom)$/s.exec(source);
  if (match) return (match[1] ? match[1] + " · " : "") + label(match[2]) + " · " + label(match[3]);
}
function isSetupList(list) {
  if (!list.id) return false;
  const triggers = list.ownerDocument.querySelectorAll('.agent-setup-body [role="combobox"][aria-controls]');
  return Array.from(triggers).some((trigger) => trigger.getAttribute("aria-controls") === list.id);
}
function translateAgentModelPlaceholder(element, english) {
  if (!element.classList.contains("agent-model-name")) return;
  const row = element.parentElement;
  if (!row?.matches('.agent-setup-body .agent-model-list button[role="menuitemradio"]:disabled')) return;
  const issue = row.getAttribute("title");
  if (english === "No models available" && (issue === "Unavailable" || issue === label("Unavailable"))) {
    return label(english);
  }
  if (row.getAttribute("aria-checked") !== "false") return;
  if ((english === "Not installed" || english === "Loading models…" || copyId(english) === "1c71ea4bea582fb5") && (issue === english || issue === label(english))) return label(english);
}
function translateAgentSettings(element, field, english, node) {
  if (element.matches(".mini-agent-chat-model-personality,.mini-agent-chat-model,.agent-setup-header > .agent-setup-hint")) {
    if (field === "text" || field === "title") {
      const summary = translateModeSummary(english);
      if (summary) return summary;
    }
    if (element.matches(".mini-agent-chat-model")) return label(english);
  }
  if (field === "text" && element.matches(".mini-agent-chat-model > span:not(.mini-agent-chat-model-personality)")) return null;
  if (field === "text" && element.matches('[role="tooltip"][data-menu-layer]')) {
    const hint = translateHint(english);
    if (hint && element.ownerDocument.querySelector(setupScope)) return hint;
  }
  if (!element.closest(setupScope)) {
    if (label(english) !== void 0 && (field === "text" || field === "aria-label")) {
      const list = element.closest('[role="listbox"]');
      if (list && isSetupList(list)) return label(english);
    }
    return;
  }
  if (field === "text") {
    if (element.closest(".agent-setup-nav button")) return null;
    if (element.classList.contains("agent-model-name")) return translateAgentModelPlaceholder(element, english) ?? null;
    if (element.closest(".agent-model-empty") && element.childNodes.length > 1) {
      if (node === element.firstChild && english === "No models match “") return "没有与“";
      if (node === element.lastChild && english === "”.") return "”匹配的模型。";
      if (node === element.firstChild && english === "Choose") return "请在下方的运行环境中选择";
      if (node === element.lastChild && english === "in Environment below to load its models.") return "以加载模型。";
      return null;
    }
    if (element.matches(".agent-setup-hint") && element.childNodes.length === 3) {
      if (node === element.firstChild && copyId(english) === "063452409e766f57") {
        return "切换后可继续使用当前对话，";
      }
      if (node === element.childNodes[1] && english === "the provider stays fixed") return "提供商已固定";
      if (node === element.childNodes[1] && english === "the provider and context stay fixed") return "提供商和上下文已固定";
      if (node === element.lastChild && english === ".") return "。";
    }
    if (element.matches(".personality-tool-extension")) return node === element.firstChild && english === "from" ? "来自" : null;
    if (element.matches(".personality-tool-list label > span")) {
      const id = element.querySelector(":scope > code")?.textContent;
      if (node === element.firstChild && id && id.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ") === english) {
        return tools.get(id) ?? null;
      }
      return null;
    }
    if (element.matches(".personality-tool-group > p")) return groupHelp.get(copyId(english));
    if (element.matches(".personality-tool-group > summary > span,.personality-tool-select-all")) {
      return groups.get(english) ?? label(english);
    }
  }
  if (field === "aria-label") {
    if (english.startsWith("Select all tools in ") && element.closest(".personality-tool-select-all")) {
      const group = groups.get(english.slice("Select all tools in ".length));
      if (group) return "全选“" + group + "”中的工具";
    }
    if (english.endsWith(" tools") && element.matches(".personality-tool-list")) {
      const group = groups.get(english.slice(0, -" tools".length));
      if (group) return group + "工具";
    }
  }
  if (element.closest(".personality-tool-list code,.personality-unavailable-tools code,.agent-model-name")) return null;
  if (field === "text" && element.matches('.agent-model-empty[role="alert"]') && copyId(english) !== "c45880d7d6d89bd6") return null;
  if (field === "text" && element.matches("textarea,input,[contenteditable]")) return null;
  return label(english) ?? translateHint(english);
}

// src/translate.ts
var attributes = ["title", "aria-label", "aria-description", "placeholder", "data-tooltip", "data-title-tip", "alt"];
var scopeAttributes = ["class", "role", "contenteditable", "translate", "data-testid", "data-package-row", "data-value", "data-role", "disabled", "aria-checked"];
var protectedContent = 'script,style,pre,code,.cm-content,.view-lines,[translate="no"],[data-merlin-text-surface],.canvas-card-header,.agent-attention-preview,.agent-assignee-name,.agent-current-task-title,.merlin-scripts-name,.credential-row-label,.merlin-ops-name';
var editableContent = '[contenteditable]:not([contenteditable="false"]),input,textarea,[role="textbox"]';
var searchMessageStart = "No settings in this category match “";
var searchEndId = "38f7650709e6c304";
var searchMessageStartZh = "当前分类没有与“";
var searchMessageEndZh = "”匹配的设置。要搜索其他分类，请先在左侧选择。";
function localize(doc, dictionary2, readCanvas) {
  const translateWorkspaceDetails = createWorkspaceTranslator(readCanvas);
  const rules = /* @__PURE__ */ new Map();
  const helpLengths2 = /* @__PURE__ */ new Set();
  for (const group of dictionary2) {
    for (const [english, translation] of Object.entries(group.entries)) {
      if (!translation) continue;
      const length = keyLength(english);
      if (length !== void 0) helpLengths2.add(length);
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
    const toolboxScriptName = english && translateToolboxScriptName(element, field, english, readCanvas);
    let translated;
    const candidates = english ? rules.get(field + "\n" + english) ?? (helpLengths2.has(english.length) ? rules.get(field + "\n" + copyKey(english)) : void 0) : void 0;
    const splitMessage = element.classList.contains("ue-menu-note") || element.classList.contains("merlin-graphs-empty") || english === "." && element.matches(".agent-onboarding-content > p,.agent-setup-hint") || english === "”." && element.classList.contains("agent-model-empty") || english === "?" && element.matches(".generation-shelf-approval > strong");
    if (toolboxScriptName) {
      translated = toolboxScriptName;
    } else if (english && element.closest(".agent-chat-message")) {
      if (isAgentChatChrome(element, field)) translated = translateAgentChat(element, field, english, node);
    } else if (english && (candidates || splitMessage || english === "(" || /[A-Za-z]/.test(english))) {
      translated = translateAgentSettings(element, field, english, node);
      if (translated === void 0) translated = translateAgentChat(element, field, english, node);
      if (translated === void 0) translated = translateEditorConnection(element, field, english, node);
      if (translated === void 0) translated = translateGeometryMenu(element, field, english);
      if (translated === void 0) translated = translateNodeHover(element, field, english);
      if (translated === void 0) translated = translateMediaDetails(element, field, english, node);
      if (translated === void 0) translated = translateWorkspaceDetails(element, field, english, node);
      if (translated === void 0) translated = translatePanelDetails(element, field, english, node);
      if (translated === void 0) translated = translatePanelsDynamic(element, field, english, node);
      if (translated === void 0) translated = translateCanvasAction2(element, field, english);
      if (translated === void 0) translated = translatePanelActions(element, field, english);
      if (translated === void 0) translated = translateSettingsPreview2(element, field, english, node);
      if (translated === void 0) translated = translateSettingsActions(element, field, english);
      if (translated === void 0) translated = translateShelfAction(element, field, english);
      if (translated === void 0) translated = translateGeneration(element, field, english, node);
      if (translated === void 0) translated = translateSettingsDynamic(element, field, english, node);
      if (translated === void 0) translated = translateMenuDynamic(element, field, english);
      if (translated === void 0) translated = translateGraphContext(element, field, english);
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
      const emptyTextInputHint = field === "text" && english === "Double-click to edit" && translated === "双击编辑" && element.matches(".text-input-rich[data-merlin-text-surface] > span:only-child") && !element.closest("[contenteditable]");
      if (english === packageName || modelName || element.matches('[data-testid="provider-icon"]') || element.closest(".agent-model-name") && !(field === "text" && english && translateAgentModelPlaceholder(element, english)) || element.closest(toolboxScriptNameSelector) && !toolboxScriptName || element.closest(protectedContent) && !emptyTextInputHint || element.closest(".merlin-canvas-tab") && !tabAction || field === "text" && element.closest(editableContent + ',option[value="custom"]')) translated = void 0;
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
        if (record.target instanceof doc.defaultView.Element && record.target.classList.contains("generation-shelf-workflow-folder")) {
          roots.add(record.target);
        }
      } else if (record.type === "characterData") roots.add(record.target);
      else if (record.attributeName && doc.contains(record.target)) {
        const element = record.target;
        if (scopeAttributes.includes(record.attributeName) || record.attributeName === "title" && element.matches('.agent-model-list [role="menuitemradio"]')) roots.add(element);
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
    const tools2 = /^(\d+) tools?$/.exec(english);
    if (tools2) return tools2[1] + " 个工具";
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
    selector: '[role="tooltip"],[role="tooltip"] *,.merlin-content-modes button',
    fields: [
      "text",
      "aria-description"
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
    selector: '.merlin-graph-inspector :is(.merlin-script-form-section,.merlin-script-form-section-head span,.merlin-script-form-prop,.merlin-script-form-prop-label span,.merlin-script-form-none:not([title]),.merlin-script-form-checkbox,.merlin-script-side-locked > span,.merlin-script-side-duplicate,input,textarea,button[role="switch"],.merlin-script-form-add,.merlin-script-form-dot.is-button,.merlin-script-form-remove,.merlin-skill-attach-add,.merlin-skill-attach-manage,.merlin-custom-category:first-child),.merlin-graph-inspector-subtype button,.merlin-graph-inspector .merlin-tags-field',
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
      "#115:8e488f24a293ef70": "还没有输入。右键节点可选择「创建输入」，也可从这里添加后拖到图中。",
      "#107:e176399bd31cd521": "请将结果连到输出节点，卡片才能展示。",
      "Edit a Copy": "编辑副本",
      "Edit a copy": "编辑副本",
      "#97:134ffde693927f62": "卡片已有结果，复制后可调整设置。",
      "#61:063dcf91c4f920cb": "请解锁画布后再编辑节点图。",
      "Auto lock": "自动锁定",
      "Locks once it has run and every output is filled": "运行并填充所有已连接的输出后锁定",
      "Stays editable after it runs": "运行后仍可编辑",
      "#48:8adc0149dd1d2760": "全局自动锁定已关闭，节点图不会自动锁定。",
      "#97:a1f6281c0ef5dcdc": "全局自动锁定设为始终，所有节点图在运行后都会锁定。",
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
      "#479:5fc485050d51d73b": "输入是节点图卡片运行前提供的值，例如常量、提示词或图片。智能体填写节点图时会读取这些名称。右键节点选择「创建输入」，也可从这里添加输入后拖到图中。重复拖入可放置多个共享同一值的关联节点。删除最后一个关联节点时会保留此处的输入定义。点击这里的 × 会删除输入及其所有关联节点。",
      "#142:30eb1ad134b1a62c": "将结果连到输出节点的引脚，卡片会展示标星的输出。",
      "#176:bf101b1a2478458a": "手动添加的技能供此画布及其嵌套画布中的智能体参考。工具权限继续沿用现有设置。"
    }
  },
  {
    selector: '.merlin-graph-inspector button[role="switch"],[role="tooltip"][data-portal-popup][id],.merlin-graph-inspector .merlin-sr-only',
    fields: ["text", "title"],
    entries: {
      "#408:a1314ce94736abb2": "开启时，节点图运行并填充所有已连接的输出后会锁定，使结果与生成流程对应。关闭时仍可编辑。在「设置 → 偏好设置 → 节点图」中，全局选项设为「开启」时采用各图的开关。设为「关闭」时全部保持可编辑，设为「始终」时所有节点图都在运行后锁定。"
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
    selector: '.merlin-app-menus .merlin-file-menu > .ue-menu :is(.ue-menu-label,.ue-menu-heading,[role="group"]),.merlin-app-bar .merlin-new-canvas-tab + .ue-menu[popover] > .ue-menu-item > .ue-menu-label',
    fields: ["text", "aria-label"],
    entries: {
      "New / Open": "新建 / 打开",
      "Current canvas": "当前画布",
      "Open canvas file…": "打开画布文件…",
      "Open file…": "打开文件…",
      "Rename canvas…": "重命名画布…",
      "Collaborate…": "协作…",
      "Close canvas": "关闭画布",
      "Save canvas": "保存画布",
      "Duplicate canvas": "复制画布",
      "Package canvas…": "打包画布…"
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
      "Third-party software": "第三方软件",
      "Transitive Notices": "间接依赖声明",
      "Transitive notices": "间接依赖声明",
      "#64:3ded3b59abfd4956": "用节点图组织 AI 素材生成步骤。",
      "Frontend version": "前端版本",
      "Server version": "服务器版本",
      "Server build ID": "服务器构建标识",
      "AI Models root": "AI 模型根目录"
    }
  },
  {
    selector: '[role="dialog"]:is([aria-label="About Unreal Canvas"],[aria-label="关于 Unreal Canvas"]) nav + div > div > div:has(> div:nth-child(6)) > div:nth-child(odd)',
    fields: ["text"],
    entries: {
      Version: "版本",
      Build: "构建版本",
      "AI models root": "AI 模型根目录"
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
      "Exit Fullscreen": "退出全屏",
      "Filter by": "筛选条件",
      Person: "人员",
      Age: "时间",
      Votes: "投票",
      "Custom Filter…": "自定义筛选…",
      "Custom filter…": "自定义筛选…",
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
    selector: '.merlin-toolbar-control-box button:has(> svg[data-icon="source-link"]),.merlin-toolbar-control-box [role="menu"]:is([aria-label="History lines"],[aria-label="历史连线"]),.merlin-toolbar-control-box [role="menu"]:is([aria-label="History lines"],[aria-label="历史连线"]) :is(button,.ue-menu-label,[role="group"])',
    fields: ["text", "title", "aria-label"],
    entries: {
      "History lines": "历史连线",
      "Show selected": "显示所选",
      "Show all": "显示全部",
      "Show none": "全部隐藏",
      "Fade other cards": "淡化其他卡片",
      "Fade the cards outside the lines": "淡化连线以外的卡片",
      "Show ancestor numbers": "显示上游序号",
      "Number each line by its step back": "按回溯层级为连线编号",
      "Curved lines": "曲线连线",
      "Draw the lines as free-flowing curves": "以曲线绘制连线",
      "Line style": "线型",
      "Animated dashes": "动态虚线",
      "Static dashes": "静态虚线",
      "Solid lines": "实线"
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
    selector: '.pill-menu-item,.pill-menu-item .ue-menu-label,.pill-menu-item .feature-hint-menu-label,[role=menu]:is([aria-label="Canvas actions"],[aria-label="画布操作"]) .feature-hint-menu-label,body:has([role=menu]:is([aria-label="Canvas actions"],[aria-label="画布操作"])) > .ue-submenu > button,body:has([role=menu]:is([aria-label="Canvas actions"],[aria-label="画布操作"])) > .ue-submenu > button > :is(.ue-menu-label,.feature-hint-menu-label)',
    fields: [
      "text",
      "title",
      "aria-label"
    ],
    entries: {
      Deck: "卡组",
      "Add comment": "添加评论",
      "Add to Timeline": "添加到时间线",
      "Retarget Animation": "重定向动画",
      "Bring forward": "上移一层",
      "Send backward": "下移一层",
      "#69:c8ec072e046393f1": "复制所选卡片到新节点图，同时保留原卡片。",
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
    selector: '[role=menu]:is([aria-label="Canvas actions"],[aria-label="画布操作"]) > .ue-menu-item > .feature-hint-menu-label',
    fields: ["text"],
    entries: {
      "Import file…": "导入文件…",
      "Canvas settings": "画布设置",
      "Unpack Subcanvas": "解散子画布",
      "Unpack Deck": "解散卡组",
      "Open Timeline": "打开时间线"
    }
  },
  {
    selector: 'body:has([role=menu]:is([aria-label="Canvas actions"],[aria-label="画布操作"]) > button[aria-expanded=true]) > .ue-submenu > button.ue-menu-item > .ue-menu-label',
    fields: ["text"],
    entries: {
      "Text card": "文本卡片",
      "Duplicate graph": "创建节点图副本",
      "Fit to aspect ratio": "适配宽高比",
      "Reset card size": "重置卡片大小",
      "Fit to text": "适应文本",
      "Export as workspace file…": "导出为工作区文件…"
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
    selector: '[role="dialog"][aria-modal="true"],[role="dialog"]:is([aria-label="Custom Filter" i],[aria-label="自定义筛选"]) > div,[role="dialog"]:is([aria-label="Custom Filter" i],[aria-label="自定义筛选"]) > div:first-child > span:first-child,[role="dialog"]:is([aria-label="Custom Filter" i],[aria-label="自定义筛选"]) input,[role="dialog"]:is([aria-label="Custom Filter" i],[aria-label="自定义筛选"]) > div:last-child > button,[role="dialog"]:is([aria-label="Custom Filter" i],[aria-label="自定义筛选"]) button.custom-select,[role="dialog"]:is([aria-label="Custom Filter" i],[aria-label="自定义筛选"]) select option[value=""],[role="dialog"]:is([aria-label="Custom Filter" i],[aria-label="自定义筛选"]) button.custom-select > span,[role="dialog"]:is([aria-label="Custom Filter" i],[aria-label="自定义筛选"]) [role="group"] > button,[role="dialog"]:is([aria-label="Custom Filter" i],[aria-label="自定义筛选"]) [role="group"] [role="group"] button',
    fields: [
      "text",
      "title",
      "aria-label",
      "placeholder"
    ],
    entries: {
      "Custom Filter": "自定义筛选",
      "Custom filter": "自定义筛选",
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
  },
  {
    selector: '[role="tooltip"][data-portal-popup][id]:not(:has(> *))',
    fields: ["text"],
    entries: {
      "#203:3ae274ba26e125a3": "已锁定。此节点图已运行。仍可移动节点、用框架整理节点、排列输入和输出，以及添加、编辑或删除文本便笺和连接线。点击解锁，或复制一份再编辑。",
      "#73:a6848abdbcf0a574": "已解锁。编辑会改变此结果的生成流程。点击可重新锁定。",
      "#86:3a12456e3300330b": "可编辑。节点图已运行，但已在「设置 → 偏好设置 → 节点图」中关闭自动锁定。",
      "#83:c6f42911d1a191a8": "此节点图已运行，仍可编辑。此图的自动锁定已在「脚本详情 → 常规」中关闭。",
      "#126:c0b393609e3d4f3a": "可编辑。节点图尚未完成一次整图运行并填充所有已连接的输出。逐个运行卡片时仍可编辑。",
      "#38:a5c6eb409431756d": "可编辑。此节点图尚未运行。",
      "#63:a9dca4faa68ff5f1": "默认工作流已锁定。复制后即可编辑副本。",
      "#445:1d6a2d1741c98afd": "运行画布上的节点图卡片、它的输出节点，或覆盖所有输出的触发器后，如果每个已连接的输出都有内容，节点图就会自动锁定，使结果与生成流程对应。逐个运行图内卡片时仍可编辑。可用图右上角关闭按钮旁的锁图标解锁或编辑副本。单个节点图的自动锁定开关位于该图的「脚本详情 → 常规」。"
    }
  },
  {
    selector: '[role="dialog"][aria-modal="true"]:has(> [data-confirm-body]),[role="dialog"][aria-modal="true"]:has(> [data-confirm-body]) > div:first-child',
    fields: ["text", "aria-label"],
    entries: {
      "Unlock this graph?": "解锁此节点图？",
      "Built-in graphs can't be edited": "内置节点图不可编辑",
      "Graphs from extensions can't be edited": "扩展提供的节点图不可编辑"
    }
  },
  {
    selector: `[role="dialog"]:is([aria-label="Unlock this graph?"],[aria-label="解锁此节点图？"],[aria-label="Built-in graphs can't be edited"],[aria-label="内置节点图不可编辑"],[aria-label="Graphs from extensions can't be edited"],[aria-label="扩展提供的节点图不可编辑"]) > [data-confirm-body]`,
    fields: ["text", "aria-label"],
    entries: {
      Message: "说明",
      "#407:e2911791849f4ce4": "此节点图已运行并生成结果。修改节点图会改变生成流程，卡片上的结果将与节点图不符。要保留当前结果，请编辑副本。「仅复制节点图」会新建一张没有输出的卡片。「连同输出一起复制」会复制整张卡片并以解锁状态打开，方便修改现有流程的部分节点。编辑完毕后，可以重新锁定。",
      "#121:af126ab87eee29a3": "此节点图随应用提供。在工具箱中复制它，即可编辑副本。"
    }
  },
  {
    selector: `[role="dialog"]:is([aria-label="Unlock this graph?"],[aria-label="解锁此节点图？"],[aria-label="Built-in graphs can't be edited"],[aria-label="内置节点图不可编辑"],[aria-label="Graphs from extensions can't be edited"],[aria-label="扩展提供的节点图不可编辑"]) > [data-confirm-actions] > button`,
    fields: ["text"],
    entries: {
      Cancel: "取消",
      "Copy graph only": "仅复制节点图",
      "Copy with outputs": "连同输出一起复制",
      Unlock: "解锁",
      OK: "确定"
    }
  },
  {
    selector: ".merlin-toolbar-control-box",
    fields: ["aria-label"],
    entries: {
      "View, filter and zoom": "视图、筛选与缩放"
    }
  },
  {
    selector: '.settings-row-value span,.ue-menu-item[role="option"]:is([data-value="off"],[data-value="on"],[data-value="always"])',
    fields: ["text", "title"],
    entries: {
      "Graphs never lock.": "节点图不会自动锁定。",
      "#44:9410be555898dd9c": "自动锁定按节点图分别设置。",
      "#64:093ed9443a829987": "所有节点图在运行后都会自动锁定。"
    }
  },
  {
    selector: ".merlin-toolbar-control-box :is(button,.merlin-toolbar-zoom)[data-app-tooltip]",
    fields: ["aria-description"],
    entries: {
      "#44:5642cf966f61773d": "双击恢复到 100%",
      "#88:cda9bfa4c1fee200": "用连线显示各卡片的来源。当前显示所选卡片的历史连线。",
      "#81:2582fa4b505e1409": "用连线显示各卡片的来源。当前显示所有卡片的历史连线。",
      "#82:7a55791747ad0f17": "仅显示符合筛选条件的卡片。筛选已启用，部分卡片已隐藏。"
    }
  },
  {
    selector: '[role="tooltip"][data-portal-popup] > div:only-child > div:nth-child(2) > div:only-child',
    fields: ["text"],
    entries: {
      "#35:8531a194dbeda074": "当前显示所选卡片的历史连线",
      "#28:23115c7a39328c6d": "当前显示所有卡片的历史连线",
      "#37:a8c7585ba64f3bc8": "筛选已启用，部分卡片已隐藏"
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
    selector: '.media-library-filter-trigger,.merlin-content-view-controls button,.merlin-scripts .merlin-segmented-icons > button,.merlin-scripts-columns-btn,.merlin-scripts-create-btn,.merlin-panel-settings-menu,.merlin-rail-body-content:has(> .merlin-scripts) > .ue-menu[role=menu]:is([aria-label="Columns"],[aria-label="显示列"])',
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
    selector: '.merlin-scripts-cell,.merlin-panel-settings-menu .ue-menu-label,.merlin-scripts-results-sort,.merlin-rail-body-content > .ue-menu[role=menu]:is([aria-label="Columns"],[aria-label="显示列"]) button[role=menuitemcheckbox] > .ue-menu-label',
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
      "#47:aa08b5775383ce1f": "内置脚本已锁定，创建副本后可编辑。",
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
    selector: ".agent-onboarding h2,.agent-onboarding-content > p,.agent-onboarding details p,.agent-onboarding summary,.agent-onboarding button,.agent-onboarding button > span,.agent-onboarding-choice small,.agent-onboarding-choice .onboarding-choice-copy > strong,.agent-onboarding-notice,.agent-onboarding-card > small,.agent-onboarding-card > span,.agent-onboarding-card > p,.agent-onboarding label,.agent-onboarding li,.agent-onboarding option,.agent-onboarding,.agent-welcome,.agent-welcome-examples",
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
      "Models available": "模型可用",
      "#33:3d0a30aad6252f0a": "账号响应尚待验证",
      "Send test message": "发送测试消息",
      "#99:e738fa2cb1363f93": "测试使用你的提供商账户，可能产生正常请求费用。测试仅验证连接。",
      "#38:e9ed0b37be8c0b45": "打开任一画布后可测试连接。",
      "#17:18fb99c4ce3a319d": "连接成功。",
      "#116:02ce1ffd17a1b0bc": "可开始对话。现有提供商设置已保留，模型、权限和推理强度可在对话中更改。",
      "Return to provider setup": "返回提供商设置",
      "Start chatting →": "开始对话 →",
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
      "#56:005cfc61cd336d6c": "在 Python 工作区交互调用 Unreal Canvas API。",
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
      "Custom filter…": "自定义筛选…",
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
    selector: ".media-library .merlin-panel-icon-button,.media-library-size,.media-library .merlin-key-picker,.media-library .merlin-content-view-controls button,.media-library .merlin-segmented-icons > button,.media-library input,.media-library-hand-save,.media-library-hand-card-remove,.merlin-navigator-tree-actions button,.merlin-panel-chip",
    fields: [
      "title",
      "aria-label",
      "data-title-tip",
      "placeholder"
    ],
    entries: {
      "Limited to the selected cards": "仅限选中的卡片",
      "#37:e59a654e2f383cc9": "只显示资源库所选项",
      "#29:6b54aac512a20d50": "归档卡片请使用平铺视图。",
      "Back to the Library": "返回资源库",
      "Archived cards from": "按来源筛选已归档卡片",
      "#41:7d43d6843973c931": "仅在媒体平铺视图中显示所选项目",
      "#121:dc6ba6e03c34dfa8": "已归档卡片保留生成结果和编辑内容，可按原样恢复。",
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
    selector: ".settings-window-body main [role=group] :is(span,button.ui-switch[role=switch])",
    fields: [
      "title",
      "data-title-tip"
    ],
    entries: {
      "#541:e74bd1158828b5f7": "可信目录中的更新可沿用现有授权，包括「运行前询问」设置允许的扩展。更新没有新增权限请求，且目录已审核该版本时，可自动更新。未审核的版本若不执行代码、不以插件方式加载模型定义，并且保留现有模型和登录状态，也可自动更新。其他更新会等待你的操作，并在运行前再次询问。会在应用内执行代码或以插件方式加载模型定义的扩展，需要手动点击「更新」。"
    }
  },
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
      "with the pointer over a 3D view": "鼠标位于三维视图上时",
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
    selector: ".settings-window-body .settings-group > p",
    fields: ["text"],
    entries: {
      "#324:34421c3a34530313": "卡片底栏只显示一行。下方两组决定左右两侧字段的显示顺序，组名不会显示。左侧固定以带类型颜色的「卡片类型」开头，可以在其后添加字段。其他字段使用弱化颜色。"
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

// src/locales/canvas-actions-022.json
var canvas_actions_022_default = [
  {
    selector: '.ue-menu:has(button:is([aria-label="Close search"],[aria-label="关闭搜索"])) .merlin-panel-search input,.ue-menu:has(button:is([aria-label="Close search"],[aria-label="关闭搜索"])) > div:first-child > button,.ue-menu:has(button:is([aria-label="Close search"],[aria-label="关闭搜索"])) > div:last-child,.ue-menu:has(button:is([aria-label="Close search"],[aria-label="关闭搜索"])) > div:nth-child(2) > div:only-child:not(:has(*))',
    fields: [
      "text",
      "title",
      "aria-label",
      "placeholder"
    ],
    entries: {
      "Search canvases": "搜索画布",
      "Search cards, frames, notes…": "搜索卡片、框架和便笺…",
      "#34:4edec0bb4145837d": "只查找本画布",
      "#64:f4310aad255cd325": "搜索范围为本画布，点击可扩大到所有画布。",
      "#11:696264878d4f2cff": "本画布",
      "Close (Esc)": "关闭 (Esc)",
      "No matches": "没有匹配结果",
      "#45:fb37d26577abda7b": "Enter 下一处，Shift+Enter 上一处，Esc 退出。"
    }
  },
  {
    selector: '.pill-menu:has(.merlin-panel-search) .merlin-panel-search input,.ue-menu:has(input:is([aria-label="Search nodes"],[aria-label="搜索节点"])) .merlin-panel-search input,.pill-menu:has(.merlin-panel-search) .ue-menu-note,.ue-menu:has(input:is([aria-label="Search nodes"],[aria-label="搜索节点"])) .ue-menu-note,.pill-menu:has(.merlin-panel-search) button[aria-haspopup="menu"] > .ue-menu-label,.ue-menu:has(input:is([aria-label="Search nodes"],[aria-label="搜索节点"])) button[aria-haspopup="menu"] > .ue-menu-label',
    fields: [
      "text",
      "title",
      "aria-label",
      "placeholder"
    ],
    entries: {
      "Search nodes": "搜索节点",
      "Search nodes…": "输入英文节点名，如 image…",
      Animation: "动画",
      "Search nodes...": "输入英文节点名，如 image…",
      "No match": "没有匹配的节点。可输入英文名，或清空后按分类浏览。",
      Input: "输入",
      Generate: "生成",
      Process: "处理",
      Geometry: "几何",
      Logic: "逻辑",
      Routing: "路由",
      Composition: "组合",
      Viewers: "查看器",
      Constant: "常量",
      Custom: "自定义"
    }
  },
  {
    selector: ".canvas-tool-palette [data-toolbar-menu-open] .ue-menu-item > .ue-menu-label,.canvas-tool-palette [data-toolbar-menu-open] input",
    fields: [
      "text",
      "title",
      "aria-label",
      "placeholder"
    ],
    entries: {
      Connector: "连接线",
      Deck: "卡组",
      Comment: "评论",
      "Insert File…": "插入文件…",
      "Search Insert": "搜索可插入的项目"
    }
  },
  {
    selector: ".pill-submenu > button.pill-menu-item > .ue-menu-label",
    fields: [
      "text"
    ],
    entries: {
      "Bring to Front": "置于顶层",
      "Bring Forward": "上移一层",
      "Send Backward": "下移一层",
      "Send to Back": "置于底层"
    }
  },
  {
    selector: ".annotation-toolbar,.annotation-toolbar :is(button,input,.ue-menu-label,label,.ue-menu-heading,span)",
    fields: [
      "text",
      "title",
      "aria-label",
      "placeholder"
    ],
    entries: {
      "Annotation tools": "批注工具",
      "Freehand draw": "自由绘制",
      "Freehand draw options": "自由绘制选项",
      "Lasso area": "套索区域",
      "Lasso area options": "套索选项",
      "Straight line": "直线",
      "Straight line options": "直线选项",
      Arrow: "箭头",
      "Arrow options": "箭头选项",
      Rectangle: "矩形",
      "Rectangle options": "矩形选项",
      Circle: "圆形",
      "Circle options": "圆形选项",
      Triangle: "三角形",
      "Triangle options": "三角形选项",
      "Text annotation": "文字批注",
      "Outline color": "描边颜色",
      "Outline thickness": "描边粗细",
      "Stroke erase": "笔画擦除",
      "Stroke erase options": "笔画擦除选项",
      "Pixel erase": "像素擦除",
      "Pixel erase options": "像素擦除选项",
      "Clear annotations on a card": "清除卡片上的批注",
      Outline: "描边",
      Fill: "填充",
      Opacity: "不透明度",
      Hex: "十六进制",
      "Outline hex value": "描边颜色的十六进制值",
      "Fill hex value": "填充颜色的十六进制值",
      "Custom outline color": "自定义描边颜色",
      "Custom fill color": "自定义填充颜色",
      "Fill color": "填充颜色",
      "Solid outline": "实线描边",
      "Dashed outline": "虚线描边"
    }
  },
  {
    selector: '.pill-menu:has(.merlin-panel-search) button:not([aria-haspopup]):not(:has(.ue-menu-icon > span[style*="rgb(251, 146, 60)"])) > .ue-menu-label,.ue-menu:has(input:is([aria-label="Search nodes"],[aria-label="搜索节点"])) button:not([aria-haspopup]):not(:has(.ue-menu-icon > span[style*="rgb(251, 146, 60)"])) > .ue-menu-label',
    fields: [
      "text"
    ],
    entries: {
      "Audio Input": "音频输入",
      Doodle: "涂鸦",
      "Figma Fetch": "从 Figma 获取",
      "Image Input": "图像输入",
      "Mesh Input": "网格输入",
      "Reposition Render": "调整渲染位置",
      "Sequence Render": "序列渲染",
      "Text Input": "文本输入",
      "UE Viewport": "UE 视口",
      "USD Input": "USD 输入",
      "Video Input": "视频输入",
      "Viewport Render": "视口渲染",
      "Webcam Capture": "摄像头采集",
      "Audio Generator": "音频生成器",
      "Cube Mesh": "立方体网格",
      "Image Generator": "图像生成器",
      "Image Upscaler": "图像超分辨率",
      "Mesh Generator": "网格生成器",
      "Sphere Mesh": "球体网格",
      "Splat Generator": "高斯泼溅生成器",
      "Texture Generator": "纹理生成器",
      "Video Generator": "视频生成器",
      "Video Upscaler": "视频超分辨率",
      "Auto-Rig": "自动绑定骨骼",
      "Canny Edges (Image)": "Canny 边缘（图像）",
      "Canny Edges (Video)": "Canny 边缘（视频）",
      "Depth Estimation": "深度估计",
      "Edge Detection (Image)": "边缘检测（图像）",
      "Edge Detection (Video)": "边缘检测（视频）",
      "Extract Frame": "提取帧",
      "Image Grid": "图像网格",
      "Image Validator": "图像校验",
      "Merge (Image)": "合并图像",
      "Merge (Video)": "合并视频",
      "Point Cloud": "点云",
      Segmentation: "分割",
      "Spatial Mask Guide": "空间遮罩引导",
      "Spatial Prompt Synthesis": "空间提示词合成",
      "Speech to Text": "语音转文本",
      "Text Segment": "文本分段",
      "Transform (Image)": "图像变换",
      "Transform (Video)": "视频变换",
      "Bake Textures": "烘焙纹理",
      "UV Unwrap": "UV 展开",
      Remesh: "重构网格",
      Simplify: "简化网格",
      "Recompute Normals": "重算法线",
      "Fill Holes": "填补孔洞",
      "UV unwrap": "UV 展开",
      "Recompute normals": "重算法线",
      "Fill holes": "填补孔洞",
      "Weld edges": "焊接边",
      Deck: "卡组",
      "Retarget Animation": "重定向动画",
      "Weld Edges": "焊接边",
      Solidify: "实体化",
      "Console Log": "控制台日志",
      Convert: "转换",
      "Create Static Mesh Asset": "创建静态网格体资产",
      "ICP Align": "ICP 对齐",
      "MCP Tool": "MCP 工具",
      "Point Correspondence Pose Fit": "通过对应点拟合姿态",
      "Projected World Transform At": "指定位置的投影世界变换",
      "Set Camera": "设置摄像机",
      "Simple Align": "简单对齐",
      "Spawn Cutout At": "在指定位置生成剪影",
      "Spawn Mesh At": "在指定位置生成网格",
      Tasks: "任务",
      Choice: "选项",
      Select: "选择",
      Switch: "切换",
      "Append Bundles": "追加数据束",
      Bundle: "数据束",
      "Canvas Input": "画布输入",
      "Canvas Output": "画布输出",
      "Image Viewer": "图像查看器",
      "Mesh Viewer": "网格查看器",
      "Panorama Viewer": "全景查看器",
      "Video Viewer": "视频查看器",
      Boolean: "布尔值",
      Constant: "常量",
      Float: "浮点数",
      Integer: "整数",
      String: "字符串",
      "Vector 2": "二维向量",
      "Vector 3": "三维向量"
    }
  },
  {
    selector: ".graph-node-header-actions,.graph-node-header-actions .node-header-btn",
    fields: [
      "title",
      "aria-label"
    ],
    entries: {
      "Node actions": "节点操作",
      "Run this node": "运行此节点"
    }
  },
  {
    selector: '[data-frame-layout-controls] button,[data-frame-drag-handle],[data-frame-ui] :is(button,input,[role="img"]),[data-merlin-frame-grip],[data-frame-ui] [title]',
    fields: [
      "title",
      "aria-label"
    ],
    entries: {
      "Structured Layout": "结构化布局",
      "Structured Layout options": "结构化布局选项",
      "#58:142b5f26a9cfdc3c": "启用结构化布局后可调整这些选项。",
      "#38:16751dc57760be27": "点击改用自由布局。",
      "Enable Structured Layout": "启用结构化布局",
      "Frame color": "框架颜色",
      "Frame name": "框架名称",
      "Remove frame, keep cards": "移除框架并保留卡片",
      "#45:2e437212e98716b7": "拖动边缘调节大小，双击适配内容。",
      "#78:e6416cfd5129fbf5": "拖动移动框架。双击栏头适配面板，双击名称改名。",
      "#47:12a08cc339f00d47": "拖动移动框架，双击栏头适配面板。",
      Filtered: "已筛选"
    }
  },
  {
    selector: '[data-frame-ui][role="dialog"],[data-frame-ui][role="dialog"] :is(span,div,input,button)',
    fields: [
      "aria-label",
      "title",
      "text"
    ],
    entries: {
      "Structured Layout options": "结构化布局选项",
      "Card scale": "卡片缩放",
      "Card scale (%)": "卡片缩放比例 (%)",
      Spacing: "间距",
      "#48:fb9c64021123b941": "拉宽框架可在一行放下更多列。",
      "#181:91cd8bb630c35158": "按横向分区组织卡片。拖入卡片可调整归属，双击区名可改名。添加分区时会开启结构化布局。",
      "Add section": "添加分区"
    }
  },
  {
    selector: ".pill-menu:not(:has(.merlin-panel-search)) :is(.pill-menu-item,.feature-hint-menu-label,.ue-menu-label)",
    fields: [
      "text",
      "title"
    ],
    entries: {
      Organise: "整理",
      "Add Frame Section": "添加框架分区",
      "Collapse To": "折叠为",
      "Lock Frame": "锁定框架",
      "Unlock Frame": "解锁框架",
      "Delete Frame": "删除框架",
      "#107:c1a67da67d4860c1": "解锁后才可删除框架、切换布局或编辑分区。",
      "#61:bb6a9a2847ff47dc": "请先启用此框架的结构化布局。"
    }
  },
  {
    selector: '.frame-color-picker,.frame-color-picker :is(button,input,[role="slider"],.frame-color-label,label,span)',
    fields: [
      "text",
      "title",
      "aria-label"
    ],
    entries: {
      "Frame color": "框架颜色",
      "Hue and saturation": "色相与饱和度",
      Saturation: "饱和度",
      Value: "明度",
      Hex: "十六进制",
      "Hex color": "十六进制颜色",
      Suggested: "推荐颜色",
      Reset: "重置",
      Cancel: "取消",
      OK: "确定"
    }
  }
];

// src/locales/shelf-actions.json
var shelf_actions_default = [
  {
    selector: ".generation-shelf-well,.generation-shelf-well [aria-label],.generation-shelf-well [title],.generation-shelf-batch-popover,.generation-shelf-batch-popover [title],.generation-shelf-batch-popover [aria-label],.generation-shelf-prompt-tool,.generation-shelf-prompt-resize,.generation-shelf-generate-options,.generation-shelf-menu,.attached-agent-sleep,.generation-shelf-fold-handle",
    fields: [
      "title",
      "aria-label"
    ],
    entries: {
      Inputs: "输入",
      "Batch inputs": "批量输入",
      "Fold batch": "折叠批量输入",
      "Close batch": "关闭批量输入",
      "#39:520bd37358d31e86": "收起批量输入并保留已有卡片",
      "#69:c8bd530c090e0c9a": "将批量输入叠放，点击可展开",
      "#46:1daabbb1bb22a99b": "清空输入素材，保留提示词与参数",
      "#46:f5f7ed64f07ab940": "从画布或本机文件添加到批量列表",
      "#78:34203ecb1bb2033f": "点击选择卡片，也可直接拖入卡片或文件。",
      "#83:edeb802f5afadb0c": "可继续点选卡片或拖入更多卡片与文件。",
      "Remove from the batch": "从批量输入中移除",
      "#37:7cc784336c9cdf0f": "拖到“输入”栏即可用于每次运行。",
      "Move back to inputs": "移回输入",
      "Remove input entirely": "彻底移除此输入",
      "Collapse prompt": "收起提示词",
      "Resize prompt": "调整提示词框大小",
      "#37:0d245becce74e7e4": "可用拖动或方向键改变尺寸。",
      "#32:ac7b3f3d77ad8bf6": "把结果送回相应输入所在的卡组",
      "Output: Agent Chooses": "输出目标由智能体选择",
      "Work on my own (Zzz)": "独立工作（Zzz）"
    }
  },
  {
    selector: ".generation-shelf-well-title,.generation-shelf-batch-popover > header > strong,.generation-shelf-batch-popover > p,.generation-shelf-batch-popover .generation-shelf-batch-member button,.generation-shelf-reference-sub,.generation-shelf-generate-label",
    fields: [
      "text"
    ],
    entries: {
      Batch: "批量",
      "Batch inputs": "批量输入",
      "#51:2e040e42ffe6e51a": "每项输入单独运行一次。将某项移出批量区即可供所有轮次共用。",
      "#52:dd1b4898f52a1128": "拖入备选素材，每一轮使用其中一项。",
      "#34:5ba3e3c90b7c7084": "点击折叠批量列表。",
      "#29:a69297086cb8ce29": "点击展开批量列表。",
      "Queue tool use": "将工具加入队列",
      "Send to agent": "发送给智能体"
    }
  },
  {
    selector: "[data-add-reference-popover] > div:first-child :is(input,button),[data-add-reference-popover] > div:nth-child(2):not(:has(*)),[data-add-reference-popover] > div:last-child > button:is(.pill-menu-item,.ue-menu-item)",
    fields: [
      "text",
      "aria-label",
      "title",
      "placeholder"
    ],
    entries: {
      "Search canvas": "搜索画布",
      "Search canvas...": "搜索画布…",
      "Search canvas…": "搜索画布…",
      Close: "关闭",
      "No matching canvas elements": "没有匹配的画布元素",
      "From file...": "从文件选择…",
      "From file…": "从文件选择…",
      "Use selected": "使用所选内容",
      "Paste copied node": "粘贴已复制的节点",
      "Paste copied card": "粘贴已复制的卡片"
    }
  },
  {
    selector: ".feature-hint-card,.feature-hint-card > p,.feature-hint-heading > strong,.feature-hint-heading > button,.feature-hint-dismiss",
    fields: [
      "text",
      "title",
      "aria-label"
    ],
    entries: {
      "Voice shortcut": "语音快捷键",
      "Close hint": "关闭提示",
      "Don’t show again": "不再显示",
      Press: "按下",
      "#86:7ace28ce42cbdf31": "在此输入或去画布中打开语音聊天。按住 Ctrl 说话。",
      "#76:2266eb52bd1504ef": "可在这里听写，也可在画布上打开语音聊天。再次按键即可停止。"
    }
  },
  {
    selector: '.generation-shelf-menu[role="menu"]:is([aria-label="Agent"],[aria-label="智能体"]) .generation-shelf-menu-row > button[role="menuitemradio"]:is([aria-label="Work on my own"],[aria-label="独立工作"],[aria-label="Choose agent"],[aria-label="选择智能体"]) > .generation-shelf-menu-copy > span,.generation-shelf-menu[role="menu"]:is([aria-label="Agent"],[aria-label="智能体"]) .generation-shelf-menu[role="menu"] button[role="menuitem"] > .generation-shelf-menu-copy > span',
    fields: ["text"],
    entries: {
      "Work on my own": "独立工作",
      "Work with an agent": "与智能体协作",
      "+ New agent": "+ 新建智能体",
      "Reopen agent…": "重新打开智能体…"
    }
  },
  {
    selector: '.generation-shelf-menu[role="menu"]:is([aria-label="Agent"],[aria-label="智能体"]) button.generation-shelf-menu-option',
    fields: ["aria-label"],
    entries: {
      "Work on my own": "独立工作",
      "Choose agent": "选择智能体",
      "New agent": "新建智能体",
      "Reopen agent": "重新打开智能体"
    }
  },
  {
    selector: '[role="tooltip"] > div > div,.generation-shelf-menu .ue-menu-label,.generation-shelf-menu .ue-menu-detail,.shelf-collaborator-menu .ue-menu-detail',
    fields: [
      "text"
    ],
    entries: {
      "Working on your own": "正在独立工作",
      "#42:c0f0bfade2682dd4": "用当前模型直接生成结果。",
      "#41:d40ae7ce607268f2": "使用所选模型直接生成",
      "#28:2d2f684474c39b78": "选择配合工作的智能体",
      "Work on my own": "独立工作",
      "Work with an agent": "与智能体协作",
      "Choose an agent to help": "选择一个智能体帮忙",
      "#57:13503ee6df5fc76a": "可更换协作智能体。点击 Zzz 进入独立工作模式。",
      "Click to hide the settings": "点击收起设置",
      "Click to change them": "点击修改设置",
      "#29:f1c20ef6e631f454": "查看脚本的高级输入选项。",
      "Click to hide them": "点击收起高级输入",
      "Click to show them": "点击显示高级输入",
      "Choose where results land": "选择结果的输出位置",
      "#53:12c7d4de0a551edc": "按当前的输入和参数运行选中的工具。",
      "#31:90f3cf1a5cd581bc": "已从本次输入中移除。",
      "Linked text in the prompt": "提示词中关联的文本",
      "Agent context": "智能体上下文",
      "#51:1912af4dff07682a": "查看器打开时将采用该项已有的批注。",
      "#54:5ada1addbf0016dd": "拖动改变顺序，键盘可用 Alt 加左右方向键。",
      "#37:b04d6f31170506c0": "按空格加入批量列表。",
      "#103:4add066cc3cfa350": "各轮共用这些输入。选中的卡片会列在这里，可拖动排序。固定后取消选择仍会保留。",
      "#137:b62199315cc2826c": "这里的输入供各轮共用。可固定、拖动排序，也可移到批量区逐轮替换。"
    }
  },
  {
    selector: ".generation-shelf-status,.generation-shelf-status span,.generation-shelf-generate,.generation-shelf-generate-label",
    fields: [
      "text",
      "title",
      "aria-label"
    ],
    entries: {
      "#56:6140979b3984a826": "先选一个可用卡组，或创建卡片。",
      "#56:1c917c1eb0bc1d0f": "先选一个可用卡组，也可以新建。",
      "#59:3109947305f50698": "以前选择的智能体模型目前不可用，请重新选取。",
      "Loading models…": "正在加载模型…",
      "#31:4178cc13dc950b88": "先打开一个画布，再使用智能体。",
      "Loading chat history…": "正在加载聊天记录…",
      "#59:e0e8be96428b153b": "原卡组已不存在，请新建卡片。",
      "#75:9f972f9be03aefa0": "脚本的输出类型与当前卡片不匹配，请新建卡片。",
      "#64:c402324af5e7d9b0": "编辑目标已被移除，请先创建卡片。",
      "#73:38f1b95614cac589": "工具的输出类型与当前卡片不匹配，请新建卡片。"
    }
  },
  {
    selector: '.merlin-toolbar-zoom,.canvas-tool-palette,.generation-shelf-fields [role="textbox"],.agents-panel-empty',
    fields: [
      "title",
      "aria-label",
      "text"
    ],
    entries: {
      "Double-click for 100%": "双击恢复到 100%",
      "Canvas toolbar": "画布工具栏",
      "System Prompt": "系统提示词",
      "#69:d9b91fbb06637ae3": "聊天记录写入失败，请检查服务器连接。"
    }
  }
];

// src/locales/panel-actions-022.json
var panel_actions_022_default = [
  {
    selector: "[role=listbox]:is([aria-label='Model for your first chat'],[aria-label='首次对话使用的模型'])",
    fields: [
      "aria-label"
    ],
    entries: {
      "Model for your first chat": "首次对话使用的模型"
    }
  },
  {
    selector: ".agent-onboarding-card p,.agent-onboarding-content > p,.agent-onboarding-content details > p,.agent-onboarding-guidance > p,.agent-onboarding-guidance button",
    fields: [
      "text"
    ],
    entries: {
      "#104:dbaa865c5c9b1e6c": "沿用本机 CLI 的登录、连接及组织设置。",
      "Open setup guide ↗": "打开设置指南 ↗",
      "#50:02405a495af52c1b": "请运行 Codex CLI 并登录。",
      "#56:394e7ecb9d45b33f": "请运行 Claude Code 并登录。",
      "#44:6f11cbe8f85808a5": "请先在本机安装 Claude Code。",
      "#38:fb65a56a36a13121": "本机尚未安装 Codex CLI。",
      "#87:6fb756462f5fccdf": "按指南安装 Claude Code，再登录现有账户。",
      "#81:62706d6bbff140b3": "按指南安装 Codex CLI，再登录现有账户。",
      "run: codex login": "运行 codex login",
      "start claude and type /login": "启动 claude 后输入 /login",
      "#279:1c63e1a2897142bb": "加载 Claude Code 的用户设置、钩子、规则、插件、技能、命令和 CLAUDE.md，也加载用户级和插件提供的 MCP 服务。文件与终端工具限于 Claude 工作目录。",
      "#185:f28bd7ed8c6d06c8": "沿用 Claude Code 的账号与连接，在 Canvas 内使用专用设置和工具。工作目录的记忆仍可能生效。",
      "#110:7c6eb6384c07c37c": "载入 Codex 的本机配置，包括 MCP、插件、钩子、规则、记忆、AGENTS.md 和技能。",
      "#202:287e3fcf7e61a0de": "只沿用 Codex 登录与模型设置，其他本地扩展和记忆不会载入。仅存在系统密钥环中的凭据不可沿用。"
    }
  },
  {
    selector: "button.agent-onboarding-select > span > span,[role=listbox]:is([aria-label='Chat context'],[aria-label='对话上下文']) [role=option]:is([data-value=personal],[data-value=clean]) > span",
    fields: [
      "text"
    ],
    entries: {
      "Personal configuration": "个人配置",
      "Clean context": "空白上下文"
    }
  },
  {
    selector: ".merlin-navigator-tree-actions button,.outliner-header-cell,.outliner-header-cell > span,.outliner-body,.media-library .merlin-panel-search input,.merlin-panel-settings-menu,.merlin-panel-settings-menu .ue-menu-label",
    fields: [
      "text",
      "title",
      "aria-label",
      "placeholder"
    ],
    entries: {
      "Search all items": "搜索所有项目",
      "All items": "所有项目",
      "Tree options": "树视图选项",
      "Expand all": "全部展开",
      "Collapse all": "全部折叠",
      "Sort by name": "按名称排序",
      "Sort by type": "按类型排序",
      "Sort by model": "按模型排序",
      Name: "名称",
      Type: "类型",
      Model: "模型"
    }
  },
  {
    selector: ".merlin-panel-chip > button,.merlin-panel-search-clear",
    fields: [
      "title",
      "aria-label"
    ],
    entries: {
      "Remove filter": "移除筛选条件"
    }
  },
  {
    selector: ".merlin-script-side-locked > span,.merlin-script-side-duplicate,.merlin-script-form-add,.merlin-script-form-grip,.merlin-script-form-dot,.merlin-script-form-star,.merlin-script-form-remove,.merlin-graph-inspector .merlin-script-form-none",
    fields: [
      "text",
      "title",
      "aria-label"
    ],
    entries: {
      "#117:49284a0412574c0f": "内置节点图需先复制到工具箱，再修改副本。",
      "Edit a Copy": "编辑副本",
      Required: "必填",
      "#33:7e254ee25a72b6c7": "当前为必填，点击切换为可选。",
      Optional: "可选",
      "#33:e194ce253c950e11": "当前为可选，点击切换为必填。",
      "#38:5df040d56be75238": "所选模型运行时必须提供此输入。",
      "Primary output": "主要输出",
      "Mark as primary output": "设为主要输出",
      "#31:8611e1a1ddcb1a15": "拖动排序，或使用 Alt+↑/↓。",
      "#57:fb39e91b1f8494f2": "已定义接口。拖入节点图即可放置实例。",
      Remove: "移除"
    }
  },
  {
    selector: "[role=dialog]:is([aria-label='Unsaved changes'],[aria-label='未保存的更改']),[role=dialog]:is([aria-label='Unsaved changes'],[aria-label='未保存的更改']) :is(div,button)",
    fields: [
      "text",
      "aria-label"
    ],
    entries: {
      "Unsaved changes": "未保存的更改",
      "#61:e33504c211954ec3": "节点图尚未保存。可另存副本或放弃此次修改。",
      Discard: "放弃更改",
      "Save a Copy": "另存为副本",
      "Save a copy": "另存为副本",
      "Save and close": "保存并关闭"
    }
  },
  {
    selector: "[role=dialog]:is([aria-label='Custom Filter' i],[aria-label='自定义筛选']) input,.media-library-filter-trigger,.merlin-scripts-section .merlin-panel-chip",
    fields: [
      "title",
      "placeholder",
      "aria-label"
    ],
    entries: {
      "contains…": "包含…",
      Starred: "已加星标",
      "#20:7ffd20a3f486ab70": "仅查看收藏的脚本",
      "Remove filter": "移除筛选条件"
    }
  },
  {
    selector: ".merlin-rail-body-content:has(.merlin-scripts) > .ue-menu[data-portal-popup] > div > .ue-menu-item > .ue-menu-label",
    fields: [
      "text"
    ],
    entries: {
      "New folder": "新建文件夹",
      "Export all scripts…": "导出所有脚本…",
      "Refresh library": "刷新资源库"
    }
  }
];

// src/locales/settings-actions-022.json
var settings_actions_022_default = [
  {
    selector: ".provider-onboarding, .provider-onboarding :is(h2,h3,p,button,input,label,small), .provider-onboarding .provider-onboarding-progress span, .provider-onboarding-notice, .provider-onboarding-custom strong",
    fields: [
      "text",
      "aria-label",
      "placeholder",
      "title"
    ],
    entries: {
      "Generation provider setup": "生成服务商设置",
      "/ Add provider": "/ 添加服务商",
      "/ Custom provider": "/ 自定义服务商",
      "Choose your provider": "选择服务商",
      "#57:c87ec1f41dd3a1ec": "选择已集成的服务商以添加模型。",
      "Included providers": "内置服务商",
      "Use your own API key": "使用自己的 API 密钥",
      "Add custom provider": "添加自定义服务商",
      "#44:c1b66cf7c056b627": "查看其他服务的接入方法",
      "Loading providers…": "正在加载服务商…",
      "#36:f9ccacdaabff9462": "服务商目录载入失败。",
      "Try again": "重试",
      "Provider unavailable": "服务商不可用",
      "Loading the provider catalog…": "正在加载服务商目录…",
      "#84:3330e0a81ba92e0d": "找不到此集成，请检查目录或添加自定义服务商。",
      "Choose a provider": "选择服务商",
      "#49:1eb317cf6b864fcb": "填写此服务商为账号提供的凭据。",
      "Get an API key ↗": "获取 API 密钥 ↗",
      "API ID": "API 标识",
      "API secret": "API 密钥",
      "API key": "API 密钥",
      "Your Scenario API ID": "输入 Scenario API 标识",
      "Your Scenario API secret": "输入 Scenario API 密钥",
      "Paste your API key": "粘贴 API 密钥",
      "Show credentials": "显示凭据",
      "Hide credentials": "隐藏凭据",
      "Save and check connection": "保存并检查连接",
      "Save and continue": "保存并继续",
      "#70:bf1644f2f2e9f3e5": "验证所选账号的连接，不执行生成。",
      "#108:15098d7edbd7921a": "此服务不提供账号探测，首次生成时会验证已保存的密钥。",
      "#52:e570fa5fd097368b": "下列目录中有自定义服务商示例。",
      "Open schema examples folder": "打开定义示例文件夹",
      "Get help with the integration": "获取接入帮助",
      "Provider name": "服务商名称",
      "API documentation (optional)": "API 文档（可选）",
      "Documentation URL or reference": "文档网址或参考资料",
      "Setup Agents": "配置智能体",
      "Ask an agent for help": "向智能体求助",
      "#82:8a1a21977fe2f446": "即将打开智能体设置，返回时会保留已填资料。",
      "#87:917d170e0360aee1": "根据已填内容起草求助消息。密钥请写入专用凭据字段。",
      "#19:3c7b2d4af263fc0e": "已完成连接检查。",
      "#20:cf6a97a7263df756": "服务商已设置。",
      "#106:da964cf8b6a25849": "已保存凭据。此服务不提供账号探测，需通过后续请求验证密钥。",
      "#132:c651438af8171f59": "个模型定义可用。实际权限和生成能力仍待验证，工程限制继续生效。",
      "Return to canvas": "返回画布",
      "Set up another provider": "设置其他服务商",
      Connection: "连接",
      "Provider connection": "服务商连接",
      "#35:8d462fe86a118227": "可使用已有凭据",
      "#51:344a47ebc4b31cfe": "。可沿用已有值，或在下方替换。",
      "#42:bb77960db073936d": "留空沿用当前凭据",
      "Checking…": "正在检查…",
      "#91:3f8f6061316adebc": "身份验证信息载入失败，请返回刷新目录。",
      "#49:344544fa9b913270": "填写服务商名称后再向智能体求助。",
      "#39:8ca052eaf327aa6c": "请先打开画布再联系智能体。",
      "#58:238b1e0bc0c169e9": "请等待画布打开后重试。"
    }
  },
  {
    selector: '.credentials-section [role="dialog"], .credentials-section [role="dialog"] > h3',
    fields: [
      "aria-label",
      "text"
    ],
    entries: {
      "Set Anthropic API key": "设置 Anthropic API 密钥",
      "#30:b71add4e9566e15d": "配置 Luma Dream Machine 的 API 密钥",
      "Set fal.ai API key": "设置 fal.ai API 密钥",
      "Set Figma personal access token": "设置 Figma 个人访问令牌",
      "Set Luma Agents API key": "设置 Luma Agents API 密钥",
      "Set Scenario API id:secret": "设置 Scenario API 凭据（id:secret）",
      "Set World Labs API Key": "设置 World Labs API 密钥"
    }
  },
  {
    selector: '.settings-window-body main [role="dialog"]:has(> div > h3), .settings-window-body main [role="dialog"]:has(> div > h3) :is(h3,button,label)',
    fields: [
      "text",
      "aria-label"
    ],
    entries: {
      "Add media schema": "添加媒体定义",
      "Add service schema": "添加服务定义",
      Add: "添加",
      media: "媒体",
      service: "服务",
      schema: "定义",
      "Paste JSON": "粘贴 JSON",
      "Import file": "导入文件",
      "Ask agent": "询问智能体",
      "Schema JSON": "定义 JSON",
      Validate: "验证",
      "Documentation URL or pasted text": "文档网址或粘贴的内容"
    }
  },
  {
    selector: ".settings-window-body main .settings-group-body input",
    fields: [
      "placeholder"
    ],
    entries: {
      "Field label…": "字段名称…",
      "Options, comma-separated…": "选项之间用英文逗号分隔…"
    }
  },
  {
    selector: ".settings-window-body main .settings-group-body div:has(> div > input[autofocus]) button, .settings-window-body main .settings-group-body div:has(> div > input[placeholder]) > div > button",
    fields: [
      "text"
    ],
    entries: {
      cancel: "取消",
      "Add field": "添加字段"
    }
  },
  {
    selector: '.settings-window-body main .settings-group-body div:has(> input[placeholder]) > span :is(button[role="combobox"] span,[role="option"] span)',
    fields: [
      "text"
    ],
    entries: {
      text: "文本",
      number: "数字",
      boolean: "布尔值",
      enum: "单选枚举",
      multi_enum: "多选枚举",
      date: "日期",
      url: "网址"
    }
  },
  {
    selector: '.settings-window-body [role="listbox"] [role="option"] span',
    fields: [
      "text"
    ],
    entries: {
      "#44:cffc8bac016c906f": "Base（默认），速度优先、内存需求低",
      "#42:cb34e27a55a5f00b": "Small，兼顾准确度与内存",
      "#51:c14a2f8d7af6687b": "Large v3 Turbo，多语言精度较高，需更多内存",
      "#49:95b5402458258670": "Distil Large v3.5，针对英语，需更多内存",
      "Listen while Ctrl is held": "按住 Ctrl 时录音",
      "Listen until stopped": "持续录音直至手动停止"
    }
  },
  {
    selector: '.nodrag.nowheel[role="dialog"], .nodrag.nowheel[role="dialog"] .ue-menu-heading, .nodrag.nowheel[role="dialog"] .ue-menu-item[role="switch"], .nodrag.nowheel[role="dialog"] .ue-menu-item[role="switch"] .ue-menu-label',
    fields: [
      "text",
      "title",
      "aria-label"
    ],
    entries: {
      "Model filters": "模型筛选",
      "Filter by": "筛选条件",
      "#52:fcb443d9393e3f41": "仅查看本机配置支持的模型",
      "Runnable only": "仅显示可运行模型"
    }
  },
  {
    selector: '.settings-nav, .settings-window-body nav, .settings-window-body [role="navigation"]',
    fields: [
      "aria-label"
    ],
    entries: {
      "Settings categories": "设置分类"
    }
  },
  {
    selector: '.settings-window-body [role="tabpanel"] div',
    fields: [
      "text"
    ],
    entries: {
      "#57:818f267f1db4b0b6": "随应用安装，现已可用。",
      "#28:ebebb36e87db7962": "开发目录中的扩展会持续启用。"
    }
  },
  {
    selector: ".settings-window-body main div:has(> div > ul[aria-label]) :is(div,button):not(.merlin-chat-md *), .settings-window-body main div:has(> div > ul[aria-label]) .merlin-chat-md strong",
    fields: [
      "text"
    ],
    entries: {
      "#32:3a286f082ba12dc1": "每个扩展使用独立文件夹，其中含有",
      "#64:ae848e83eaa05dea": "。向智能体说明用途，即可创建扩展。可实现下列功能。",
      Panels: "面板",
      "#386:a7a7e7ba1ee18d69": "创建停靠、浮动或占满窗口的自定义面板。面板可操作画布、选区和媒体库，运行卡片、监听变更、保存数据及访问指定服务。",
      "Commands in menus": "菜单命令",
      "#274:3085be34b5d390f1": "可把命令放到工具栏、创建菜单和上下文菜单，处理选择、放置卡片、打开面板或执行工具与 Python。",
      Cards: "卡片",
      "#205:8cfff60d6e7ac030": "扩展可随附脚本和节点图，并从菜单插入卡片。从现有卡片调用时，新卡片会放在旁边并接收原卡片作为输入。",
      "Media tools": "媒体工具",
      "#486:cb6036d8d6f2746e": "扩展可提供图像编辑器、预览或仅显示叠加层。确认效果后保留原图，可重复应用或移除。渲染可在面板或 Python 中完成。",
      Viewers: "查看器",
      "#151:f2c3dcd91edbd35a": "为指定格式注册自定义预览，例如将 CSV 显示为表格。其他位置显示图标与文件名。",
      Overlays: "叠加层",
      "#153:59257306e5d38a0a": "给查看器增加可切换的参考线，保留下层图像的缩放和平移。",
      "External editors": "外部编辑器",
      "#267:6eb97d26c261a705": "将本机图像或网格编辑工具加入卡片的「发送到」菜单。先在外部路径选择程序，保存结果后即可返回画布。",
      "Python actions": "Python 操作",
      "#68:57061c53873d3b01": "命令可在本机 Python 会话执行，并使用其中的",
      "#173:49688f49458a8989": "模块操作卡片或调用工具。可在执行面板查看此扩展的输出和错误。",
      "Tools for agents": "智能体工具",
      "#167:83848b8cc942087c": "向 Canvas 内外的 MCP 客户端提供自定义工具，由 Python 或扩展面板处理。在 Python 中通过以下接口访问：",
      "#68:345bd976059b8475": "。工具执行生成仍需本次智能体调用具备相应权限。",
      Layouts: "布局",
      "#268:1238b60a110a0578": "可描述停靠区、开启的面板及宽度。当前支持读取和检查布局，尚无菜单可切换布局。",
      Workspaces: "工作区",
      "#224:e5e46d6bdb8d05c7": "将预设框架、规则和外观做成可插入的子画布。移除扩展后，已放置的副本会保留。",
      "#164:51d4fe4bb4aaba9d": "在扩展设置页声明文本、数字、开关或列表。面板接收实时变更（",
      "#31:3c52a105416d8610": "），Python 可使用以下接口读取：",
      "Scripts and graphs": "脚本和节点图",
      "#142:b24dbf9df5c4e8d2": "扩展启用后，其脚本、子脚本和节点图可从工具箱使用。标记为工具架项的内容也会显示在工具架。",
      "Skills and help": "技能与帮助",
      "#102:4dd31c96059630c0": "为画布或对话提供可选技能，并附带可供助手查询的帮助文档。",
      "#95:fe8849c388bb0807": "新草稿附带选中卡片列表面板及面向智能体的说明（",
      "#86:2f8535a82d4b0f2b": "）。给草稿命名，复制提示词，并告诉智能体要实现哪些功能。",
      "#48:6dc8378f6422234c": "查看智能体扩展编写指南"
    }
  },
  {
    selector: ".settings-window-body main div:has(> div > ul[aria-label]) button[aria-expanded]",
    fields: [
      "text"
    ],
    entries: {
      "Hide the guide": "收起指南"
    }
  },
  {
    selector: ".settings-window-body main div:has(> div > ul[aria-label]) .merlin-chat-md :is(p,li,h1,h2,h3,strong,em,a)",
    fields: [
      "text"
    ],
    entries: {
      "#32:8fc00e9eef2925a9": "让智能体编写扩展",
      "#264:9f93d710c2fb1a2f": "用文字描述需要的面板、命令、工具或技能。智能体可编写并保存扩展，保存后即可在应用中查看效果。",
      "What an extension can do": "扩展可以做什么",
      "#719:4394a540c0bee984": "自定义面板可读取选区、浏览媒体库、导入与整理素材，调整卡片并监听运行结果。编辑操作支持撤销并遵循画布只读状态；产生费用的操作需确认。也可保存面板数据和调用指定服务。",
      "#272:2917a31c43accaf6": "在工具栏或画布菜单注册命令，可针对当前选择打开面板、插入卡片或调用工具。",
      "#613:59af838483147c20": "将自定义编辑控件和预览集成到查看器。原图保留，结果可存为前后对照、更新卡组或作为图内新版本。可使用页面或 Python 渲染图像、视频帧及叠加图层。",
      "#162:6b00ee881c4e657f": "为新文件类型提供预览，例如以表格显示 CSV。",
      "#230:bea95bc15853d457": "给可缩放的图像叠加参考线。UE 的原生实时画面会覆盖网页叠加层。",
      "#297:b93639c1313e5aaa": "从菜单插入扩展的脚本或节点图。对卡片操作会在旁边新建并连接输入，在空白处操作则使用点击的位置。",
      "#76:5841fc316b0ce361": "命令在本机的 Python 环境运行，可访问相同的",
      "#36:d2e2a1578f3f5b6d": "模块。交互式 Python 会话位于以下面板：",
      "#105:1969c17030d7e971": "底部面板会记录输出和错误。此类命令不发起付费生成。",
      "#246:4e95473e745242e1": "工具可供内置或外部智能体调用。Python 或后台面板可响应请求，生成操作受调用方权限约束。",
      "#164:f9d9df689aeec2c1": "可给扩展添加设置页。面板会接收变更，Python 也能读取设置值。",
      "#100:81807dd5078863e7": "启用扩展后即可在库中找到其 Python 脚本、子脚本和节点图。",
      "#61:f416690d893e7142": "可打包智能体工作指引与帮助文档。",
      "#54:394905a8c22a9857": "会列入扩展设置页，可在开始使用前查看。",
      "#243:3e81ca08403c4355": "自定义卡片类型和本地服务可通过插件 API 实现，已审核的插件可从目录安装。编写插件用的 TypeScript 类型随服务端提供，位于",
      "#34:8f4027f7b67b0255": "目录（",
      "): its": "）。其中的",
      "#123:6b11a2d55f712227": "提供插件开发说明。需要较新宿主功能的插件可能无法加载，详情见",
      "Settings ▸ Extensions": "设置 ▸ 扩展",
      "#20:8d282db152a29ee1": "中可以查到使用条件。",
      Start: "开始",
      "and press": "，然后点击",
      "#65:c830b3bcd6389a90": "。查看可添加的项目，填好扩展名称后选择",
      "#121:c094f89bad0b6547": "。草稿会生成侧栏面板来显示所选卡片，并提供智能体说明文件（",
      ", and": "，以及",
      "#17:780ad36c28b685c0": "供 Claude Code 读取）。",
      Press: "在提示中点击",
      "Copy agent prompt": "复制智能体提示词",
      "#120:9a6245bf06ded68f": "。展开草稿也能复制提示词，其中附有草稿的路径。",
      "#397:3f376a3ad039b11d": "在应用内打开智能体，或从草稿目录运行已连接 Canvas MCP 的智能体。粘贴提示词并写明要做的功能。应用内智能体还可以创建草稿、修改文件并检查面板报错。",
      "#109:e405ed7ca78c4acc": "面板随文件保存自动刷新。根据实际显示效果提出下一项修改。",
      "What to tell the agent": "如何向智能体描述需求",
      "#54:e6c5331e85a6dfa8": "描述需求时，建议写清下面几项。",
      "#52:0651e668a97a7f90": "这个面板要解决什么问题，通常怎么操作。",
      "#136:352bfe631f459fa4": "期望的停靠位置或窗口形式。选择右侧栏的面板起初可能显示在左侧。",
      "#163:e0b0280ebe848e60": "指定菜单入口和触发条件，例如空白处右键，或选定某类卡片后打开。",
      "#80:e4ba86d92dad2ea4": "需要访问的数据范围，例如选中的卡片、相关文件或媒体库。",
      "#72:0d1f7c4d7c5d5502": "用户触发操作后应发生什么，例如添加图片、记住选项或打开网页。",
      "#41:e0b71010f24ed970": "如需联网，请给出服务的名称与地址。",
      "#108:645807c41c736c0b": "若要打包自己的脚本或节点图，先在应用中做好，再让智能体加入扩展（",
      "Export script": "导出脚本",
      and: "和",
      "Export as JSON…": "导出为 JSON…",
      "#47:d262b2882489f805": "文件可通过这两个工具箱命令导出）。",
      "#36:8e0cba0826d503ec": "有指定的布局、颜色或风格时也可以说明。",
      "For example:": "示例",
      "Build an extension in": "请在以下文件夹制作一个扩展：",
      "#6:a1e32bdcf172cb97": "。请先查看该文件夹内的",
      "#178:716b832ebd68a4e3": "。请把选中的图片和各自的卡片名排成一张预览图，在右侧栏提供将它放回画布的按钮。",
      "#131:838a8c007c1aeecf": "。我希望能在面板内搜索媒体库，将结果拖进清单，关闭后再打开仍能看到清单。",
      "#23:cf223cbdc477e7b2": "常见故障",
      "#25:b42da05021d067cf": "找不到扩展面板",
      "#105:cc7c1aecd24ba298": "。到“设置 → 扩展”展开该条目，把显示的原因交给智能体排查。",
      "#43:09bae57887cc1656": "面板未显示内容或点击无效",
      "#214:5375eefc304916bf": "。让智能体查看面板异常和调用失败记录。若它无法读取应用状态，可让它把错误直接显示在面板里。",
      "#17:e4585e4fb4907ddd": "遇到调用被拒绝的提示，例如",
      or: "或",
      "#59:8275a2ca598666f2": "，先核对智能体是否在",
      "#22:5c22a979384abdc4": "中登记了所需服务及地址，并把报错发给它。",
      "Share it": "分享扩展",
      "#46:5e9a76ef66dd2e83": "在扩展设置内展开这份草稿。",
      "#29:0d198c012744bc96": "分享 → 导出安装包",
      "#29:6daa5ddece7d2a7e": "可把包保存到下载文件夹，扩展名为",
      "#21:7443cdb66c7b8c85": "。接收方在下列入口安装：",
      "#39:056d0203f1f4208b": "安装 → 从压缩包或分享码安装",
      "#27:ab34d5da905e190d": "分享 → 生成分享码",
      "#62:5be63d33d3e7dc4b": "需要先配置项目的共享目录。生成的码形如",
      "#124:3b7d4cc981d2ae28": "。项目成员凭码安装。更新后再次分享即可沿用原码，接收方选择：",
      "#27:06dccf744118bdcc": "分享 → 加入目录…",
      "#176:7d4b32590aac4c8f": "能将扩展发布到已有目录，也能将指定文件夹设为新目录。团队成员添加同一来源后可在这里安装：",
      "#36:d0ac8d5b03567487": "。同一个版本在每个目录中只能发布一次。",
      "Publish…": "发布…",
      "#87:13f67e9115493205": "把扩展发布到指定 Git 仓库并创建版本标签。安装入口为",
      "#33:a122cdee9fb6b6e3": "安装 → 从 Git 仓库安装",
      "and get updates with": "，然后通过此按钮检查更新：",
      "#87:8371f5dd3e074739": "。会保留仓库已有的说明和许可证。下次发版前请提高",
      "#227:968475c81824f9ca": "内的版本号。工具架智能体会在发布前征求同意，外部 MCP 智能体会提示你在应用中确认。",
      "#47:8754622f7e96666e": "也可以将目录放到共享盘，再让接收方选择",
      "#25:e7a4d3bbf5eb2a4b": "安装 → 从文件夹安装",
      "Dotfiles such as": "以点开头的文件或目录，例如",
      "#26:479491c64510ca96": "，以上分发方式均会将其排除在包外。",
      "#166:e247b846b46e3058": "可以先审查扩展申请的权限再授权。安装说明见 extensions，开发文档见 extension-authoring。"
    }
  },
  {
    selector: ".settings-window-body main div:has(> button[title][aria-label]) > div > div",
    fields: [
      "text"
    ],
    entries: {
      "#148:2a2ea1f862978cd8": "从 Git 发行版安装。填写标签可固定版本，留空获取最新版。鉴权沿用本机 Git。",
      "#98:4fc452006c669495": "选择含 extension.json 的目录。更新会再次从该位置复制，支持共享盘。",
      "#43:8fe9506b620b9031": "使用压缩包或分享码安装",
      "#125:43dddef3f8fa381c": "请选择通过“分享”生成的 ZIP。当前项目还没有可供分享码使用的共享目录。",
      "#168:c4ebe7363b69bc81": "可选择“分享”导出的 ZIP，也可输入项目分享码。更新时仍从同一来源读取。"
    }
  },
  {
    selector: ".settings-window-body main :is(input,button,ul)",
    fields: [
      "aria-label",
      "placeholder"
    ],
    entries: {
      "Close Create your own extension": "关闭“创建自己的扩展”",
      "What an extension can add": "扩展可添加的内容",
      "Extension name": "扩展名称",
      "Extension id": "扩展标识",
      "#35:4e12c7583b4cd419": "收起 Git 安装窗口",
      "Repository URL": "仓库网址",
      "Release tag": "版本标签",
      "Tag (optional)": "标签（可选）",
      "Close Install from a folder": "关闭“从文件夹安装”",
      "Folder that holds extension.json": "包含 extension.json 的文件夹",
      "#49:7ce61789139b6755": "收起压缩包与分享码安装窗口",
      "Package file or share code": "安装包或分享码",
      "#33:e46b8bfdbba9599e": "选择 ZIP 安装包或填写分享码"
    }
  }
];

// src/locales/settings-preview2.json
var settings_preview2_default = [
  {
    selector: ".settings-nav button, .settings-nav button span, .settings-pane-header h2, .settings-window-body button, .settings-window-body strong",
    fields: [
      "text"
    ],
    entries: {
      "External paths": "外部路径",
      "Model providers": "模型服务商",
      "Model catalog": "模型目录",
      "Model schemas": "模型定义",
      "Default models": "默认模型",
      "Browse models…": "浏览模型…"
    }
  },
  {
    selector: ".settings-pane-header p, .settings-group > p",
    fields: [
      "text"
    ],
    entries: {
      "#197:58cd4e828deb672f": "指定 Canvas 使用的外部程序和 Python 工作进程。数据目录请在“存储”设置，工作流目录请在“偏好设置”中设置。",
      "#113:10bbcfe5b9451366": "配置模型服务商、登录和密钥。多条连接可共用同一凭据。",
      "#205:2c75ebc3d934fbcc": "查看模型的路由及状态。可用星标设为默认、固定到选择器、设置审批或删除自己添加的模型。",
      "#172:3a7140ef32669e8b": "在此为各类能力选默认模型，影响新建生成卡片与助手的首选项。也可在模型目录点击星标。",
      "#308:af7d8dc112180b3d": "管理本机扩展、插件和自建草稿。扩展可提供面板、命令、工具、脚本或技能。运行遵循授权设置，自建草稿内以插件加载的卡片类型与模型定义也需首次授权。"
    }
  },
  {
    selector: ".settings-row label, .settings-row label > span",
    fields: [
      "text"
    ],
    entries: {
      "Card header colors": "卡片标题栏颜色",
      "Zoom speed": "缩放速度",
      "Confirm before clearing annotations": "清除批注前要求确认",
      "Auto lock on wired outputs": "连接输出后自动锁定",
      "Graph in C2PA manifests": "在 C2PA 清单中附带节点图",
      "Graph & code script directories": "节点图与代码脚本目录",
      "Enable floating agent chat": "启用浮动智能体对话",
      "#34:d8e815b67f463421": "查看智能体任务及近期活动",
      "ComfyUI server URL": "ComfyUI 服务地址",
      "Local servers on this computer": "本机服务器",
      "New local server": "新建本地服务器",
      Kind: "类型",
      Address: "地址",
      Program: "启动程序",
      Arguments: "启动参数",
      Folder: "工作目录",
      "AI models root": "AI 模型根目录",
      "Depth estimation": "深度估计"
    }
  },
  {
    selector: '.settings-row .custom-select:is([data-value="gradient"],[data-value="solid"],[data-value="neutral"],[data-value="on"],[data-value="off"],[data-value="always"],[data-value="comfyui"],[data-value="model-server"]) span, .ue-menu-item[role=option]:is([data-value="gradient"],[data-value="solid"],[data-value="neutral"],[data-value="on"],[data-value="off"],[data-value="always"],[data-value="comfyui"],[data-value="model-server"]), .ue-menu-item[role=option]:is([data-value="gradient"],[data-value="solid"],[data-value="neutral"],[data-value="on"],[data-value="off"],[data-value="always"],[data-value="comfyui"],[data-value="model-server"]) span',
    fields: [
      "text"
    ],
    entries: {
      "Color gradient": "渐变色",
      "Solid color": "纯色",
      Neutral: "中性色",
      Always: "始终",
      "Model server": "模型服务器"
    }
  },
  {
    selector: ".settings-row input",
    fields: [
      "placeholder"
    ],
    entries: {
      "#6:8c36545f724b9460": "（未设置）",
      "#26:b2b319ac35b331a7": "（启动器所在目录）"
    }
  },
  {
    selector: ".settings-window-body main:has(kbd) :is(p,div,span)",
    fields: [
      "text"
    ],
    entries: {
      "#62:7ca11db0c86e387f": "用相应快捷键切换工具，Esc 返回选择模式。",
      "#43:7455667ab9b3c1db": "使用滚轮缩放画布或应用窗口内容",
      "#208:8f18ddd837d65e22": "按住此键滚动。指针在画布上时以指针为中心缩放；Windows 或 Linux 下，在顶栏或侧面板滚动可改变整个界面的缩放。",
      "Show or hide history lines": "显示或隐藏来源连线",
      "#96:a4b0f72822149dba": "显示选中卡片与所有上游来源卡片的连线。",
      "#102:296d1ad718b8fceb": "将整幅画布缩放到视野内。",
      "#80:ab14eca32e1af1ea": "还原侧面板，退出查看器、卡组或当前层级",
      "#196:b68b66c22cb5e464": "先收回占满画布的查看器，再退出工具或对比并关闭查看器，然后从内向外收起卡组，最后返回父画布。",
      "#78:349d9fbf73e8552c": "退出全屏，或切换查看器占用范围",
      "#157:629de348a86b9537": "退出从缩放菜单开启的全屏。在普通窗口内，可将卡片查看器在侧栏与整幅画布之间切换。",
      "#64:673eff08104674ef": "切换选中卡片或资源库项目的查看器",
      "#164:96b599b8d5ac4b84": "沿用上次使用的查看模式，首次为网格。网格展示全部选择，单项模式逐张浏览，划像和分屏可同时比较两项。",
      "#118:a58bd7c1c3cf0513": "逗号退一帧，句号进一帧。USD 或三维模型的动画同样支持逐帧浏览。",
      "Frame the model": "使模型完整显示",
      "#77:55f84e5ba61c19ad": "优先让查看器中的网格、泼溅或 USD 场景适应窗口，再处理画布的 F 键。",
      "#182:e6a1646bfb81fed6": "带着当前选区打开提问框并开始输入。首次使用智能体时会保留草稿并提供配置入口。各平台使用 Ctrl。",
      "#44:19acc65f9067381a": "拖入画布媒体以加入时间线",
      "#143:853bfbb04d5822b5": "对轨道、区段或关键帧点右键查看操作。方向键选择，Enter 确认，Esc 关闭。",
      "#69:067a617f382b732c": "只剩一个筛选结果时可按 Enter 选用。"
    }
  },
  {
    selector: ".settings-row :is(div,span), .settings-group [role=status], .settings-group button",
    fields: [
      "text",
      "title",
      "aria-label"
    ],
    entries: {
      "#151:600ba0be8f169c09": "选择一个在该地址提供模型服务的启动程序。Canvas 按模型服务启动它，不检查可执行文件类型。",
      "#39:a606ed8e93c128a1": "选择启动程序提供的服务类型。",
      "#88:23860648c6002315": "填写完整工作目录路径。留空则使用启动程序所在目录。",
      "Put back what is saved": "恢复已保存的值",
      "Open its folder": "打开所在文件夹",
      "Show what is saved": "显示已保存的值",
      "#141:dcb0613aaa2565d5": "选择在该地址启动 ComfyUI 服务的程序。Canvas 将按 ComfyUI 服务调用它，不检查程序类型。"
    }
  },
  {
    selector: ':is(.canvas-card-preview,.graph-node-body) div:has(> svg[data-icon="file-download"]):has(> button.nodrag) > span, :is(.canvas-card-preview,.graph-node-body) div:has(> svg[data-icon="file-download"]):has(> button.nodrag) > button',
    fields: [
      "text"
    ],
    entries: {
      "Drop ComfyUI workflow": "将 ComfyUI 工作流拖到这里",
      "API-format .json or ComfyUI PNG": "支持 API 格式的 JSON 文件或包含工作流的 ComfyUI PNG",
      "#34:a3e4774898b19a26": "配置输入后即可运行。拖入新文件可切换工作流。",
      "Replace…": "替换…",
      "Browse…": "浏览…"
    }
  },
  {
    selector: 'div:has(> div > textarea[placeholder*="ComfyUI"]) > div, div:has(> div > textarea[placeholder*="ComfyUI"]) > div > :is(div,button,textarea,label,span), div:has(> div > textarea[placeholder*="ComfyUI"]) :is(input,button,[role=combobox])',
    fields: [
      "text",
      "title",
      "placeholder",
      "aria-label"
    ],
    entries: {
      "COMFYUI SERVER": "ComfyUI 服务器",
      "Server URL": "服务器地址",
      "WORKFLOW (API FORMAT)": "工作流（API 格式）",
      "Load .json or PNG…": "载入 JSON 或 PNG…",
      "#66:c4573265925d95f6": "粘贴从 ComfyUI 导出的 API 工作流 JSON（含节点 ID 和 class_type）。",
      "#56:6ad67af66015ed3b": "格式无法识别，请从 ComfyUI 导出 API 格式的 JSON。",
      "No workflow loaded": "尚未载入工作流",
      INPUTS: "输入",
      OUTPUTS: "输出",
      "+ Add input": "+ 添加输入",
      "+ Add output": "+ 添加输出",
      "pin name": "引脚名称",
      "Unreal Canvas input pin name": "Unreal Canvas 输入引脚名称",
      "Unreal Canvas output pin name": "Unreal Canvas 输出引脚名称",
      "Remove input": "移除输入",
      "Remove output": "移除输出",
      "Workflow node": "工作流节点",
      "Field to inject": "要写入的字段",
      "Pin type": "引脚类型",
      "#46:45e9cf6d4fffafb5": "选择输出节点，例如 SaveImage 或 VHS_VideoCombine。"
    }
  },
  {
    selector: ".settings-row button, .settings-row button span",
    fields: [
      "text"
    ],
    entries: {
      "Add server…": "添加服务器…",
      "Start server": "启动服务器",
      "Stop server": "停止服务器",
      "Set default": "设为默认",
      "+ Add folder": "+ 添加文件夹",
      "Save again": "重新保存",
      "Make default": "设为默认",
      "Keep server": "保留服务器",
      "Remove server": "移除服务器"
    }
  },
  {
    selector: ".settings-row-value span, .settings-row label span",
    fields: [
      "text"
    ],
    entries: {
      "#19:8fcd5b80ed205806": "服务器列表为空。",
      "#38:924339ce6b2bb35a": "请为服务器指定启动程序。",
      "#125:17d96a14c341b59d": "工作流或内置助手请求服务器时，如目标地址尚无响应，应用将启动所配程序。",
      "Reading the saved servers…": "正在读取已保存的服务器…",
      "Will not start": "无法启动",
      "Not checked": "尚未检查",
      "Unsaved changes": "有未保存的更改",
      "#44:9410be555898dd9c": "自动锁定按节点图分别设置。"
    }
  },
  {
    selector: ".settings-window-body > main button.ui-icon-btn[aria-pressed]:has(> svg:is([data-icon=pin],[data-icon=unpin]))",
    fields: ["title", "aria-label"],
    entries: {
      "Show in pickers": "在模型选择器中显示",
      "#98:10e650423fdea006": "加入此能力的候选名单。设置名单后，模型选择器只显示名单里的模型。",
      "#98:1cfceed1ec9d3a2d": "已加入候选名单。此能力的选择器只显示名单里的模型。点击可移除此模型。"
    }
  },
  {
    selector: ".settings-window-body > main .credential-row-status",
    fields: ["text"],
    entries: {
      "Set (keystore)": "已配置（密钥库）",
      "#32:da024b975e4b1445": "已配置（你保存的密钥，仅供读取）",
      "Set (.env)": "已配置（.env）",
      "Set (--keys-file)": "已配置（--keys-file）",
      "Set (built-in)": "已配置（内置）"
    }
  },
  {
    selector: ".settings-window-body > main [data-media-id] > span,.settings-window-body > main [data-media-id] > div > div:nth-child(2)",
    fields: ["text"],
    entries: {
      User: "用户",
      accepts: "接受的输入："
    }
  },
  {
    selector: '[role=dialog][aria-modal=true]:is([aria-label^="Browse "],[aria-label^="浏览"]):has(> .merlin-panel-search) > .merlin-panel-search input, [role=dialog][aria-modal=true]:is([aria-label^="Browse "],[aria-label^="浏览"]):has(> .merlin-panel-search) > div:nth-child(2) [role=combobox], [role=dialog][aria-modal=true]:is([aria-label^="Browse "],[aria-label^="浏览"]):has(> .merlin-panel-search) [role=tablist]',
    fields: [
      "aria-label",
      "placeholder"
    ],
    entries: {
      "Search models": "搜索模型",
      "Search models…": "搜索模型…",
      Source: "来源",
      "Model types": "模型类型"
    }
  },
  {
    selector: '[role=dialog][aria-modal=true]:is([aria-label^="Browse "],[aria-label^="浏览"]):has(> .merlin-panel-search) > div:last-child > div > span:first-child, [role=dialog][aria-modal=true]:is([aria-label^="Browse "],[aria-label^="浏览"]):has(> .merlin-panel-search) > div:last-child > .ui-empty-state, [role=dialog][aria-modal=true]:is([aria-label^="Browse "],[aria-label^="浏览"]):has(> .merlin-panel-search) > div:last-child > div:not(:has(> *))',
    fields: [
      "text"
    ],
    entries: {
      "#73:03acb70159cafd6c": "仅对已登录的账号开放模型目录。请配置凭据后再浏览。",
      "Models you add from": "通过",
      "run on your": "添加的模型会使用你的",
      "key, which is not set up yet.": "密钥。请先配置密钥。",
      "Couldn't load the models.": "模型加载失败。",
      "Could not list model catalogs:": "无法读取模型目录：",
      "No model catalogs are available.": "暂无可用的模型目录。",
      "Loading…": "正在加载…",
      "Loading more…": "正在加载更多模型…",
      "No models match.": "没有匹配的模型。",
      "#37:2e4314080ed5a6b8": "已读取的模型中暂无匹配项。",
      "more match": "个其他匹配项",
      "#40:80a77f7b19c4cf44": "，可细化搜索条件来缩小范围。"
    }
  },
  {
    selector: '[role=dialog][aria-modal=true]:is([aria-label^="Browse "],[aria-label^="浏览"]):has(> .merlin-panel-search) > div:last-child .ui-btn, [role=dialog][aria-modal=true]:is([aria-label^="Browse "],[aria-label^="浏览"]):has(> .merlin-panel-search) > div:last-child .ui-badge, [role=dialog][aria-modal=true]:is([aria-label^="Browse "],[aria-label^="浏览"]):has(> .merlin-panel-search) > div:last-child [role=group], [role=dialog][aria-modal=true]:is([aria-label^="Browse "],[aria-label^="浏览"]):has(> .merlin-panel-search) > div:last-child [role=group] > span:first-child',
    fields: [
      "text",
      "aria-label",
      "title",
      "data-title-tip"
    ],
    entries: {
      "Try again": "重试",
      Add: "添加",
      "adding…": "正在添加…",
      "removing…": "正在移除…",
      Remove: "移除",
      "re-add": "重新添加",
      Cancel: "取消",
      "Show more": "显示更多",
      "added ✓": "已添加 ✓",
      "Already in your models": "已在你的模型中",
      "Remove this model and its route": "移除此模型及其路由",
      "#83:09fb94950b21869e": "根据当前目录重新生成模型定义，以获取新增功能。",
      preferred: "首选",
      Approved: "已批准",
      "Limited Use": "限用",
      Unreviewed: "未审核",
      "Near objects are shown": "近处物体的显示方式",
      "Brighter (most depth maps)": "更亮（多数深度图）",
      Darker: "更暗"
    }
  }
];

// src/locales/media-details.json
var media_details_default = [
  {
    selector: ".media-library-archived-grab,.media-library-locate,.media-library .merlin-panel-icon-button,.media-library .merlin-panel-chip,.media-library-more,.media-library .merlin-panel-search input,.media-library-results [role=dialog] :is(div,button),.media-library [role=alert]",
    fields: [
      "text",
      "aria-label",
      "title",
      "placeholder"
    ],
    entries: {
      "Show on canvas": "在画布中定位",
      "#52:c3e7512bfd14c3b0": "拖回画布即可在落点恢复卡片。",
      "Show everything again": "重新显示全部内容",
      "#203:7545c6b720320389": "删除卡片也会移除生成结果。卡组和节点图会连同内部内容删除；清空历史前可撤销。",
      Cancel: "取消",
      "Delete permanently": "永久删除",
      "Show more (": "显示更多（还有",
      "remaining)": "项）",
      "Find an item…": "查找项目…",
      "#79:ed343c00dbdee216": "来源已失效，请刷新资源库。",
      "#80:1e13d804fd549b7f": "刷新资源库后重新选择卡片。",
      "#77:8139b3d1d7a06319": "找不到该卡片，请刷新资源库。"
    }
  },
  {
    selector: ".merlin-rail-body-content:has(.media-library) > .ue-menu .ue-menu-item > .ue-menu-label",
    fields: [
      "text"
    ],
    entries: {
      Restore: "恢复",
      "Show where it was": "定位归档前的位置",
      "Show on canvas": "在画布中定位",
      "Delete permanently": "永久删除",
      "Copy file path": "复制文件路径"
    }
  },
  {
    selector: "[data-testid=timeline-trim-start],[data-testid=timeline-trim-end],[data-testid=shared-viewer-transport],[data-testid=shared-viewer-transport] > [role=status]",
    fields: [
      "aria-label",
      "text"
    ],
    entries: {
      "Trim start": "修剪起点",
      "Trim end": "修剪终点",
      "Synchronized playback": "同步播放",
      "Waiting for playable media…": "正在等待可播放的媒体…"
    }
  },
  {
    selector: "button[title][aria-label]:has(> span),button[title][aria-label]:not(:has(*)),span[title]:has(> span)",
    fields: [
      "aria-label",
      "title"
    ],
    entries: {
      "#71:95598d0387b5db2d": "正在联动播放，点击可解除同步。",
      "#37:31524456b408afe0": "让多个片段共用播放时间。",
      "#45:be1455458b484226": "调整片段起始偏移以对齐画面。",
      "One frame earlier": "提前一帧",
      "One frame later": "推迟一帧",
      "#29:a2a474e3e405194f": "逗号退一帧，句号进一帧。"
    }
  },
  {
    selector: "button:is([title^='Sync is on:'],[title^='Play the clips together'],[title^='片段正同步播放'],[title='使用同一时间基准同步播放片段'],[title^='Offsets:'],[title='调整时间偏移，使各片段对齐']) > span,div:has(> button > svg[data-icon=step-back]) > span:not([title])",
    fields: [
      "text"
    ],
    entries: {
      Sync: "同步",
      Offsets: "时间偏移",
      "Waiting for every clip": "正在等待所有片段就绪"
    }
  },
  {
    selector: "div:has(> button > svg[data-icon=step-back]) > span[title],span[title]:has(+ button):not(:first-child)",
    fields: [
      "title"
    ],
    entries: {
      "#68:331283c3ad2280b3": "拖动调整偏移。按住 Shift 以十帧为步长，双击归零。"
    }
  },
  {
    selector: ".nodrag.nowheel:has(.merlin-pane-collapse[aria-expanded]) div:not([title]):not([role])",
    fields: [
      "text"
    ],
    entries: {
      "No children": "没有子项"
    }
  },
  {
    selector: ".viewer-compact-toolbar button,.viewer-header-tools .toolbar-section,.bottom-node-viewer > .merlin-panel-control-btn,.bottom-node-viewer > .merlin-split-handle,.annotation-toolbar button,.bottom-node-viewer [aria-label='Hierarchy'],.bottom-node-viewer [aria-label='层级']",
    fields: [
      "title",
      "aria-label"
    ],
    entries: {
      "Fill Canvas (F11)": "填满画布（F11）",
      "Resize viewer": "调整查看器大小",
      "#57:27dedf13805575cc": "拖动边缘调节查看器尺寸，拖到右端可关闭。",
      Playback: "播放控制",
      Panels: "面板",
      View: "视图",
      Capture: "捕获",
      "Render pass": "渲染通道",
      "Close this pane": "关闭此窗格",
      "View result": "查看结果",
      "Pick points": "选取点",
      "Segment image": "分割图像",
      "Cancel segmentation": "取消分割",
      "Toggle draw mode (D)": "切换绘制模式（D）",
      "#66:1b5c3ead78407b04": "请在图像层或批注层添加标记。",
      "Delete annotation layer": "删除批注层",
      "Delete mask layer": "删除遮罩层",
      "Mesh view": "网格视图",
      "Comparison layout": "对比布局",
      "Exit compare (Esc)": "退出对比（Esc）",
      "Capture frame to history": "将当前帧保存到历史记录",
      "Grab frame at current time": "截取当前帧",
      "#66:3209e53cf8ee3b10": "封面已固定，点击恢复自动更新。",
      "#58:2a563ea9589650ca": "封面跟随视图，点击可固定当前画面。",
      "Download mesh": "下载网格",
      "Download video": "下载视频",
      "Undo stroke (Ctrl+Z)": "撤销笔画（Ctrl+Z）",
      "Redo stroke (Ctrl+Shift+Z)": "重做笔画（Ctrl+Shift+Z）",
      "Compare results": "对比结果",
      "Crop, turn or flip": "裁剪、旋转或翻转",
      "Cancel crop (Esc)": "取消裁剪（Esc）",
      "Turn left": "向左旋转",
      "Turn right": "向右旋转",
      "Flip horizontally": "水平翻转",
      "Flip vertically": "垂直翻转",
      "Back to the original": "恢复原始状态",
      "#65:8e200eec2455bade": "保留原图，并在旁边创建编辑后的图像。",
      "#65:b3dbef0a27b58588": "保留原视频，并在旁边创建编辑后的视频。",
      "Cancel (Esc)": "取消（Esc）",
      "Apply (Enter)": "应用（Enter）",
      "#30:c1bab43421b18e95": "保存为新版本（Enter）",
      "Remove the crop": "移除裁剪",
      "Show hierarchy": "显示层级",
      "Hide hierarchy": "隐藏层级",
      Hierarchy: "层级"
    }
  },
  {
    selector: ".viewer-compact-toolbar button[title]",
    fields: [
      "text"
    ],
    entries: {
      Reset: "重置",
      Cancel: "取消",
      Done: "完成",
      "Applying…": "正在应用…",
      "Save as new": "另存为新",
      image: "图像",
      video: "视频"
    }
  },
  {
    selector: ".nodrag.nowheel:has(.merlin-pane-collapse[aria-expanded]) button:not([title]):not([role]):not(:has(*))",
    fields: [
      "text"
    ],
    entries: {
      ")": "）"
    }
  }
];

// src/locales/editor-connection.json
var editor_connection_default = [
  {
    selector: "button.unreal-editor-chip > .unreal-editor-chip-label",
    fields: [
      "text"
    ],
    entries: {
      Connect: "连接"
    }
  },
  {
    selector: ".unreal-editor-menu",
    fields: [
      "aria-label"
    ],
    entries: {
      "Unreal Editors": "虚幻编辑器"
    }
  },
  {
    selector: ".unreal-editor-menu .ue-menu-heading,.unreal-editor-menu .ue-menu-note,.unreal-editor-menu .unreal-editor-menu-tag,.unreal-editor-menu .unreal-editor-menu-recheck,.unreal-editor-menu .unreal-editor-menu-quit,.unreal-editor-menu .unreal-editor-menu-status-detail,.unreal-editor-menu .unreal-editor-menu-starting[role=presentation] .ue-menu-label",
    fields: [
      "text"
    ],
    entries: {
      "Running editors": "运行中的编辑器",
      "Recent projects": "最近的工程",
      "#28:6d1446d1be1e7e59": "当前没有运行中的 UE 编辑器。",
      "#46:1ebde62fc8139d3b": "在这台电脑上未发现 UE 安装。",
      "#17:aa391b3cc9a2695d": "没有找到符合条件的关卡。",
      "Listing levels…": "正在获取关卡列表…",
      "Unsaved changes": "未保存的更改",
      "MCP only": "仅 MCP",
      "No MCP server": "无 MCP 服务",
      "Starting…": "启动中…",
      Background: "后台运行",
      "Check again": "重新检查",
      Quit: "退出",
      "#58:305e82aae6604507": "待编辑器载入后，这里会自动刷新。",
      "#105:99c682275e71013d": "等待编辑器的 MCP 服务启动，Canvas 会自动连接。",
      "#87:09de7f859d02eb44": "请检查编辑器的 MCP 服务，必要时重启编辑器。",
      "#72:cabb734cb8099ac6": "正在加载或编译着色器，请待编辑器空闲后重试。",
      "#29:9afd6ae3ef0ccf7d": "此编辑器不支持执行 Unreal 卡片。",
      "#29:2eec99eba00799a3": "此编辑器不支持执行 Unreal 节点。",
      "#90:eac2052656246ce9": "请在「编辑 → 插件」启用 Unreal Canvas Bridge 并重启 UE。",
      "#145:30855131def92714": "请启用 Model Context Protocol。如已安装 Unreal Canvas Bridge，也请启用。重启 UE 后生效。"
    }
  },
  {
    selector: ".unreal-editor-menu > button > .ue-menu-label",
    fields: [
      "text"
    ],
    entries: {
      "Start in the background": "在后台启动",
      "Open UProject…": "打开 UE 工程…",
      "Open level…": "打开关卡…",
      Disconnect: "断开连接",
      "Quit and disconnect": "退出编辑器并断开连接",
      Back: "返回",
      Cancel: "取消"
    }
  },
  {
    selector: ".unreal-editor-menu button",
    fields: [
      "title"
    ],
    entries: {
      "#103:95ec55ebb494a4f5": "隐藏编辑器窗口并在后台运行，仍可编辑关卡、渲染和接收视口画面。",
      "#55:4d06b39eab5d3d57": "在编辑器中打开选定的 .uproject 文件。",
      "#68:6070839266997c59": "选择要打开的关卡。",
      "#84:82df894e2b58940f": "暂停此编辑器的关卡操作，重新选择即可连接。",
      "#95:aca8fbe77dd4280d": "退出并断开连接。退出前可处理尚未保存的更改。",
      "#114:82b72f3f5755a466": "关闭后台编辑器。退出前可选择是否保存更改。",
      "Remove from recent projects": "从最近工程中移除"
    }
  },
  {
    selector: ".unreal-level-picker-search input,.unreal-level-picker-search [aria-label]",
    fields: [
      "aria-label",
      "placeholder"
    ],
    entries: {
      "Search levels": "搜索关卡"
    }
  },
  {
    selector: ".unreal-editor-chip",
    fields: [
      "aria-description"
    ],
    entries: {
      "#49:7e481c7ef0ae84fc": "连接 UE 编辑器并选择工程"
    }
  }
];

// src/locales/panel-details.json
var panel_details_default = [
  {
    selector: '.merlin-inspector-summary span[style*="--field-label-size"]',
    fields: ["text"],
    entries: {
      Source: "来源"
    }
  },
  {
    selector: '.merlin-skill-attach-list, .merlin-skill-attach-actions > button, .merlin-skill-picker, .merlin-skill-picker-list, .merlin-skill-picker-search input, .merlin-skill-picker-empty:not([role="alert"]), .chat-skills-scope-editor button[aria-expanded], .chat-skills-scope-editor button[aria-expanded] > span, .chat-skills-scope-editor summary',
    fields: [
      "text",
      "aria-label",
      "title",
      "placeholder"
    ],
    entries: {
      "Attached skills": "已挂接的技能",
      "+ Attach skill": "+ 挂接技能",
      "Manage in Toolbox": "在工具箱中管理",
      "#69:50af44b598806a58": "在工具箱里添加、编辑、重命名或删除技能。",
      "Attach a skill": "挂接技能",
      "Search skills": "搜索技能",
      "Skills to attach": "可挂接的技能",
      "#19:6b096e5403455ad5": "找不到符合条件的技能。",
      "#42:1a4fb8bf8998402d": "尚无技能，点击工具箱的「+」创建。",
      "#24:3be9dca31e95a221": "可选技能均已添加。",
      "Loading skills…": "正在加载技能…",
      "Canvas defaults": "画布默认设置"
    }
  },
  {
    selector: '[role="listbox"]:is([aria-label="Skill selection"],[aria-label="技能选择"]), .chat-skills-reset, .mini-agent-chat .agent-setup-header > strong',
    fields: [
      "text",
      "aria-label"
    ],
    entries: {
      "Skill selection": "技能选择",
      "Agent setup": "智能体设置",
      "Close canvas skills": "收起画布技能"
    }
  },
  {
    selector: ".chat-skills-scope-editor .merlin-skill-attach-actions button,.chat-skills-reset,.chat-skills-section-heading > small,.chat-skills-heading,.chat-skills-list > label > span > small:first-of-type",
    fields: [
      "text"
    ],
    entries: {
      "Close canvas skills": "收起画布技能",
      "Selectable here": "可在此选择",
      "Read-only": "只读",
      "Excluded in this conversation": "已在本次对话中排除",
      "#33:ff4ee518b8ae05d4": "提示词建议使用此技能，尚未开启。",
      "Available to add": "可以添加"
    }
  },
  {
    selector: ".provider-settings-row > span,.provider-settings-row > button",
    fields: [
      "text"
    ],
    entries: {
      "Credential available": "凭据可用",
      Manage: "管理"
    }
  },
  {
    selector: '.mini-agent-chat-compose [role="separator"]',
    fields: [
      "title"
    ],
    entries: {
      "Drag to resize": "拖动以调整输入框大小"
    }
  },
  {
    selector: ".merlin-script-editor > p,.merlin-script-side-locked",
    fields: [
      "text"
    ],
    entries: {
      "#59:48f73e0bf08e5993": "脚本编辑器出错，画布内容已保留。",
      "#117:aa277e5895531c14": "存在优先级更高的同 ID 技能，本文件的更改只保存在本库。"
    }
  },
  {
    selector: ".agent-detail-tabs, .agent-detail-tabs > button",
    fields: [
      "text",
      "aria-label"
    ],
    entries: {
      "Agent details": "智能体详情",
      Messages: "消息",
      Tasks: "任务",
      Activity: "活动"
    }
  },
  {
    selector: ".agent-detail-header h2",
    fields: [
      "title"
    ],
    entries: {
      "Double-click to rename": "双击重命名"
    }
  },
  {
    selector: ".agent-locate-button",
    fields: [
      "title",
      "aria-label"
    ],
    entries: {
      "Locate agent": "定位智能体",
      "No location available": "当前没有可定位的位置"
    }
  },
  {
    selector: ".agent-chat-status .agent-status, .agent-status-text, .agent-chat-status .agent-setup-inline-link, .agent-configure-button, .mini-agent-chat-model:disabled:not(:has(*)), .mini-agent-chat .generation-shelf-conversation",
    fields: [
      "text",
      "title",
      "aria-label"
    ],
    entries: {
      "#36:f730e39f90d48e58": "先完成智能体设置，即可开始交谈。",
      "Setup required": "需要配置",
      "Manage connections": "管理连接",
      "Setup agent": "配置智能体",
      "No model": "未选择模型",
      "Agent conversation": "智能体对话"
    }
  },
  {
    selector: ".agent-task-heading :is(h2,p), .agent-task-empty > :is(strong,p), .agent-task-filters, .agent-task-filters > button, .agent-task-composer, .agent-task-title-input > span, .agent-task-title-input > input, .agent-task-compose-row > button, .agent-task-dependencies, .agent-task-breadcrumb > button",
    fields: [
      "text",
      "aria-label",
      "placeholder"
    ],
    entries: {
      "Our task list": "我们的任务列表",
      "Team & independent work": "团队任务与独立任务",
      "Show tasks": "筛选任务",
      Everyone: "所有人",
      "Needs you": "需要你处理",
      "New task": "新建任务",
      Task: "任务",
      "+ Add a task…": "+ 添加任务…",
      Add: "添加",
      "No tasks yet": "暂无任务",
      "#66:591429eee537291f": "手动分派任务，或让智能体在工作时生成计划。",
      "Task dependencies": "任务依赖",
      "Task path": "任务路径",
      "All tasks": "全部任务"
    }
  },
  {
    selector: ".agent-task-owner-input .agent-assignee-picker",
    fields: [
      "aria-label"
    ],
    entries: {
      "Assign to": "分派给"
    }
  },
  {
    selector: ".agent-activity-heading > :is(h2,p), .agent-activity-presence, .agent-activity-presence > summary, .agent-activity-feed, .agent-activity-empty, .agent-activity-diagnostics > :is(summary,h3,p.agent-detail-muted), .agent-activity-diagnostics .agent-detail-disclosure > :is(summary,p.agent-detail-muted), .agent-activity-task, .agent-activity-presence > div > button, .agent-task-breadcrumb > button",
    fields: [
      "text",
      "aria-label"
    ],
    entries: {
      "Team activity": "团队活动",
      "#51:ad9a741ac90e9d85": "追踪任务负责人、交接与进度。",
      "Current agent status": "智能体当前状态",
      "Agent status ·": "智能体状态 ·",
      active: "个正在工作",
      "Team activity timeline": "团队活动时间线",
      "#61:1ca80a942781eb64": "团队开始执行后将在此列出任务进度。",
      "Runtime details": "运行详情",
      "Current activity": "当前活动",
      "#29:5519cc35951ea572": "暂无进行中的活动记录。",
      "Recent activity (": "最近活动 (",
      "#28:5c53adf6c3ab9150": "近期没有活动记录。",
      "Sessions & diagnostics": "会话与诊断",
      "View task ↗": "查看任务 ↗",
      Reconnect: "重新连接",
      "All activity": "全部活动"
    }
  },
  {
    selector: ".agent-action-menu .ue-menu-label, .agent-appearance-picker .ue-menu-heading, .agent-action-shapes, .agent-action-colors, .agent-name-editor",
    fields: [
      "text",
      "aria-label",
      "title"
    ],
    entries: {
      Messages: "消息",
      "Rename…": "重命名…",
      "Appearance…": "外观…",
      "Close…": "关闭…",
      "Agent appearance": "智能体外观",
      "Agent color": "智能体颜色",
      Appearance: "外观",
      Color: "颜色",
      Back: "返回",
      Done: "完成",
      "Agent name": "智能体名称",
      "#32:0499cfe5b98c7d98": "Enter 确认，Esc 放弃。"
    }
  },
  {
    selector: '.chat-skills-popover, .chat-skills, .chat-skills-heading > :is(strong,span), .chat-skills-search input, .chat-skills-expansion, .chat-skills-expansion > span:first-child, .chat-skills-expansion button.custom-select, .chat-skills-expansion button.custom-select span[aria-hidden] , .chat-skills-help, .chat-skills-chips > span:not([role]), .chat-skills-chips > span[role="alert"] > button, .chat-skills-reset, .chat-skills-list > p, .chat-skills-section-heading > :is(span,strong), .chat-skills-scope-editor',
    fields: [
      "text",
      "aria-label",
      "placeholder",
      "title"
    ],
    entries: {
      "Chat skills": "聊天技能",
      "Skills for this conversation": "本次对话的技能",
      Skills: "技能",
      "No active skills": "没有启用的技能",
      "Loading skills": "正在加载技能",
      "Loading skills…": "正在加载技能…",
      "Skills could not be loaded": "无法加载技能",
      "Search skills": "搜索技能",
      "Search skills…": "搜索技能…",
      "#207:1dd024eca85ac53b": "可固定使用已选技能、由智能体建议，或让它说明理由并自动添加。排除项仍然有效，两个菜单共用这项策略。",
      "Skill selection": "技能选择",
      "Selected only": "仅使用所选技能",
      Suggest: "建议启用",
      "Add automatically": "自动添加",
      "#33:da8bc8f26abc8be0": "此消息未选用技能。",
      "#122:39066dfe56f7fcf9": "团队工作期间暂时锁定选择策略，当前提示词的技能仍可调整。",
      "#95:003bac548bafaf5d": "画布技能取决于当前位置。此选择和策略仅适用于这段对话。",
      "Edit canvas skills": "编辑画布技能",
      "#99:39b462a9610881ff": "先在工具箱创建技能，再把它加入当前画布或对话。",
      "#19:6b096e5403455ad5": "找不到符合条件的技能。",
      "Reset conversation choices": "重置本次对话的选择",
      "Canvas defaults": "画布默认设置",
      "Unreal Canvas skills": "Unreal Canvas 技能",
      "Selectable here": "可在此选择",
      "Inherited from local CLI": "继承自本地命令行",
      "Read-only": "只读",
      Retry: "重试"
    }
  },
  {
    selector: ".agent-mcp-servers, .agent-mcp-servers-header > :is(h2,h3,strong), .agent-mcp-servers > p, .agent-mcp-servers > a, .agent-provider-setup-request, .agent-provider-setup-request button, .agent-chat-open-messages",
    fields: [
      "text",
      "aria-label",
      "title"
    ],
    entries: {
      "MCP servers": "MCP 服务器",
      "Checking this chat's MCP servers…": "正在检查本次聊天的 MCP 服务器…",
      "#29:3287d8b4db8d62a2": "当前对话尚未连接 MCP 服务器。",
      "Open the sign-in page": "打开登录页",
      "Provider setup invitation": "服务商配置邀请",
      "Open provider setup": "打开服务商配置",
      "Not now": "暂不配置",
      "Open Messages": "打开消息"
    }
  },
  {
    selector: ".merlin-script-editor-btn, .merlin-script-form-remove, .merlin-script-heading-edit, .merlin-script-form, .merlin-skill-attach-inherited-label",
    fields: [
      "text",
      "title",
      "aria-label"
    ],
    entries: {
      "Close the editor": "关闭编辑器",
      "Clear the icon": "清除图标",
      "Rename workspace": "重命名工作区",
      "Workspace structure": "工作区结构",
      "Workspace summary": "工作区摘要",
      "Also active by inheritance": "同时通过继承生效"
    }
  },
  {
    selector: ".agent-action-shapes > button > span",
    fields: [
      "text"
    ],
    entries: {
      Pebble: "石子",
      Flame: "火焰",
      Cat: "猫",
      Cowboy: "牛仔",
      Baseball: "棒球",
      Rabbit: "兔子",
      Cloud: "云朵",
      Star: "星星",
      Cthulhu: "克苏鲁",
      Dino: "恐龙",
      Skeleton: "骷髅",
      Buff: "大力士",
      Merlin: "梅林"
    }
  },
  {
    selector: ".agent-action-shapes > button",
    fields: [
      "aria-label"
    ],
    entries: {
      "Pebble appearance": "石子外观",
      "Flame appearance": "火焰外观",
      "Cat appearance": "猫外观",
      "Cowboy appearance": "牛仔外观",
      "Baseball appearance": "棒球外观",
      "Rabbit appearance": "兔子外观",
      "Cloud appearance": "云朵外观",
      "Star appearance": "星星外观",
      "Cthulhu appearance": "克苏鲁外观",
      "Dino appearance": "恐龙外观",
      "Skeleton appearance": "骷髅外观",
      "Buff appearance": "大力士外观",
      "Merlin appearance": "梅林外观"
    }
  },
  {
    selector: ".agent-action-colors > button",
    fields: [
      "title"
    ],
    entries: {
      Mint: "薄荷绿",
      Lilac: "淡紫色",
      Sky: "天蓝色",
      Peach: "桃色",
      Rose: "玫瑰色",
      Gold: "金色",
      Coral: "珊瑚色",
      Orange: "橙色",
      Lime: "青柠色",
      Teal: "青绿色",
      Indigo: "靛蓝色",
      Magenta: "品红色"
    }
  },
  {
    selector: ".agent-action-colors > button",
    fields: [
      "aria-label"
    ],
    entries: {
      "Mint agent": "薄荷绿智能体",
      "Lilac agent": "淡紫色智能体",
      "Sky agent": "天蓝色智能体",
      "Peach agent": "桃色智能体",
      "Rose agent": "玫瑰色智能体",
      "Gold agent": "金色智能体",
      "Coral agent": "珊瑚色智能体",
      "Orange agent": "橙色智能体",
      "Lime agent": "青柠色智能体",
      "Teal agent": "青绿色智能体",
      "Indigo agent": "靛蓝色智能体",
      "Magenta agent": "品红色智能体"
    }
  }
];

// src/locales/agent-session.json
var agent_session_default = [
  {
    selector: ".agent-welcome-actions > button.agent-welcome-primary",
    fields: [
      "text",
      "title",
      "aria-label"
    ],
    entries: {
      "Start a chat": "开始对话"
    }
  },
  {
    selector: ".agent-welcome-actions > button:not(.agent-welcome-primary), p.agent-welcome-start",
    fields: [
      "text"
    ],
    entries: {
      "Manage connections": "管理连接",
      "#35:e5fd313c1ab70ced": "选择「开始对话」以发送第一条消息。"
    }
  },
  {
    selector: ".agent-detail-header > .agent-detail-actions > button",
    fields: [
      "text"
    ],
    entries: {
      Reconnect: "重新连接"
    }
  },
  {
    selector: ".agent-squad-roster, .agent-squad-roster > header, .agent-squad-move-help, .agent-squad-launcher, .agent-squad-collapse, .agent-squad-resize, .agent-squad-current > span, .agent-squad-tasks",
    fields: [
      "text",
      "aria-label"
    ],
    entries: {
      Team: "团队",
      "Expand team": "展开团队",
      "Collapse team": "收起团队",
      "Move team": "移动团队面板",
      "#60:e62a6a4d22664481": "拖动或用方向键移动。按住 Shift 可加大步长。",
      "Resize chat from top edge": "从上边缘调整聊天窗口大小",
      "Resize chat from bottom edge": "从下边缘调整聊天窗口大小",
      "Working with:": "正在协作的智能体：",
      "Team tasks ↗": "团队任务 ↗"
    }
  },
  {
    selector: ".agent-squad-current > strong:not([title])",
    fields: [
      "text"
    ],
    entries: {
      "Choose an agent": "选择智能体"
    }
  },
  {
    selector: ".agent-squad-current > strong[title]",
    fields: [
      "title"
    ],
    entries: {
      "Double-click to rename": "双击重命名"
    }
  },
  {
    selector: ".agent-shelf-reopen, .agent-history-popover, .shelf-collaborator-menu:has(.agent-history-list), :is(.agent-history-popover,.shelf-collaborator-menu) > strong, :is(.agent-history-popover,.shelf-collaborator-menu) input, .agent-history-list > p, .agent-history-list > .generation-shelf-model-label, .agent-history-list ~ small[role=status]",
    fields: [
      "text",
      "aria-label",
      "placeholder",
      "title"
    ],
    entries: {
      "Reopen agent": "重新打开智能体",
      "Search agents": "搜索智能体",
      "Search by name or task…": "按名称或任务搜索…",
      "Saved local agents": "本地保存的智能体",
      "#19:04ec60928555dc35": "没有找到智能体。",
      "#55:9d8f1c8be872c116": "关闭的智能体会列在这里。",
      "Opening agent…": "正在打开智能体…",
      "Looking for saved local agents…": "正在查找本地保存的智能体…"
    }
  },
  {
    selector: ".agent-retry-status, .agent-retry-status > div > span",
    fields: [
      "text",
      "aria-label"
    ],
    entries: {
      "Automatic retries": "自动重试",
      "Agent response": "智能体回复",
      "Saving checking progress": "保存检查进度",
      "Agent connection": "智能体连接",
      "App server access": "应用服务器访问",
      Retry: "重试",
      of: "/",
      "in progress…": "正在重试…",
      "starting…": "即将重试…"
    }
  },
  {
    selector: ".agent-chat-open-messages",
    fields: [
      "title",
      "aria-label"
    ],
    entries: {
      "Open Messages": "打开消息"
    }
  },
  {
    selector: ".agent-provider-setup-request, .agent-provider-setup-request > button",
    fields: [
      "text",
      "aria-label"
    ],
    entries: {
      "Provider setup invitation": "服务商配置邀请",
      "Set up provider": "配置服务商",
      "Not now": "暂不配置"
    }
  },
  {
    selector: ".generation-shelf-approval, .generation-shelf-approval > [role=status] > strong, .generation-shelf-approval > details > summary, .generation-shelf-approval > details > p:nth-of-type(2), .generation-shelf-approval-actions > :is(button,small)",
    fields: [
      "text",
      "aria-label",
      "title"
    ],
    entries: {
      "Organization approval request": "整理画布的授权请求",
      "Agent approval request": "智能体授权请求",
      "Generation approval needed": "生成内容需要授权",
      "Approval needed": "需要授权",
      "Scope and action": "操作和授权范围",
      "#75:fff68172246838d1": "本次授权覆盖这个画布后续的同类整理。",
      "#37:18174f098877c9e7": "仅允许这一次。",
      "Tool arguments": "工具参数",
      "Not now": "暂不允许",
      Deny: "拒绝",
      "Approve once": "仅允许这一次",
      "Allow this session": "本次会话内允许",
      "Don’t ask again": "以后生成时不再询问",
      "#101:12e537dc4f77e7e9": "允许这次请求，后续消息可直接生成内容。",
      "#65:67162f06dd80d6e8": "等待你的选择。停止智能体即可取消请求。",
      "#61:088e711a9d8a47a5": "本次请求有效期为 45 秒，过期后可重试。"
    }
  },
  {
    selector: ".agent-team-proposal-request, .agent-team-proposal-request > [role=status], .agent-team-proposal-request > [role=status] > strong, .agent-team-proposal > ul > li > small, .agent-team-proposal > small, .agent-team-proposal-actions > button",
    fields: [
      "text",
      "aria-label"
    ],
    entries: {
      "Team proposal": "组队提议",
      "· Waiting for your decision": "· 等待你决定",
      "Brief helper": "临时帮手",
      "Task teammate": "任务队友",
      "Ongoing collaborator": "长期协作者",
      "#215:7aae66cf81405172": "组队会启动所列队友，由当前智能体管理成员。单独继续会由它独立完成，两种选择均遵循已有工具权限。",
      "Continue solo": "单独继续",
      "Accept team": "接受组队"
    }
  },
  {
    selector: ".agent-mcp-servers, .agent-mcp-servers-header > :is(strong,button), .agent-mcp-servers > p:not([role=alert]), .agent-mcp-servers > button, .agent-mcp-servers-status, .agent-mcp-servers li > button",
    fields: [
      "text",
      "aria-label"
    ],
    entries: {
      "MCP servers": "MCP 服务器",
      Refresh: "刷新",
      Close: "关闭",
      "Checking this chat's MCP servers…": "正在检查本次对话的 MCP 服务器…",
      "#29:3287d8b4db8d62a2": "当前对话尚未连接 MCP 服务器。",
      Connected: "已连接",
      "Needs sign-in": "需要登录",
      "Couldn't connect": "连接失败",
      Connecting: "正在连接",
      "Turned off": "已关闭",
      "Signing in…": "正在登录…",
      "Sign in": "登录",
      "Open the sign-in page": "打开登录页面"
    }
  }
];

// src/dictionary.ts
var dictionary = [...agent_session_default, ...editor_connection_default, ...panel_details_default, ...media_details_default, ...canvas_actions_022_default, ...panel_actions_022_default, ...settings_preview2_default, ...settings_actions_022_default, ...shelf_actions_default, ...generation_extra_default, ...editors_extra_default, ...script_authoring_extra_default, ...viewers_extra_default, ...menus_extra_default, ...panels_extra_default, ...settings_extra_default, ...zh_CN_default];

// manifest.json
var manifest_default = {
  id: "unreal-canvas-zh-cn",
  name: "Unreal Canvas 简体中文",
  version: "0.2.13",
  apiVersion: 1,
  namespaces: [
    "canvaszh"
  ]
};

// src/index.ts
if (!loadSignal.aborted) {
  const stop = localize(document, dictionary, () => useCanvasStore.getState());
  loadSignal.addEventListener("abort", stop, { once: true });
  console.info(`[unreal-canvas-zh-cn] 简体中文已加载（${manifest_default.version}）`);
}
