import type { MetadataRoute } from 'next';
const base='https://www.aureonmusicgroup.com';
export default function sitemap():MetadataRoute.Sitemap{return['','/artists','/music','/videos','/news','/merchandise','/about','/contact','/privacy','/terms','/digital-download-policy','/refund-policy','/cookie-policy','/copyright','/ai-disclosure'].map(path=>({url:`${base}${path}`,lastModified:new Date(),changeFrequency:path===''?'weekly':'monthly',priority:path===''?1:0.7}));}
