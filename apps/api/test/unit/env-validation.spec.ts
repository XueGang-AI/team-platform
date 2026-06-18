import { apiEnvSchema, loadEnv } from '@team-platform/config';

function validEnv(): Record<string, string> {
  return {
    NODE_ENV: 'development',
    ENVIRONMENT: 'dev',
    LOG_LEVEL: 'info',
    SERVICE_NAME: 'team-platform-api',
    API_VERSION: '1.0.0',
    API_HOST: '0.0.0.0',
    API_PORT: '3001',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db?schema=public',
    REDIS_URL: 'redis://localhost:6379',
  };
}

describe('api env validation', () => {
  it('accepts valid env and coerces API_PORT to number', () => {
    const env = loadEnv(apiEnvSchema, validEnv());
    expect(env.API_PORT).toBe(3001);
    expect(env.DATABASE_URL).toBe(validEnv().DATABASE_URL);
  });

  it('rejects invalid DATABASE_URL', () => {
    expect(() =>
      loadEnv(apiEnvSchema, { ...validEnv(), DATABASE_URL: 'not-a-postgres-url' }),
    ).toThrow(/DATABASE_URL/);
  });

  it('rejects invalid REDIS_URL', () => {
    expect(() =>
      loadEnv(apiEnvSchema, { ...validEnv(), REDIS_URL: 'http://localhost:6379' }),
    ).toThrow(/REDIS_URL/);
  });

  it('rejects unknown LOG_LEVEL', () => {
    expect(() => loadEnv(apiEnvSchema, { ...validEnv(), LOG_LEVEL: 'verbose' })).toThrow(
      /LOG_LEVEL/,
    );
  });
});
