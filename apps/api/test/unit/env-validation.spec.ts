import { apiEnvSchema, loadEnv, webEnvSchema } from '@team-platform/config';

function validEnv(): Record<string, string> {
  return {
    NODE_ENV: 'development',
    ENVIRONMENT: 'dev',
    LOG_LEVEL: 'info',
    SERVICE_NAME: 'team-platform-api',
    API_VERSION: '1.0.0',
    API_HOST: '0.0.0.0',
    API_PORT: '3201',
    DATABASE_URL:
      'postgresql://team_platform:team_platform@127.0.0.1:15432/team_platform?schema=public',
    REDIS_URL: 'redis://127.0.0.1:16379',
    REDIS_KEY_PREFIX: 'team_platform:',
  };
}

describe('api env validation', () => {
  it('accepts valid env and coerces API_PORT to number', () => {
    const env = loadEnv(apiEnvSchema, validEnv());
    expect(env.API_PORT).toBe(3201);
    expect(env.DATABASE_URL).toBe(validEnv().DATABASE_URL);
    expect(env.REDIS_KEY_PREFIX).toBe('team_platform:');
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

describe('web env validation', () => {
  it('accepts same-origin API proxy path', () => {
    const env = loadEnv(webEnvSchema, {
      NODE_ENV: 'development',
      ENVIRONMENT: 'dev',
      LOG_LEVEL: 'info',
      WEB_PORT: '3200',
      WEB_API_BASE_URL: '/api/platform',
      PLATFORM_API_INTERNAL_URL: 'http://localhost:3201',
    });

    expect(env.WEB_API_BASE_URL).toBe('/api/platform');
    expect(env.PLATFORM_API_INTERNAL_URL).toBe('http://localhost:3201');
  });

  it('rejects invalid browser API base URL', () => {
    expect(() =>
      loadEnv(webEnvSchema, {
        WEB_API_BASE_URL: 'not-a-url',
        PLATFORM_API_INTERNAL_URL: 'http://localhost:3201',
      }),
    ).toThrow(/WEB_API_BASE_URL/);
  });
});
