import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { SkipResponseTransform } from '../../common/decorators/skip-response-transform.decorator';
import { PrismaHealthIndicator } from './indicators/prisma-health.indicator';
import { RedisHealthIndicator } from './indicators/redis-health.indicator';

@Controller('health')
@SkipResponseTransform()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly redisIndicator: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prismaIndicator.isHealthy('database'),
      () => this.redisIndicator.isHealthy('redis'),
    ]);
  }
}
