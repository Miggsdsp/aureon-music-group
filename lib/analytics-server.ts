import {createHash} from 'crypto';
import {FieldValue} from 'firebase-admin/firestore';
import {adminFirestore} from '@/lib/firebase-admin';
import {ANALYTICS_EVENTS,type AnalyticsEventName,type TrustedAnalyticsEventName} from '@/lib/analytics-model';

export {ANALYTICS_EVENTS};
export type AnalyticsEventType=AnalyticsEventName;
type Primitive=string|number|boolean|null|undefined;
export type ServerAnalyticsEvent={
 eventType:AnalyticsEventType;entityType?:string;entityId?:string;title?:string;slug?:string;genre?:string;
 artistId?:string;artistSlug?:string;artistName?:string;albumId?:string;albumSlug?:string;albumTitle?:string;
 productId?:string;productName?:string;playlistId?:string;playlistName?:string;memberId?:string;referralCode?:string;
 searchQuery?:string;searchResultCount?:number;plan?:string;revenueCents?:number;currency?:string;
 durationSeconds?:number;listenedSeconds?:number;progressPercent?:number;visitorId?:string;sessionId?:string;
 country?:string;region?:string;city?:string;locale?:string;timezone?:string;deviceType?:string;pathname?:string;userAgent?:string;
 metricName?:string;metricValue?:number;metricRating?:string;metricId?:string;
 firstTouchSource?:string;firstTouchMedium?:string;firstTouchCampaign?:string;firstTouchContent?:string;firstTouchTerm?:string;firstLandingPage?:string;initialReferrer?:string;
 sessionSource?:string;sessionMedium?:string;sessionCampaign?:string;
 firstSongViewed?:string;lastSongViewed?:string;firstArtistViewed?:string;lastArtistViewed?:string;
 analyticsConsent?:boolean;metadata?:Record<string,Primitive>;
};

const clean=(value:unknown,max=180)=>String(value||'').trim().slice(0,max);
const number=(value:unknown,max=Number.MAX_SAFE_INTEGER)=>Math.max(0,Math.min(max,Number(value||0)||0));
const keyPart=(value:string)=>value.toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'unknown';
const privateMetadataKey=/email|phone|address|full.?name|customer|stripe|payment.?intent|subscription.?id/i;
const cleanSearch=(value:unknown)=>{const text=clean(value,100);return /@|\+?\d[\d\s().-]{7,}/.test(text)?'[redacted]':text};
function cleanMetadata(value:unknown){if(!value||typeof value!=='object'||Array.isArray(value))return{};return Object.fromEntries(Object.entries(value as Record<string,unknown>).filter(([key,item])=>!privateMetadataKey.test(key)&&['string','number','boolean'].includes(typeof item)).slice(0,30).map(([key,item])=>[clean(key,60),typeof item==='string'?clean(item,180):item])) as Record<string,Primitive>}

export function analyticsContextFromBody(body:any):Partial<ServerAnalyticsEvent>{
 const first=body?.firstTouch||{},session=body?.sessionTouch||{},content=body?.contentAttribution||{};
 return{analyticsConsent:body?.analyticsConsent===true,visitorId:clean(body?.analyticsClientId||body?.visitorId,120),sessionId:clean(body?.analyticsSessionId||body?.sessionId,120),firstTouchSource:clean(first.source,100),firstTouchMedium:clean(first.medium,100),firstTouchCampaign:clean(first.campaign,100),firstTouchContent:clean(first.content,100),firstTouchTerm:clean(first.term,100),firstLandingPage:clean(first.landingPage,300),initialReferrer:clean(first.referrer,300),sessionSource:clean(session.source,100),sessionMedium:clean(session.medium,100),sessionCampaign:clean(session.campaign,100),firstSongViewed:clean(content.firstSongViewed,160),lastSongViewed:clean(content.lastSongViewed,160),firstArtistViewed:clean(content.firstArtistViewed,160),lastArtistViewed:clean(content.lastArtistViewed,160)};
}

export function stripeAnalyticsMetadata(context:Partial<ServerAnalyticsEvent>){return{analyticsConsent:context.analyticsConsent?'true':'false',analyticsClientId:clean(context.visitorId,100),analyticsSessionId:clean(context.sessionId,100),utmSource:clean(context.firstTouchSource,80),utmMedium:clean(context.firstTouchMedium,80),utmCampaign:clean(context.firstTouchCampaign,80),utmContent:clean(context.firstTouchContent,80),utmTerm:clean(context.firstTouchTerm,80),sessionSource:clean(context.sessionSource,80),sessionMedium:clean(context.sessionMedium,80),sessionCampaign:clean(context.sessionCampaign,80),initialLandingPage:clean(context.firstLandingPage,180),initialReferrer:clean(context.initialReferrer,180),firstSongViewed:clean(context.firstSongViewed,100),lastSongViewed:clean(context.lastSongViewed,100),firstArtistViewed:clean(context.firstArtistViewed,100),lastArtistViewed:clean(context.lastArtistViewed,100)}}
export function analyticsContextFromStripe(metadata:Record<string,string>|null|undefined):Partial<ServerAnalyticsEvent>{const m=metadata||{};return{analyticsConsent:m.analyticsConsent==='true',visitorId:clean(m.analyticsClientId,120),sessionId:clean(m.analyticsSessionId,120),firstTouchSource:clean(m.utmSource,100),firstTouchMedium:clean(m.utmMedium,100),firstTouchCampaign:clean(m.utmCampaign,100),firstTouchContent:clean(m.utmContent,100),firstTouchTerm:clean(m.utmTerm,100),sessionSource:clean(m.sessionSource,100),sessionMedium:clean(m.sessionMedium,100),sessionCampaign:clean(m.sessionCampaign,100),firstLandingPage:clean(m.initialLandingPage,300),initialReferrer:clean(m.initialReferrer,300),firstSongViewed:clean(m.firstSongViewed,160),lastSongViewed:clean(m.lastSongViewed,160),firstArtistViewed:clean(m.firstArtistViewed,160),lastArtistViewed:clean(m.lastArtistViewed,160)}}

function eventPayload(input:ServerAnalyticsEvent,now:Date){return{
 eventType:input.eventType,entityType:clean(input.entityType,30),entityId:clean(input.entityId,160),title:clean(input.title),slug:clean(input.slug,160),genre:clean(input.genre,100),
 artistId:clean(input.artistId,160),artistSlug:clean(input.artistSlug,160),artistName:clean(input.artistName),albumId:clean(input.albumId,160),albumSlug:clean(input.albumSlug,160),albumTitle:clean(input.albumTitle),
 productId:clean(input.productId,160),productName:clean(input.productName),playlistId:clean(input.playlistId,160),playlistName:clean(input.playlistName),memberId:clean(input.memberId,160),referralCode:clean(input.referralCode,80),searchQuery:cleanSearch(input.searchQuery),searchResultCount:number(input.searchResultCount,100000),
 plan:clean(input.plan,40),revenueCents:number(input.revenueCents),currency:clean(input.currency||'eur',12).toLowerCase(),durationSeconds:number(input.durationSeconds,86400),listenedSeconds:number(input.listenedSeconds,86400),progressPercent:number(input.progressPercent,100),
 visitorId:clean(input.visitorId,120),sessionId:clean(input.sessionId,120),country:clean(input.country||'Unknown',8),region:clean(input.region||'Unknown',80),city:clean(input.city||'Unknown',100),locale:clean(input.locale,40),timezone:clean(input.timezone,80),deviceType:clean(input.deviceType,30),pathname:clean(input.pathname,300),referrer:clean(input.firstTouchSource||input.initialReferrer,180),userAgent:clean(input.userAgent,300),
 metricName:clean(input.metricName,30),metricValue:number(input.metricValue,1000000),metricRating:clean(input.metricRating,30),metricId:clean(input.metricId,120),
 firstTouchSource:clean(input.firstTouchSource,100),firstTouchMedium:clean(input.firstTouchMedium,100),firstTouchCampaign:clean(input.firstTouchCampaign,100),firstTouchContent:clean(input.firstTouchContent,100),firstTouchTerm:clean(input.firstTouchTerm,100),firstLandingPage:clean(input.firstLandingPage,300),initialReferrer:clean(input.initialReferrer,300),sessionSource:clean(input.sessionSource,100),sessionMedium:clean(input.sessionMedium,100),sessionCampaign:clean(input.sessionCampaign,100),firstSongViewed:clean(input.firstSongViewed,160),lastSongViewed:clean(input.lastSongViewed,160),firstArtistViewed:clean(input.firstArtistViewed,160),lastArtistViewed:clean(input.lastArtistViewed,160),analyticsConsent:input.analyticsConsent===true,metadata:cleanMetadata(input.metadata),createdAt:FieldValue.serverTimestamp(),receivedAt:now.toISOString(),day:now.toISOString().slice(0,10)} }

function increments(input:ServerAnalyticsEvent,event:any){const result:Record<string,any>={[`events.${keyPart(input.eventType)}`]:FieldValue.increment(1),totalEvents:FieldValue.increment(1),updatedAt:FieldValue.serverTimestamp()};if(event.revenueCents)result.revenueCents=FieldValue.increment(event.revenueCents);if(event.listenedSeconds)result.listenedSeconds=FieldValue.increment(event.listenedSeconds);if(event.country&&event.country!=='Unknown')result[`countries.${keyPart(event.country)}`]=FieldValue.increment(1);if(event.entityType)result[`entityTypes.${keyPart(event.entityType)}`]=FieldValue.increment(1);const metadata=event.metadata||{};if(input.eventType.startsWith('recommendation_')){const action=input.eventType.replace('recommendation_',''),source=keyPart(clean(metadata.recommendationSource||'unknown',100)),algorithm=keyPart(clean(metadata.recommendationAlgorithm||'unknown',100));result[`discovery.actions.${keyPart(action)}`]=FieldValue.increment(1);result[`discovery.sources.${source}.${keyPart(action)}`]=FieldValue.increment(1);result[`discovery.algorithms.${algorithm}.${keyPart(action)}`]=FieldValue.increment(1)}if(input.eventType.startsWith('trust_')){const action=keyPart(input.eventType.replace('trust_','')),placement=keyPart(clean(metadata.trustPlacement||input.entityId||'unknown',100)),category=keyPart(clean(metadata.trustCategory||input.entityType||'general',100));result[`trust.actions.${action}`]=FieldValue.increment(1);result[`trust.placements.${placement}.${action}`]=FieldValue.increment(1);result[`trust.categories.${category}.${action}`]=FieldValue.increment(1)}return result}

export async function recordAnalyticsEvent(input:ServerAnalyticsEvent,options:{dedupeKey?:string;trusted?:boolean}={}){
 if(!ANALYTICS_EVENTS.includes(input.eventType))throw new Error(`Unsupported analytics event: ${input.eventType}`);
 const now=new Date(),event=eventPayload(input,now),day=event.day as string,dedupeId=options.dedupeKey?createHash('sha256').update(`${input.eventType}:${options.dedupeKey}`).digest('hex'):'';
 const events=adminFirestore.collection('analyticsEvents'),eventRef=dedupeId?events.doc(dedupeId):events.doc(),dayRef=adminFirestore.collection('analyticsDaily').doc(day),totalRef=adminFirestore.collection('analyticsTotals').doc('platform'),delta=increments(input,event);
 if(dedupeId){const created=await adminFirestore.runTransaction(async transaction=>{const existing=await transaction.get(eventRef);if(existing.exists)return false;transaction.set(eventRef,{...event,trusted:options.trusted===true,dedupeId,ga4Status:'pending'});transaction.set(dayRef,{day,...delta,createdAt:FieldValue.serverTimestamp()},{merge:true});transaction.set(totalRef,delta,{merge:true});return true});return{eventId:eventRef.id,created}}
 const batch=adminFirestore.batch();batch.set(eventRef,event);batch.set(dayRef,{day,...delta,createdAt:FieldValue.serverTimestamp()},{merge:true});batch.set(totalRef,delta,{merge:true});await batch.commit();return{eventId:eventRef.id,created:true};
}

async function sendGa4(event:ServerAnalyticsEvent,eventId:string){
 const measurementId=process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID||process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID||'',apiSecret=process.env.GA4_API_SECRET||'';
 if(!event.analyticsConsent||!event.visitorId||!measurementId||!apiSecret)return false;
 const params:Record<string,string|number>={event_id:eventId,content_type:clean(event.entityType,30),content_id:clean(event.entityId,100),content_name:clean(event.title,100),plan:clean(event.plan,40),source:clean(event.firstTouchSource,100),medium:clean(event.firstTouchMedium,100),campaign:clean(event.firstTouchCampaign,100),first_song_viewed:clean(event.firstSongViewed,100),last_song_viewed:clean(event.lastSongViewed,100),first_artist_viewed:clean(event.firstArtistViewed,100),last_artist_viewed:clean(event.lastArtistViewed,100),currency:clean(event.currency||'eur',12).toUpperCase()};if(event.revenueCents)params.value=event.revenueCents/100;Object.keys(params).forEach(key=>params[key]===''&&delete params[key]);
 const response=await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({client_id:event.visitorId,events:[{name:event.eventType,params}]})});return response.ok;
}

export async function recordTrustedAnalyticsEvent(input:ServerAnalyticsEvent&{eventType:TrustedAnalyticsEventName},dedupeKey:string){
 const result=await recordAnalyticsEvent(input,{dedupeKey,trusted:true});const ref=adminFirestore.collection('analyticsEvents').doc(result.eventId);const snapshot=await ref.get();if(snapshot.data()?.ga4Status==='sent')return result;
 try{const sent=await sendGa4(input,result.eventId);await ref.set({ga4Status:sent?'sent':'not_configured_or_no_consent',ga4UpdatedAt:FieldValue.serverTimestamp()},{merge:true})}catch(error){await ref.set({ga4Status:'failed',ga4UpdatedAt:FieldValue.serverTimestamp()},{merge:true});console.error('Trusted GA4 event delivery failed:',input.eventType,error)}return result;
}
