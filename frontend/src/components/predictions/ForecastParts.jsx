import { Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, CheckCircle2, ChevronDown, Info } from 'lucide-react';
import ChartTooltip from '../common/ChartTooltip';
import { EmptyState } from '../common/States';
import { CHART, Legend } from '../dashboard/Charts';
import { formatCompact, formatCurrency, monthLabel } from '../../utils/format';
import { WEIGHTS_TEXT } from './weights';

/** Badge describing how much data backs a forecast. */
export function ConfidenceBadge({ confidence }) {
  return <span className={`badge-sw ${confidence.level === 'preliminary' ? 'accent' : ''}`}>{confidence.label}{confidence.level === 'preliminary' ? ' estimate' : ' confidence'}</span>;
}

/** Completed months (solid green) next to projected months (apricot, translucent with dashed outline). */
export function MonthlyOutlookChart({ data }) {
  if (!data.some((d) => d.actual > 0 || d.predicted > 0)) {
    return <EmptyState title="No history to chart" message="Record some expenses to see actual versus predicted spending." />;
  }
  return (
    <div className="fade-in">
      <div style={{ height: 250 }} role="img" aria-label="Completed months versus projected months">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="month" tickFormatter={(m) => monthLabel(m, 'short').split(' ')[0]} tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatCompact} tick={{ fontSize: 11, fill: CHART.axis }} axisLine={false} tickLine={false} width={52} />
            <Tooltip cursor={{ fill: '#f4f6f3' }} content={<ChartTooltip labelFormatter={(m) => monthLabel(m)} />} />
            <Bar dataKey="actual" name="Actual" fill={CHART.actual} radius={[5, 5, 0, 0]} maxBarSize={30} isAnimationActive={false} />
            <Bar dataKey="predicted" name="Projected" fill={CHART.forecast} fillOpacity={0.35} stroke={CHART.forecast} strokeDasharray="4 3" radius={[5, 5, 0, 0]} maxBarSize={30} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2"><Legend items={[{ label: 'Actual (current month: to date)', color: CHART.actual }, { label: 'Projected', color: CHART.forecast, dashed: true }]} /></div>
    </div>
  );
}

const STATUS = {
  over: { cls: 'danger', label: 'Over budget', icon: AlertTriangle },
  near: { cls: 'accent', label: 'Near limit', icon: AlertTriangle },
  ok: { cls: '', label: 'On track', icon: CheckCircle2 },
  no_budget: { cls: 'neutral', label: 'No budget', icon: Info },
};

export function CategoryForecastTable({ items }) {
  if (!items.length) return <EmptyState title="No category data" message="There is no spending this month to forecast yet." />;
  return (
    <div className="table-responsive">
      <table className="table table-sw">
        <thead><tr><th>Category</th><th className="text-end d-none d-sm-table-cell">Spent</th><th className="text-end">Predicted</th><th className="text-end d-none d-md-table-cell">Budget</th><th className="text-end">Status</th></tr></thead>
        <tbody>
          {items.map((c) => {
            const st = STATUS[c.status];
            return (
              <tr key={c.id}>
                <td>
                  <span className="d-inline-flex align-items-center gap-2"><span className="cat-dot" style={{ background: c.color }} />{c.name}</span>
                  {c.data_sufficiency === 'limited' && <div className="small-label">Limited history</div>}
                </td>
                <td className="text-end d-none d-sm-table-cell tnum text-muted-sw">{formatCurrency(c.spent)}</td>
                <td className="text-end amount">{formatCurrency(c.projected)}</td>
                <td className="text-end d-none d-md-table-cell tnum text-muted-sw">{c.budget > 0 ? formatCurrency(c.budget) : '—'}</td>
                <td className="text-end">
                  <span className={`badge-sw ${st.cls}`}><st.icon size={11} />{st.label}</span>
                  {c.overrun > 0 && <div className="small-label tnum">{formatCurrency(c.overrun)} over</div>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** "How this forecast works" disclosure: method, weights, limits and the live basis for this estimate. */
export function ForecastDisclosure({ month }) {
  return (
    <details className="disclosure">
      <summary>
        <span className="d-inline-flex align-items-center gap-2"><Info size={15} /> How this forecast works</span>
        <ChevronDown size={16} className="chev" />
      </summary>
      <div className="disc-body">
        <p className="mb-2">{month.method}</p>
        {month.typical_fraction_spent !== null && (
          <p className="mb-2">In earlier months about <strong>{month.typical_fraction_spent}%</strong> of the monthly total had been spent by day {month.elapsed_days}.</p>
        )}
        {month.historical_basis.length > 0 && (
          <>
            <div className="eyebrow mb-1">Weighted moving average{month.historical_average !== null && ` · ${formatCurrency(month.historical_average)}`}</div>
            <ul className="list-unstyled mb-3">
              {month.historical_basis.map((b) => (
                <li key={b.month} className="d-flex justify-content-between"><span>{monthLabel(b.month)} <span className="text-muted-sw">× {b.weight}</span></span><span className="tnum">{formatCurrency(b.total)}</span></li>
              ))}
            </ul>
          </>
        )}
        <p className="mb-1"><strong>Method.</strong> {WEIGHTS_TEXT}</p>
        <p className="mb-1"><strong>Pace-only estimate:</strong> {formatCurrency(month.baseline_projection)} (spent so far ÷ days elapsed × days in month). It repeats large early bills, so it is shown for reference only.</p>
        <p className="mb-0 text-muted-sw"><strong className="text-body">Limits.</strong> This is simple statistics, not a trained model. It cannot foresee one-off purchases, income changes or new subscriptions, and early-month or short-history estimates are volatile. {month.confidence.detail}</p>
        {month.notes.map((n) => <div key={n} className="notice-box mt-2"><Info size={15} className="flex-shrink-0 mt-1" /><span>{n}</span></div>)}
      </div>
    </details>
  );
}
