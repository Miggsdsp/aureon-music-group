import { NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

function millis(value:any){if(!value)return 0;if(typeof value.toMillis==='function')return value.toMillis();if(typeof value.toDate==='function')return value.toDate().getTime();return new Date(value).getTime()||0;}

export async function GET(_request:Request,{params}:{params:Promise<{digestId:string}>}){
 const {digestId}=await params;const snapshot=await adminFirestore.collection('fulfilmentDigests').doc(digestId).get();if(!snapshot.exists)return NextResponse.json({error:'Report not found.'},{status:404});const data=snapshot.data()||{};if(millis(data.expiresAt)<Date.now())return NextResponse.json({error:'This fulfilment report has expired.'},{status:410});const csv=String(data.csv||'');if(!csv)return NextResponse.json({error:'Report is unavailable.'},{status:404});const date=new Date().toISOString().slice(0,10);return new NextResponse('\ufeff'+csv,{status:200,headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="Aureon-Merchandise-Orders-${date}.csv"`,'Cache-Control':'private, no-store'}});
}
