import { IsString, MaxLength } from 'class-validator';
import { TOKEN_MAX_LENGTH } from './password.constants';

/** 刷新令牌请求 */
export class RefreshTokenDto {
  /**
   * 登录 / 注册 / 上次刷新时返回的 refresh token。每个 refresh token 只能使用一次
   * @example "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
   */
  @IsString()
  @MaxLength(TOKEN_MAX_LENGTH)
  refreshToken: string;
}
