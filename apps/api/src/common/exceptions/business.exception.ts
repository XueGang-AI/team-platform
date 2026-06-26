import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 业务异常基类。
 * 携带稳定错误码（对外契约）与 HTTP 状态码，可选 details（不泄露敏感信息）。
 * AllExceptionsFilter 识别本类并按 code/status/details 输出 ErrorResponse。
 */
export class BusinessException extends HttpException {
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string, status: HttpStatus, details?: unknown) {
    super({ code, message, details }, status);
    this.code = code;
    this.details = details;
  }
}

/** 404 资源不存在 */
export class NotFoundException extends BusinessException {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, HttpStatus.NOT_FOUND, details);
  }
}

/** 409 冲突（如 slug 重复） */
export class ConflictException extends BusinessException {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, HttpStatus.CONFLICT, details);
  }
}

/** 401 未认证 */
export class UnauthorizedBusinessException extends BusinessException {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, HttpStatus.UNAUTHORIZED, details);
  }
}

/** 403 无权限 */
export class ForbiddenBusinessException extends BusinessException {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, HttpStatus.FORBIDDEN, details);
  }
}

/** 400 业务校验失败 */
export class ValidationException extends BusinessException {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, HttpStatus.BAD_REQUEST, details);
  }
}

/** 422 语义错误（如操作已归档资源） */
export class UnprocessableException extends BusinessException {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}

/** 503 健康检查类失败 */
export class ServiceHealthException extends BusinessException {
  constructor(code: string, message: string, details?: unknown) {
    super(code, message, HttpStatus.SERVICE_UNAVAILABLE, details);
  }
}
