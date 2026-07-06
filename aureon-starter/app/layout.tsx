import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Aureon Music Group',
  description: 'Independent music label creating tomorrow\'s classics across deep house, country pop, reggae, blues and Afro house.',
  metadataBase: new URL('https://www.aureonmusicgroup.com'),
  openGraph: {
    title: 'Aureon Music Group',
    description: 'Creating tomorrow\'s classics.',
    url: 'https://www.aureonmusicgroup.com',
    siteName: 'Aureon Music Group',
    type: 'website'
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
