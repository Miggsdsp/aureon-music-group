import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminFirestore } from '@/lib/firebase-admin';
import { verifyUnsubscribeToken } from '@/lib/lifecycle-email';

export const runtime = 'nodejs';

function response(title: string, message: string, status = 200) {
  return new NextResponse(`<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>${title}</title></head><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#050505;color:#f7f2e8;font-family:Arial,sans-serif"><main style="width:min(560px,calc(100% - 32px));border:1px solid #5b4722;background:#0b0a08;padding:42px;box-sizing:border-box;text-align:center"><div style="font-family:Georgia,serif;color:#d9ae4d;letter-spacing:7px;font-size:25px">AUREON</div><p style="color:#b89755;letter-spacing:3px;font-size:10px">MUSIC GROUP</p><h1 style="font-family:Georgia,serif;font-size:32px;margin-top:34px">${title}</h1><p style="color:#d8d0c0;line-height:1.7">${message}</p><a href="/account" style="display:inline-block;margin-top:20px;border:1px solid #d9ae4d;padding:14px 22px;color:#f2c862;text-decoration:none;text-transform:uppercase;letter-spacing:2px;font-size:11px">Return to Aureon</a></main></body></html>`, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const uid = String(url.searchParams.get('uid') || '');
  const token = String(url.searchParams.get('token') || '');
  if (!uid || !token || !verifyUnsubscribeToken(uid, token)) return response('Invalid link', 'This unsubscribe link is invalid or has expired.', 400);
  await adminFirestore.collection('members').doc(uid).set({ marketingEmailsDisabled: true, marketingEmailsDisabledAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await adminFirestore.collection('emailSuppressions').doc(uid).set({ uid, reason: 'member_unsubscribed', createdAt: FieldValue.serverTimestamp() }, { merge: true });
  return response('Preferences updated', 'You will no longer receive Aureon lifecycle or marketing emails. Essential transactional emails about purchases, security and billing may still be sent.');
}
