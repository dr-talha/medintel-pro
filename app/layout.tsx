import type { Metadata } from 'next';
import './globals.css';
import GlobalChat from '@/components/GlobalChat';
import PWARegister from '@/components/PWARegister';
import JsonLd from '@/components/JsonLd';
import { ThemeProvider } from '@/components/ThemeProvider';
import Navigation from '@/components/Navigation';

export const metadata: Metadata = {
  metadataBase: new URL('https://medintel-pro.vercel.app'),
  title: {
    default: 'MedIntel Pro | AI Medical Intelligence for Pakistan',
    template: '%s | MedIntel Pro',
  },
  description:
    'MedIntel Pro delivers AI-assisted medical intelligence for Pakistan, including drug lookup, disease maps, medical calculators, quizzes, first aid, and clinical education tools.',
  keywords: [
    'Medical',
    'AI',
    'Pakistan',
    'Calculators',
    'MedIntel Pro',
    'Drug Lookup',
    'First Aid',
    'Clinical Education',
  ],
  authors: [{ name: 'MedIntel Pro' }],
  creator: 'MedIntel Pro',
  publisher: 'MedIntel Pro',
  openGraph: {
    title: 'MedIntel Pro | AI Medical Intelligence for Pakistan',
    description:
      'Explore AI-powered medical tools for Pakistan: drug lookup, clinical calculators, disease maps, first aid guidance, quizzes, and medical education resources.',
    url: '/',
    siteName: 'MedIntel Pro',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'MedIntel Pro AI medical intelligence platform',
      },
    ],
    locale: 'en_PK',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MedIntel Pro | AI Medical Intelligence for Pakistan',
    description:
      'AI-assisted medical intelligence with drug lookup, calculators, disease maps, first aid, quizzes, and clinical education tools.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/icon-192.png',
  },
  manifest: '/manifest.json',
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
          <Navigation />
          <main>{children}</main>
          <PWARegister />
          <GlobalChat />
        </ThemeProvider>
      </body>
    </html>
  );
}
