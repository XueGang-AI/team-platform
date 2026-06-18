import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { REQUEST_ID_HEADER } from '@team-platform/contracts';

/**
 * 解析请求 ID：优先复用入站 `x-request-id`，缺失时生成 UUID。
 * 同时写回响应头，供调用方与后续 Trace 接入关联。
 *
 * Phase 1 不正式接入 OpenTelemetry，request_id 是当前唯一的请求关联维度，
 * 为未来 trace_id/span_id 预留扩展位（见 @team-platform/logger LOG_FIELDS）。
 */
export function resolveRequestId(req: IncomingMessage, res?: ServerResponse): string {
  const header = req.headers[REQUEST_ID_HEADER];
  const existing = typeof header === 'string' ? header : undefined;
  const id = existing && existing.length > 0 ? existing : randomUUID();
  res?.setHeader?.(REQUEST_ID_HEADER, id);
  return id;
}
