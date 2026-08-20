import { NextResponse } from 'next/server';
import { hasActivePlan, requireMember } from '@/lib/member-server';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(request:Request){
 try{
  const context=await requireMember(request);
  const active=hasActivePlan(context.member);
  const creator=hasActivePlan(context.member,'creator');
  const plan=active?String(context.member.plan||''):'';
  return NextResponse.json({authenticated:true,active,plan,permissions:{stream:active,playlists:active,favourites:active,listeningHistory:active,creatorLicence:creator,creatorDownloads:creator,subscriptionDownloads:creator}},{headers:{'Cache-Control':'no-store'}});
 }catch{
  return NextResponse.json({authenticated:false,active:false,plan:'',permissions:{stream:false,playlists:false,favourites:false,listeningHistory:false,creatorLicence:false,creatorDownloads:false,subscriptionDownloads:false}},{headers:{'Cache-Control':'no-store'}});
 }
}
