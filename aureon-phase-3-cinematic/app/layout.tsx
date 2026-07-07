import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Aureon Music Group | Creating Tomorrow’s Classics',
  description: 'A premium independent music label crafting original music across deep house, country, reggae, blues and Afro house.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
