import { Link } from 'react-router-dom';
import { Sparkline, CHART } from './Charts';
import { formatCurrency, formatPercent } from '../../utils/format';

function Delta({ pct, suffix }) {
  if (pct === null || pct === undefined) return <span>No earlier month to compare</span>;
  return <><span className={`delta ${pct > 0 ? 'up' : 'down'}`}>{pct > 0 ? '▲' : '▼'} {formatPercent(Math.abs(pct))}</span> {suffix}</>;
}

// Four metrics. Sparklines are drawn from this month's real daily data.
export default function SummaryCards({ summary, daily, comparison }) {
  const s = summary;
  const over = s.budget_remaining !== null && s.budget_remaining < 0;
  const cumulative = comparison.cumulative.filter((d) => d.current !== null);
  const like = comparison.like_for_like;
  return (
    <div className="row row-cols-1 row-cols-sm-2 row-cols-xl-4 g-3">
      <div className="col">
        <div className="card-sw metric">
          <span className="eyebrow">Spent this month</span>
          <div className="stat-value">{formatCurrency(s.this_month)}</div>
          <div className="stat-sub">
            {like.previous > 0 ? <Delta pct={like.change_pct} suffix={`vs same ${like.days} days last month`} /> : <Delta pct={null} />}
          </div>
          <Sparkline data={cumulative} dataKey="current" />
        </div>
      </div>
      <div className="col">
        <div className="card-sw metric">
          <span className="eyebrow">Budget remaining</span>
          <div className="stat-value" style={over ? { color: 'var(--sw-danger)' } : undefined}>
            {s.budget_remaining === null ? 'Not set' : formatCurrency(s.budget_remaining)}
          </div>
          <div className="stat-sub">
            {s.budget_remaining === null ? <>Set budgets in <Link to="/categories">Categories</Link></>
              : over ? `Over the ${formatCurrency(s.budget)} monthly budget` : `of ${formatCurrency(s.budget)} · ${Math.round((s.this_month / s.budget) * 100)}% used`}
          </div>
          {s.budget > 0 && (
            <div className={`progress-sw mt-auto ${over ? 'over' : s.this_month / s.budget >= 0.9 ? 'near' : ''}`} style={{ marginTop: '1rem' }}>
              <span style={{ width: `${Math.min(100, (s.this_month / s.budget) * 100)}%` }} />
            </div>
          )}
        </div>
      </div>
      <div className="col">
        <div className="card-sw metric">
          <span className="eyebrow">Average daily spending</span>
          <div className="stat-value">{formatCurrency(s.average_daily)}</div>
          <div className="stat-sub">{s.elapsed_days > 0 ? `Across ${s.elapsed_days} day${s.elapsed_days === 1 ? '' : 's'}` : 'No days elapsed yet'}</div>
          <Sparkline data={daily} dataKey="total" color={CHART.previous} />
        </div>
      </div>
      <div className="col">
        <div className="card-sw metric forecast">
          <span className="eyebrow">Predicted month-end</span>
          <div className="stat-value">{formatCurrency(s.predicted_month_end)}</div>
          <div className="stat-sub">{s.forecast_confidence} estimate · <Link to="/predictions">how it works</Link></div>
        </div>
      </div>
    </div>
  );
}
