/**
 * @team-platform/logger
 *
 * 结构化日志的共享脱敏配置。
 *
 * Phase 1.5 收敛：API 通过 nestjs-pino 自建 logger，本包仅提供统一的脱敏路径，
 * 确保密码、Token、连接串、敏感 Header 不出现在日志中。
 * 若未来出现第二个需要共享 logger 工厂的服务，再在此恢复 createLogger。
 */

/**
 * 需要脱敏的字段路径。密码、Token、连接串、敏感 Header 一律不出现在日志中。
 */
export const LOG_REDACTION_PATHS = [
  'password',
  'passwd',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'authorization',
  'DATABASE_URL',
  'REDIS_URL',
  '*.password',
  '*.token',
  '*.authorization',
  'req.headers.authorization',
  'req.headers.cookie',
];
