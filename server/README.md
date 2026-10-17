# 尘途修仙服务端

服务端提供 Fastify API、PostgreSQL 持久化、顺序数据库迁移、邀请码注册、密码登录、Bearer 会话和带版本冲突保护的云存档。

## Docker Compose 启动

在仓库根目录运行：

```powershell
docker compose up --build
```

健康检查地址为 `http://127.0.0.1:3000/health`。停止服务使用 `docker compose down`；默认不会删除数据库卷。

## 本地 Node.js 启动

先启动 PostgreSQL，并根据 `.env.example` 设置 `DATABASE_URL`、`HOST` 和 `PORT`，然后运行：

```powershell
pnpm install
pnpm server:migrate
pnpm server:dev
```

需要源码热编译时，在另一个终端运行 `pnpm --dir server dev:compile`；`server:dev` 会监听编译后的 `dist` 目录并在变化后重启。

## 创建邀请码

数据库迁移完成后运行：

```powershell
pnpm --dir server invite:create
```

命令会生成一个默认可使用 1 次、30 天后过期的邀请码，并只在终端显示一次。也可以依次传入自定义邀请码、最大使用次数和有效天数：

```powershell
pnpm --dir server invite:create CHENTU-TEST 5 14
```

数据库只保存邀请码和会话令牌的 SHA-256 摘要，不保存明文；用户密码使用带随机盐的 `scrypt` 保存。

## API

除健康检查外，接口前缀为 `/v1`。请求体和响应体均为 JSON。

| 方法   | 路径                | 用途                           |
| ------ | ------------------- | ------------------------------ |
| `GET`  | `/health`           | 服务和数据库健康检查           |
| `POST` | `/v1/auth/register` | 使用邀请码创建账号、角色和会话 |
| `POST` | `/v1/auth/login`    | 密码登录并创建 30 天会话       |
| `POST` | `/v1/auth/logout`   | 注销当前会话                   |
| `GET`  | `/v1/me`            | 获取当前账号、角色和会话信息   |
| `GET`  | `/v1/save`          | 读取当前云存档                 |
| `PUT`  | `/v1/save`          | 使用 `stateVersion` 写入云存档 |

注册请求示例：

```json
{
  "username": "cultivator_1",
  "password": "at-least-8-characters",
  "invitationCode": "CHENTU-TEST",
  "characterName": "青岚"
}
```

登录或注册响应中的 `token` 通过请求头发送：

```text
Authorization: Bearer <token>
```

写入云存档时必须提交最近读取到的状态版本：

```json
{
  "stateVersion": 1,
  "state": {
    "gameId": "chentu-cultivation-save",
    "version": 2
  }
}
```

示例只展示了部分 `state` 字段；服务端要求提交完整有效的游戏存档。写入成功后 `stateVersion` 自动加一。如果云端已被其他设备更新，接口返回 `409 save_conflict` 和最新云端存档，客户端必须提示用户选择云端或本地版本，不能静默覆盖。

## 测试和迁移

```powershell
pnpm test:server
pnpm build:server
```

设置 `DATABASE_URL` 且数据库已迁移时，测试套件会额外执行真实 PostgreSQL 注册、会话和云存档流程；没有数据库时该项自动跳过。

数据库迁移文件位于 `server/migrations`，已经执行的文件名记录在 `schema_migrations`。已发布的迁移文件不得原地修改，应新增更高序号的迁移。
