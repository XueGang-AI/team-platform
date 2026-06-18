/**
 * Ambient 声明：tests/e2e 未直接依赖 @types/node，
 * 仅声明 playwright.config.ts 中用到的 process.env。
 * 若后续为 @team-platform/e2e 补充 @types/node 依赖，可删除本文件。
 */
declare const process: {
  env: Record<string, string | undefined>;
};
