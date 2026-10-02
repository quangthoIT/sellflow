import './globals.css';
import { Inter } from 'next/font/google';
import { AppShell } from '@/components/app-shell';
import { I18nProvider } from '@/components/i18n-provider';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata = {
  title: 'SellFlow - Quản lý Bán hàng & Hợp đồng Doanh nghiệp',
  description: 'Hệ thống Quản lý Bán hàng, Báo giá & Hợp đồng Doanh nghiệp',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={inter.variable} suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-background font-sans antialiased`}>
        <ThemeProvider defaultTheme="light" storageKey="theme">
          <I18nProvider>
            <AppShell>{children}</AppShell>
            <Toaster position="top-right" richColors closeButton />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
