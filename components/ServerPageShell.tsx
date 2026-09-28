import { Header } from './Header';
import { ServerFooter } from './ServerFooter';

export function ServerPageShell({ title, kicker, children }: { title: string; kicker: string; children: React.ReactNode }) {
  return (
    <main className="page-shell">
      <Header />
      <section className="inner-hero">
        <p className="eyebrow">{kicker}</p>
        <h1>{title}</h1>
      </section>
      <section className="content-panel">{children}</section>
      <ServerFooter />
    </main>
  );
}
