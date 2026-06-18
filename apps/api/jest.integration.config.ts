import type { Config } from 'jest';

const config: Config = {
  rootDir: '.',
  testRegex: ['test/integration/.*\\.integration\\.ts$'],
  setupFiles: ['<rootDir>/test/integration/setup.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        diagnostics: { ignoreCodes: [151002] },
      },
    ],
  },
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  // 生成的 Prisma client 使用 Node16 风格 .js 扩展名导入，jest 需剥离 .js 以解析到 .ts
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // 集成测试需要真实 PostgreSQL + Redis，串行执行避免端口/连接竞争
  maxWorkers: 1,
};

export default config;
