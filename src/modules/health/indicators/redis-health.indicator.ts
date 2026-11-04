import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import type { Cache } from 'cache-manager';
import { withTimeout } from './with-timeout';

const PING_KEY = 'health:redis:ping';
const PING_VALUE = 'pong';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string) {
    const indicator = this.healthIndicatorService.check(key);
    try {
      const value = await withTimeout(
        this.cache.set(PING_KEY, PING_VALUE, 5000).then(() => this.cache.get(PING_KEY)),
      );
      if (value !== PING_VALUE) {
        throw new Error('Redis ping returned an unexpected value');
      }
      return indicator.up();
    } catch (error) {
      return indicator.down({
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
