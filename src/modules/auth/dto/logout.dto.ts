import { IsString, MaxLength } from 'class-validator';
import { TOKEN_MAX_LENGTH } from './password.constants';

/** 登出请求 */
export class LogoutDto {
  /**
   * 要注销的 refresh token；注销后该 token 无法再用于刷新
   * @example "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
   */
  @IsString()
  @MaxLength(TOKEN_MAX_LENGTH)
  refreshToken: string;
}
