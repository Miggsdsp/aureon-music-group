'use client';

import Script from 'next/script';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {ANALYTICS_CONSENT_KEY,initialiseAttribution} from '@/lib/analytics-attribution';
import {trackAnalytics} from '@/lib/track-analytics';

const measurementId=process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID||process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID||'';

export default function AnalyticsBridge(){
 const pathname=usePathname();const[granted,setGranted]=useState(false);
 useEffect(()=>{const refresh=()=>setGranted(localStorage.getItem(ANALYTICS_CONSENT_KEY)==='granted');refresh();window.addEventListener('aureon-consent-change',refresh);return()=>window.removeEventListener('aureon-consent-change',refresh)},[]);
 useEffect(()=>{if(!granted)return;window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(...args:unknown[]){window.dataLayer?.push(args)};window.gtag('consent','update',{analytics_storage:'granted'});if(measurementId)window.gtag('config',measurementId,{send_page_view:false,anonymize_ip:true});const{returning}=initialiseAttribution();if(returning&&!sessionStorage.getItem('aureon-returning-listener')){sessionStorage.setItem('aureon-returning-listener','1');trackAnalytics({eventType:'returning_listener',entityType:'visitor'})}},[granted]);
 useEffect(()=>{if(!granted||!pathname)return;const params=new URLSearchParams(location.search),safeParams=new URLSearchParams();for(const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term']){const value=params.get(key);if(value)safeParams.set(key,value.slice(0,100))}const pageLocation=location.origin+pathname+(safeParams.size?`?${safeParams}`:'');trackAnalytics({eventType:'page_view',entityType:'page',entityId:pathname,title:document.title,metadata:{page_location:pageLocation,page_path:pathname,page_title:document.title}})},[granted,pathname]);
 if(!granted||!measurementId||process.env.NODE_ENV!=='production')return null;
 return <Script id="aureon-ga4" src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`} strategy="afterInteractive"/>;
}
