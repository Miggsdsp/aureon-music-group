import { AdminShell } from '@/components/admin/AdminShell';

const cards = [
  ['Revenue today', '€0.00'],
  ['Orders', '0'],
  ['Song sales', '0'],
  ['Merchandise sales', '0'],
  ['Customers', '0'],
  ['Downloads', '0']
];

export default function AdminDashboardPage() {
  return (
    <AdminShell>
      <div className="admin-page-heading"><p className="admin-kicker">Aureon Control Center</p><h1>Dashboard</h1><p>Secure operations overview for Aureon Music Group.</p></div>
      <section className="admin-stat-grid">{cards.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>
      <section className="admin-dashboard-grid"><article><h2>Backend connected</h2><p>Firebase Authentication, Firestore and Storage are now connected to the website.</p></article><article><h2>Next build</h2><p>Artist, album and song management will be added here without exposing upload controls publicly.</p></article></section>
    </AdminShell>
  );
}
