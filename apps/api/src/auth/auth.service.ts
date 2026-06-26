import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LoginBody, LoginResponse } from '@team-platform/contracts';
import { ErrorCode } from '../common/errors/error-codes';
import {
  UnauthorizedBusinessException,
  UnprocessableException,
} from '../common/exceptions/business.exception';
import { PrismaService } from '../prisma/prisma.service';
import { mapUser } from './auth.mapper';
import type { AuthenticatedUser } from './auth.types';

interface TokenPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

const DEFAULT_TTL_SECONDS = 60 * 60 * 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async login(body: LoginBody): Promise<LoginResponse> {
    const email = normalizeEmail(body.email);
    const user = await this.prisma.user.upsert({
      where: { email },
      create: { email, name: body.name.trim() },
      update: { name: body.name.trim() },
    });
    if (user.status === 'DISABLED') {
      throw new UnprocessableException(ErrorCode.USER_DISABLED, '用户已停用');
    }
    return { token: this.signUser(user), user: mapUser(user) };
  }

  async verifyBearer(header: string | undefined): Promise<AuthenticatedUser> {
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedBusinessException(ErrorCode.AUTH_TOKEN_REQUIRED, '缺少认证 Token');
    }
    const token = header.slice('Bearer '.length).trim();
    const payload = this.verifyToken(token);
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedBusinessException(ErrorCode.AUTH_TOKEN_INVALID, '认证 Token 无效');
    }
    if (user.status === 'DISABLED') {
      throw new UnprocessableException(ErrorCode.USER_DISABLED, '用户已停用');
    }
    return user;
  }

  private signUser(user: { id: string; email: string }): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: TokenPayload = {
      sub: user.id,
      email: user.email,
      iat: now,
      exp: now + DEFAULT_TTL_SECONDS,
    };
    const encoded = base64url(JSON.stringify(payload));
    return `${encoded}.${this.sign(encoded)}`;
  }

  private verifyToken(token: string): TokenPayload {
    const [encoded, signature] = token.split('.');
    if (!encoded || !signature || !safeEqual(signature, this.sign(encoded))) {
      throw new UnauthorizedBusinessException(ErrorCode.AUTH_TOKEN_INVALID, '认证 Token 无效');
    }
    try {
      const payload = JSON.parse(
        Buffer.from(encoded, 'base64url').toString('utf8'),
      ) as TokenPayload;
      if (!payload.sub || !payload.email || payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('invalid token payload');
      }
      return payload;
    } catch {
      throw new UnauthorizedBusinessException(ErrorCode.AUTH_TOKEN_INVALID, '认证 Token 无效');
    }
  }

  private sign(value: string): string {
    const secret = this.config.get<string>('AUTH_TOKEN_SECRET') ?? 'team-platform-local-dev-secret';
    return createHmac('sha256', secret).update(value).digest('base64url');
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function base64url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}
