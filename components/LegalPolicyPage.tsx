import { PageShell } from '@/components/PageShell';
import { EditablePageText } from '@/components/EditablePageText';

export function LegalPolicyPage({slug,title,kicker,sections}:{slug:string;title:string;kicker:string;sections:Array<{heading:string;body:string}>}){
 return <PageShell title={title} kicker={kicker}><article className="news-article-body legal-policy"><EditablePageText slug={slug} field="intro" fallback="This policy explains how Aureon Music Group operates this service and protects its customers." as="p"/>{sections.map((section,index)=><section key={section.heading}><h2>{section.heading}</h2><EditablePageText slug={slug} field={`section${index+1}`} fallback={section.body} as="p"/></section>)}<p><strong>Last updated:</strong> 16 July 2026. Contact: info@aureonmusicgroup.com</p></article></PageShell>;
}