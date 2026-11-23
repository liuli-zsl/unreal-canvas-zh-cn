# Unreal Canvas 简体中文

由 liuli-zsl 独立维护的社区插件，为 UE 编辑器中的 Unreal Canvas 和从该编辑器启动的独立 App 提供离线简体中文。

**[下载最新正式版](https://github.com/liuli-zsl/unreal-canvas-zh-cn/releases/latest)** · [各版本与更新记录](CHANGELOG.md)

本源码版本 **0.2.10** 适用于 Win64、UE 5.9 Preview 2（编辑器 BuildId `60738873`）和 Unreal Canvas 0.24.0。请通过 Epic 安装 Canvas 本体，并准备 UE 的 C++ 工具链，用于首次编译插件模块。

## 安装

1. 在正式版页面下载源码安装 ZIP 或 **Source code (zip)**，解压后把直接含有 `UnrealCanvasZhCN.uplugin` 的整个目录放进工程的 `Plugins`。保留解压目录名即可。从 `main` 克隆到 `Plugins` 可体验开发版。
2. 打开或重启工程。首次放入工程的插件默认启用，UE 会一同加载 Unreal Canvas Bridge。如果 UE 提示重新编译，点「是」即可（需已安装 UE 的 C++ 工具链）。如果你曾在该工程中手动停用汉化，可在 **编辑 → 插件** 中重新勾选 **Unreal Canvas 简体中文**。
3. 选择 **工具 → Unreal Canvas** 或 **工具 → 启动 Unreal Canvas 独立应用**（英文界面为 **Launch Unreal Canvas App**）。打开工作区后，齿轮的提示和设置面板会显示中文。已经打开的独立 App 需要先保存工作、退出，再从这个工程启动。

## 停用、升级与旧版迁移

- 网页工作区可在 Canvas 的 **设置 → 扩展 → 已安装 → 插件** 中临时关闭汉化。原生菜单跟随宿主界面语言，选择简体中文时使用随包译文。
- 要停用整个 UE 插件，在 UE 插件面板取消勾选并重启。独立 App 也要退出，再从该编辑器启动。通过桌面直接启动的独立 App 使用它自己的扩展配置。
- 升级前保存工作并关闭编辑器和独立 App，再替换工程中的插件文件夹。
- 升级后重新打开工程，再从该编辑器启动独立 App。Canvas 的实时日志会显示当前插件版本号。
- 如果以前运行过 `install.ps1`，Canvas 会优先加载用户目录里的同 ID 副本。迁移时关闭两个宿主，将旧的 `%APPDATA%/com.epicgames.unrealcanvas/plugins/unreal-canvas-zh-cn` 移到 `plugins` 目录之外作为备份，再从 UE 启动。自定义数据目录以该服务 `GET /api/plugins/installed` 的 `installRoot` 为准。

## 汉化范围

- **画布与节点**覆盖顶栏、设置、卡片菜单、生成工具架、模型列表、视口脚本、参考素材及几何节点分类与操作。
- **智能体与媒体**覆盖连接向导、权限选项、聊天状态、资源库、时间线与媒体查看器。
- **原生界面**覆盖UE 工程中的 Bridge 设置，以及独立 App 的编辑、窗口和帮助菜单。覆盖范围与已知限制随宿主版本变化。[逐版改动](CHANGELOG.md)

节点库可以按中文分类浏览。要用关键词查找内置节点，请输入英文名（如 `image`）。画布查找支持直接输入卡片的中文或英文原名。

节点图的「逻辑」分类显示内置节点「格式化字符串」和「提取文本」。节点搜索结果与同名自定义节点仍显示英文原名。UE 项目设置中的公共分类标题 `Extensions` 会显示英文，其下方的 Bridge 字段“扩展目录”已有中文。

原生资源覆盖独立 App 的“编辑、窗口、帮助”菜单及其固定子项、Canvas 设置和版本管理。部分直接由宿主拼接的选项，例如 `(use project default)`，仍会显示英文。脚本菜单中的译名按内置身份匹配。自建脚本及包含自建脚本的文件夹按原名显示。

用户卡片名、自定义脚本名、提示词、聊天正文、模型标识及资产路径保留原文。翻译在本机完成。开发时更新了包内词库，可以分别在已打开的 Canvas 窗口进入 **设置 → 扩展 → Unreal Canvas 简体中文 → 重新加载**。

上游界面的英文或 DOM 结构变化可能使词条失配。第三方扩展自行绘制的界面、服务商返回的原始报错、部分 Bridge 下载与启动提示，以及单独的 **Unreal Canvas (Native)** Slate 图编辑器仍可能显示英文。

发现漏译时，请通过[漏译反馈](https://github.com/liuli-zsl/unreal-canvas-zh-cn/issues/new?template=missing-translation.yml)提供版本、窗口和控件位置。

## 维护者生成公开源码包

GitHub 根据发布 Tag 自动提供 **Source code (zip)**。如需同版的命名附件，从已审核的标签归档。下面以 `v0.2.7` 为例，发版时将标签换成目标版本。

```powershell
$tag = 'v0.2.7'
$version = $tag.TrimStart('v')
New-Item -ItemType Directory -Force -Path output | Out-Null
git archive --format=zip --prefix=UnrealCanvasZhCN/ --output="output/UnrealCanvasZhCN-$version-Source.zip" "refs/tags/$tag"
```

上传前核对源码包里的插件版本、前端 JS、简体中文资源和许可文件。Release 选择同一标签，写明自上个正式版以来的改动、宿主兼容范围和实际验收结果。

## 维护者重新生成资源和本地 Win64 安装包

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

脚本读取本机官方 Canvas 提供的 `unreal-canvas-plugin-api-1.67.0.tgz`，校验锁文件中的 SHA-512，再安装依赖、运行测试、编译和打包。SDK 位于自定义目录时可追加 `-SdkArchive '完整的 SDK 归档路径'`。本机验收使用 `output/UnrealCanvasZhCN-<版本>-UE5.9-Win64.zip`，其中含按该编辑器 BuildId 编译的 DLL。GitHub 公开附件使用上一节生成的 `-Source.zip`。前端开发可单独运行以下命令。

```powershell
npm.cmd run setup:sdk
npm.cmd ci
npm.cmd test
npm.cmd run build
```

各版本已有的编辑器与独立 App 实机验收见项目记录。[验收记录](VERIFICATION.md) · [更新记录](CHANGELOG.md) · [协作说明](AGENTS.md)

## 许可与署名

作者有权授权的内容采用 Apache License 2.0，可免费使用、修改和商用。再分发时请随附许可证，保留适用的版权和署名声明，并在已修改的文件中注明改动。可以在随包说明中写「基于 liuli-zsl 的 Unreal Canvas 简体中文修改」并附上原项目地址，无需通知作者。[许可证](LICENSE) · [原项目署名](NOTICE) · [第三方材料](THIRD_PARTY.md)
