'use client';

import type { ElementType } from 'react';
import { usePublishedDocument } from '@/lib/usePublishedDocument';

export function EditablePageText({slug,field,fallback,as:Tag='span',className}:{slug:string;field:string;fallback:string;as?:ElementType;className?:string}){
 const {data}=usePublishedDocument<any>('sitePages',slug,{[field]:fallback});
 return <Tag className={className}>{String(data?.[field] ?? fallback)}</Tag>;
}
