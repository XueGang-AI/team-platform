import { getWebEnv } from '@/lib/env';
import type { NextRequest } from 'next/server';

const HOP_BY_HOP_REQUEST_HEADERS = [
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
];

const HOP_BY_HOP_RESPONSE_HEADERS = [
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
];

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  return proxyPlatformApi(request, context);
}

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  return proxyPlatformApi(request, context);
}

export async function PUT(request: NextRequest, context: RouteContext): Promise<Response> {
  return proxyPlatformApi(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext): Promise<Response> {
  return proxyPlatformApi(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  return proxyPlatformApi(request, context);
}

export async function HEAD(request: NextRequest, context: RouteContext): Promise<Response> {
  return proxyPlatformApi(request, context);
}

export async function OPTIONS(request: NextRequest, context: RouteContext): Promise<Response> {
  return proxyPlatformApi(request, context);
}

async function proxyPlatformApi(request: NextRequest, context: RouteContext): Promise<Response> {
  const env = getWebEnv();
  const { path = [] } = await context.params;
  const upstreamUrl = buildUpstreamUrl(env.PLATFORM_API_INTERNAL_URL, path, request.nextUrl.search);
  const headers = buildRequestHeaders(request);

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: 'no-store',
    redirect: 'manual',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  try {
    const upstream = await fetch(upstreamUrl, init);
    const responseHeaders = new Headers(upstream.headers);
    for (const header of HOP_BY_HOP_RESPONSE_HEADERS) {
      responseHeaders.delete(header);
    }
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch {
    return Response.json(
      {
        error: {
          code: 'PLATFORM_API_UNAVAILABLE',
          message: '平台 API 暂不可用',
        },
      },
      { status: 502 },
    );
  }
}

function buildUpstreamUrl(baseUrl: string, path: string[], search: string): URL {
  const url = new URL(baseUrl);
  const basePath = url.pathname.replace(/\/$/, '');
  const proxyPath = path.map((segment) => encodeURIComponent(segment)).join('/');
  url.pathname = `${basePath}/${proxyPath}`.replace(/\/+/g, '/');
  url.search = search;
  return url;
}

function buildRequestHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers);
  for (const header of HOP_BY_HOP_REQUEST_HEADERS) {
    headers.delete(header);
  }
  const forwardedHost = request.headers.get('host');
  if (forwardedHost) {
    headers.set('x-forwarded-host', forwardedHost);
  }
  headers.set('x-forwarded-proto', request.nextUrl.protocol.replace(':', ''));
  return headers;
}
