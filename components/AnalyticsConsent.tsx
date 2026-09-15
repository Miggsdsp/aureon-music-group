'use client';

import Link from 'next/link';
import {useEffect,useState} from 'react';
import {ANALYTICS_CONSENT_KEY,setAnalyticsConsent} from '@/lib/analytics-attribution';
import styles from './AnalyticsConsent.module.css';

export default function AnalyticsConsent(){
 const[choice,setChoice]=useState<string|null|undefined>(undefined);
 useEffect(()=>setChoice(localStorage.getItem(ANALYTICS_CONSENT_KEY)),[]);
 if(choice===undefined)return null;
 if(choice)return <button type="button" className={styles.preferences} onClick={()=>setChoice(null)}>Privacy choices</button>;
 const choose=(granted:boolean)=>{setAnalyticsConsent(granted);setChoice(granted?'granted':'denied')};
 return <aside className={styles.banner} aria-label="Analytics preferences"><div><strong>Privacy-conscious analytics</strong><p>Aureon would like to measure anonymous visits and music discovery so we can improve the platform. We do not send your name, email or payment details to Google Analytics.</p><Link href="/cookie-policy">Cookie policy</Link></div><div className={styles.actions}><button type="button" onClick={()=>choose(false)}>Decline optional analytics</button><button type="button" className={styles.accept} onClick={()=>choose(true)}>Allow analytics</button></div></aside>;
}
