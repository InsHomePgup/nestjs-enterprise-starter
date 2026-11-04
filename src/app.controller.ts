import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AppInfoDto } from './app.dto';
import { AppService } from './app.service';

@ApiTags('app')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * 服务信息
   *
   * 返回服务名称和后端版本号，可用于前端确认当前对接的后端版本。
   */
  @Get()
  getInfo(): AppInfoDto {
    return this.appService.getInfo();
  }
}
