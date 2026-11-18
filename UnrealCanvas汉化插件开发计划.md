# Unreal Canvas 简体中文插件开发计划

目标是在 UE 编辑器的 **工具 → Unreal Canvas** 和 **Launch Unreal Canvas App** 打开的独立窗口中，让用户看到中文的工具架、设置页、按钮、菜单、提示和画布操作。两个入口使用同一份插件和词库。首个验证对象是本机 UE 5.9 Preview 和 Canvas Server 0.21.0。

## 1. 已查实的实现依据

| 问题 | 本机结果 | 对开发的影响 |
| --- | --- | --- |
| 两个入口显示什么 | Bridge 创建 `SUnrealCanvasPanel`，通过 `SWebBrowser` 打开网页。独立 App 的 `RequiredTabs` 指向 Bridge 的同一个 `UnrealCanvasBoard`。 | 把主要翻译放在 Canvas 网页前端。两个窗口分别验收，端口和进程可能不同。 |
| 英文从哪里来 | 正在运行的前端包里有 `Settings`、`Help`、`Install an extension` 等界面文案。Bridge 的安装、等待和启动失败提示则由 Slate 绘制。 | 第一版交付网页工作区汉化。原生壳的提示如要补译，单列 UE 文本资源。截图上方另一个 `Unreal Canvas (Native)` 有自己的 Slate 界面，属于另一项工作。 |
| 有什么扩展接口 | 本机 SDK 为 **1.33.0**，清单中的 `apiVersion` 为数字 **1**。已核对公开类型声明，未找到注册整个应用语言包的接口。运行时会加载获准的前端插件，SDK 导出的 `loadSignal` 在停用、重载或卸载时中止。 | 选用 Canvas 的运行时前端 **Plugin**。在网页显示层翻译内置控件，利用 `loadSignal` 清理。对宿主界面元素的识别需要随版本回归。 |
| 插件安装在哪里 | 项目当前服务的 `GET /api/plugins/installed` 返回 `%APPDATA%\com.epicgames.unrealcanvas\plugins`。面板在 **Settings → Extensions → Installed → Plugins** 显示插件状态。 | 源码留在工程的 `Tools` 下，测试包部署到服务实际返回的 `installRoot`。分别核对两端是否共用该目录。 |

在引擎的 `Engine/Plugins/Developer/UnrealCanvas/UnrealCanvasBridge/Source` 中可查看 Bridge 标签页入口和网页面板的创建代码，独立 App 的配置在 `Engine/Source/Programs/UnrealCanvasApp/Config/DefaultEditor.ini`。官方 SDK 文档随本机 Canvas 安装提供。Canvas 自带帮助中的 `get_help("extensions")` 有本版本的安装、Allow 和 Reload 说明。[Epic 的 Canvas 概述](https://dev.epicgames.com/documentation/unreal-engine/unreal-canvas-overview-in-unreal-engine?lang=zh-CN)

## 2. 先打通一个真正可安装的插件

初版原型的建议源目录为 `<工程目录>/Tools/unreal-canvas-zh-cn/`。使用独立的 TypeScript 前端项目。当前 UE 插件的安装步骤见 [README](README.md)。

```text
unreal-canvas-zh-cn/
  manifest.json
  package.json
  package-lock.json
  src/index.ts                插件入口、启动和清理
  src/translate.ts            界面匹配、局部更新、恢复原文
  src/locales/zh-CN.json      按界面和上下文组织的离线词库
  tests/                      复用同一套翻译逻辑的 DOM 回归用例
  dist/index.js               给 Canvas 加载的单文件 ES 模块
```

清单的起点如下。插件目录名与 `id` 必须一致。

```json
{
  "id": "unreal-canvas-zh-cn",
  "name": "Unreal Canvas 简体中文",
  "version": "0.1.0",
  "apiVersion": 1,
  "namespaces": ["canvaszh"]
}
```

1. 用 SDK 随附的声明做类型检查，按其 README 构建 ES 模块。词库打入 `dist/index.js`，将 `@merlin/plugin-api` 保留为宿主提供的外部依赖。宿主通过内存中的模块地址加载代码，产物不能依赖相邻的 JSON 文件或延迟加载的本地 JS 分块。
2. 第一轮只给**系统设置按钮**的可见标签或悬浮提示加一条翻译，并输出一次可识别的开发版加载日志。先证明真实控件变成“设置”，再扩大词库。
3. 生成完整发布目录 `unreal-canvas-zh-cn/manifest.json` 和 `unreal-canvas-zh-cn/dist/index.js`，复制该目录到实际 `installRoot`。这是前端 **Plugin** 的本地开发路径。当前 **Install → From a folder** 对话框查找的是另一类 **Extension** 的 `extension.json`。未来从 Git 安装前端 Plugin 时，Canvas 帮助列出的是仓库根目录 `manifest.json` 和 `v0.1.0` 形式的版本标签。
4. 在 Installed 里定位这个 ID，按宿主实际状态执行 **Allow**、启用或 **Reload**。用 `GET /api/plugins/installed` 检查发现状态，再用 `GET /api/plugins/frontend` 检查前端清单中是否出现该 ID；最后回到界面检查译文。前两项只能证明发现和分发，不能代替画面验证。
5. 同一小样在编辑器标签页和独立 App 各跑一次，停用后确认恢复原文。这一次实测同时验证上述发布布局、两个客户端的加载行为和 React 重绘后的效果。若有一端失败，先区分是目录、允许状态、前端包加载还是控件匹配的问题。

**查当前服务地址。** 端口会随启动改变。下面的 PowerShell 从本次工程日志读取地址，只做查询。

```powershell
$canvasLog = Get-ChildItem -LiteralPath './Saved/Logs' -Filter '*.log' | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
$readyLine = Select-String -LiteralPath $canvasLog -Pattern 'unrealcanvas-server ready at (http://(?:localhost|127\.0\.0\.1):\d+)' | Select-Object -Last 1
if (-not $readyLine) { throw '本次工程日志里尚未找到 Canvas 服务地址' }
$canvasUrl = $readyLine.Matches[0].Groups[1].Value
(Invoke-RestMethod -Uri "$canvasUrl/api/version").version
(Invoke-RestMethod -Uri "$canvasUrl/api/plugins/installed").installRoot
```

独立 App 的对应日志是 `<引擎目录>/Engine/Source/Programs/UnrealCanvasApp/Saved/Logs/UnrealCanvasApp.log`。以各自仍能响应的服务和实际窗口为准。

## 3. 翻译层怎样写

- **按控件认文字。** 词条用“界面区域 + 控件用途 + 英文原文”识别。例如设置按钮的 `Settings` 译为“设置”，名为 `Settings` 的用户卡片仍显示原名。先在真实界面确认工具栏、菜单、对话框的角色及稳定属性，再写匹配规则。控件里的动态文件名、模型名和用户自定义菜单项同样需要区分。
- **只改显示。** 处理命中规则的文本节点及 `title`、`placeholder`、`aria-label`。原位更新文本节点的 `nodeValue`，保留 React 创建的元素、子节点和事件。输入框的值、可编辑正文、提示词、对话、代码、资产路径、模型 ID 和保存到画布的 JSON 保持原样。提示框可以翻译“在这里输入提示词”，不能碰用户正在输入的内容。
- **照顾晚出现的界面。** 激活时处理已挂载的界面，用一个 `MutationObserver` 收集新增子树、文字变化和指定属性的变化，按批次处理。覆盖右键菜单、下拉框、悬浮提示等临时挂到页面其他位置的控件。忽略插件自己刚写入的值，拖动画布时不反复扫描整页。
- **正确处理切换和重载。** 每个命中的节点或属性记录最近一次英文及对应译文。React 刷新原文后更新记录。收到 `loadSignal` 中止时，断开观察器、取消调度并清理监听，只恢复当前仍等于本次译文的内容。重复 Reload 后始终只有一个观察器。第一版可直接使用宿主的启用开关切换中英文。
- **动态文案用模板。** 错误和状态按已知句式匹配，保留数量、文件名等变量；同一个 `Run` 在执行按钮和历史记录中可以有不同译法。工程内保存的是人工可审阅的词库，日常显示不需要模型、网络或 API Key。

## 4. 夜间执行顺序

| 阶段 | 做什么 | 完成标志 |
| --- | --- | --- |
| A · 验证安装与显示 | 搭建第 2 节的最小插件，先打通构建、发现、Allow、显示、停用和 Reload。 | 两端分别留下同一个系统控件的中英文对照，记录各自的 Canvas 版本。 |
| B · 实现翻译与保护 | 实现第 3 节的匹配与恢复。建立包含真实控件结构和同名用户内容的本地网页测试样例。 | 自动测试覆盖初次加载、弹层、异步文本、同名卡片、中文输入、停用和重复加载。 |
| C · 扩充首版词库 | 先做工具架、生成选项、卡片右键菜单、Settings 及其 Model Providers、Extensions 页面。接着覆盖 Library、Toolbox、Inspector、Operations、Agents 面板里的内置操作和常见空状态。记录实际走过的页面与仍为英文的宿主文案。 | 每个已覆盖页面都能用中文完成一个实际操作。未知词条附界面位置；插件日志和缺词清单只记录明确属于系统控件的文案。 |
| D · 回归和打包 | 分别在 UE 标签页与独立 App 打开设置、展开菜单、切换面板、输入中文、停用和重载。用同一个发布包完成两端验收，修复能够复现的问题。 | 产出压缩包、简短安装说明和验证记录，列出已通过项、未通过项及覆盖边界。 |

遇到某端未启动、桌面无法交互或宿主要求当前会话无法完成的首次 Allow 时，保留该项为待实机验证，继续可独立完成的词库、自动测试和打包。恢复条件后再补该窗口的实际操作；普通浏览器截图或 HTTP 200 单独列为辅助证据。

## 5. 回归用例与交付物

| 场景 | 验收方式 |
| --- | --- |
| 界面与用户内容同词 | 在临时画布中将卡片命名为 `Settings`，在提示框输入 `Generate 中文测试`。检查系统控件已变中文，卡片名、输入法组字和最终文本均正确，保存再打开后内容一致。 |
| 动态菜单与重绘 | 打开卡片右键菜单、Settings 子页和悬浮提示，再关闭并重新打开。检查按钮、提示和读屏标签；用鼠标和键盘点选后仍触发原动作。 |
| 可逆性 | 停用后可见的按钮和提示恢复英文，再启用和连续 Reload 两次。检查新开的菜单也使用正确语言，控制台无新增插件错误，监听器没有累积。 |
| 两端独立验收 | 编辑器页和独立 App 各保存一张能识别窗口的中文界面截图，并记录一次真实点击和输入的结果。使用设置、查找、展开菜单等本地操作即可完成验收。 |

最终保留源码与词库、`output/unreal-canvas-zh-cn-0.1.0.zip`、包内安装与停用说明，以及一份含版本、测试结果和截图位置的简短记录。解压后应得到以插件 ID 命名的文件夹，可直接安装构建好的产物。另查压缩包不含 `node_modules`、用户画布或本机配置。

## 晚上启动时可直接发送

> 请按《Unreal Canvas 简体中文插件开发计划》在当前工程实现并验证首版。先用一个真实设置控件打通编辑器和独立 App 的前端插件加载，再扩充词库。完成能执行的修复、回归和打包；最终给我源码、安装包、两个窗口各自的实测结果，以及仍需处理的条目。
