import Link from 'next/link';
import { BriefcaseBusiness, Disc3, Headphones, Mail, MapPin, ShoppingBag } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { ContactForm } from '@/components/ContactForm';

const contactOptions = [
  {
    title: 'Artist Submissions',
    text: 'Artists, producers and songwriters interested in working with Aureon Music Group.',
    label: 'Submit a demo',
    href: 'mailto:info@aureonmusicgroup.com?subject=Artist%20Submission',
    icon: Disc3
  },
  {
    title: 'Licensing & Sync',
    text: 'Music for film, television, advertising, games and commercial campaigns.',
    label: 'Licensing enquiry',
    href: 'mailto:info@aureonmusicgroup.com?subject=Licensing%20and%20Sync%20Enquiry',
    icon: Headphones
  },
  {
    title: 'Business Partnerships',
    text: 'Brand collaborations, sponsorship opportunities and strategic partnerships.',
    label: 'Contact business team',
    href: 'mailto:info@aureonmusicgroup.com?subject=Business%20Partnership',
    icon: BriefcaseBusiness
  },
  {
    title: 'Customer Support',
    text: 'Help with merchandise, music downloads, orders and general account enquiries.',
    label: 'Get support',
    href: 'mailto:info@aureonmusicgroup.com?subject=Customer%20Support',
    icon: ShoppingBag
  }
];

export default function ContactPage() {
  return (
    <PageShell title="Contact Aureon" kicker="Let’s create tomorrow’s classics together">
      <section className="contact-page-wrap">
        <div className="contact-lead">
          <p>
            Whether you are an artist, producer, songwriter, filmmaker, brand or business partner,
            we would love to hear from you.
          </p>
        </div>

        <div className="contact-option-grid">
          {contactOptions.map(({ title, text, label, href, icon: Icon }) => (
            <article className="contact-option-card" key={title}>
              <Icon size={26} />
              <h2>{title}</h2>
              <p>{text}</p>
              <Link href={href}>{label} →</Link>
            </article>
          ))}
        </div>

        <section className="contact-glass-panel">
          <div className="contact-form-heading">
            <p className="eyebrow">Direct Enquiry</p>
            <h2>Send Aureon a message</h2>
            <p>Complete the form and your email application will open with the enquiry prepared.</p>
          </div>
          <ContactForm />
        </section>

        <section className="contact-details">
          <div>
            <Mail size={20} />
            <span>info@aureonmusicgroup.com</span>
          </div>
          <div>
            <MapPin size={20} />
            <span>Ireland</span>
          </div>
          <div>
            <span className="contact-domain-mark">A</span>
            <span>aureonmusicgroup.com</span>
          </div>
        </section>
      </section>
    </PageShell>
  );
}
