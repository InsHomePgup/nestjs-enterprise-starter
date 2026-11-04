import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { EMAIL_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './password.constants';

/** 注册请求 */
export class RegisterDto {
  /**
   * 邮箱，作为登录账号，全局唯一
   * @example "alice@example.com"
   */
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email: string;

  /**
   * 密码，8～72 位
   * @example "password123"
   */
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;

  /**
   * 昵称
   * @example "Alice"
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
