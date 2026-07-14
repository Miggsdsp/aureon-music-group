'use client';

import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { firestore, firebaseStorage } from '@/lib/firebase-client';
import { AdminShell } from './AdminShell';

type RecordData={id:string;title?:string;name?:string;slug?:string;description?:string;status?:string;price?:number;featured?:boolean;details?:Record<string,unknown>};
type SectionConfig={collectionName:string;primaryLabel:string;supportsPrice:boolean;supportsPublishing:boolean};
type UploadField={key:string;label:string;accept:string;folder:string;privatePath?:boolean;multiple?:boolean;autoPreview?:boolean};

const configs:Record<string,SectionConfig>={
 Artists:{collectionName:'artists',primaryLabel:'Artist name',supportsPrice:false,supportsPublishing:true},
 Albums:{collectionName:'albums',primaryLabel:'Album title',supportsPrice:true,supportsPublishing:true},
 Songs:{collectionName:'songs',primaryLabel:'Song title',supportsPrice:true,supportsPublishing:true},
 Videos:{collectionName:'videoAlbums',primaryLabel:'Video album title',supportsPrice:false,supportsPublishing:true},
 News:{collectionName:'newsArticles',primaryLabel:'Article title',supportsPrice:false,supportsPublishing:true},
 Merchandise:{collectionName:'products',primaryLabel:'Product name',supportsPrice:true,supportsPublishing:true},
 Pages:{collectionName:'sitePages',primaryLabel:'Page title',supportsPrice:false,supportsPublishing:true},
 Orders:{collectionName:'orders',primaryLabel:'Order reference',supportsPrice:true,supportsPublishing:false},
 Settings:{collectionName:'siteSettings',primaryLabel:'Setting name',supportsPrice:false,supportsPublishing:false}
};

const uploadFields:Record<string,UploadField[]>={
 Artists:[
  {key:'logoUrl',label:'Artist logo',accept:'image/*',folder:'public/artists/logos'},
  {key:'profileImageUrl',label:'Profile image',accept:'image/*',folder:'public/artists/profiles'},
  {key:'bannerImageUrl',label:'Banner image',accept:'image/*',folder:'public/artists/banners'}
 ],
 Albums:[{key:'coverImageUrl',label:'Album cover artwork',accept:'image/*',folder:'public/albums/covers'}],
 Songs:[
  {key:'coverImageUrl',label:'Song cover artwork',accept:'image/*',folder:'public/songs/covers'},
  {key:'privateFilePath',label:'Full song MP3/WAV — Aureon automatically creates the 40-second preview',accept:'audio/mpeg,audio/mp3,audio/wav,audio/x-wav',folder:'private/full-tracks',privatePath:true,autoPreview:true}
 ],
 Videos:[
  {key:'thumbnailUrl',label:'Video thumbnail',accept:'image/*',folder:'public/videos/thumbnails'},
  {key:'videoUrl',label:'Video file',accept:'video/*',folder:'public/videos/files'}
 ],
 News:[{key:'featuredImageUrl',label:'Featured image',accept:'image/*',folder:'public/news'}],
 Merchandise:[
  {key:'imageUrl',label:'Main product image',accept:'image/*',folder:'public/products'},
  {key:'galleryUrls',label:'Additional product images',accept:'image/*',folder:'public/products/gallery',multiple:true}
 ]
};

const emptyForm={primary:'',slug:'',description:'',status:'draft',price:'0.99',featured:false,details:'{}'};
function makeSlug(value:string){return value.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function safeFileName(name:string){return name.toLowerCase().replace(/[^a-z0-9.]+/g,'-').replace(/^-|-$/g,'')}

function writeAscii(view:DataView,offset:number,value:string){for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i))}
function createWavBlob(buffer:AudioBuffer,seconds=40){
 const frames=Math.min(buffer.length,Math.floor(buffer.sampleRate*seconds));
 const channels=Math.min(buffer.numberOfChannels,2);
 const bytesPerSample=2;
 const dataSize=frames*channels*bytesPerSample;
 const arrayBuffer=new ArrayBuffer(44+dataSize);
 const view=new DataView(arrayBuffer);
 writeAscii(view,0,'RIFF');view.setUint32(4,36+dataSize,true);writeAscii(view,8,'WAVE');writeAscii(view,12,'fmt ');
 view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,buffer.sampleRate,true);
 view.setUint32(28,buffer.sampleRate*channels*bytesPerSample,true);view.setUint16(32,channels*bytesPerSample,true);view.setUint16(34,16,true);
 writeAscii(view,36,'data');view.setUint32(40,dataSize,true);
 const channelData=Array.from({length:channels},(_,index)=>buffer.getChannelData(index));
 let offset=44;
 for(let frame=0;frame<frames;frame++)for(let channel=0;channel<channels;channel++){
  const sample=Math.max(-1,Math.min(1,channelData[channel][frame]||0));
  view.setInt16(offset,sample<0?sample*0x8000:sample*0x7fff,true);offset+=2;
 }
 return new Blob([arrayBuffer],{type:'audio/wav'});
}
async function buildPreviewFile(file:File,slug:string){
 const AudioContextClass=window.AudioContext||(window as typeof window & {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
 if(!AudioContextClass)throw new Error('This browser cannot create audio previews. Please use Safari or Chrome on your Mac.');
 const context=new AudioContextClass();
 try{
  const decoded=await context.decodeAudioData(await file.arrayBuffer());
  const blob=createWavBlob(decoded,40);
  return new File([blob],`${slug}-preview.wav`,{type:'audio/wav'});
 }finally{await context.close()}
}

export function AdminSection({title,description}:{title:string;description:string}){
 const config=configs[title];
 const [items,setItems]=useState<RecordData[]>([]);
 const [form,setForm]=useState(emptyForm);
 const [editingId,setEditingId]=useState<string|null>(null);
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState('');
 const [uploading,setUploading]=useState<Record<string,number>>({});
 const [uploadedDetails,setUploadedDetails]=useState<Record<string,unknown>>({});

 useEffect(()=>{if(!config)return;const source=query(collection(firestore,config.collectionName),orderBy('updatedAt','desc'));const unsubscribe=onSnapshot(source,s=>setItems(s.docs.map(d=>({id:d.id,...d.data()} as RecordData))),()=>onSnapshot(collection(firestore,config.collectionName),s=>setItems(s.docs.map(d=>({id:d.id,...d.data()} as RecordData)))));return unsubscribe},[config]);
 const primaryKey=useMemo(()=>title==='Artists'||title==='Merchandise'?'name':'title',[title]);
 const fields=uploadFields[title]||[];
 if(!config)return <AdminShell><div className="admin-page-heading"><p className="admin-kicker">Aureon Control Center</p><h1>{title}</h1><p>{description}</p></div><section className="admin-empty-state"><h2>{title}</h2><p>This module will be connected in the next operational phase.</p></section></AdminShell>;

 function startEdit(item:RecordData){
  const details=item.details||{};
  setEditingId(item.id);setUploadedDetails(details);
  setForm({primary:String(item.name||item.title||''),slug:String(item.slug||''),description:String(item.description||''),status:String(item.status||'draft'),price:String(item.price??'0.99'),featured:Boolean(item.featured),details:JSON.stringify(details,null,2)});
  setMessage('Editing selected record.');
 }
 function resetForm(){setEditingId(null);setForm(emptyForm);setUploadedDetails({});setUploading({});setMessage('')}

 function uploadToStorage(storagePath:string,file:File,progressKey:string,returnPath=false){
  setUploading(current=>({...current,[progressKey]:0}));
  return new Promise<string>((resolve,reject)=>{
   const task=uploadBytesResumable(ref(firebaseStorage,storagePath),file,{contentType:file.type||undefined});
   task.on('state_changed',snapshot=>{
    const progress=Math.round((snapshot.bytesTransferred/snapshot.totalBytes)*100);
    setUploading(current=>({...current,[progressKey]:progress}));
   },error=>{setUploading(current=>{const next={...current};delete next[progressKey];return next});reject(error)},async()=>{
    const value=returnPath?storagePath:await getDownloadURL(task.snapshot.ref);
    setUploading(current=>{const next={...current};delete next[progressKey];return next});resolve(value);
   });
  });
 }

 async function uploadFile(field:UploadField,file:File){
  const slug=form.slug.trim()||makeSlug(form.primary||'upload');
  const objectName=`${slug}-${Date.now()}-${safeFileName(file.name)}`;
  const storagePath=`${field.folder}/${objectName}`;
  try{
   setMessage(field.autoPreview?'Uploading full song…':'Uploading file…');
   const value=await uploadToStorage(storagePath,file,field.key,Boolean(field.privatePath));
   if(field.multiple){setUploadedDetails(current=>{const existing=Array.isArray(current[field.key])?current[field.key] as unknown[]:[];return {...current,[field.key]:[...existing,value]}})}
   else setUploadedDetails(current=>({...current,[field.key]:value}));

   if(field.autoPreview){
    setMessage('Full song uploaded. Creating the 40-second preview automatically…');
    const previewFile=await buildPreviewFile(file,slug);
    const previewPath=`public/previews/${slug}-${Date.now()}-preview.wav`;
    const previewUrl=await uploadToStorage(previewPath,previewFile,'previewUrl',false);
    setUploadedDetails(current=>({...current,previewUrl,previewDuration:40}));
    setMessage('Full song and automatic 40-second preview uploaded successfully.');
   }else setMessage(`${field.label} uploaded successfully.`);
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to upload this file.')}
 }

 async function handleFiles(field:UploadField,fileList:FileList|null){if(!fileList?.length)return;for(let i=0;i<fileList.length;i++)await uploadFile(field,fileList[i])}

 async function saveItem(event:React.FormEvent){
  event.preventDefault();if(!form.primary.trim()){setMessage(`${config.primaryLabel} is required.`);return}
  if(Object.keys(uploading).length){setMessage('Please wait for all uploads to finish.');return}
  if(title==='Songs'&&!uploadedDetails.privateFilePath){setMessage('Please upload the full song before saving. Aureon will create its preview automatically.');return}
  setSaving(true);setMessage('');
  try{
   const manualDetails=JSON.parse(form.details||'{}');const details={...manualDetails,...uploadedDetails};
   const payload:any={[primaryKey]:form.primary.trim(),slug:form.slug.trim()||makeSlug(form.primary),description:form.description.trim(),status:config.supportsPublishing?form.status:'active',featured:form.featured,details,updatedAt:serverTimestamp(),...(config.supportsPrice?{price:Number(form.price||0)}:{})};
   if(editingId){await updateDoc(doc(firestore,config.collectionName,editingId),payload);setMessage('Changes saved successfully.')}else{await addDoc(collection(firestore,config.collectionName),{...payload,createdAt:serverTimestamp()});setMessage('New record created successfully.')}
   setEditingId(null);setForm(emptyForm);setUploadedDetails({});
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to save this record.')}finally{setSaving(false)}
 }
 async function removeItem(id:string){if(!window.confirm('Delete this record permanently?'))return;try{await deleteDoc(doc(firestore,config.collectionName,id));setMessage('Record deleted.');if(editingId===id)resetForm()}catch(error){setMessage(error instanceof Error?error.message:'Unable to delete this record.')}}
 async function togglePublish(item:RecordData){if(!config.supportsPublishing)return;const nextStatus=item.status==='published'?'draft':'published';try{await updateDoc(doc(firestore,config.collectionName,item.id),{status:nextStatus,updatedAt:serverTimestamp()});setMessage(nextStatus==='published'?'Content is now visible on the website.':'Content is now hidden from the website.')}catch(error){setMessage(error instanceof Error?error.message:'Unable to change visibility.')}}

 return <AdminShell>
  <div className="admin-page-heading"><p className="admin-kicker">Aureon Control Center</p><h1>{title}</h1><p>{description}</p></div>
  <div className="admin-cms-toolbar"><p>{items.length} record{items.length===1?'':'s'} in Firebase</p><button type="button" onClick={resetForm}>Create new</button></div>
  {message&&<div className="admin-cms-message">{message}</div>}
  <section className="admin-cms-grid">
   <form className="admin-cms-form" onSubmit={saveItem}>
    <h2>{editingId?`Edit ${title.slice(0,-1)}`:`Create ${title.slice(0,-1)}`}</h2>
    <label>{config.primaryLabel}<input value={form.primary} onChange={e=>setForm({...form,primary:e.target.value})}/></label>
    <label>URL slug<input value={form.slug} placeholder="created-automatically" onChange={e=>setForm({...form,slug:e.target.value})}/></label>
    <label>Description<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
    {config.supportsPrice&&<label>Price (€)<input type="number" min="0" step="0.01" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></label>}
    {fields.length>0&&<fieldset style={{border:'1px solid rgba(201,166,74,.35)',padding:'18px',margin:'8px 0 20px'}}>
     <legend style={{padding:'0 8px'}}>Files and media</legend>
     <p style={{opacity:.75,marginTop:0}}>{title==='Songs'?'Upload the full song once. Aureon automatically creates and uploads a safe 40-second public preview.':'Choose files from your Mac. Aureon uploads them to Firebase automatically and saves the correct path.'}</p>
     {fields.map(field=>{const value=uploadedDetails[field.key];const progress=uploading[field.key];return <div key={field.key} style={{marginBottom:18}}>
      <label>{field.label}<input type="file" accept={field.accept} multiple={field.multiple} onChange={e=>handleFiles(field,e.target.files)}/></label>
      {typeof progress==='number'&&<div><progress value={progress} max="100" style={{width:'100%'}}/> <small>{progress}% uploaded</small></div>}
      {field.autoPreview&&typeof uploading.previewUrl==='number'&&<div><progress value={uploading.previewUrl} max="100" style={{width:'100%'}}/> <small>{uploading.previewUrl}% preview uploaded</small></div>}
      {value&&<small style={{display:'block',wordBreak:'break-all',marginTop:6}}>✓ Uploaded: {Array.isArray(value)?`${value.length} files`:String(value)}</small>}
      {field.autoPreview&&uploadedDetails.previewUrl&&<small style={{display:'block',marginTop:6}}>✓ 40-second preview created automatically</small>}
     </div>})}
    </fieldset>}
    <details style={{marginBottom:18}}><summary>Advanced content fields (optional)</summary><label>Advanced JSON<textarea rows={10} value={form.details} onChange={e=>setForm({...form,details:e.target.value})} placeholder='{"genre":"Reggae"}'/></label></details>
    {config.supportsPublishing&&<label>Visibility<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="draft">Draft / hidden</option><option value="published">Published / visible</option></select></label>}
    <label><span>Featured content</span><input type="checkbox" checked={form.featured} onChange={e=>setForm({...form,featured:e.target.checked})}/></label>
    <div className="admin-cms-actions"><button className="admin-primary-action" type="submit" disabled={saving||Object.keys(uploading).length>0}>{saving?'Saving…':Object.keys(uploading).length?'Uploading…':editingId?'Save changes':'Create record'}</button>{editingId&&<button type="button" onClick={resetForm}>Cancel</button>}</div>
   </form>
   <div className="admin-cms-list"><table><thead><tr><th>Name</th><th>Status</th>{config.supportsPrice&&<th>Price</th>}<th>Actions</th></tr></thead><tbody>{items.length===0&&<tr><td colSpan={config.supportsPrice?4:3}>No records yet. Create the first one using the form.</td></tr>}{items.map(item=><tr key={item.id}><td><strong>{item.name||item.title||'Untitled'}</strong><br/><small>{item.slug||item.id}</small></td><td><span className="admin-status">{item.status||'active'}</span></td>{config.supportsPrice&&<td>€{Number(item.price||0).toFixed(2)}</td>}<td><div className="admin-row-actions"><button type="button" onClick={()=>startEdit(item)}>Edit</button>{config.supportsPublishing&&<button type="button" onClick={()=>togglePublish(item)}>{item.status==='published'?'Hide':'Publish'}</button>}<button type="button" onClick={()=>removeItem(item.id)}>Delete</button></div></td></tr>)}</tbody></table></div>
  </section>
 </AdminShell>
}