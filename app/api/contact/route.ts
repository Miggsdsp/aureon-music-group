import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminFirestore } from '@/lib/firebase-admin';

export const runtime='nodejs';
const attempts=new Map<string,{count:number;reset:number}>();
function clean(value:unknown,max=3000){return String(value||'').trim().slice(0,max);}
export async function POST(request:Request){
 const ip=(request.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim();
 const now=Date.now();const current=attempts.get(ip);if(current&&current.reset>now&&current.count>=5)return NextResponse.json({error:'Too many messages. Please try again later.'},{status:429});attempts.set(ip,{count:current&&current.reset>now?current.count+1:1,reset:now+60*60*1000});
 try{const body=await request.json();if(body.website)return NextResponse.json({ok:true});const name=clean(body.name,120),email=clean(body.email,180).toLowerCase(),subject=clean(body.subject,180),department=clean(body.department,80),message=clean(body.message,5000);if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!subject||message.length<10)return NextResponse.json({error:'Please complete all required fields.'},{status:400});const ref=await adminFirestore.collection('enquiries').add({name,email,subject,department,message,status:'new',source:'website',ip,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});const apiKey=process.env.RESEND_API_KEY;const to=process.env.CONTACT_NOTIFICATION_EMAIL||'info@aureonmusicgroup.com';const from=process.env.TRANSACTIONAL_EMAIL_FROM||'Aureon Music Group <downloads@aureonmusicgroup.com>';if(apiKey){await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],reply_to:email,subject:`Aureon enquiry: ${subject}`,text:`Name: ${name}\nEmail: ${email}\nDepartment: ${department}\nReference: ${ref.id}\n\n${message}`})});}return NextResponse.json({ok:true,reference:ref.id});}catch(error){console.error('Contact submission failed:',error);return NextResponse.json({error:'Your message could not be sent. Please try again.'},{status:500});}
}