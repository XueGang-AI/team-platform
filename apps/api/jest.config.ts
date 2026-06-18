import type { Config } from 'jest';

const config: Config = {
  rootDir: '.',
  testRegex: ['test/unit/.*\\.spec\\.ts$'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        // Node16 模块与 isolatedModules 不完全兼容，仅屏蔽该诊断告警
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
};

export default config;
