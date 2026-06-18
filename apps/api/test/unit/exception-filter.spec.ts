import { ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ErrorCode } from '../../src/common/errors/error-codes';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';

function makeHost(reqId?: string): {
  host: ArgumentsHost;
  json: jest.Mock;
  status: jest.Mock;
} {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const response = { status };
  const request = reqId ? { id: reqId } : {};
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, json, status };
}

describe('AllExceptionsFilter', () => {
  it('maps HttpException to ErrorResponse with code and requestId', () => {
    const filter = new AllExceptionsFilter();
    const { host, json, status } = makeHost('rid-1');
    filter.catch(new HttpException('not found', HttpStatus.NOT_FOUND), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith({
      error: { code: ErrorCode.NOT_FOUND, message: 'not found', requestId: 'rid-1' },
    });
  });

  it('returns generic message for unknown errors without leaking details', () => {
    // 过滤器内部会记录异常详情，测试中屏蔽该日志输出避免噪音
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const filter = new AllExceptionsFilter();
    const { host, json, status } = makeHost('rid-2');
    // 模拟一个可能含敏感信息的内部错误
    filter.catch(new Error('ECONNREFUSED pg://user:secret@host:5432'), host);
    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    const body = json.mock.calls[0][0];
    expect(body.error.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(body.error.message).toBe('Internal server error');
    expect(body.error.requestId).toBe('rid-2');
    // 不泄露内部 message
    expect(JSON.stringify(body)).not.toContain('secret');
    expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
  });

  it('omits requestId when absent', () => {
    const filter = new AllExceptionsFilter();
    const { host, json } = makeHost();
    filter.catch(new HttpException('bad', HttpStatus.BAD_REQUEST), host);
    expect(json.mock.calls[0][0].error).not.toHaveProperty('requestId');
  });
});
