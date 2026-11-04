import { IsEmail, IsString, MaxLength } from 'class-validator';
import { EMAIL_MAX_LENGTH, PASSWORD_MAX_LENGTH } from './password.constants';

/** 登录请求 */
export class LoginDto {
  /**
   * 注册邮箱
   * @example "alice@example.com"
   */
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email: string;

  /**
   * 密码
   * @example "password123"
   */
  @IsString()
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;
}
