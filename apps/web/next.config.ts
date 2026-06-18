import type { NextConfig } from 'next';

/**
 * Next.js 16 最小配置。
 * Phase 1 仅建立工程骨架，不启用实验特性与自定义 webpack。
 * 健康状态需要实时性，Server Component 中的 fetch 统一使用 cache: 'no-store'，
 * 同时禁用开发期 HMR 缓存，避免本地开发时拿到过期的 /health 响应。
 */
const nextConfig: NextConfig = {
  experimental: {
    serverComponentsHmrCache: false,
  },
};

export default nextConfig;
