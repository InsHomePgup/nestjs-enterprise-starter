import { IsString, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, TOKEN_MAX_LENGTH } from './password.constants';

/** 重置密码请求 */
export class ResetPasswordDto {
  /**
   * 重置密码邮件中携带的 token，有效期见 PASSWORD_RESET_EXPIRES_MIN，只能使用一次
   * @example "3a7bd3e2360a3d29eea436fcfb7e44c735d117c42d1c1835420b6b9942dd4f1b"
   */
  @IsString()
  @MaxLength(TOKEN_MAX_LENGTH)
  token: string;

  /**
   * 新密码，8～72 位。重置成功后该用户所有设备的登录状态都会失效
   * @example "new-password123"
   */
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  newPassword: string;
}
