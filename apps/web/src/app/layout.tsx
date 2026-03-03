import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SmartHirink - AI Virtual Interview Platform',
  description: 'AI-powered interview and candidate assessment system',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-slate-50">
        <nav className="bg-white border-b border-slate-200 px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <a href="/" className="text-xl font-bold text-primary-700">
              SmartHirink
            </a>
            <div className="flex items-center gap-4">
              <a href="/dashboard" className="text-sm text-slate-600 hover:text-primary-600">
                Dashboard
              </a>
              <a href="/interviews" className="text-sm text-slate-600 hover:text-primary-600">
                Phỏng vấn
              </a>
              <a href="/login" className="text-sm text-slate-600 hover:text-primary-600">
                Đăng nhập
              </a>
            </div>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
