/**
 * @team-platform/config
 *
 * 运行时环境变量校验。所有外部输入（环境变量）必须经过 zod 校验后使用。
 * 被 apps/api 与 apps/web 共同使用。
 */
import { z } from 'zod';

/** 基础环境变量（所有应用共享） */
export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  ENVIRONMENT: z.string().min(1).default('dev'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const httpUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  }, '必须是 http(s) URL');

const browserApiBaseUrlSchema = z
  .string()
  .min(1)
  .refine((value) => {
    if (value.startsWith('/')) {
      return true;
    }
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }, '必须是同源路径或 http(s) URL');

/** API 专属环境变量 */
export const apiEnvSchema = baseEnvSchema.extend({
  SERVICE_NAME: z.string().min(1).default('team-platform-api'),
  API_VERSION: z.string().min(1).default('1.0.0'),
  API_HOST: z.string().min(1).default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(3201),
  DATABASE_URL: z
    .string()
    .min(1)
    .refine((v) => v.startsWith('postgresql://') || v.startsWith('postgres://'), {
      message: 'DATABASE_URL 必须是 postgresql:// 连接串',
    })
    .default(
      'postgresql://team_platform:team_platform@127.0.0.1:15432/team_platform?schema=public',
    ),
  REDIS_URL: z
    .string()
    .min(1)
    .refine((v) => v.startsWith('redis://') || v.startsWith('rediss://'), {
      message: 'REDIS_URL 必须是 redis:// 连接串',
    })
    .default('redis://127.0.0.1:16379'),
  REDIS_KEY_PREFIX: z.string().default('team_platform:'),
  HEALTH_CHECK_ALLOWED_HOSTS: z.string().default(''),
  HEALTH_CHECK_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
  HEALTH_CHECK_MAX_CONCURRENCY: z.coerce.number().int().positive().default(5),
  AUTH_TOKEN_SECRET: z.string().min(16).default('team-platform-local-dev-secret'),
});

/** Web（管理后台）专属环境变量 */
export const webEnvSchema = baseEnvSchema.extend({
  WEB_PORT: z.coerce.number().int().positive().default(3200),
  WEB_API_BASE_URL: browserApiBaseUrlSchema.default('/api/platform'),
  PLATFORM_API_INTERNAL_URL: httpUrlSchema.default('http://localhost:3201'),
});

export type BaseEnv = z.infer<typeof baseEnvSchema>;
export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WebEnv = z.infer<typeof webEnvSchema>;

/**
 * 按给定 schema 解析环境变量。校验失败时抛出明确错误（包含字段名，不含其他环境变量值）。
 */
export function loadEnv<T extends z.ZodTypeAny>(
  schema: T,
  env: Record<string, string | undefined> = process.env,
): z.infer<T> {
  const result = schema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`环境变量校验失败: ${issues}`);
  }
  return result.data;
}
