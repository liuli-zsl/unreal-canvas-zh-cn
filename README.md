# Unreal Canvas 简体中文

UE 插件 **0.2.7** 为编辑器标签页和从该编辑器启动的独立 Unreal Canvas App 提供离线简体中文。本版面向 Windows 64 位、UE 5.9 Preview 2（编辑器 BuildId `60738873`）和 Unreal Canvas 0.24.0。

## 安装

1. 从 `main`、所需版本的 Tag 或 GitHub Release 下载并解压，把**直接含有 `UnrealCanvasZhCN.uplugin` 的整个目录**放入工程的 `Plugins`。也可以直接克隆到 `Plugins` 下。保留 GitHub 解压后的目录名即可，例如 `你的工程/Plugins/unreal-canvas-zh-cn-main/UnrealCanvasZhCN.uplugin`。
2. 打开或重启工程。首次放入工程的插件默认启用，UE 会一同加载 Unreal Canvas Bridge。如果 UE 提示重新编译，点「是」即可（需已安装 UE 的 C++ 工具链）。如果你曾在该工程中手动停用汉化，可在 **编辑 → 插件** 中重新勾选 **Unreal Canvas 简体中文**。
3. 选择 **工具 → Unreal Canvas** 或 **工具 → 启动 Unreal Canvas 独立应用**（英文界面为 **Launch Unreal Canvas App**）。打开工作区后，齿轮的提示和设置面板会显示中文。已经打开的独立 App 需要先保存工作、退出，再从这个工程启动。

首次使用 Unreal Canvas 时请按 Epic 的提示安装 Canvas 本体。公开下载提供源码安装包，内含前端 JavaScript 和编译好的中文词库。首次安装只需 UE 编译 C++ 模块，编辑器和独立 App 共用编译结果。[下载 v0.2.7](https://github.com/liuli-zsl/unreal-canvas-zh-cn/releases/tag/v0.2.7)

## Main、Tag 和 GitHub Release

日常修改提交到 `main`。推送 `main` 后，其他电脑可以拉取这些提交。正式发版时，先选定并验证 `main` 上的一个提交，给它打 `vX.Y.Z` 标签（Tag），推送该标签，再在 GitHub 选择同一标签创建同名 Release。

| 在哪里看 | 它表示什么 |
| --- | --- |
| `main` | 开发主线，随新提交前进。 |
| Tag | 指向一个确定的版本提交。发版后保留标签的指向，修复随下一版本发布。 |
| GitHub Release | 与一个 Tag 关联的发布页，说明改动和兼容性。自动提供的 **Source code (zip)** 可按上面的步骤安装。本版的源码安装附件与该标签使用同一份文件。 |

## 停用、升级与旧版迁移

- 网页工作区可在 Canvas 的 **设置 → 扩展 → 已安装 → 插件** 中临时关闭汉化。原生菜单跟随宿主界面语言，选择简体中文时使用随包译文。
- 要停用整个 UE 插件，在 UE 插件面板取消勾选并重启。独立 App 也要退出，再从该编辑器启动。通过桌面直接启动的独立 App 使用它自己的扩展配置。
- 升级前保存工作并关闭编辑器和独立 App，再替换工程中的插件文件夹。
- 升级后重新打开工程，再从该编辑器启动独立 App。Canvas 的实时日志会显示当前插件版本号。
- 如果以前运行过 `install.ps1`，Canvas 会优先加载用户目录里的同 ID 副本。迁移时关闭两个宿主，将旧的 `%APPDATA%/com.epicgames.unrealcanvas/plugins/unreal-canvas-zh-cn` 移到 `plugins` 目录之外作为备份，再从 UE 启动。自定义数据目录以该服务 `GET /api/plugins/installed` 的 `installRoot` 为准。

## 汉化范围

连接智能体后，点对话输入框底部的模型与权限摘要，打开 **智能体设置 → 自定义**。0.2.6 补译了权限、推理强度、行为、记忆和工具等选项，也补译了聊天中的工作状态、发言人标签和本条消息的技能说明。模型名和对话名称按原名显示。

在“连接你的智能体 → 最后检查”中，0.2.5 补齐了连接说明和检查结果。选择本地 Codex 时，Canvas 向它实际启动的 Codex CLI 请求可见模型。桌面版和单独安装的 CLI 可能使用不同版本。更新 Canvas 使用的 CLI 后，返回向导上一步并重新检查即可刷新列表。

0.2.4 同步了 Preview 2 的可选组件下载、场景审核、视口菜单、扩展目录和导入确认等原生文案，随包提供 279 个原生文本键。新版的卡片右键菜单、编辑器连接状态、“设置 → 外部路径 → 本地服务器”和 ComfyUI 工作流入口也有中文。

在节点图空白处右键，打开 **几何**。0.2.3 翻译了 Bridge 提供的默认 28 个分类、381 项操作。启用实验几何操作后，可见 30 个分类、408 项操作。插入节点后，“操作”下拉框也使用中文。节点标题可以重命名，已有名称保留原文。

独立 App 的编辑器连接菜单现在会显示“运行中的编辑器”“最近的工程”等分组，展开后可查找关卡。消息、技能、任务、活动及角色外观面板，以及资源归档、多视频对齐、USD 场景树分页和时间线修剪控件也补了中文。

0.2.2 补上了展开后才能看到的界面，包括 `Ctrl+F` 画布查找、节点库分类、卡片排列、框架布局、批注画笔与颜色、批量输入、资源树排序和自定义筛选。添加模型服务商、连接凭据、安装扩展和智能体高级选项现在也有中文说明。

节点库可以按中文分类浏览。要用关键词查找内置节点，请输入英文名（如 `image`）。画布查找支持直接输入卡片的中文或英文原名。

在 0.24.0 的节点搜索结果中，`Format String` 和 `Text Extract` 与同名自定义节点共用显示结构，因此这两个名称保留英文。UE 项目设置中的公共分类标题 `Extensions` 也会显示英文，其下方的 Bridge 字段“扩展目录”已有中文。

原生资源覆盖独立 App 的“编辑、窗口、帮助”菜单及其固定子项、Canvas 设置和版本管理。部分直接由宿主拼接的选项，例如 `(use project default)`，仍会显示英文。脚本菜单里的 `Viewport Snapshot`、`Sequence Render` 等名称按原名显示，用户可以创建同目录同名的脚本。

0.2.1 新增视频起始帧和结束帧、音频采样率、网格面数上限、批量运行、脚本搜索和参数说明等译文。设置覆盖 13 个分类，包括快捷键和模型路由状态。画布和卡片菜单、帮助指南、时间线、脚本编辑、资源库筛选、日志和媒体查看器也增加了中文控件。

用户卡片名、自定义脚本名、提示词、聊天正文、模型标识及资产路径保留原文。翻译在本机完成。开发时更新了包内词库，可以分别在已打开的 Canvas 窗口进入 **设置 → 扩展 → Unreal Canvas 简体中文 → 重新加载**。

上游界面的英文或 DOM 结构变化可能使词条失配。第三方扩展自行绘制的界面、服务商返回的原始报错、部分 Bridge 下载与启动提示，以及单独的 **Unreal Canvas (Native)** Slate 图编辑器仍可能显示英文。

## 维护者重新生成资源和安装附件

| 入口 | 用途 |
| --- | --- |
| `Source/UnrealCanvasZhCN/Private/UnrealCanvasZhCNModule.cpp` | 在 Bridge 启动 Server 前，把包内专用资源目录加入本编辑器进程的 Canvas 随包扩展搜索路径。 |
| `src/locales/`、`src/dictionary.ts` | 按设置、菜单、面板、生成、编辑和查看器组织的离线词库，由统一入口加载。 |
| `src/translate.ts`、`src/index.ts` | 原位处理显示文本、动态菜单和属性，通过宿主的 `loadSignal` 清理并恢复原文。 |
| `Resources/CanvasPlugins/unreal-canvas-zh-cn/` | 两个宿主加载的前端包。构建脚本会同步根目录的清单和打包后的 JS。 |
| `Tools/NativeShell/`、`Resources/NativeShell/` | 原生界面的匹配键、中文文案、生成工具，以及两个宿主共用的中文资源。安装时保留其目录结构。 |
| `scripts/package.py` | 用显式文件清单生成 Windows UE 插件压缩包。 |

维护者修改前端、重生成词库或制作预编译附件时，另需 Node.js 24（含 npm）和 Python 3.10 或以上版本。先从 UE 启动一次官方 Canvas 0.24.0，再在源码根目录运行下面的命令，把示例引擎路径改为本机安装目录。

```powershell
.\Build-Plugin.ps1 -EngineRoot 'C:\Program Files\Epic Games\UE_5.9'
```

脚本读取本机官方 Canvas 提供的 `unreal-canvas-plugin-api-1.67.0.tgz`，校验锁文件中的 SHA-512，再安装依赖、运行测试、编译和打包。SDK 位于自定义目录时可追加 `-SdkArchive '完整的 SDK 归档路径'`。成功后到 `output/` 取安装 ZIP。前端开发可单独运行以下命令。

```powershell
npm.cmd run setup:sdk
npm.cmd ci
npm.cmd test
npm.cmd run build
```

各版本已有的编辑器与独立 App 实机验收见项目记录。[验收记录](VERIFICATION.md) · [更新记录](CHANGELOG.md) · [协作说明](AGENTS.md)

## 许可与署名

作者有权授权的内容采用 Apache License 2.0，可免费使用、修改和商用。再分发时请随附许可证，保留适用的版权和署名声明，并在已修改的文件中注明改动。可以在随包说明中写「基于 liuli-zsl 的 Unreal Canvas 简体中文修改」并附上原项目地址，无需通知作者。[许可证](LICENSE) · [原项目署名](NOTICE) · [第三方材料](THIRD_PARTY.md)
