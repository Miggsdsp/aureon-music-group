'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { BadgeCheck, CreditCard, Eye, MousePointerClick, ShieldCheck, TrendingUp } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { useAdminAuth } from '@/components/admin/AdminAuthProvider';
import { firestore } from '@/lib/firebase-client';
import styles from './trust.module.css';

type Row=Record<string,any>;
type Period='24h'|'7d'|'30d'|'all';
const asDate=(value:any)=>value?.toDate?.()||new Date(value?.seconds?value.seconds*1000:value||0);
const pct=(a:number,b:number)=>b?`${(a/b*100).toFixed(1)}%`:'0.0%';
const startFor=(period:Period)=>period==='all'?0:Date.now()-(period==='24h'?1:period==='7d'?7:30)*86400000;
const meta=(event:Row)=>event.metadata&&typeof event.metadata==='object'?event.metadata:{};

export default function TrustDashboard(){
 const{authorised,loading}=useAdminAuth();const[period,setPeriod]=useState<Period>('7d');const[events,setEvents]=useState<Row[]>([]);const[error,setError]=useState('');
 useEffect(()=>{if(loading||!authorised)return;return onSnapshot(collection(firestore,'analyticsEvents'),snap=>{setEvents(snap.docs.map(doc=>({id:doc.id,...doc.data()})));setError('');},()=>setError('Unable to load trust analytics.'));},[authorised,loading]);
 const report=useMemo(()=>{const filtered=events.filter(event=>String(event.eventType||'').startsWith('trust_')&&asDate(event.createdAt||event.receivedAt).getTime()>=startFor(period));const placements=new Map<string,{impressions:number;clicks:number;conversions:number}>();let impressions=0,clicks=0,conversions=0;for(const event of filtered){const type=String(event.eventType);const placement=String(meta(event).trustPlacement||event.entityId||'unknown');const item=placements.get(placement)||{impressions:0,clicks:0,conversions:0};if(type==='trust_impression'){impressions++;item.impressions++;}if(type==='trust_click'){clicks++;item.clicks++;}if(type==='trust_conversion'){conversions++;item.conversions++;}placements.set(placement,item);}return{impressions,clicks,conversions,placements:[...placements.entries()].map(([name,value])=>({name,...value})).sort((a,b)=>b.impressions-a.impressions)};},[events,period]);
 return <AdminShell><div className={styles.page}><header className={styles.header}><div><p>Trust & Credibility</p><h1>Trust Performance</h1><span>Measure how reassurance messaging influences clicks, accounts, subscriptions and purchases.</span></div><div className={styles.periods}>{(['24h','7d','30d','all'] as Period[]).map(value=><button key={value} className={period===value?styles.active:''} onClick={()=>setPeriod(value)}>{value}</button>)}</div></header>{error&&<p className={styles.error}>{error}</p>}<section className={styles.kpis}><article><Eye/><span>Trust impressions</span><strong>{report.impressions.toLocaleString()}</strong></article><article><MousePointerClick/><span>Trust clicks</span><strong>{report.clicks.toLocaleString()}</strong></article><article><TrendingUp/><span>Trust CTR</span><strong>{pct(report.clicks,report.impressions)}</strong></article><article><CreditCard/><span>Attributed conversions</span><strong>{report.conversions.toLocaleString()}</strong></article><article><ShieldCheck/><span>Conversion rate</span><strong>{pct(report.conversions,report.impressions)}</strong></article></section><section className={styles.panel}><div className={styles.panelTitle}><BadgeCheck/><div><p>Placement performance</p><h2>Which trust indicators influence action</h2></div></div><div className={styles.table}><div className={styles.row}><b>Placement</b><b>Impressions</b><b>Clicks</b><b>CTR</b><b>Conversions</b></div>{report.placements.length?report.placements.map(item=><div className={styles.row} key={item.name}><span>{item.name.replace(/[-_]/g,' ')}</span><span>{item.impressions}</span><span>{item.clicks}</span><span>{pct(item.clicks,item.impressions)}</span><span>{item.conversions}</span></div>):<p className={styles.empty}>Trust metrics will appear after visitors see and interact with the new indicators.</p>}</div></section></div></AdminShell>;
}
