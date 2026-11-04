import { IsEmail, MaxLength } from 'class-validator';
import { EMAIL_MAX_LENGTH } from './password.constants';

/** 忘记密码请求 */
export class ForgotPasswordDto {
  /**
   * 注册邮箱。无论邮箱是否存在，接口都返回 204，防止账号枚举
   * @example "alice@example.com"
   */
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email: string;
}
