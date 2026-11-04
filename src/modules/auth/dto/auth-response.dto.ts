import { UserResponseDto } from '../../user/dto/user-response.dto';

/** 登录 / 注册 / 刷新令牌的响应 */
export class AuthResponseDto {
  /**
   * 访问令牌（JWT），放在请求头 `Authorization: Bearer <accessToken>` 中；有效期见 JWT_EXPIRES_IN
   * @example "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   */
  accessToken: string;

  /**
   * 刷新令牌，用于在 access token 过期后调用 /auth/refresh 换取新令牌。
   * 只能使用一次，每次刷新都会返回新的 refresh token；有效期见 JWT_REFRESH_EXPIRES_IN
   * @example "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
   */
  refreshToken: string;

  /** 当前登录用户 */
  user: UserResponseDto;
}
