import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aureon Music Group | Creating Tomorrow\'s Classics',
  description: 'Aureon Music Group is an independent music label creating original music across deep house, western pop, reggae, blues and Afro house.',
  icons: {
    icon: '/images/favicon.svg',
  },
  openGraph: {
    title: 'Aureon Music Group',
    description: 'Creating Tomorrow\'s Classics',
    siteName: 'Aureon Music Group',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
