/** 服务信息 */
export class AppInfoDto {
  /**
   * 服务名称（APP_NAME）
   * @example "API"
   */
  name: string;

  /**
   * 后端版本号，与 package.json / GitHub Release 一致；前端可据此确认对接的契约版本
   * @example "1.1.0"
   */
  version: string;
}
