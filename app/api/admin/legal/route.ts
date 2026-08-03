import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminFirestore } from '@/lib/firebase-admin';
import { requireAdminApi } from '@/lib/require-admin-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message === 'UNAUTHENTICATED') return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 });
  if (message === 'FORBIDDEN') return NextResponse.json({ error: 'Administrator access is required.' }, { status: 403 });
  console.error('Legal Centre API failed:', error);
  return NextResponse.json({ error: 'The legal document could not be saved.' }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    await requireAdminApi(request);
    const snapshot = await adminFirestore.collection('legalDocuments').get();
    const documents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ documents }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdminApi(request);
    const body = await request.json();
    const id = String(body?.id || '').trim();
    const title = String(body?.title || '').trim();
    const content = String(body?.content || '').trim();
    const slug = String(body?.slug || '').trim();
    const status = ['draft', 'published', 'archived'].includes(String(body?.status)) ? String(body.status) : 'draft';

    if (!title || !content || !slug) {
      return NextResponse.json({ error: 'Document title, URL slug and content are required.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const version = String(body?.version || '1.0').trim() || '1.0';
    const ref = id ? adminFirestore.collection('legalDocuments').doc(id) : adminFirestore.collection('legalDocuments').doc();
    const existing = id ? await ref.get() : null;
    const current = existing?.data() || {};
    const versions = [...(Array.isArray(current.versions) ? current.versions : []), { version, content, savedAt: now }].slice(-25);

    await ref.set({
      title,
      slug,
      content,
      version,
      effectiveDate: String(body?.effectiveDate || ''),
      lastUpdated: now.slice(0, 10),
      status,
      seoTitle: String(body?.seoTitle || '').trim(),
      seoDescription: String(body?.seoDescription || '').trim(),
      order: Number(body?.order || 0),
      versions,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: admin.email || admin.uid,
      ...(id ? {} : { createdAt: FieldValue.serverTimestamp(), createdBy: admin.email || admin.uid }),
    }, { merge: true });

    return NextResponse.json({ id: ref.id, status, saved: true });
  } catch (error) {
    return errorResponse(error);
  }
}
