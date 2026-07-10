import { PageShell } from '@/components/PageShell';
import { MerchStore } from '@/components/MerchStore';

export default function MerchandisePage(){
 return <PageShell title="Merchandise" kicker="Aureon Store">
  <section className="store-intro"><div><p className="eyebrow">Official Store</p><h2>Wear the sound.</h2></div><p>Shop official Aureon and artist merchandise including hoodies, T-shirts, caps, posters and limited releases.</p></section>
  <MerchStore/>
 </PageShell>
}
