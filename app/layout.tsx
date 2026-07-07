import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Aureon Music Group | Creating Tomorrow's Classics",
  description:
    'A premium independent music label crafting original music across deep house, country pop, reggae, blues and Afro house.',
  openGraph: {
    title: "Aureon Music Group | Creating Tomorrow's Classics",
    description: 'Official website of Aureon Music Group.',
    url: 'https://aureonmusicgroup.com',
    siteName: 'Aureon Music Group',
    images: [{ url: '/images/aureon-studio-bg.jpg', width: 1600, height: 900 }],
    locale: 'en_IE',
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
