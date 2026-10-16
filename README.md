# 尘途修仙：源码恢复工程

本工程由 Windows 阶段 A 运行包反推恢复，现已在恢复界面上继续开发本地单人玩法。当前目录是可编辑的 React/Electron 源码工程，不是丢失前文件的逐字还原。

## 0.2 本地修炼

- 打坐时每秒获得 1 点修为，切换到其他动作会暂停增长。
- 支持炼气一层至炼气九层，修为达到门槛后可突破并保留溢出值。
- 关闭程序后按最后一次打坐状态结算离线收益，单次最多计算 8 小时。
- 主进程将修炼状态原子写入 Electron 用户数据目录，渲染页面不能直接读写文件。
- 设置页可通过系统文件对话框导出或导入 JSON 存档；导入时会校验文件身份和版本、清理异常字段，并在覆盖前自动保留旧存档副本。

当前仍不包含账号、服务器、云同步、多人玩法、背包、炼丹产出或真实游历结算。

## 恢复范围

- `src/renderer/App.jsx`：从当前运行包使用的前端 bundle 中提取的界面代码。保留 React 元素调用形式，函数内部的局部变量名部分已被打包器缩短。
- `src/renderer/Character.jsx`：现使用从 `docs/character-reference.png` 提取的透明正面像素精灵。`src/renderer/assets/character-front.png` 是运行时素材；`scripts/extract-reference-sprite.py` 可用 Pillow 和 NumPy 重新生成它。
- `scripts/recover-from-release.cjs`：可重复执行的提取脚本。传入原 Windows 运行包目录后会重新生成恢复文件，覆盖现有编辑，适用于核对来源，不适用于日常构建。
- `src/renderer/styles.css`：以运行包样式为基础，现包含像素精灵与动作预览样式。
- `src/electron/`：从编译输出恢复的主进程、preload、偏好规则和托盘补注册脚本。
- `assets/tray.ico`：运行包中的托盘图标。
- `docs/`：从现有运行包复制的需求、进度、交接和测试记录，作为历史资料保存。

后续功能进度、验证证据和错误原因统一维护在 [开发记录](docs/开发记录.md)。旧文档作为历史快照，不重复追加开发状态。

所有开发者和 AI 接手项目时，必须先阅读 `docs/开发记录.md` 的“所有开发者和 AI 必须遵守的记录与交付规则”。该规则要求：真实验证后才记录功能；同一功能只保留一条记录；修复时填写错误原因并合并重复记录；完成后提交并推送 Git，推送失败要明确记录。

恢复的是当前原型行为。原 TypeScript 类型、注释、测试、构建脚本和源码文件边界无法从无 source map 的运行包精确还原。文档或旧备份与当前运行包有出入时，以运行包为准。

## 构建

使用 Node.js 22+ 和 pnpm：

```powershell
pnpm install
pnpm build
pnpm test
pnpm smoke
```

`pnpm start` 使用 Electron 的正常沙盒启动。原运行包在原机器上曾有正常启动提前退出的问题；仅在受信任的本地原型环境下，可用 `pnpm start:diagnostic` 传入 `--no-sandbox` 诊断。这个命令不适合联网发布。

如果 Electron 运行时无法在线下载，可以用现有 Windows 运行包测试重建结果：

```powershell
node scripts/package-from-release.cjs "C:\Users\Administrator\Desktop\尘途修仙"
```

此命令创建 `release/recovered-win`，不会修改原运行包，也不会复制其中的用户配置。新目录包含现有运行时、重新构建的界面和桌面代码，以及原来的诊断启动器。

运行包中的托盘修复依赖 Electron 35.7.5 的 Windows 内部实现。升级 Electron 前需要复核并重新测试。当前工程有本地修炼存档，但不含服务端、账号、云同步或多人游戏逻辑。

## 本次验证

Windows x64、Node.js 24.19.0、pnpm 11.25.0、Electron 35.7.5 环境下，生产构建、9 项单元测试和正常沙盒原生 smoke 均通过。smoke 覆盖渲染桥接、修为增长与落盘、动作、置顶、缩放、穿透、洞府/桌宠切换、托盘隐藏恢复和屏外位置恢复。导出文件对话框已人工生成有效 JSON；Mac、长期运行、真实多屏拔插以及导入对话框的指定文件选择仍需人工实机验收。
