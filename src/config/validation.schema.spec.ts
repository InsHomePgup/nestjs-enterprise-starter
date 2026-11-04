import { validationSchema } from './validation.schema';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
};

function validate(env: Record<string, unknown>) {
  return validationSchema.validate({ ...base, ...env }, { allowUnknown: true }).error?.message;
}

describe('validationSchema JWT_SECRET', () => {
  it('accepts a short-ish dev secret outside production', () => {
    expect(
      validate({ NODE_ENV: 'development', JWT_SECRET: 'change-me-dev-secret' }),
    ).toBeUndefined();
  });

  it('rejects secrets shorter than 16 chars everywhere', () => {
    expect(validate({ NODE_ENV: 'development', JWT_SECRET: 'short' })).toBeDefined();
  });

  it('rejects the template placeholder in production', () => {
    expect(
      validate({
        NODE_ENV: 'production',
        JWT_SECRET: 'CHANGE_ME_SET_A_REAL_SECRET_VIA_DEPLOYMENT_ENV_OR_SECRETS_MANAGER',
      }),
    ).toMatch(/placeholder/);
  });

  it('rejects secrets shorter than 32 chars in production', () => {
    expect(validate({ NODE_ENV: 'production', JWT_SECRET: 'a'.repeat(31) })).toMatch(/32/);
  });

  it('accepts a strong secret in production', () => {
    expect(validate({ NODE_ENV: 'production', JWT_SECRET: 'f'.repeat(64) })).toBeUndefined();
  });
});
