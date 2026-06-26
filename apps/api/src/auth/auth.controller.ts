import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { LoginResponse, UserDTO } from '@team-platform/contracts';
import { AuthGuard } from './auth.guard';
import { mapUser } from './auth.mapper';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import type { AuthenticatedUser } from './auth.types';
import { LoginDto } from './auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: '本地邮箱登录，返回 Bearer Token' })
  login(@Body() body: LoginDto): Promise<LoginResponse> {
    return this.auth.login(body);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: '当前用户' })
  me(@CurrentUser() user: AuthenticatedUser): UserDTO {
    return mapUser(user);
  }
}
