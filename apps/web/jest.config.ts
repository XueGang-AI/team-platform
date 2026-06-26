import type { Config } from 'jest';

/**
 * apps/web Jest 配置。
 *
 * 注意：本仓库未安装 jest-environment-jsdom 与 @testing-library/react。
 * 因此使用 node 环境配合 react-dom/server 的 renderToStaticMarkup 做渲染断言，
 * 不自行安装依赖。若后续需要 DOM 交互测试，需先在 package.json 增加
 * jest-environment-jsdom 与 testing-library 依赖。
 */
const config: Config = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@team-platform/contracts$': '<rootDir>/../../packages/contracts/src/index.ts',
    '^@team-platform/config$': '<rootDir>/../../packages/config/src/index.ts',
  },
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          module: 'CommonJS',
          moduleResolution: 'node16',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          target: 'ES2022',
          lib: ['dom', 'dom.iterable', 'ES2022'],
          types: ['node', 'jest'],
          skipLibCheck: true,
          isolatedModules: false,
          verbatimModuleSyntax: false,
          noEmit: false,
          declaration: false,
          sourceMap: false,
        },
      },
    ],
  },
};

export default config;
