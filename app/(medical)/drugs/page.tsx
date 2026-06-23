import type { Metadata } from 'next';
import DrugSearchClient from './DrugSearchClient';

export const metadata: Metadata = {
  title: 'Drug Search',
  description:
    'Search RxNorm concepts and openFDA safety signals through the MedIntel Pro drug lookup tool for safer clinical education workflows.',
  openGraph: {
    title: 'Drug Search | MedIntel Pro',
    description:
      'Use MedIntel Pro to search drug names, RxNorm concepts, and openFDA safety signals from a CORS-safe Next.js route.',
    url: '/drugs',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'MedIntel Pro drug search interface',
      },
    ],
  },
};

export default function DrugSearchPage() {
  return <DrugSearchClient />;
}
