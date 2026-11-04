import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppInfoDto } from './app.dto';
import { readPackageVersion } from './common/swagger/openapi';

@Injectable()
export class AppService {
  private readonly version = readPackageVersion();

  constructor(private readonly config: ConfigService) {}

  getInfo(): AppInfoDto {
    return { name: this.config.get<string>('app.name') ?? 'API', version: this.version };
  }
}
