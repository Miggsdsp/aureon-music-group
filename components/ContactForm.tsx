'use client';

import { FormEvent, useState } from 'react';
import { Send } from 'lucide-react';

export function ContactForm() {
  const [status, setStatus] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '');
    const email = String(form.get('email') || '');
    const department = String(form.get('department') || 'General Enquiry');
    const subject = String(form.get('subject') || 'Website enquiry');
    const message = String(form.get('message') || '');

    const body = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Department: ${department}`,
      '',
      message
    ].join('\n');

    window.location.href = `mailto:info@aureonmusicgroup.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setStatus('Your email application has been opened with the enquiry prepared.');
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      <div className="contact-form-row">
        <label>
          <span>Full Name</span>
          <input name="name" type="text" autoComplete="name" required />
        </label>
        <label>
          <span>Email Address</span>
          <input name="email" type="email" autoComplete="email" required />
        </label>
      </div>

      <div className="contact-form-row">
        <label>
          <span>Subject</span>
          <input name="subject" type="text" required />
        </label>
        <label>
          <span>Department</span>
          <select name="department" defaultValue="General Enquiry">
            <option>Artist Submission</option>
            <option>Licensing & Sync</option>
            <option>Business Partnerships</option>
            <option>Merchandise Support</option>
            <option>Press & Media</option>
            <option>General Enquiry</option>
          </select>
        </label>
      </div>

      <label>
        <span>Message</span>
        <textarea name="message" rows={7} required />
      </label>

      <button className="primary-button contact-submit" type="submit">
        Send Message <Send size={16} />
      </button>

      {status && <p className="contact-status" role="status">{status}</p>}
    </form>
  );
}
