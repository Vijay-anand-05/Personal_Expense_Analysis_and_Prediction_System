import { formatCurrency } from '../../utils/format';

// Shared Recharts tooltip: title + one currency row per series.
export default function ChartTooltip({ active, payload, label, labelFormatter }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p.value !== null && p.value !== undefined);
  if (!rows.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="tt-title">{labelFormatter ? labelFormatter(label, payload) : label}</div>
      {rows.map((p) => (
        <div key={p.dataKey || p.name} className="d-flex align-items-center gap-2">
          <span className="cat-dot" style={{ background: p.color || p.payload?.fill }} />
          <span className="text-muted-sw">{p.name}:</span>
          <strong>{formatCurrency(p.value)}</strong>
        </div>
      ))}
    </div>
  );
}
