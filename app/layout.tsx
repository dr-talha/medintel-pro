import type { Metadata } from 'next';
import './globals.css';
import GlobalChat from '@/components/GlobalChat';
import PWARegister from '@/components/PWARegister';
import JsonLd from '@/components/JsonLd';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'MedIntel Pro',
  description: 'AI-assisted medical intelligence for educational use.',
};

const medicalWebPageSchema = {
  '@context': 'https://schema.org',
  '@type': 'MedicalWebPage',
  name: 'MedIntel Pro',
  description: 'AI-assisted medical intelligence for educational use, including drug lookup, disease maps, calculators, quizzes, and first aid support.',
  url: 'https://medintel-pro.vercel.app',
  audience: {
    '@type': 'MedicalAudience',
    audienceType: 'Clinicians, students, and informed patients',
  },
  about: {
    '@type': 'MedicalEntity',
    name: 'Clinical decision support education',
  },
  publisher: {
    '@type': 'Organization',
    name: 'MedIntel Pro',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 text-slate-950 antialiased dark:bg-slate-950 dark:text-slate-50">
        <ThemeProvider>
          <JsonLd id="medintel-medical-webpage" schema={medicalWebPageSchema} />
          {children}
          <PWARegister />
          <GlobalChat />
        </ThemeProvider>
      </body>
    </html>
  );
}
