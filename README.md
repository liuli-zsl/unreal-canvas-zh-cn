# Unreal Canvas 简体中文 0.2.3

适配 Windows 64 位的 UE 5.9 Preview 与 Unreal Canvas 0.21.0。插件在本机为 Canvas 工作区提供简体中文。

## 安装

把解压后直接含有 `UnrealCanvasZhCN.uplugin` 的整个文件夹放入工程的 `Plugins`。打开工程，UE 提示编译时选择“是”，需要本机安装 UE 的 C++ 工具链。选择“工具 → Unreal Canvas”即可打开工作区，独立应用也请从这个编辑器启动。

前端 JavaScript 已随源码提供。维护者如需改动前端，可运行 `npm run setup:sdk` 从本机的官方 Canvas 安装准备匹配的开发包，然后执行 `npm ci`、`npm test` 和 `npm run build`。

本版本可从 Git 历史中取得。当前安装说明和兼容信息见 [项目主页](https://github.com/liuli-zsl/unreal-canvas-zh-cn)。可授权内容及署名见 [许可证](LICENSE)、[NOTICE](NOTICE) 和 [第三方材料](THIRD_PARTY.md)。
