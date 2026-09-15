'use client';

import {useEffect,useRef} from 'react';
import {recordContentView} from '@/lib/analytics-attribution';
import {trackAnalytics,type AnalyticsEvent} from '@/lib/track-analytics';

export function AnalyticsView({event}:{event:AnalyticsEvent}){
 const initial=useRef(event);
 useEffect(()=>{const value=initial.current;if(value.eventType==='song_view'&&value.slug)recordContentView('song',value.slug);if(value.eventType==='artist_view'&&value.slug)recordContentView('artist',value.slug);trackAnalytics(value)},[]);
 return null;
}
