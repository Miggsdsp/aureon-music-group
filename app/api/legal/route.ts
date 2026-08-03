import { NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function serialise(value: any) {
  if (!value) return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  return value;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = String(searchParams.get('slug') || '').trim();
    const collection = adminFirestore.collection('legalDocuments');

    if (slug) {
      const snapshot = await collection.where('slug', '==', slug).where('status', '==', 'published').limit(1).get();
      if (snapshot.empty) return NextResponse.json({ document: null }, { status: 404, headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } });
      const doc = snapshot.docs[0];
      const data = doc.data();
      return NextResponse.json({ document: { id: doc.id, ...data, createdAt: serialise(data.createdAt), updatedAt: serialise(data.updatedAt) } }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } });
    }

    const snapshot = await collection.where('status', '==', 'published').get();
    const documents = snapshot.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, ...data, createdAt: serialise(data.createdAt), updatedAt: serialise(data.updatedAt) };
    }).sort((a: any, b: any) => Number(a.order ?? 999) - Number(b.order ?? 999) || String(a.title || '').localeCompare(String(b.title || '')));

    return NextResponse.json({ documents }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } });
  } catch (error) {
    console.error('Public legal read failed:', error);
    return NextResponse.json({ error: 'The Legal Centre is temporarily unavailable.' }, { status: 500 });
  }
}
