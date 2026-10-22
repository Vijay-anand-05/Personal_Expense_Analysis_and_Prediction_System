// Compact metric: uppercase label, prominent value, short supporting line. `accent` marks forecast values.
// (`icon` is accepted for backwards compatibility but intentionally not rendered, to avoid icon clutter.)
export default function StatCard({ label, value, sub, accent = false }) {
  return (
    <div className={`card-sw metric ${accent ? 'forecast' : ''}`}>
      <span className="eyebrow">{label}</span>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
