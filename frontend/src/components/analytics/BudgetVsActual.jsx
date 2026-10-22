import { Link } from 'react-router-dom';
import { Target } from 'lucide-react';
import { EmptyState } from '../common/States';
import { formatCurrency } from '../../utils/format';

// Progress-bar list: green under 90%, orange 90-100%, red over budget.
export default function BudgetVsActual({ rows }) {
  if (!rows.length) {
    return <EmptyState icon={Target} title="No budgets or spending" message="Set category budgets to compare them with actual spending."
      action={<Link to="/categories" className="btn btn-outline-sw btn-sm">Set budgets</Link>} />;
  }
  return (
    <div>
      {rows.map((r) => {
        const pct = r.used_pct === null ? null : Math.min(r.used_pct, 100);
        const level = r.over_budget ? 'over' : r.used_pct !== null && r.used_pct >= 90 ? 'near' : '';
        return (
          <div className="mb-3" key={r.id}>
            <div className="d-flex justify-content-between align-items-baseline gap-2">
              <span className="d-flex align-items-center gap-2"><span className="cat-dot" style={{ background: r.color }} />{r.name}</span>
              <span className="small-label text-end">
                {formatCurrency(r.actual)} {r.budget > 0 ? `of ${formatCurrency(r.budget)}` : '· no budget set'}
                {r.used_pct !== null && <strong className={r.over_budget ? 'trend-up ms-1' : 'ms-1'}>({r.used_pct}%)</strong>}
              </span>
            </div>
            {pct !== null && (
              <div className={`progress-sw mt-1 ${level}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${r.name} budget used`}>
                <span style={{ width: `${pct}%` }} />
              </div>
            )}
            {r.over_budget && <div className="small trend-up mt-1">Over budget by {formatCurrency(-r.remaining)}</div>}
          </div>
        );
      })}
    </div>
  );
}
