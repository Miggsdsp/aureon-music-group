import { notFound } from 'next/navigation';
import { getPublicGenre } from '@/lib/public-genres';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (await getPublicGenre(slug) === null) notFound();
  return {};
}

export default async function GenreLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (await getPublicGenre(slug) === null) notFound();
  return children;
}
