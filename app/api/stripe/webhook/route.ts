import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { FieldValue } from 'firebase-admin/firestore';
import { adminFirestore } from '@/lib/firebase-admin';
import { getStripe } from '@/lib/stripe-server';
import { sendPurchaseDownloadEmail } from '@/lib/transactional-email';

export const runtime = 'nodejs';

type PurchasedSong={id:string;title:string;artist:string;privateFilePath:string;unitAmount:number;token:string};
type PendingItem={id:string;name:string;quantity:number;priceCents:number;digital:boolean;size?:string;colour?:string};

function getPrivateFilePath(data:Record<string,any>){const details=data.details&&typeof data.details==='object'?data.details:{};return String(data.privateFilePath||details.privateFilePath||data.fullTrackPath||details.fullTrackPath||'').trim()}
function getPriceCents(data:Record<string,any>){const details=data.details&&typeof data.details==='object'?data.details:{};const price=Number(data.price??details.price??0);return Number.isFinite(price)?Math.round(price*100):0}
function normalisePurchaseReference(reference:string){return String(reference||'').trim().replace(/^SONG-/i,'')}
function objectValue(value:unknown){return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};}

async function resolveSongRecord(reference:string){const songs=adminFirestore.collection('songs');const candidates=Array.from(new Set([String(reference||'').trim(),normalisePurchaseReference(reference)].filter(Boolean)));for(const candidate of candidates){const direct=await songs.doc(candidate).get();if(direct.exists)return direct;}for(const candidate of candidates){for(const field of ['slug','songId','aureonId','id','title']){const match=await songs.where(field,'==',candidate).limit(1).get();if(!match.empty)return match.docs[0];}}return null;}

export async function POST(request:Request){
 const webhookSecret=process.env.STRIPE_WEBHOOK_SECRET;if(!webhookSecret)return NextResponse.json({error:'Webhook secret not configured.'},{status:500});const signature=request.headers.get('stripe-signature');if(!signature)return NextResponse.json({error:'Missing Stripe signature.'},{status:400});
 let event:Stripe.Event;try{event=getStripe().webhooks.constructEvent(await request.text(),signature,webhookSecret);}catch(error){console.error('Invalid Stripe webhook signature:',error);return NextResponse.json({error:'Invalid signature.'},{status:400});}
 try{
  if(event.type==='checkout.session.completed'){const session=event.data.object as Stripe.Checkout.Session;if(session.mode==='payment')await fulfilPaidCheckout(session);}
  if(event.type==='checkout.session.expired'){const session=event.data.object as Stripe.Checkout.Session;if(session.mode==='payment')await adminFirestore.collection('orders').doc(session.id).set({stripeCheckoutSessionId:session.id,status:'expired',paymentStatus:session.payment_status,updatedAt:FieldValue.serverTimestamp()},{merge:true});}
  return NextResponse.json({received:true});
 }catch(error){console.error('Stripe webhook processing failed:',error);return NextResponse.json({error:'Webhook processing failed.'},{status:500});}
}

async function fulfilPaidCheckout(session:Stripe.Checkout.Session){
 if(session.mode!=='payment'||session.payment_status!=='paid')return;
 const orderRef=adminFirestore.collection('orders').doc(session.id);const pendingSnapshot=await orderRef.get();const pending=pendingSnapshot.data()||{};const pendingItems=(Array.isArray(pending.items)?pending.items:[]) as PendingItem[];
 const songReferences=String(session.metadata?.songIds||'').split(',').map(value=>value.trim()).filter(Boolean);const merchItems=pendingItems.filter(item=>item&&!item.digital);
 if(!songReferences.length&&!merchItems.length)return;

 const customerEmail=session.customer_details?.email||session.customer_email||String(pending.customerEmail||'');const customerName=session.customer_details?.name||String(pending.customerName||`${session.metadata?.firstName||''} ${session.metadata?.surname||''}`.trim());const billingAddress=session.customer_details?.address;const deliveryAddress=pending.deliveryAddress||null;const country=deliveryAddress?.country||billingAddress?.country||'Not captured';const city=deliveryAddress?.city||billingAddress?.city||'';const postalCode=deliveryAddress?.postalCode||billingAddress?.postal_code||'';const deviceType=session.metadata?.deviceType||'Not captured';const trafficSource=session.metadata?.trafficSource||session.metadata?.utmSource||'Direct';const paymentIntentId=typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent?.id||'';const orderNumber=`AUR-${session.created}-${session.id.slice(-6).toUpperCase()}`;const siteUrl=(process.env.NEXT_PUBLIC_SITE_URL||'https://www.aureonmusicgroup.com').replace(/\/$/,'');

 const songs:PurchasedSong[]=await Promise.all(songReferences.map(async reference=>{const snapshot=await resolveSongRecord(reference);if(!snapshot)throw new Error(`Purchased song record not found: ${reference}`);const data=snapshot.data()||{};const privateFilePath=getPrivateFilePath(data);if(!privateFilePath.startsWith('private/full-tracks/'))throw new Error(`Purchased song has no valid private file path: ${snapshot.id}`);return{id:snapshot.id,title:String(data.title||data.name||normalisePurchaseReference(reference)),artist:String(data.artist||data.artistName||data.details?.artistName||'Aureon Music Group'),privateFilePath,unitAmount:getPriceCents(data),token:randomBytes(32).toString('hex')};}));

 let inventoryIssue='';
 const created=await adminFirestore.runTransaction(async transaction=>{
  const existing=await transaction.get(orderRef);if(existing.exists&&existing.data()?.status==='paid')return false;
  const productSnapshots=[] as Array<{line:PendingItem;snapshot:any}>;for(const line of merchItems){const productRef=adminFirestore.collection('products').doc(line.id);productSnapshots.push({line,snapshot:await transaction.get(productRef)});}

  for(const {line,snapshot} of productSnapshots){
   if(!snapshot.exists){inventoryIssue=`Product ${line.id} no longer exists after payment.`;continue;}
   const data=snapshot.data()||{};const details=objectValue(data.details);const rawSizeStock=objectValue(data.sizeStock??details.sizeStock);const sizeStock=Object.fromEntries(Object.entries(rawSizeStock).map(([key,value])=>[key,Math.max(0,Math.floor(Number(value)||0))]));const qty=Math.max(1,Math.floor(Number(line.quantity)||1));
   if(Object.keys(sizeStock).length&&line.size){const current=Number(sizeStock[line.size]||0);if(current<qty){inventoryIssue=`Insufficient stock for ${line.name} size ${line.size}.`;continue;}const nextSizeStock={...sizeStock,[line.size]:current-qty};const nextTotal=Object.values(nextSizeStock).reduce((sum,value)=>sum+Number(value||0),0);transaction.set(snapshot.ref,{sizeStock:nextSizeStock,stock:nextTotal,available:nextTotal>0,updatedAt:FieldValue.serverTimestamp(),details:{...details,sizeStock:nextSizeStock,stock:nextTotal,available:nextTotal>0}},{merge:true});}
   else{const rawStock=data.stock??details.stock;if(rawStock!==undefined&&rawStock!==null&&rawStock!==''){const current=Math.max(0,Math.floor(Number(rawStock)||0));if(current<qty){inventoryIssue=`Insufficient stock for ${line.name}.`;continue;}const next=current-qty;transaction.set(snapshot.ref,{stock:next,available:next>0,updatedAt:FieldValue.serverTimestamp(),details:{...details,stock:next,available:next>0}},{merge:true});}}
  }

  transaction.set(adminFirestore.collection('customers').doc(customerEmail||session.id),{email:customerEmail,name:customerName,phone:session.customer_details?.phone||pending.customerPhone||session.metadata?.phone||'',country,city,postalCode,deliveryAddress:deliveryAddress||null,stripeCustomerId:typeof session.customer==='string'?session.customer:session.customer?.id||'',totalOrders:FieldValue.increment(1),lifetimeSpend:FieldValue.increment(session.amount_total||0),lastOrderAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp(),createdAt:FieldValue.serverTimestamp()},{merge:true});
  transaction.set(orderRef,{orderNumber,stripeCheckoutSessionId:session.id,stripePaymentIntentId:paymentIntentId,customerEmail,customerName,customerCountry:country,country,customerCity:city,customerPostalCode:postalCode,deliveryAddress:deliveryAddress||null,deviceType,trafficSource,utmSource:session.metadata?.utmSource||'',utmMedium:session.metadata?.utmMedium||'',utmCampaign:session.metadata?.utmCampaign||'',landingPath:session.metadata?.landingPath||'',currency:session.currency||'eur',amountTotal:session.amount_total||0,songIds:songs.map(song=>song.id),productIds:merchItems.map(item=>item.id),songs:songs.map(song=>({id:song.id,title:song.title,artist:song.artist,privateFilePath:song.privateFilePath,unitAmount:song.unitAmount,quantity:1})),products:merchItems.map(item=>({id:item.id,name:item.name,unitAmount:item.priceCents,quantity:item.quantity,size:item.size||'',colour:item.colour||''})),status:'paid',paymentStatus:session.payment_status,fulfilmentStatus:merchItems.length?(inventoryIssue?'manual_review':'awaiting_fulfilment'):'digital_complete',inventoryIssue:inventoryIssue||'',downloadStatus:songs.length?'available':'not_applicable',downloadPolicy:songs.length?'single-use':'not_applicable',emailStatus:songs.length?'pending':'not_applicable',paidAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true});
  transaction.set(adminFirestore.collection('payments').doc(paymentIntentId||session.id),{orderId:session.id,stripeCheckoutSessionId:session.id,stripePaymentIntentId:paymentIntentId,customerEmail,amount:session.amount_total||0,currency:session.currency||'eur',status:'paid',createdAt:FieldValue.serverTimestamp()},{merge:true});
  for(const song of songs)transaction.set(adminFirestore.collection('downloads').doc(song.token),{token:song.token,orderId:session.id,orderNumber,songId:song.id,songTitle:song.title,artist:song.artist,privateFilePath:song.privateFilePath,customerEmail,active:true,status:'active',maxDownloads:1,downloadCount:0,expiresAt:new Date(Date.now()+72*60*60*1000),createdAt:FieldValue.serverTimestamp()});
  return true;
 });

 if(!created||!customerEmail||!songs.length)return;
 try{const result=await sendPurchaseDownloadEmail({to:customerEmail,customerName,orderNumber,items:songs.map(song=>({title:song.title,artist:song.artist,downloadUrl:`${siteUrl}/api/download/${song.token}`}))});await orderRef.set({emailStatus:result.sent?'sent':'not-configured',emailSentAt:result.sent?FieldValue.serverTimestamp():null},{merge:true});}catch(error){console.error('Purchase email failed:',error);await orderRef.set({emailStatus:'failed',emailError:String(error)},{merge:true});}
}
