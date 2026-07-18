import Link from 'next/link';
import { BriefcaseBusiness, Disc3, Headphones, Mail, MapPin, ShoppingBag } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { ContactForm } from '@/components/ContactForm';
import { EditablePageText } from '@/components/EditablePageText';

const contactOptions = [
  { title: 'Artist Submissions', text: 'Artists, producers and songwriters interested in working with Aureon Music Group.', label: 'Submit a demo', subject: 'Artist Submission', icon: Disc3 },
  { title: 'Licensing & Sync', text: 'Music for film, television, advertising, games and commercial campaigns.', label: 'Licensing enquiry', subject: 'Licensing and Sync Enquiry', icon: Headphones },
  { title: 'Business Partnerships', text: 'Brand collaborations, sponsorship opportunities and strategic partnerships.', label: 'Contact business team', subject: 'Business Partnership', icon: BriefcaseBusiness },
  { title: 'Customer Support', text: 'Help with merchandise, music downloads, orders and general account enquiries.', label: 'Get support', subject: 'Customer Support', icon: ShoppingBag },
];

export default function ContactPage() {
  return (
    <PageShell title="Contact Aureon" kicker="Let’s create tomorrow’s classics together">
      <section className="contact-page-wrap">
        <div className="contact-lead">
          <EditablePageText slug="contact" field="description" fallback="Whether you are an artist, producer, songwriter, filmmaker, brand or business partner, we would love to hear from you." as="p" />
        </div>

        <div className="contact-option-grid">
          {contactOptions.map(({ title, text, label, subject, icon: Icon }) => (
            <article className="contact-option-card" key={title}>
              <Icon size={26} />
              <h2>{title}</h2>
              <p>{text}</p>
              <EditablePageText slug="contact" field="email" fallback="info@aureonmusicgroup.com" as="span" className="contact-email-source" />
              <Link href={`mailto:info@aureonmusicgroup.com?subject=${encodeURIComponent(subject)}`}>{label} →</Link>
            </article>
          ))}
        </div>

        <section className="contact-glass-panel">
          <div className="contact-form-heading">
            <p className="eyebrow">Direct Enquiry</p>
            <EditablePageText slug="contact" field="formTitle" fallback="Something on your mind? Let us know." as="h2" />
            <EditablePageText slug="contact" field="formDescription" fallback="Send Aureon Music Group a message and our team will respond as soon as possible." as="p" />
          </div>
          <ContactForm />
        </section>

        <section className="contact-details">
          <div><Mail size={20} /><EditablePageText slug="contact" field="email" fallback="info@aureonmusicgroup.com" as="span" /></div>
          <div><MapPin size={20} /><EditablePageText slug="contact" field="location" fallback="Ireland" as="span" /></div>
          <div><span className="contact-domain-mark">A</span><EditablePageText slug="contact" field="domain" fallback="aureonmusicgroup.com" as="span" /></div>
        </section>
      </section>
    </PageShell>
  );
}
