import * as Joi from 'joi';

/**
 * In production the JWT secret must be long and must not be a template placeholder
 * (e.g. `CHANGE_ME_...` from .env.production), otherwise the app refuses to start.
 */
const jwtSecret = Joi.string()
  .required()
  .when('NODE_ENV', {
    is: 'production',
    // biome-ignore lint/suspicious/noThenProperty: Joi's conditional API, not a thenable
    then: Joi.string()
      .min(32)
      .pattern(/^(?!change[-_]?me)/i, { name: 'not a placeholder' })
      .messages({
        'string.pattern.name':
          'JWT_SECRET is still a placeholder; set a real secret (e.g. `openssl rand -hex 32`)',
        'string.min': 'JWT_SECRET must be at least 32 characters in production',
      }),
    otherwise: Joi.string().min(16),
  });

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api'),
  SWAGGER_ENABLED: Joi.boolean().default(true),
  APP_NAME: Joi.string().default('API'),
  APP_DESCRIPTION: Joi.string().default('Enterprise NestJS starter API'),
  DATABASE_URL: Joi.string().uri().required(),
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().required(),
  REDIS_TTL: Joi.number().default(60000),
  JWT_SECRET: jwtSecret,
  JWT_EXPIRES_IN: Joi.string().default('1d'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  BCRYPT_SALT_ROUNDS: Joi.number().integer().min(4).max(15).default(10),
  PASSWORD_RESET_EXPIRES_MIN: Joi.number().integer().min(1).default(30),
  THROTTLE_TTL: Joi.number().default(60000),
  THROTTLE_LIMIT: Joi.number().default(100),
  CORS_ORIGIN: Joi.string().default('*'),
  LOG_LEVEL: Joi.string().default('info'),
});
