import { defineConfig } from 'prisma/config';

// Prisma 7：连接串从 schema 迁移到 prisma.config.ts，由 @prisma/adapter-pg 运行时使用，
// CLI（migrate/generate）也从此读取。
//
// `prisma generate` 不连接数据库，但 prisma.config.ts 会被加载；为避免在无
// DATABASE_URL 的环境（如 CI 的 lint/typecheck 依赖链、本地首次 generate）下失败，
// 此处对连接串做容错回退。真实开发/迁移/集成测试时 DATABASE_URL 必须由环境提供。
const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl,
  },
});
