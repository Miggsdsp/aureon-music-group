import { NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase-admin';
import { requireAdminApi } from '@/lib/require-admin-api';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    await requireAdminApi(request);
    const [admins, legacyAdmins] = await Promise.all([
      adminFirestore.collection('admins').get(),
      adminFirestore.collection('admin').get(),
    ]);
    const uids = new Set([...admins.docs, ...legacyAdmins.docs].map(document => document.id));
    return NextResponse.json({ uids: [...uids] }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = message === 'UNAUTHENTICATED' ? 401 : message === 'FORBIDDEN' ? 403 : 500;
    return NextResponse.json({ error: 'Unable to load internal account exclusions.' }, { status });
  }
}
