'use client';

import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { firebaseStorage, firestore } from '@/lib/firebase-client';
import { AdminShell } from './AdminShell';

type Row={id:string;title?:string;slug?:string;category?:string;tags?:string[];author?:string;excerpt?:string;body?:string;featuredImageUrl?:string;publishAt?:any;publishDate?:string;featured?:boolean;status?:string;seoTitle?:string;seoDescription?:string};
type Form={title:string;slug:string;category:string;tags:string;author:string;excerpt:string;body:string;featuredImageUrl:string;publishAt:string;featured:boolean;seoTitle:string;seoDescription:string};
const blank:Form={title:'',slug:'',category:'Company news',tags:'',author:'Aureon Music Group',excerpt:'',body:'',featuredImageUrl:'',publishAt:'',featured:false,seoTitle:'',seoDescription:''};
const slugify=(value:string)=>value.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const dateInput=(value:any)=>{if(!value)return'';const date=value?.toDate?.()??new Date(value);if(Number.isNaN(date.getTime()))return'';const offset=date.getTimezoneOffset();return new Date(date.getTime()-offset*60000).toISOString().slice(0,16)};

export function NewsManager(){
 const[items,setItems]=useState<Row[]>([]);const[editing,setEditing]=useState<Row|null>(null);const[form,setForm]=useState<Form>(blank);const[message,setMessage]=useState('');const[progress,setProgress]=useState(0);const[saving,setSaving]=useState(false);
 useEffect(()=>onSnapshot(collection(firestore,'newsArticles'),snap=>setItems(snap.docs.map(d=>({id:d.id,...d.data()} as Row))),error=>setMessage(`Unable to load articles: ${error.message}`)),[]);
 const reset=()=>{setEditing(null);setForm(blank);setProgress(0)};
 const edit=(item:Row)=>{setEditing(item);setForm({title:item.title||'',slug:item.slug||'',category:item.category||'Company news',tags:(item.tags||[]).join(', '),author:item.author||'Aureon Music Group',excerpt:item.excerpt||'',body:item.body||'',featuredImageUrl:item.featuredImageUrl||'',publishAt:dateInput(item.publishAt),featured:Boolean(item.featured),seoTitle:item.seoTitle||'',seoDescription:item.seoDescription||''})};
 async function upload(file:File){setProgress(1);setMessage('');const path=`public/news/${Date.now()}-${file.name.toLowerCase().replace(/[^a-z0-9.]+/g,'-')}`;const task=uploadBytesResumable(ref(firebaseStorage,path),file,{contentType:file.type});try{await new Promise<void>((resolve,reject)=>task.on('state_changed',s=>setProgress(Math.round(s.bytesTransferred/s.totalBytes*100)),reject,resolve));const url=await getDownloadURL(task.snapshot.ref);setForm(v=>({...v,featuredImageUrl:url}));setMessage('Featured image uploaded.')}catch(error){setMessage(error instanceof Error?error.message:'Image upload failed.')}finally{setProgress(0)}}
 async function save(status:'draft'|'published'){
  if(!form.title.trim()||!form.body.trim())return setMessage('Headline and article body are required.');
  setSaving(true);setMessage('');
  try{
   const scheduled=form.publishAt?new Date(form.publishAt):null;
   const publishedAt=status==='published'?(scheduled||new Date()):scheduled;
   const payload={title:form.title.trim(),slug:form.slug.trim()||slugify(form.title),category:form.category,tags:form.tags.split(',').map(x=>x.trim()).filter(Boolean),author:form.author.trim()||'Aureon Music Group',excerpt:form.excerpt.trim(),description:form.excerpt.trim(),body:form.body,content:form.body,featuredImageUrl:form.featuredImageUrl,imageUrl:form.featuredImageUrl,publishAt:publishedAt,publishDate:publishedAt?.toISOString().slice(0,10)||'',featured:form.featured,status,seoTitle:form.seoTitle.trim(),seoDescription:form.seoDescription.trim(),updatedAt:serverTimestamp()};
   if(editing)await updateDoc(doc(firestore,'newsArticles',editing.id),payload);else await addDoc(collection(firestore,'newsArticles'),{...payload,createdAt:serverTimestamp()});
   reset();setMessage(status==='published'?'Article published. It will appear on the News page and homepage automatically.':'Draft saved.');
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to save article.')}finally{setSaving(false)}
 }
 return <AdminShell>
  <div className="admin-page-heading"><p className="admin-kicker">Editorial</p><h1>News CMS</h1><p>Create drafts or publish stories immediately. Only published stories appear publicly.</p></div>
  {message&&<div className="admin-cms-message" role="status">{message}</div>}
  <section className="admin-cms-grid">
   <form className="admin-cms-form" onSubmit={e=>{e.preventDefault();void save('published')}}>
    <h2>{editing?'Edit':'Create'} article</h2>
    <label>Headline<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
    <label>URL slug<input value={form.slug} onChange={e=>setForm({...form,slug:e.target.value})}/></label>
    <div className="checkout-fields two-columns"><label>Category<select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{['Company news','Artist news','New release','Behind the music','Events','Awards','Press release'].map(x=><option key={x}>{x}</option>)}</select></label><label>Author<input value={form.author} onChange={e=>setForm({...form,author:e.target.value})}/></label></div>
    <label>Tags<input placeholder="artist, release, announcement" value={form.tags} onChange={e=>setForm({...form,tags:e.target.value})}/></label>
    <label>Excerpt<textarea value={form.excerpt} onChange={e=>setForm({...form,excerpt:e.target.value})}/></label>
    <label>Article body<textarea required style={{minHeight:280}} value={form.body} onChange={e=>setForm({...form,body:e.target.value})}/></label>
    <label>Featured image<input type="file" accept="image/*" onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file)}}/></label>{progress>0&&<progress value={progress} max={100} style={{width:'100%'}}/>}
    <label>Publish date and time (optional)<input type="datetime-local" value={form.publishAt} onChange={e=>setForm({...form,publishAt:e.target.value})}/></label>
    <label style={{display:'flex',gap:10,alignItems:'center'}}><input type="checkbox" checked={form.featured} onChange={e=>setForm({...form,featured:e.target.checked})}/>Feature on homepage</label>
    <label>SEO title<input value={form.seoTitle} onChange={e=>setForm({...form,seoTitle:e.target.value})}/></label><label>SEO description<textarea value={form.seoDescription} onChange={e=>setForm({...form,seoDescription:e.target.value})}/></label>
    <div style={{display:'flex',gap:12,flexWrap:'wrap'}}><button type="button" disabled={saving||progress>0} onClick={()=>void save('draft')}>Save Draft</button><button className="primary-button" disabled={saving||progress>0}>{saving?'Publishing…':editing?'Update & Publish':'Publish Article'}</button>{editing&&<button type="button" onClick={reset}>Cancel</button>}</div>
   </form>
   <div className="admin-table-wrap"><table><thead><tr><th>Article</th><th>Category</th><th>Featured</th><th>Status</th><th>Actions</th></tr></thead><tbody>{items.length?items.map(item=><tr key={item.id}><td>{item.title||'Untitled'}</td><td>{item.category||'—'}</td><td>{item.featured?'Yes':'No'}</td><td>{item.status||'draft'}</td><td><button type="button" onClick={()=>edit(item)}>Edit</button><button type="button" onClick={()=>{if(confirm('Delete permanently?'))void deleteDoc(doc(firestore,'newsArticles',item.id))}}>Delete</button></td></tr>):<tr><td colSpan={5}>No articles yet.</td></tr>}</tbody></table></div>
  </section>
 </AdminShell>
}
