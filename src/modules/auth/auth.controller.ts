import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ErrorCode } from '../../common/constants/error-code.enum';
import { ApiErrors } from '../../common/swagger/api-errors.decorator';
import { UserResponseDto } from '../user/dto/user-response.dto';
import { UserService } from '../user/user.service';
import { AuthService } from './auth.service';
import { Auth } from './decorators/auth.decorator';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  /**
   * 注册
   *
   * 创建普通用户（角色为 USER）并直接登录，返回令牌和用户信息。
   */
  @Post('register')
  @ApiErrors(ErrorCode.AUTH_EMAIL_TAKEN)
  register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto);
  }

  /**
   * 登录
   *
   * 邮箱或密码错误时统一返回 `AUTH_INVALID_CREDENTIALS`，不区分具体原因。
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiErrors(ErrorCode.AUTH_INVALID_CREDENTIALS)
  login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  /**
   * 刷新令牌
   *
   * 用 refresh token 换取新的 access token 和 refresh token。旧 refresh token 立即失效，
   * 同一个 refresh token 并发刷新时只有一个请求会成功，前端应保证同一时间只发起一次刷新。
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiErrors(ErrorCode.AUTH_REFRESH_TOKEN_INVALID)
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    return this.authService.refresh(dto);
  }

  /**
   * 登出
   *
   * 注销指定的 refresh token。token 无效或已注销时同样返回 204（幂等）。
   * access token 在过期前仍然有效，前端应同时清除本地保存的令牌。
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: LogoutDto): Promise<void> {
    await this.authService.logout(dto);
  }

  /**
   * 忘记密码
   *
   * 向邮箱发送重置密码链接。无论邮箱是否注册都返回 204，防止账号枚举。
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.authService.forgotPassword(dto);
  }

  /**
   * 重置密码
   *
   * 使用邮件中的 token 设置新密码。成功后该用户所有设备的 refresh token 都会失效，需要重新登录。
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiErrors(ErrorCode.AUTH_RESET_TOKEN_INVALID)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.authService.resetPassword(dto);
  }

  /**
   * 获取当前登录用户
   */
  @Get('me')
  @Auth()
  @ApiErrors(ErrorCode.USER_NOT_FOUND)
  me(@Req() req: Request): Promise<UserResponseDto> {
    const { userId } = req.user as { userId: string };
    return this.userService.findOne(userId);
  }
}
