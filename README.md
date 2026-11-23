# Unreal Canvas 简体中文

由 liuli-zsl 独立维护的社区插件，为 UE 编辑器中的 Unreal Canvas 和从该编辑器启动的独立 App 提供离线简体中文。

**[下载最新正式版](https://github.com/liuli-zsl/unreal-canvas-zh-cn/releases/latest)** · [各版本与更新记录](Tools/Docs/CHANGELOG.md)

本源码版本 **0.2.11** 适用于 Win64、UE 5.9 Preview 2（编辑器 BuildId `60738873`）和 Unreal Canvas 0.24.0。请通过 Epic 安装 Canvas 本体。

## 安装

1. 选择与插件版本、UE 版本、编辑器 BuildId 和 Canvas 版本匹配的 Win64 预编译 ZIP。本版文件名为 `UnrealCanvasZhCN-0.2.11-UE5.9-Win64.zip`。
2. 将 ZIP 直接解压到工程的 `Plugins/`。解压后应能找到 `Plugins/UnrealCanvasZhCN/UnrealCanvasZhCN.uplugin`。
3. 打开工程，在 **编辑 → 插件** 确认已启用 **Unreal Canvas 简体中文**，按 UE 提示重启。UE 会一同加载 Unreal Canvas Bridge，前端扩展也会自动启用。

用 **工具 → Unreal Canvas** 打开编辑器内的工作区，或选择 **工具 → 启动 Unreal Canvas 独立应用**（英文界面为 **Launch Unreal Canvas App**）。两处的齿轮都能打开中文设置。已经打开的独立 App 需要先保存工作、退出，再从这个工程启动。

历史正式版 `v0.2.9` 提供源码包。使用该版源码或直接克隆仓库时，首次编译需要 UE 的 C++ 工具链。使用预编译 ZIP 时如果 UE 提示重新编译，请先核对附件和编辑器 BuildId。

## 停用、升级与旧版迁移

- 网页工作区可在 Canvas 的 **设置 → 扩展 → 已安装 → 插件** 中临时关闭汉化。原生菜单跟随宿主界面语言，选择简体中文时使用随包译文。
- 要停用整个 UE 插件，在 UE 插件面板取消勾选并重启。独立 App 也要退出，再从该编辑器启动。通过桌面直接启动的独立 App 使用它自己的扩展配置。
- 升级前保存工作并关闭编辑器和独立 App，再替换工程中的插件文件夹。
- 升级后重新打开工程，再从该编辑器启动独立 App。Canvas 的实时日志会显示当前插件版本号。
- 如果以前用 `install.ps1` 手动安装过前端（当前源码入口为 `Tools/Frontend/install.ps1`），Canvas 会优先加载用户目录里的同 ID 副本。迁移时关闭两个宿主，将旧的 `%APPDATA%/com.epicgames.unrealcanvas/plugins/unreal-canvas-zh-cn` 移到 `plugins` 目录之外作为备份，再从 UE 启动。自定义数据目录以该服务 `GET /api/plugins/installed` 的 `installRoot` 为准。

## 汉化范围

- **画布与节点**覆盖顶栏、设置、卡片菜单、生成工具架、模型列表、视口脚本、参考素材及几何节点分类与操作。
- **智能体与媒体**覆盖连接向导、权限选项、聊天状态、资源库、时间线与媒体查看器。
- **原生界面**覆盖UE 工程中的 Bridge 设置，以及独立 App 的编辑、窗口和帮助菜单。覆盖范围与已知限制随宿主版本变化。[逐版改动](Tools/Docs/CHANGELOG.md)

节点库可以按中文分类浏览。要用关键词查找内置节点，请输入英文名（如 `image`）。画布查找支持直接输入卡片的中文或英文原名。

节点图的「逻辑」分类显示内置节点「格式化字符串」和「提取文本」。节点搜索结果与同名自定义节点仍显示英文原名。UE 项目设置中的公共分类标题 `Extensions` 会显示英文，其下方的 Bridge 字段“扩展目录”已有中文。

原生资源覆盖独立 App 的“编辑、窗口、帮助”菜单及其固定子项、Canvas 设置和版本管理。部分直接由宿主拼接的选项，例如 `(use project default)`，仍会显示英文。脚本菜单中的译名按内置身份匹配。自建脚本及包含自建脚本的文件夹按原名显示。

用户卡片名、自定义脚本名、提示词、聊天正文、模型标识及资产路径保留原文。翻译在本机完成。开发时更新了包内词库，可以分别在已打开的 Canvas 窗口进入 **设置 → 扩展 → Unreal Canvas 简体中文 → 重新加载**。

上游界面的英文或 DOM 结构变化可能使词条失配。第三方扩展自行绘制的界面、服务商返回的原始报错、部分 Bridge 下载与启动提示，以及单独的 **Unreal Canvas (Native)** Slate 图编辑器仍可能显示英文。

发现漏译时，请通过[漏译反馈](https://github.com/liuli-zsl/unreal-canvas-zh-cn/issues/new?template=missing-translation.yml)提供版本、窗口和控件位置。

## 维护者生成公开源码包

GitHub 根据发布 Tag 自动提供 **Source code (zip)**。如需同版的命名源码附件，在已核实并打好标签的发布提交上运行：

```powershell
$version = (Get-Content -Raw UnrealCanvasZhCN.uplugin | ConvertFrom-Json).VersionName
$tag = "v$version"
$out = "Tools/Artifacts/Packages/Builds/Source/$tag"
New-Item -ItemType Directory -Force -Path $out | Out-Null
$zip = "$out/UnrealCanvasZhCN-$version-Source.zip"
if (Test-Path -LiteralPath $zip) { throw "此标签的源码包已存在：$zip" }
git archive --format=zip --prefix=UnrealCanvasZhCN/ --output="$zip" "refs/tags/$tag"
```

上传前核对源码包里的插件版本、前端 JS、简体中文资源和许可文件。Release 选择同一标签，写明自上个正式版以来的改动、宿主兼容范围和实际验收结果。

## 维护者重新生成资源和本地 Win64 安装包

| 入口 | 用途 |
| --- | --- |
| `Source/UnrealCanvasZhCN/Private/UnrealCanvasZhCNModule.cpp` | 在 Bridge 启动 Server 前，把包内专用资源目录加入本编辑器进程的 Canvas 随包扩展搜索路径。 |
| `Tools/Frontend/src/` | 汉化入口、翻译逻辑与分类词库。测试、npm 清单和构建脚本都在 `Tools/Frontend/`。 |
| `Resources/CanvasPlugins/unreal-canvas-zh-cn/` | 两个宿主加载的前端包。构建时向这里直接写入 JS，并同步前端清单。 |
| `Content/Localization/UnrealCanvasShellZhCN/` | 编辑器与独立 App 共用的原生简体中文资源。 |
| `Tools/NativeShell/`、`Resources/NativeShell/` | 前者维护原生词条并生成资源，后者提供独立 App 发现主插件所需的描述文件。 |
| `Tools/Packaging/package.py` | 用显式文件清单生成 Windows UE 插件压缩包。 |
| `Tools/Artifacts/` | 本机安装包和验收资料，Git 忽略此目录。历史包、截图、原始记录分别放在 `Packages/`、`Verification/Screenshots/` 和 `Verification/Runs/`。 |

维护者修改前端、重生成词库或制作预编译附件时，另需 Node.js 24（含 npm）和 Python 3.10 或以上版本。先从 UE 启动一次官方 Canvas 0.24.0，再在源码根目录运行下面的命令，把示例引擎路径改为本机安装目录。

```powershell
.\Tools\Packaging\Build-Plugin.ps1 -EngineRoot 'C:\Program Files\Epic Games\UE_5.9'
```

脚本读取本机官方 Canvas 提供的 `unreal-canvas-plugin-api-1.67.0.tgz`，校验锁文件中的 SHA-512，再安装依赖、运行测试、编译和打包。SDK 位于自定义目录时可追加 `-SdkArchive '完整的 SDK 归档路径'`。新 Win64 包保存在 `Tools/Artifacts/Packages/Builds/<ZIP 的 SHA-256>/`，脚本结束时显示完整路径。同版本的不同包各自保留。正式 Release 上传该标签验证过的免编译包，列明插件、UE、Canvas 版本、平台和编辑器 BuildId。源码附件可一同提供。

从仓库根目录进入前端工程后，可单独安装依赖、运行测试和构建。

```powershell
Set-Location Tools/Frontend
npm.cmd run setup:sdk
npm.cmd ci
npm.cmd test
npm.cmd run build
```

各版本已有的编辑器与独立 App 实机验收见项目记录。[验收记录](Tools/Docs/VERIFICATION.md) · [更新记录](Tools/Docs/CHANGELOG.md) · [协作说明](AGENTS.md)

## 许可与署名

作者有权授权的内容采用 Apache License 2.0，可免费使用、修改和商用。再分发时请随附许可证，保留适用的版权和署名声明，并在已修改的文件中注明改动。可以在随包说明中写「基于 liuli-zsl 的 Unreal Canvas 简体中文修改」并附上原项目地址，无需通知作者。[许可证](LICENSE) · [原项目署名](NOTICE) · [第三方材料](Tools/Docs/THIRD_PARTY.md)
