import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  apiPrefix: process.env.API_PREFIX ?? 'api',
  bodyLimit: process.env.BODY_LIMIT ?? '100kb',
  swaggerEnabled: (process.env.SWAGGER_ENABLED ?? 'true') === 'true',
  name: process.env.APP_NAME ?? 'API',
  description: process.env.APP_DESCRIPTION ?? 'Enterprise NestJS starter API',
}));

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  ttl: parseInt(process.env.REDIS_TTL ?? '60000', 10),
}));

export const jwtConfig = registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
}));

export const throttleConfig = registerAs('throttle', () => ({
  ttl: parseInt(process.env.THROTTLE_TTL ?? '60000', 10),
  limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
}));

export const authConfig = registerAs('auth', () => ({
  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '10', 10),
  passwordResetExpiresMinutes: parseInt(process.env.PASSWORD_RESET_EXPIRES_MIN ?? '30', 10),
}));

export default [appConfig, redisConfig, jwtConfig, throttleConfig, authConfig];
