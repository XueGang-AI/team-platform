import type { IncomingMessage, ServerResponse } from 'node:http';
import { REQUEST_ID_HEADER } from '@team-platform/contracts';
import { resolveRequestId } from '../../src/common/request-id/request-id';

function makeReq(headers: Record<string, string> = {}): IncomingMessage {
  return { headers } as unknown as IncomingMessage;
}

function makeRes(): { setHeader: jest.Mock } {
  return { setHeader: jest.fn() };
}

describe('resolveRequestId', () => {
  it('reuses inbound x-request-id and writes it back to response header', () => {
    const req = makeReq({ [REQUEST_ID_HEADER]: 'abc-123' });
    const res = makeRes();
    expect(resolveRequestId(req, res as unknown as ServerResponse)).toBe('abc-123');
    expect(res.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, 'abc-123');
  });

  it('generates a UUIDv4 when no inbound id and sets response header', () => {
    const req = makeReq();
    const res = makeRes();
    const id = resolveRequestId(req, res as unknown as ServerResponse);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(res.setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, id);
  });

  it('ignores empty inbound id', () => {
    const req = makeReq({ [REQUEST_ID_HEADER]: '' });
    const id = resolveRequestId(req, makeRes() as unknown as ServerResponse);
    expect(id).not.toBe('');
  });
});
