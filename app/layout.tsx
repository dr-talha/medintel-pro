import type { Metadata } from 'next';
import './globals.css';
import GlobalChat from '@/components/GlobalChat';

export const metadata: Metadata = {
  title: 'MedIntel Pro',
  description: 'AI-assisted medical intelligence for educational use.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 text-slate-950 antialiased dark:bg-slate-950 dark:text-slate-50">
        {children}
        <GlobalChat />
      </body>
    </html>
  );
}
