# Unreal Canvas 简体中文协作说明

本文件适用于插件仓库。用户安装和迁移步骤见 [README.md](README.md)，已验证的发布历史见 [CHANGELOG.md](CHANGELOG.md)。

## 阅读顺序与边界

1. 从 `UnrealCanvasZhCN.uplugin`、`Source/UnrealCanvasZhCN/UnrealCanvasZhCN.Build.cs` 和模块的 `Private/UnrealCanvasZhCNModule.cpp` 检查支持的平台、加载阶段和依赖。Bridge 在引擎初始化结束时启动服务，独立 App 继承启动它的编辑器进程环境。
2. 从 `manifest.json`、`src/index.ts`、`src/dictionary.ts` 到 `src/locales/` 跟踪前端加载。动态文案规则与保护逻辑从 `src/translate.ts` 进入。`@merlin/plugin-api` 由宿主供应。
3. 从 `scripts/build.mjs` 跟踪包内前端资源，从 `scripts/package.py` 检查发布文件清单和原生模块凭据。用户数据目录里的手动安装版与工程里的 UE 插件有独立生命周期。
4. 原生菜单及设置键在 `Tools/NativeShell/*.json`。修改后运行 `python Tools/NativeShell/compile.py` 和 `python scripts/verify-native-settings.py --engine <引擎目录>`。独立 App 通过随包描述文件启用主模块，使用同一份编译结果。

## 修改与版本同步

- 在 `main` 提交日常修改。正式版本从核实过的 `main` 提交打 `vX.Y.Z` 标签，GitHub Release 选择同一标签。发布页注明引擎兼容性，按已确认的分发范围附加安装包。
- 维护者用 `Build-Plugin.ps1` 或 `npm run setup:sdk` 校验本机官方 SDK。提交可运行的前端 JS、清单和简体中文资源，使 `main`、Tag 和 Release 的源码都可直接放进 `Plugins`，由 UE 按需编译。SDK、Win64 二进制、维护者打出的 ZIP 与验收截图留在本地。许可证、署名与第三方说明同时进入安装包和网页扩展的手动安装目录。

- 每项可独立交付的插件变更递增一次 `.uplugin` 的 `Version`，按变更影响更新 `VersionName`。同步前端清单、npm 清单和锁文件的版本，运行前端构建同步嵌入资源。`FileVersion` 和 Canvas 的 `apiVersion` 各自跟随对应格式。
- 更新 README 中受影响的安装、功能、版本和兼容范围，在 CHANGELOG 顶部记录日期、实际变更和已执行的验证。同一版本补记验证结果，保留历史记录。
- 新词条先定位真实系统控件，再确定选择器和字段。保留提示词、用户命名和模型标识。新增动态句式时覆盖变量保留和停用恢复；避免全页无条件替换。
- 视口脚本菜单通过宿主行的 React 键和内置脚本标记识别官方脚本。核对两项证据后才翻译可见标签。结构变化或目录中存在自建脚本时保留目录原名。
- 节点插入菜单中的 `Format String` 和 `Text Extract` 通过宿主行组件的 React 键和「逻辑」分类的原始条目核对内置身份。
- 智能体设置的下拉列表可能渲染在面板外。验证时展开列表，核对中文选项以及选中后的原始值；对话里的角色标签和系统状态需与消息正文分别测试。
- 随包扩展目录只容纳发行的汉化包。使用 Canvas 官方扩展加载接口，保持环境设置在当前进程内，保留用户手动安装副本与已有搜索路径。

## 验证与交付

- 前端运行 `npm test` 和 `npm run build`。原生模块发布使用 README 中带 `--engine` 的打包命令，核对模块凭据的 BuildId 和引擎一致。
- UE 预览版升级时，从该引擎随附的 Canvas Server 核对服务版本和 `plugin-sdk` 类型包。用该引擎的本地化资源重新核对英文原文和键，并在 README 中同步安装包与 BuildId 的对应关系。
- 在干净的测试工程和 Canvas 数据目录验证发布包，检查加载源为随包扩展。手动安装的同 ID 副本会优先加载。修改 Win64 版本时同步 `Source/UnrealCanvasZhCN/Private/PluginVersion.rc`。
- 分别记录编辑器和独立 App 的版本、可见译文、点击、输入、停用和重载。明确区分 DOM 测试、普通浏览器、真实嵌入式窗口及系统输入法组字。
- 在已运行的本地 Canvas 服务上，`node scripts/verify-host.mjs <服务地址> <输出目录>` 复验工作区及启停。卡片测试使用名为“汉化插件回归验证”的专用画布，`verify-card.mjs` 的 `--save` 参数会保存并重新打开这张画布。
- 已执行的验收见 [VERIFICATION.md](VERIFICATION.md)。实机截图和日志留在本地测试目录。发行包按脚本中的清单生成。
- 在新插件上复用三份文档的编写流程时，调用 `$ue-plugin-docs` 并给出插件目录。[技能源文件](Tools/Skills/ue-plugin-docs/SKILL.md)

较长的宿主说明以 UTF-16 长度及 FNV-1a 指纹匹配。用 `node scripts/copy-id.mjs "本机看到的完整提示"` 计算词库键。保留选择器、字段及节点类型限制，为显示内容编写独立的中文说明。智能体设置的专用词库用同一命令加 `--id` 获取短标识。
