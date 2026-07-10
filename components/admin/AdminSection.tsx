import { AdminShell } from './AdminShell';

export function AdminSection({ title, description }: { title: string; description: string }) {
  return (
    <AdminShell>
      <div className="admin-page-heading"><p className="admin-kicker">Aureon Control Center</p><h1>{title}</h1><p>{description}</p></div>
      <section className="admin-empty-state"><h2>{title} manager connected</h2><p>This secure module is ready for the Firebase content-management forms in the next phase.</p></section>
    </AdminShell>
  );
}
