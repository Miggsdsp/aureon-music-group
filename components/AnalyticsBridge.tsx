'use client';

import Script from 'next/script';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {ANALYTICS_CONSENT_KEY,initialiseAttribution} from '@/lib/analytics-attribution';
import {trackAnalytics} from '@/lib/track-analytics';

const measurementId=process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID||process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID||'';
const gaEnabled=Boolean(measurementId)&&process.env.NODE_ENV==='production';

export default function AnalyticsBridge(){
 const pathname=usePathname();const[granted,setGranted]=useState(false);const[tagReady,setTagReady]=useState(false);
 useEffect(()=>{const refresh=()=>setGranted(localStorage.getItem(ANALYTICS_CONSENT_KEY)==='granted');refresh();window.addEventListener('aureon-consent-change',refresh);return()=>window.removeEventListener('aureon-consent-change',refresh)},[]);
 useEffect(()=>{if(!gaEnabled)return;window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(...args:unknown[]){window.dataLayer?.push(args)};window.gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});window.gtag('js',new Date());window.gtag('config',measurementId,{send_page_view:false,anonymize_ip:true});},[]);
 useEffect(()=>{if(!gaEnabled||!tagReady)return;window.gtag?.('consent','update',{analytics_storage:granted?'granted':'denied'});},[granted,tagReady]);
 useEffect(()=>{if(!granted)return;const{returning}=initialiseAttribution();if(returning&&!sessionStorage.getItem('aureon-returning-listener')){sessionStorage.setItem('aureon-returning-listener','1');trackAnalytics({eventType:'returning_listener',entityType:'visitor'})}},[granted]);
 useEffect(()=>{if(!granted||!pathname||!tagReady)return;const params=new URLSearchParams(location.search),safeParams=new URLSearchParams();for(const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term']){const value=params.get(key);if(value)safeParams.set(key,value.slice(0,100))}const pageLocation=location.origin+pathname+(safeParams.size?`?${safeParams}`:'');trackAnalytics({eventType:'page_view',entityType:'page',entityId:pathname,title:document.title,metadata:{page_location:pageLocation,page_path:pathname,page_title:document.title}})},[granted,pathname,tagReady]);
 if(!gaEnabled)return null;
 return <Script id="aureon-ga4" src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`} strategy="afterInteractive" onLoad={()=>setTagReady(true)}/>;
}
