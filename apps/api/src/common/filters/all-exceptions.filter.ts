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
import { BusinessException } from '../exceptions/business.exception';

type ExpressRequest = Request & { id?: string };

/** Prisma 错误码（仅识别需要映射的，不透传原始 message） */
interface PrismaError {
  code?: string;
  message?: string;
  meta?: { target?: string[] };
}

/**
 * 全局异常过滤器：把所有异常统一收敛为 ErrorResponse 结构。
 *
 * 安全约束：
 * - 不泄露内部堆栈；
 * - BusinessException 携带稳定 code/message/details；
 * - Prisma 错误映射为通用 CONFLICT/NOT_FOUND，不透传 SQL 与内部细节；
 * - 非 HttpException 的未知异常只返回通用消息，不透传 e.message；
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
    let code: string = ErrorCode.INTERNAL_ERROR;
    let message = 'Internal server error';
    let details: unknown | undefined;

    if (exception instanceof BusinessException) {
      status = exception.getStatus();
      code = exception.code;
      const resp = exception.getResponse() as { message?: string };
      message = resp.message ?? exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = httpStatusToCode(status);
      const resp = exception.getResponse();
      if (typeof resp === 'string') {
        message = resp;
      } else if (resp && typeof resp === 'object') {
        const r = resp as { message?: unknown };
        message = Array.isArray(r.message)
          ? (r.message[0] as string)
          : ((r.message as string) ?? exception.message);
      } else {
        message = exception.message;
      }
    } else if (isPrismaError(exception)) {
      const mapped = mapPrismaError(exception);
      status = mapped.status;
      code = mapped.code;
      message = mapped.message;
    } else {
      const detail = exception instanceof Error ? exception.message : String(exception);
      this.logger.error(
        `Unhandled exception: ${detail}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ErrorResponse = {
      error: {
        code,
        message,
        ...(details ? { details } : {}),
        ...(requestId ? { requestId } : {}),
      },
    };

    response.status(status).json(body);
  }
}

function isPrismaError(e: unknown): e is PrismaError {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    typeof (e as { code: unknown }).code === 'string' &&
    (e as { code: string }).code.startsWith('P')
  );
}

function mapPrismaError(e: PrismaError): {
  status: HttpStatus;
  code: string;
  message: string;
} {
  // P2002 唯一约束冲突
  if (e.code === 'P2002') {
    const target = e.meta?.target?.join(', ');
    return {
      status: HttpStatus.CONFLICT,
      code: ErrorCode.CONFLICT,
      message: target ? `资源已存在: ${target}` : '资源已存在',
    };
  }
  // P2025 记录未找到
  if (e.code === 'P2025') {
    return {
      status: HttpStatus.NOT_FOUND,
      code: ErrorCode.NOT_FOUND,
      message: '资源不存在',
    };
  }
  // 其他 Prisma 错误：不透传内部信息
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    code: ErrorCode.INTERNAL_ERROR,
    message: 'Internal server error',
  };
}
