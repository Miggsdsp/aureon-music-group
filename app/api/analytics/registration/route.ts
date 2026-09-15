import {NextResponse} from 'next/server';
import {analyticsContextFromBody,recordTrustedAnalyticsEvent} from '@/lib/analytics-server';
import {memberError,requireMember} from '@/lib/member-server';

export const runtime='nodejs';
export async function POST(request:Request){
 try{const{uid}=await requireMember(request);const body=await request.json();const context=analyticsContextFromBody(body);if(!context.analyticsConsent)return NextResponse.json({ok:true,recorded:false});await recordTrustedAnalyticsEvent({...context,eventType:'registration_complete',entityType:'account',entityId:'registered-member',memberId:uid},uid);return NextResponse.json({ok:true,recorded:true})}
 catch(error){const result=memberError(error);return NextResponse.json({error:result.error},{status:result.status})}
}
