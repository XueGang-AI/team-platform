import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ErrorResponse } from '@team-platform/contracts';
import { ErrorCode, httpStatusToCode } from '../errors/error-codes';

type ExpressRequest = Request & { id?: string };

/**
 * 全局异常过滤器：把所有异常统一收敛为 ErrorResponse 结构。
 *
 * 安全约束：
 * - 不泄露内部堆栈；
 * - 非HttpException的未知异常只返回通用消息，不透传 e.message（可能含敏感信息）；
 * - 始终带上 request_id 以便关联日志。
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<ExpressRequest>();
    const requestId = request?.id;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = ErrorCode.INTERNAL_ERROR;
    let message: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = httpStatusToCode(status);
      const resp = exception.getResponse();
      if (typeof resp === 'string') {
        message = resp;
      } else if (resp && typeof resp === 'object') {
        const r = resp as { message?: unknown };
        message = Array.isArray(r.message)
          ? r.message[0]
          : ((r.message as string) ?? exception.message);
      } else {
        message = exception.message;
      }
    } else {
      // 未知异常：记录详情到日志（脱敏后由 pino redact 处理），但响应只给通用消息
      const detail = exception instanceof Error ? exception.message : String(exception);
      this.logger.error(
        `Unhandled exception: ${detail}`,
        exception instanceof Error ? exception.stack : undefined,
      );
      message = 'Internal server error';
    }

    const body: ErrorResponse = {
      error: {
        code,
        message,
        ...(requestId ? { requestId } : {}),
      },
    };

    response.status(status).json(body);
  }
}
