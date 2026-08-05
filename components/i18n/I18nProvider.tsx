'use client';
import {createContext,useContext,useMemo,type ReactNode} from 'react';
import {getDictionary,type Dictionary} from '@/lib/i18n/dictionaries';
import {defaultLocale,isLocale,localeMeta,type Locale} from '@/lib/i18n/config';
import {formatCurrency,formatDate,formatDateTime,regionalPrice} from '@/lib/i18n/format';
type Value={locale:Locale;dictionary:Dictionary;formatCurrency:(value:number,currency?:string)=>string;formatDate:(value:Date|string|number,options?:Intl.DateTimeFormatOptions)=>string;formatDateTime:(value:Date|string|number,timeZone?:string)=>string;regionalPrice:(value:number)=>ReturnType<typeof regionalPrice>};
const Context=createContext<Value|null>(null);
export function I18nProvider({locale,children}:{locale:string;children:ReactNode}){const active=isLocale(locale)?locale:defaultLocale;const value=useMemo<Value>(()=>({locale:active,dictionary:getDictionary(active),formatCurrency:(amount,currency)=>formatCurrency(amount,active,currency),formatDate:(date,options)=>formatDate(date,active,options),formatDateTime:(date,timeZone)=>formatDateTime(date,active,timeZone),regionalPrice:amount=>regionalPrice(amount,active)}),[active]);return <Context.Provider value={value}>{children}</Context.Provider>}
export function useI18n(){const value=useContext(Context);if(!value)throw new Error('useI18n must be used inside I18nProvider');return value;}
export function localeHtml(locale:Locale){return localeMeta[locale].html;}
