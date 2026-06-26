import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'team-platform · 管理后台',
  description:
    'team-platform 团队统一项目治理平台管理后台，覆盖项目目录、平台 API、接入协议与治理中枢。',
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
