'use client';

import { useEffect } from 'react';
import { trackAnalytics } from '@/lib/track-analytics';

const SELECTORS: Array<[string,string,string]> = [
  ['[aria-label="Aureon trust and service assurances"]','global_trust_bar','global'],
  ['.membership-trust','membership_trust','membership'],
  ['.aureon-checkout-trust','checkout_trust','checkout'],
  ['.aureon-footer-trust','footer_trust','footer'],
  ['[aria-label="Official Aureon Artist"]','official_artist_badge','product'],
  ['[aria-label="Official Aureon Album"]','official_album_badge','product'],
  ['[aria-label="Official Aureon Video"]','official_video_badge','product'],
  ['[aria-label="HD Audio"]','hd_audio_badge','product'],
  ['[data-trust-panel="creator-licensing"]','creator_licensing','creator'],
  ['[data-trust-panel="privacy-first"]','privacy_first','privacy'],
  ['[data-trust-panel="account-security"]','account_security','account'],
];

const lastExposureKey='aureon-last-trust-exposure';
function key(placement:string){return `aureon-trust-impression:${location.pathname}:${placement}`;}

export function TrustAnalyticsBridge(){
  useEffect(()=>{
    const observed=new Set<Element>();
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries){
        if(!entry.isIntersecting||entry.intersectionRatio<0.35)continue;
        const element=entry.target as HTMLElement;
        const placement=element.dataset.trustPlacement||'';
        const category=element.dataset.trustCategory||'general';
        if(!placement)continue;
        sessionStorage.setItem(lastExposureKey,JSON.stringify({placement,category,at:Date.now()}));
        if(sessionStorage.getItem(key(placement)))continue;
        sessionStorage.setItem(key(placement),'1');
        trackAnalytics({eventType:'trust_impression',entityType:'trust',entityId:placement,title:element.getAttribute('aria-label')||placement,metadata:{trustPlacement:placement,trustCategory:category}});
        observer.unobserve(element);
      }
    },{threshold:[0.35]});

    const register=()=>{
      for(const [selector,placement,category] of SELECTORS){
        document.querySelectorAll(selector).forEach(node=>{
          if(observed.has(node))return;
          observed.add(node);const element=node as HTMLElement;
          element.dataset.trustPlacement=placement;element.dataset.trustCategory=category;observer.observe(element);
        });
      }
    };
    register();
    const mutation=new MutationObserver(register);mutation.observe(document.body,{childList:true,subtree:true});
    const click=(event:MouseEvent)=>{
      const target=(event.target as Element|null)?.closest('a,button');if(!target)return;
      const trust=target.closest('[data-trust-placement]') as HTMLElement|null;
      const text=(target.textContent||'').trim().slice(0,120);
      const conversion=/subscribe|choose|checkout|create account|join free|buy|purchase|manage billing/i.test(text);
      let exposure:{placement?:string;category?:string;at?:number}={};
      try{exposure=JSON.parse(sessionStorage.getItem(lastExposureKey)||'{}');}catch{}
      const recentExposure=exposure.at&&Date.now()-exposure.at<30*60*1000?exposure:{};
      const directPlacement=trust?.dataset.trustPlacement||'';
      const ctaPlacement=/membership|subscribe|choose/i.test(text)?'membership_cta':/buy|purchase|checkout/i.test(text)?'purchase_cta':/create account|join free/i.test(text)?'account_cta':'';
      const placement=directPlacement||ctaPlacement;
      if(!placement)return;
      trackAnalytics({eventType:conversion?'trust_conversion':'trust_click',entityType:'trust',entityId:placement,title:text,metadata:{trustPlacement:placement,trustCategory:trust?.dataset.trustCategory||'cta',conversionType:conversion?(/account|join/i.test(text)?'account_creation':/buy|purchase|checkout/i.test(text)?'purchase':'membership'):'click',attributedTrustPlacement:String(recentExposure.placement||directPlacement||''),attributedTrustCategory:String(recentExposure.category||trust?.dataset.trustCategory||'')}});
    };
    document.addEventListener('click',click,true);
    return()=>{observer.disconnect();mutation.disconnect();document.removeEventListener('click',click,true);};
  },[]);
  return null;
}
