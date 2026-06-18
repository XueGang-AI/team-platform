import { loadEnv, webEnvSchema, type WebEnv } from '@team-platform/config';

/**
 * 在服务端读取并校验 Web 环境变量。
 *
 * 仅在 Server Component / 服务端模块中调用，结果不直接透传到客户端 bundle。
 * 调用方需要把必要字段（如 API 基础地址）作为 prop 显式传给 Client Component，
 * 避免把整份 env 对象序列化到浏览器。
 *
 * 校验失败时 loadEnv 会抛出明确错误（只包含字段名与校验信息，不含其他变量值）。
 */
export function getWebEnv(): WebEnv {
  return loadEnv(webEnvSchema);
}
