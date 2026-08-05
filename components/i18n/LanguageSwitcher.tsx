'use client';
import {usePathname,useRouter,useSearchParams} from 'next/navigation';
import {Globe2} from 'lucide-react';
import {defaultLocale,isLocale,localeMeta,locales,localePath,stripLocale,type Locale} from '@/lib/i18n/config';
import styles from './LanguageSwitcher.module.css';
export function LanguageSwitcher(){const pathname=usePathname();const router=useRouter();const search=useSearchParams();const first=pathname.split('/')[1]||'';const current:isLocale extends never?never:Locale=isLocale(first)?first:defaultLocale;function change(locale:Locale){document.cookie=`aureon_locale=${locale};path=/;max-age=31536000;samesite=lax`;const base=stripLocale(pathname);const query=search.toString();router.push(`${localePath(base,locale)}${query?`?${query}`:''}`);}return <label className={styles.wrap}><Globe2 size={15}/><span className="sr-only">Language</span><select aria-label="Language" value={current} onChange={event=>change(event.target.value as Locale)}>{locales.map(locale=><option value={locale} key={locale}>{localeMeta[locale].label}</option>)}</select></label>}
