'use client';

import {useEffect,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import {getAnalyticsConsentChoice,initialiseAttribution} from '@/lib/analytics-attribution';
import {trackAnalytics} from '@/lib/track-analytics';

const measurementId=process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID||process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID||'G-TN4LEXL6CB';
const googleTagId=process.env.NEXT_PUBLIC_GOOGLE_TAG_ID||measurementId;
const googleAdsId=process.env.NEXT_PUBLIC_GOOGLE_ADS_ID||'';
const gaEnabled=Boolean(measurementId)&&process.env.NODE_ENV==='production';
const gaScriptId='aureon-ga4';
const deniedConsent={analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'} as const;
const grantedConsent={analytics_storage:'granted',ad_storage:'granted',ad_user_data:'granted',ad_personalization:'denied'} as const;

function ensureGtag(){
 window.dataLayer=window.dataLayer||[];
 window.gtag=window.gtag||function(...args:unknown[]){window.dataLayer?.push(args)};
}

export default function AnalyticsBridge(){
 const pathname=usePathname();const[granted,setGranted]=useState(false);const[gaReady,setGaReady]=useState(false);const configured=useRef(false);
 useEffect(()=>{const refresh=()=>setGranted(getAnalyticsConsentChoice()==='granted');refresh();window.addEventListener('aureon-consent-change',refresh);return()=>window.removeEventListener('aureon-consent-change',refresh)},[]);
 useEffect(()=>{if(!gaEnabled)return;ensureGtag();window.gtag?.('consent','default',deniedConsent)},[]);
 useEffect(()=>{if(!gaEnabled)return;ensureGtag();if(!granted){window.gtag?.('consent','update',deniedConsent);setGaReady(false);configured.current=false;return}const markReady=()=>setGaReady(true);const markFailed=()=>setGaReady(false);const existing=document.getElementById(gaScriptId) as HTMLScriptElement|null;if(existing){if(existing.dataset.loaded==='true')markReady();else{existing.addEventListener('load',markReady,{once:true});existing.addEventListener('error',markFailed,{once:true})}}else{const script=document.createElement('script');script.id=gaScriptId;script.async=true;script.src=`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleTagId)}`;script.addEventListener('load',()=>{script.dataset.loaded='true';markReady()},{once:true});script.addEventListener('error',markFailed,{once:true});document.head.appendChild(script)}window.gtag?.('consent','update',grantedConsent);if(configured.current)return;window.gtag?.('js',new Date());window.gtag?.('config',measurementId,{send_page_view:false,anonymize_ip:true});if(/^AW-\d+$/.test(googleAdsId))window.gtag?.('config',googleAdsId,{send_page_view:false});configured.current=true;return()=>{existing?.removeEventListener('load',markReady);existing?.removeEventListener('error',markFailed)}},[granted]);
 useEffect(()=>{if(!granted||!gaReady)return;const{returning}=initialiseAttribution();if(returning&&!sessionStorage.getItem('aureon-returning-listener')){sessionStorage.setItem('aureon-returning-listener','1');trackAnalytics({eventType:'returning_listener',entityType:'visitor'})}},[granted,gaReady]);
 useEffect(()=>{if(!granted||!gaReady||!pathname)return;const params=new URLSearchParams(location.search),safeParams=new URLSearchParams();for(const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term']){const value=params.get(key);if(value)safeParams.set(key,value.slice(0,100))}const pageLocation=location.origin+pathname+(safeParams.size?`?${safeParams}`:'');trackAnalytics({eventType:'page_view',entityType:'page',entityId:pathname,title:document.title,metadata:{page_location:pageLocation,page_path:pathname,page_title:document.title}})},[granted,gaReady,pathname]);
 return null;
}
