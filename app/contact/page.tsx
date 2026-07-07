import { PageShell } from '@/components/PageShell';

export default function ContactPage() {
  return (
    <PageShell title="Contact" kicker="Business enquiries">
      <div className="contact-card"><h2>info@aureonmusicgroup.com</h2><p>For licensing, artist, press, partnership and business enquiries.</p><a className="primary-button" href="mailto:info@aureonmusicgroup.com">Email Aureon</a></div>
    </PageShell>
  );
}
