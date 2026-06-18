/**
 * @team-platform/logger
 *
 * 基于 pino 的结构化日志工厂，统一基础字段与脱敏规则。
 * 被 apps/api（通过 nestjs-pino 接入）使用。
 */
import pino, { type Logger, type LoggerOptions } from 'pino';

/** 结构化日志基础字段名（为后续 trace_id/span_id/user_id/project_id 预留） */
export const LOG_FIELDS = {
  TIMESTAMP: 'time',
  LEVEL: 'level',
  MESSAGE: 'msg',
  SERVICE_NAME: 'service_name',
  ENVIRONMENT: 'environment',
  VERSION: 'version',
  REQUEST_ID: 'request_id',
  TRACE_ID: 'trace_id',
  SPAN_ID: 'span_id',
  USER_ID: 'user_id',
  PROJECT_ID: 'project_id',
  ERROR_CODE: 'error_code',
} as const;

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

export interface CreateLoggerOptions {
  serviceName: string;
  environment: string;
  version: string;
  level?: string;
  /** 覆盖或追加 pino 选项 */
  pinoOptions?: Partial<LoggerOptions>;
}

/**
 * 创建带统一基础字段与脱敏配置的 pino Logger。
 */
export function createLogger(opts: CreateLoggerOptions): Logger {
  const base: LoggerOptions = {
    level: opts.level ?? 'info',
    base: {
      [LOG_FIELDS.SERVICE_NAME]: opts.serviceName,
      [LOG_FIELDS.ENVIRONMENT]: opts.environment,
      [LOG_FIELDS.VERSION]: opts.version,
    },
    redact: {
      paths: LOG_REDACTION_PATHS,
      censor: '[REDACTED]',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };
  return pino({ ...base, ...opts.pinoOptions });
}
