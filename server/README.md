# 尘途修仙服务端基础

当前阶段提供 Fastify 服务、PostgreSQL 连接、顺序数据库迁移和 `/health` 健康检查。尚未实现注册、登录或游戏写入接口。

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

测试和构建：

```powershell
pnpm test:server
pnpm build:server
```

数据库迁移文件位于 `server/migrations`，已经执行的文件名记录在 `schema_migrations`。已发布的迁移文件不得原地修改，应新增更高序号的迁移。
