import { Header } from './Header';
import { Footer } from './Footer';

export function PageShell({ title, kicker, children }: { title: string; kicker: string; children: React.ReactNode }) {
  return (
    <main className="page-shell">
      <Header />
      <section className="inner-hero">
        <p className="eyebrow">{kicker}</p>
        <h1>{title}</h1>
      </section>
      <section className="content-panel">{children}</section>
      <Footer />
    </main>
  );
}
