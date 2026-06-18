import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'team-platform · 管理后台',
  description:
    'team-platform 团队统一项目治理平台管理后台。当前为 Phase 1 工程骨架与本地基础设施阶段。',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <a href="#main" className="skip-link">
          跳转到主要内容
        </a>
        {children}
      </body>
    </html>
  );
}
