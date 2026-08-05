export const locales=['en','pt','es','fr','de'] as const;
export type Locale=typeof locales[number];
export const defaultLocale:Locale='en';
export const localeMeta:Record<Locale,{label:string;html:string;currency:string;region:string}>={
 en:{label:'English',html:'en-IE',currency:'EUR',region:'IE'},pt:{label:'Português',html:'pt-PT',currency:'EUR',region:'PT'},es:{label:'Español',html:'es-ES',currency:'EUR',region:'ES'},fr:{label:'Français',html:'fr-FR',currency:'EUR',region:'FR'},de:{label:'Deutsch',html:'de-DE',currency:'EUR',region:'DE'},
};
export const isLocale=(value:string):value is Locale=>(locales as readonly string[]).includes(value);
export function localePath(path:string,locale:Locale){const clean=`/${path}`.replace(/\/+/g,'/');return locale===defaultLocale?clean:`/${locale}${clean==='/'?'':clean}`;}
export function stripLocale(path:string){const parts=path.split('/');return isLocale(parts[1]||'')?`/${parts.slice(2).join('/')}`.replace(/\/$/,'')||'/':path;}
