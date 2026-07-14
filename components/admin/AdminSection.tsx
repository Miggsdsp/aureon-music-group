'use client';

import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { firestore, firebaseStorage } from '@/lib/firebase-client';
import { AdminShell } from './AdminShell';

type RecordData={id:string;title?:string;name?:string;slug?:string;description?:string;status?:string;price?:number;featured?:boolean;details?:Record<string,unknown>;artistId?:string;artistName?:string;artistSlug?:string;albumId?:string;albumTitle?:string;albumSlug?:string;genre?:string;trackNumber?:number;isrc?:string;releaseDate?:string;purchasable?:boolean;promotional?:boolean;[key:string]:unknown};
type SectionConfig={collectionName:string;primaryLabel:string;supportsPrice:boolean;supportsPublishing:boolean};
type UploadField={key:string;label:string;accept:string;folder:string;privatePath?:boolean;multiple?:boolean;autoPreview?:boolean};
type RelationForm={artistId:string;albumId:string;genre:string;trackNumber:string;isrc:string;releaseDate:string;purchasable:boolean;promotional:boolean};

const configs:Record<string,SectionConfig>={
 Artists:{collectionName:'artists',primaryLabel:'Artist name',supportsPrice:false,supportsPublishing:true},
 Albums:{collectionName:'albums',primaryLabel:'Album title',supportsPrice:false,supportsPublishing:true},
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
  {key:'privateFilePath',label:'Full song MP3/WAV — Aureon creates the 40-second preview automatically',accept:'audio/mpeg,audio/mp3,audio/wav,audio/x-wav',folder:'private/full-tracks',privatePath:true,autoPreview:true}
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
const emptyRelations:RelationForm={artistId:'',albumId:'',genre:'',trackNumber:'',isrc:'',releaseDate:'',purchasable:true,promotional:false};
function makeSlug(value:string){return value.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function safeFileName(name:string){return name.toLowerCase().replace(/[^a-z0-9.]+/g,'-').replace(/^-|-$/g,'')}
function writeAscii(view:DataView,offset:number,value:string){for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i))}
function createWavBlob(buffer:AudioBuffer,seconds=40){const frames=Math.min(buffer.length,Math.floor(buffer.sampleRate*seconds));const channels=Math.min(buffer.numberOfChannels,2);const dataSize=frames*channels*2;const arrayBuffer=new ArrayBuffer(44+dataSize);const view=new DataView(arrayBuffer);writeAscii(view,0,'RIFF');view.setUint32(4,36+dataSize,true);writeAscii(view,8,'WAVE');writeAscii(view,12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,buffer.sampleRate,true);view.setUint32(28,buffer.sampleRate*channels*2,true);view.setUint16(32,channels*2,true);view.setUint16(34,16,true);writeAscii(view,36,'data');view.setUint32(40,dataSize,true);const channelData=Array.from({length:channels},(_,i)=>buffer.getChannelData(i));let offset=44;for(let frame=0;frame<frames;frame++)for(let channel=0;channel<channels;channel++){const sample=Math.max(-1,Math.min(1,channelData[channel][frame]||0));view.setInt16(offset,sample<0?sample*0x8000:sample*0x7fff,true);offset+=2}return new Blob([arrayBuffer],{type:'audio/wav'})}
async function buildPreviewFile(file:File,slug:string){const AudioContextClass=window.AudioContext||(window as typeof window & {webkitAudioContext:typeof AudioContext}).webkitAudioContext;if(!AudioContextClass)throw new Error('This browser cannot create audio previews. Please use Safari or Chrome.');const context=new AudioContextClass();try{const decoded=await context.decodeAudioData(await file.arrayBuffer());return new File([createWavBlob(decoded,40)],`${slug}-preview.wav`,{type:'audio/wav'})}finally{await context.close()}}

export function AdminSection({title,description}:{title:string;description:string}){
 const config=configs[title];
 const [items,setItems]=useState<RecordData[]>([]);
 const [artists,setArtists]=useState<RecordData[]>([]);
 const [albums,setAlbums]=useState<RecordData[]>([]);
 const [form,setForm]=useState(emptyForm);
 const [relations,setRelations]=useState<RelationForm>(emptyRelations);
 const [editingId,setEditingId]=useState<string|null>(null);
 const [saving,setSaving]=useState(false);
 const [message,setMessage]=useState('');
 const [uploading,setUploading]=useState<Record<string,number>>({});
 const [uploadedDetails,setUploadedDetails]=useState<Record<string,unknown>>({});

 useEffect(()=>{
  if(!config)return;
  const source=query(collection(firestore,config.collectionName),orderBy('updatedAt','desc'));
  let fallbackUnsubscribe:(()=>void)|undefined;
  const unsubscribe=onSnapshot(source,
   snapshot=>setItems(snapshot.docs.map(d=>({id:d.id,...d.data()} as RecordData))),
   ()=>{fallbackUnsubscribe=onSnapshot(collection(firestore,config.collectionName),snapshot=>setItems(snapshot.docs.map(d=>({id:d.id,...d.data()} as RecordData))))}
  );
  return ()=>{unsubscribe();fallbackUnsubscribe?.()};
 },[config]);
 useEffect(()=>{if(title!=='Songs'&&title!=='Albums')return;return onSnapshot(collection(firestore,'artists'),s=>setArtists(s.docs.map(d=>({id:d.id,...d.data()} as RecordData)))},[title]);
 useEffect(()=>{if(title!=='Songs')return;return onSnapshot(collection(firestore,'albums'),s=>setAlbums(s.docs.map(d=>({id:d.id,...d.data()} as RecordData)))},[title]);
 const primaryKey=useMemo(()=>title==='Artists'||title==='Merchandise'?'name':'title',[title]);
 const fields=uploadFields[title]||[];
 const selectedArtist=artists.find(a=>a.id===relations.artistId);
 const availableAlbums=albums.filter(a=>!relations.artistId||a.artistId===relations.artistId||a.details?.artistId===relations.artistId);

 if(!config)return <AdminShell><section className="admin-empty-state"><h2>{title}</h2><p>Module unavailable.</p></section></AdminShell>;

 function startEdit(item:RecordData){const details=item.details||{};setEditingId(item.id);setUploadedDetails(details);setForm({primary:String(item.name||item.title||''),slug:String(item.slug||''),description:String(item.description||''),status:String(item.status||'draft'),price:String(item.price??'0.99'),featured:Boolean(item.featured),details:JSON.stringify(details,null,2)});setRelations({artistId:String(item.artistId||details.artistId||''),albumId:String(item.albumId||details.albumId||''),genre:String(item.genre||details.genre||''),trackNumber:String(item.trackNumber||details.trackNumber||''),isrc:String(item.isrc||details.isrc||''),releaseDate:String(item.releaseDate||details.releaseDate||''),purchasable:item.purchasable!==false&&details.purchasable!==false,promotional:Boolean(item.promotional||details.promotional)});setMessage('Editing selected record.')}
 function resetForm(){setEditingId(null);setForm(emptyForm);setRelations(emptyRelations);setUploadedDetails({});setUploading({});setMessage('')}
 function uploadToStorage(storagePath:string,file:File,progressKey:string,returnPath=false){setUploading(c=>({...c,[progressKey]:0}));return new Promise<string>((resolve,reject)=>{const task=uploadBytesResumable(ref(firebaseStorage,storagePath),file,{contentType:file.type||undefined});task.on('state_changed',s=>setUploading(c=>({...c,[progressKey]:Math.round((s.bytesTransferred/s.totalBytes)*100)})),error=>{setUploading(c=>{const n={...c};delete n[progressKey];return n});reject(error)},async()=>{const value=returnPath?storagePath:await getDownloadURL(task.snapshot.ref);setUploading(c=>{const n={...c};delete n[progressKey];return n});resolve(value)})})}
 async function uploadFile(field:UploadField,file:File){if(title==='Songs'&&!relations.artistId){setMessage('Select the artist before uploading the song.');return}const slug=form.slug.trim()||makeSlug(form.primary||'upload');const artistFolder=title==='Songs'?(selectedArtist?.slug||makeSlug(String(selectedArtist?.name||selectedArtist?.title||'unassigned'))):'';const folder=artistFolder?`${field.folder}/${artistFolder}`:field.folder;const objectName=`${slug}-${Date.now()}-${safeFileName(file.name)}`;try{setMessage(field.autoPreview?'Uploading full song…':'Uploading file…');const value=await uploadToStorage(`${folder}/${objectName}`,file,field.key,Boolean(field.privatePath));setUploadedDetails(c=>field.multiple?{...c,[field.key]:[...(Array.isArray(c[field.key])?c[field.key] as unknown[]:[]),value]}:{...c,[field.key]:value});if(field.autoPreview){setMessage('Creating the 40-second preview automatically…');const previewFile=await buildPreviewFile(file,slug);const previewUrl=await uploadToStorage(`public/previews/${artistFolder}/${slug}-${Date.now()}-preview.wav`,previewFile,'previewUrl');setUploadedDetails(c=>({...c,previewUrl,previewDuration:40}));setMessage('Full song and 40-second preview uploaded successfully.')}else setMessage(`${field.label} uploaded successfully.`)}catch(error){setMessage(error instanceof Error?error.message:'Unable to upload this file.')}}
 async function handleFiles(field:UploadField,fileList:FileList|null){if(!fileList?.length)return;for(let i=0;i<fileList.length;i++)await uploadFile(field,fileList[i])}

 async function saveItem(event:React.FormEvent){event.preventDefault();if(!form.primary.trim()){setMessage(`${config.primaryLabel} is required.`);return}if((title==='Songs'||title==='Albums')&&!relations.artistId){setMessage('Please select an artist.');return}if(Object.keys(uploading).length){setMessage('Please wait for all uploads to finish.');return}if(title==='Songs'&&!uploadedDetails.privateFilePath&&!editingId){setMessage('Please upload the full song before saving.');return}setSaving(true);setMessage('');try{const manualDetails=JSON.parse(form.details||'{}');const artist=artists.find(a=>a.id===relations.artistId);const album=albums.find(a=>a.id===relations.albumId);const relationData=(title==='Songs'||title==='Albums')?{artistId:artist?.id||'',artistName:String(artist?.name||artist?.title||''),artistSlug:String(artist?.slug||makeSlug(String(artist?.name||artist?.title||''))),genre:relations.genre.trim(),releaseDate:relations.releaseDate||'',...(title==='Songs'?{albumId:album?.id||'',albumTitle:String(album?.title||''),albumSlug:String(album?.slug||''),trackNumber:Number(relations.trackNumber||0),isrc:relations.isrc.trim(),purchasable:relations.purchasable,promotional:relations.promotional}:{})}:{};const details={...manualDetails,...uploadedDetails,...relationData};const payload:any={[primaryKey]:form.primary.trim(),slug:form.slug.trim()||makeSlug(form.primary),description:form.description.trim(),status:config.supportsPublishing?form.status:'active',featured:form.featured,details,...uploadedDetails,...relationData,updatedAt:serverTimestamp(),...(config.supportsPrice?{price:Number(form.price||0)}:{})};if(editingId){await updateDoc(doc(firestore,config.collectionName,editingId),payload);setMessage('Changes saved successfully.')}else{await addDoc(collection(firestore,config.collectionName),{...payload,createdAt:serverTimestamp()});setMessage('New record created successfully.')}setEditingId(null);setForm(emptyForm);setRelations(emptyRelations);setUploadedDetails({})}catch(error){setMessage(error instanceof Error?error.message:'Unable to save this record.')}finally{setSaving(false)}}
 async function removeItem(id:string){if(!window.confirm('Delete this record permanently?'))return;await deleteDoc(doc(firestore,config.collectionName,id));setMessage('Record deleted.');if(editingId===id)resetForm()}
 async function togglePublish(item:RecordData){if(!config.supportsPublishing)return;const nextStatus=item.status==='published'?'draft':'published';await updateDoc(doc(firestore,config.collectionName,item.id),{status:nextStatus,updatedAt:serverTimestamp()});setMessage(nextStatus==='published'?'Content is now visible on the website.':'Content is now hidden from the website.')}

 return <AdminShell>
  <div className="admin-page-heading"><p className="admin-kicker">Aureon Control Center</p><h1>{title}</h1><p>{description}</p></div>
  <div className="admin-cms-toolbar"><p>{items.length} record{items.length===1?'':'s'} in Firebase</p><button type="button" onClick={resetForm}>Create new</button></div>
  {message&&<div className="admin-cms-message">{message}</div>}
  <section className="admin-cms-grid">
   <form className="admin-cms-form" onSubmit={saveItem}>
    <h2>{editingId?`Edit ${title.slice(0,-1)}`:`Create ${title.slice(0,-1)}`}</h2>
    <label>{config.primaryLabel}<input value={form.primary} onChange={e=>setForm({...form,primary:e.target.value})}/></label>
    {(title==='Songs'||title==='Albums')&&<label>Artist<select required value={relations.artistId} onChange={e=>setRelations({...relations,artistId:e.target.value,albumId:''})}><option value="">Select artist</option>{artists.map(a=><option key={a.id} value={a.id}>{String(a.name||a.title||'Unnamed artist')}</option>)}</select></label>}
    {title==='Songs'&&<label>Album (optional)<select value={relations.albumId} onChange={e=>setRelations({...relations,albumId:e.target.value})}><option value="">Single / no album</option>{availableAlbums.map(a=><option key={a.id} value={a.id}>{String(a.title||'Untitled album')}</option>)}</select></label>}
    {(title==='Songs'||title==='Albums')&&<div className="checkout-fields two-columns"><label>Genre<input value={relations.genre} onChange={e=>setRelations({...relations,genre:e.target.value})}/></label><label>Release date<input type="date" value={relations.releaseDate} onChange={e=>setRelations({...relations,releaseDate:e.target.value})}/></label></div>}
    {title==='Songs'&&<><div className="checkout-fields two-columns"><label>Track number<input type="number" min="0" value={relations.trackNumber} onChange={e=>setRelations({...relations,trackNumber:e.target.value})}/></label><label>ISRC (optional)<input value={relations.isrc} onChange={e=>setRelations({...relations,isrc:e.target.value.toUpperCase()})}/></label></div><label className="checkout-checkbox"><input type="checkbox" checked={relations.purchasable} onChange={e=>setRelations({...relations,purchasable:e.target.checked})}/> Available to purchase</label><label className="checkout-checkbox"><input type="checkbox" checked={relations.promotional} onChange={e=>setRelations({...relations,promotional:e.target.checked})}/> Promotional/free song</label></>}
    <label>URL slug<input value={form.slug} placeholder="created-automatically" onChange={e=>setForm({...form,slug:e.target.value})}/></label>
    <label>Description<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
    {config.supportsPrice&&<label>Price (€)<input type="number" min="0" step="0.01" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></label>}
    {fields.length>0&&<fieldset style={{border:'1px solid rgba(201,166,74,.35)',padding:18,margin:'8px 0 20px'}}><legend style={{padding:'0 8px'}}>Files and media</legend><p style={{opacity:.75,marginTop:0}}>{title==='Songs'?'Select the artist, then upload the full song once. Aureon files it under that artist and creates the 40-second preview automatically.':'Choose files from your Mac. Aureon uploads and links them automatically.'}</p>{fields.map(field=>{const value=uploadedDetails[field.key];const progress=uploading[field.key];return <div key={field.key} style={{marginBottom:18}}><label>{field.label}<input type="file" accept={field.accept} multiple={field.multiple} onChange={e=>handleFiles(field,e.target.files)}/></label>{typeof progress==='number'&&<div><progress value={progress} max="100" style={{width:'100%'}}/> <small>{progress}% uploaded</small></div>}{field.autoPreview&&typeof uploading.previewUrl==='number'&&<div><progress value={uploading.previewUrl} max="100" style={{width:'100%'}}/> <small>{uploading.previewUrl}% preview uploaded</small></div>}{value&&<small style={{display:'block',wordBreak:'break-all',marginTop:6}}>✓ Uploaded: {Array.isArray(value)?`${value.length} files`:String(value)}</small>}{field.autoPreview&&uploadedDetails.previewUrl&&<small style={{display:'block',marginTop:6}}>✓ 40-second preview created automatically</small>}</div>})}</fieldset>}
    <details style={{marginBottom:18}}><summary>Advanced content fields (optional)</summary><label>Advanced JSON<textarea rows={10} value={form.details} onChange={e=>setForm({...form,details:e.target.value})}/></label></details>
    {config.supportsPublishing&&<label>Visibility<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="draft">Draft / hidden</option><option value="published">Published / visible</option></select></label>}
    <label><span>Featured content</span><input type="checkbox" checked={form.featured} onChange={e=>setForm({...form,featured:e.target.checked})}/></label>
    <div className="admin-cms-actions"><button className="admin-primary-action" type="submit" disabled={saving||Object.keys(uploading).length>0}>{saving?'Saving…':Object.keys(uploading).length?'Uploading…':editingId?'Save changes':'Create record'}</button>{editingId&&<button type="button" onClick={resetForm}>Cancel</button>}</div>
   </form>
   <div className="admin-cms-list"><table><thead><tr><th>Name</th>{(title==='Songs'||title==='Albums')&&<th>Artist</th>}<th>Status</th>{config.supportsPrice&&<th>Price</th>}<th>Actions</th></tr></thead><tbody>{items.length===0&&<tr><td colSpan={config.supportsPrice?5:4}>No records yet.</td></tr>}{items.map(item=><tr key={item.id}><td><strong>{String(item.name||item.title||'Untitled')}</strong><br/><small>{String(item.slug||item.id)}</small>{title==='Songs'&&item.albumTitle&&<><br/><small>{String(item.albumTitle)}</small></>}</td>{(title==='Songs'||title==='Albums')&&<td>{String(item.artistName||item.details?.artistName||'Unassigned')}</td>}<td><span className="admin-status">{String(item.status||'active')}</span></td>{config.supportsPrice&&<td>€{Number(item.price||0).toFixed(2)}</td>}<td><div className="admin-row-actions"><button type="button" onClick={()=>startEdit(item)}>Edit</button>{config.supportsPublishing&&<button type="button" onClick={()=>togglePublish(item)}>{item.status==='published'?'Hide':'Publish'}</button>}<button type="button" onClick={()=>removeItem(item.id)}>Delete</button></div></td></tr>)}</tbody></table></div>
  </section>
 </AdminShell>
}