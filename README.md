# 尘途修仙

本工程由 Windows 阶段 A 运行包反推恢复，现已继续开发为可直接使用浏览器游玩的 React 网页、可安装 PWA、Electron 桌宠客户端和 Fastify 服务端工作区。当前目录不是丢失前文件的逐字还原。

## 网页与悬浮桌宠

- 浏览器版本拥有完整的本地修炼循环，存档自动写入当前浏览器的 `localStorage`。
- Chrome、Edge 等支持 Document Picture-in-Picture 的桌面浏览器可点击“召唤”，打开始终置顶的悬浮桌宠小窗。
- 不支持悬浮窗的浏览器会自动退回页面桌宠模式，不影响修炼和存档。
- 网页存档可导出为 JSON，并可与 Electron 客户端的 v1/v2 存档互相导入。
- PWA manifest 和 service worker 已启用；浏览器提供安装入口时，可直接安装为独立网页应用。
- `.github/workflows/pages.yml` 会在 `main` 更新后构建并发布 GitHub Pages，也可从 Actions 页面手动触发。

本地运行网页版本：

```powershell
pnpm install
pnpm dev
```

打开 `http://127.0.0.1:5173/`。生产构建与网页 smoke：

```powershell
pnpm build
pnpm smoke:web
```

悬浮桌宠需要 HTTPS 或 `127.0.0.1`，并且必须由用户点击“召唤”打开。关闭主网页后，浏览器会同时关闭悬浮桌宠。

## 0.3 本地洞府循环

- 打坐时每秒获得 1 点修为，切换到其他动作会暂停增长。
- 支持炼气一层至炼气十三层与筑基初期，突破保留溢出值；筑基需消耗筑基丹。
- 关闭程序后按最后一次打坐状态结算离线收益，单次最多计算 8 小时。
- 洞府包含两块药田，可种植并收获凝露草；药园作为被动生产，不占用主任务。
- 丹房可炼制聚气丹和筑基丹；聚气丹可直接增加修为，炼丹期间不能同时历练。
- 青石岭支持一次本地确定性历练，完成后领取灵石、灵草、矿材与妖兽内丹。
- 行囊展示六类资源，并在生产、历练、服丹和突破时原子更新本地存档。
- 主进程将修炼状态原子写入 Electron 用户数据目录，渲染页面不能直接读写文件。
- 存档升级为 v2，同时兼容导入 v0.2 的 v1 存档；导入时会校验身份和版本、清理异常字段，并在覆盖前保留旧存档副本。

当前仍不包含账号接口、云同步、多人玩法、装备、宗门或服务端权威结算。网页和 Electron 的资源与计时目前均为本地单人规则。

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
pnpm smoke:web
```

`pnpm start` 使用 Electron 的正常沙盒启动。原运行包在原机器上曾有正常启动提前退出的问题；仅在受信任的本地原型环境下，可用 `pnpm start:diagnostic` 传入 `--no-sandbox` 诊断。这个命令不适合联网发布。

如果 Electron 运行时无法在线下载，可以用现有 Windows 运行包测试重建结果：

```powershell
node scripts/package-from-release.cjs "C:\Users\Administrator\Desktop\尘途修仙"
```

此命令创建 `release/recovered-win`，不会修改原运行包，也不会复制其中的用户配置。新目录包含现有运行时、重新构建的界面和桌面代码，以及原来的诊断启动器。

运行包中的托盘修复依赖 Electron 35.7.5 的 Windows 内部实现。升级 Electron 前需要复核并重新测试。当前工程包含服务端基础和本地修炼存档，但尚未开放账号、云同步或多人游戏接口。

## v0.4 服务端基础

服务端代码位于 `server/`，当前包含 Fastify、PostgreSQL 连接、顺序数据库迁移、邀请码注册、密码登录、Bearer 会话和带版本冲突保护的云存档 API。数据库保存密码的 `scrypt` 哈希以及邀请码、会话令牌的 SHA-256 摘要，不保存这些凭据的明文。客户端账号界面、自动同步、接口限流和服务端权威修炼结算仍待实现。

安装工作区依赖并运行服务端测试：

```powershell
pnpm install
pnpm test:server
pnpm build:server
```

已安装 Docker 的机器可以在仓库根目录运行：

```powershell
docker compose up --build
```

服务启动后访问 `http://127.0.0.1:3000/health`。详细本地开发方式见 [服务端说明](server/README.md)。

`.github/workflows/ci.yml` 会分别验证 Windows 客户端和带 PostgreSQL 的 Linux 服务端。`.github/workflows/pages.yml` 负责网页发布。未来推送新的 `v*` 标签时，`.github/workflows/release.yml` 会运行测试、生成 Windows x64 免安装 ZIP、计算 SHA-256，并上传到对应 GitHub Release。现有标签不会因新增工作流自动重新触发。

## 本次验证

Windows x64、Node.js 24.19.0、Electron 35.7.5 环境下，生产构建、15 项单元测试、正常沙盒原生 smoke 和无 preload 网页 smoke 均通过。网页 smoke 覆盖网页桥接、启用状态、修炼计时、药田操作、`localStorage` 落盘、模拟悬浮窗口中的 React 桌宠渲染以及悬浮调用失败时的页面回退；生产截图已目视检查。真实 Chrome/Edge 系统悬浮小窗和 PWA 安装仍需部署后人工验收。Mac、长期运行、真实多屏拔插以及 v2 导入导出的完整人工往返仍需实机验收。
