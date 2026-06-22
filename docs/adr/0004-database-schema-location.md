# ADR-0004：Prisma schema 位置

- **状态**：accepted
- **日期**：2026-06-18

## 背景

Phase 1 将 Prisma schema 与 `prisma.config.ts` 放在独立的 `packages/database` 包中，生成产物输出到 `apps/api/src/generated/prisma`。Phase 1.5 审计发现：

- `packages/database` 是 schema-only 包，无 `src/`、无 `tsconfig.json`、`lint`/`typecheck` 为 no-op；
- 全仓库无任何 `import ... from '@team-platform/database'`，API 通过相对路径 `../generated/prisma/client` 导入生成产物；
- `@team-platform/database` 在 `apps/api/package.json` 中声明为 `workspace:*` 依赖，但仅用于 Turbo `^build` 构建顺序，是「伪依赖」（无 exports，无法被 import）；
- 生成路径跨包边界 `packages/database → apps/api/src/generated/prisma`（三级相对路径），增加理解成本；
- 当前为模块化单体（NestJS Module 划分业务域），短期内无第二个 Prisma 消费者。

## 决策

将 Prisma schema 与 `prisma.config.ts` 从 `packages/database` 下沉到 `apps/api/prisma/`，删除 `packages/database` 包。

- schema 路径：`apps/api/prisma/schema.prisma`
- 配置路径：`apps/api/prisma.config.ts`
- 生成产物：`apps/api/src/generated/prisma/`（`generator output = "../src/generated/prisma"`，包内相对路径）
- `db:generate`/`db:migrate`/`db:push` 脚本归属 `apps/api/package.json`
- `apps/api` 的 `build` 脚本先 `prisma generate` 再 `nest build`
- API 通过相对路径 `../generated/prisma/client` 导入（不变）

## 理由

- 当前数据库运行时消费者只有 API，无跨应用复用需求。
- 模块化单体架构下，短期内不会出现第二个 Prisma 消费者。
- 下沉后消除跨包生成路径与伪 workspace 依赖，降低理解成本。
- 符合「不为未来想象保留抽象」「无消费者 package 应收敛」原则。
- schema、迁移、生成产物与 API 生命周期放在一起更简单。

## 替代方案

**方案 A（保留 `packages/database`）**：若未来有多服务共享同一 Prisma schema 的真实需求（如独立的 worker 服务）再提取为独立包。当前模块化单体不需要，提前抽象增加复杂度。

## 影响

- `pnpm-workspace.yaml` 不变（仍 `packages/*`，database 包移除后自动不匹配）。
- CI 的 `db:generate` 命令从 `pnpm --filter @team-platform/database db:generate` 改为 `pnpm --filter @team-platform/api db:generate`（turbo `^build` 也会触发）。
- `.gitignore`/`.prettierignore`/`eslint.config.mjs` 的生成产物 ignore 路径收敛为 `apps/api/src/generated/`。
- 后续 Phase 引入业务表时，`prisma migrate dev` 在 `apps/api` 内执行，迁移文件存于 `apps/api/prisma/migrations/`。
- 若未来出现第二 Prisma 消费者，再以此 ADR superseded 重新提取共享包。

## 相关

- [仓库架构](../08-repository-architecture.md)
- [技术选型 Prisma](../04-technology-decisions.md#3-prisma-是否适合)
