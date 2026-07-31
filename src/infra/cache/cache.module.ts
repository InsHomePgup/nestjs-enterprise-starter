import { createKeyv } from '@keyv/redis';
import { CacheModule } from '@nestjs/cache-manager';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        stores: [
          createKeyv(
            `redis://${config.getOrThrow<string>('redis.host')}:${config.getOrThrow<number>('redis.port')}`,
          ),
        ],
        ttl: config.get<number>('redis.ttl'),
      }),
    }),
  ],
  exports: [CacheModule],
})
export class RedisCacheModule {}
