# 尘途修仙：源码恢复工程

本工程由 Windows 阶段 A 运行包反推恢复。当前目录是可编辑的 React/Electron 源码工程，不是丢失前文件的逐字还原。

## 恢复范围

- `src/renderer/App.jsx`：从当前运行包使用的前端 bundle 中提取的界面代码。保留 React 元素调用形式，函数内部的局部变量名部分已被打包器缩短。
- `src/renderer/Character.jsx`：现使用从 `docs/character-reference.png` 提取的透明正面像素精灵。`src/renderer/assets/character-front.png` 是运行时素材；`scripts/extract-reference-sprite.py` 可用 Pillow 和 NumPy 重新生成它。
- `scripts/recover-from-release.cjs`：可重复执行的提取脚本。传入原 Windows 运行包目录后会重新生成恢复文件，覆盖现有编辑，适用于核对来源，不适用于日常构建。
- `src/renderer/styles.css`：以运行包样式为基础，现包含像素精灵与动作预览样式。
- `src/electron/`：从编译输出恢复的主进程、preload、偏好规则和托盘补注册脚本。
- `assets/tray.ico`：运行包中的托盘图标。
- `docs/`：从现有运行包复制的需求、进度、交接和测试记录，作为历史资料保存。

后续功能进度、验证证据和错误原因统一维护在 [开发记录](docs/开发记录.md)。旧文档作为历史快照，不重复追加开发状态。

恢复的是当前原型行为。原 TypeScript 类型、注释、测试、构建脚本和源码文件边界无法从无 source map 的运行包精确还原。文档或旧备份与当前运行包有出入时，以运行包为准。

## 构建

使用 Node.js 22+ 和 pnpm：

```powershell
pnpm install
pnpm build
pnpm test
```

`pnpm start` 使用 Electron 的正常沙盒启动。原运行包在原机器上曾有正常启动提前退出的问题；仅在受信任的本地原型环境下，可用 `pnpm start:diagnostic` 传入 `--no-sandbox` 诊断。这个命令不适合联网发布。

如果 Electron 运行时无法在线下载，可以用现有 Windows 运行包测试重建结果：

```powershell
node scripts/package-from-release.cjs "C:\Users\Administrator\Desktop\尘途修仙"
```

此命令创建 `release/recovered-win`，不会修改原运行包，也不会复制其中的用户配置。新目录包含现有运行时、重新构建的界面和桌面代码，以及原来的诊断启动器。

运行包中的托盘修复依赖 Electron 35.7.5 的 Windows 内部实现。升级 Electron 前需要复核并重新测试。当前工程不含服务端、账号、真实修炼存档或多人游戏逻辑。

## 本次验证

恢复后的前端与原运行包在 440×660 浏览器视口下呈现相同的洞府画面；动作切换、设置页和桌宠视图交互通过。Vite 构建及恢复的设置规则测试通过。隔离 Windows 副本启动后未生成原生 smoke 结果，因此尚未重新确认桌面窗口和托盘行为。原包已记录的沙盒启动限制也未在本次恢复中修复。
