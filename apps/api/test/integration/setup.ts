/**
 * 集成测试环境预设：在测试文件被加载（从而触发 AppModule 的 ConfigModule.forRoot
 * 同步校验）之前设置环境变量。仅当环境未提供时使用本地 compose 默认值，
 * CI 的 service container 环境变量优先。
 */
process.env.NODE_ENV ??= 'test';
process.env.ENVIRONMENT ??= 'dev';
process.env.LOG_LEVEL ??= 'warn';
process.env.SERVICE_NAME ??= 'team-platform-api';
process.env.API_VERSION ??= '1.0.0';
process.env.API_HOST ??= '0.0.0.0';
process.env.API_PORT ??= '3201';
process.env.DATABASE_URL ??=
  'postgresql://team_platform:team_platform@127.0.0.1:15432/team_platform?schema=public';
process.env.REDIS_URL ??= 'redis://127.0.0.1:16379';
process.env.REDIS_KEY_PREFIX ??= 'team_platform:';
