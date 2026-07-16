'use client';

import { FormEvent, useState } from 'react';
import { Send } from 'lucide-react';

export function ContactForm() {
  const [status, setStatus] = useState('');
  const [error,setError]=useState('');
  const [submitting,setSubmitting]=useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();setStatus('');setError('');setSubmitting(true);
    const formElement=event.currentTarget;const form=new FormData(formElement);
    try{const response=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:form.get('name'),email:form.get('email'),department:form.get('department'),subject:form.get('subject'),message:form.get('message'),website:form.get('website')})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Unable to send message.');setStatus(`Thank you. Your message has been received${data.reference?` — reference ${data.reference}`:''}.`);formElement.reset();}catch(e){setError(e instanceof Error?e.message:'Unable to send message.');}finally{setSubmitting(false);}
  }

  return <form className="contact-form" onSubmit={handleSubmit}>
    <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{position:'absolute',left:'-9999px'}}/>
    <div className="contact-form-row"><label><span>Full Name</span><input name="name" type="text" autoComplete="name" maxLength={120} required /></label><label><span>Email Address</span><input name="email" type="email" autoComplete="email" maxLength={180} required /></label></div>
    <div className="contact-form-row"><label><span>Subject</span><input name="subject" type="text" maxLength={180} required /></label><label><span>Department</span><select name="department" defaultValue="General Enquiry"><option>Artist Submission</option><option>Licensing & Sync</option><option>Business Partnerships</option><option>Merchandise Support</option><option>Press & Media</option><option>Customer Support</option><option>General Enquiry</option></select></label></div>
    <label><span>Message</span><textarea name="message" rows={7} minLength={10} maxLength={5000} required /></label>
    <button className="primary-button contact-submit" type="submit" disabled={submitting}>{submitting?'Sending…':'Send Message'} <Send size={16}/></button>
    {status&&<p className="contact-status" role="status">{status}</p>}{error&&<p className="contact-status" role="alert">{error}</p>}
  </form>;
}