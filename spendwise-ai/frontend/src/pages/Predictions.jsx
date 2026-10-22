import { AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import useApi from '../hooks/useApi';
import { useApp } from '../context/AppContext';
import Card from '../components/common/Card';
import { CardSkeleton, ErrorState, Skeleton } from '../components/common/States';
import { CategoryForecastTable, ConfidenceBadge, ForecastDisclosure, MonthlyOutlookChart } from '../components/predictions/ForecastParts';
import { TrendForecastChart } from '../components/dashboard/Charts';
import InsightsPanel from '../components/dashboard/InsightsPanel';
import { formatCurrency, monthLabel } from '../utils/format';

export default function Predictions() {
  const { month } = useApp();
  const me = useApi(() => api.getMonthEnd(month), [month]);
  const next = useApi(() => api.getNextMonth(), []);
  const cats = useApi(() => api.getCategoryForecast(month), [month]);
  const ins = useApi(() => api.getInsights(month), [month]);
  const cmp = useApi(() => api.getComparison(month), [month]);

  const error = me.error || next.error || cats.error || ins.error || cmp.error;
  const reloadAll = () => { me.reload(); next.reload(); cats.reload(); ins.reload(); cmp.reload(); };
  if (error) return <div className="card-sw"><ErrorState message={error} onRetry={reloadAll} /></div>;
  if (!me.data || !next.data || !cats.data || !ins.data || !cmp.data) {
    return (
      <>
        <div className="row g-3 mb-3">
          <div className="col-lg-7"><div className="card-sw hero-forecast"><Skeleton width="40%" height={11} /><Skeleton height={44} width="55%" className="mt-3" /></div></div>
          <div className="col-lg-5"><CardSkeleton height={90} /></div>
        </div>
        <CardSkeleton height={300} />
      </>
    );
  }

  const m = me.data.data;
  const n = next.data.data;
  const c = cats.data.data;
  const i = ins.data.data;
  const trend = cmp.data.data;
  const warnings = c.categories.filter((x) => x.status === 'over');
  const preliminary = m.confidence.level === 'preliminary';

  return (
    <div className="fade-in">
      {preliminary && (
        <div className="notice-box mb-3" role="status">
          <AlertTriangle size={16} className="flex-shrink-0 mt-1" />
          <span><strong>Preliminary forecast.</strong> {m.confidence.detail}</span>
        </div>
      )}

      <div className="row g-3 mb-3">
        <div className="col-lg-7">
          <div className="card-sw hero-forecast h-100">
            <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
              <span className="eyebrow" style={{ color: 'var(--sw-accent-ink)' }}>
                {m.is_complete ? `Total for ${monthLabel(m.month)}` : `Estimated spending by end of ${monthLabel(m.month)}`}
              </span>
              <ConfidenceBadge confidence={m.confidence} />
            </div>
            <div className="hero-value mt-2">{formatCurrency(m.projected)}</div>
            <div className="text-muted-sw mt-2">
              {m.is_complete
                ? 'This month is complete: the figure above is the actual total.'
                : <>{formatCurrency(m.spent)} spent in {m.elapsed_days} of {m.days_in_month} days · {m.remaining_days} days remaining</>}
            </div>
            {!m.is_complete && (
              <div className="progress-sw mt-3" style={{ height: 6 }} aria-hidden="true">
                <span style={{ width: `${Math.min(100, (m.spent / Math.max(m.projected, 1)) * 100)}%`, background: 'var(--sw-primary)' }} />
              </div>
            )}
          </div>
        </div>
        <div className="col-lg-5">
          <div className="card-sw metric forecast">
            <span className="eyebrow">Forecast for {monthLabel(n.month)}</span>
            <div className="stat-value">{n.forecast === null ? 'Not available' : formatCurrency(n.forecast)}</div>
            <div className="stat-sub">
              {n.forecast === null
                ? 'Needs at least one completed month of history.'
                : <>Weighted average of {n.basis.length} earlier month{n.basis.length === 1 ? '' : 's'}{n.over_budget && <> · <span className="trend-up">above the {formatCurrency(n.budget)} budget</span></>}</>}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-lg-8">
          <Card title="Actual vs projected" subtitle={`${monthLabel(m.month)} cumulative spending, with last month for context`}>
            <TrendForecastChart cumulative={trend.cumulative} month={m.month} previousMonth={trend.previous_month}
              elapsed={m.elapsed_days} projected={m.projected} isComplete={m.is_complete} />
          </Card>
        </div>
        <div className="col-lg-4">
          <Card title="Monthly outlook" subtitle="Completed months and forecasts"><MonthlyOutlookChart data={n.chart} /></Card>
        </div>
      </div>

      <div className="mb-3"><ForecastDisclosure month={m} /></div>

      {warnings.length > 0 && (
        <div className="notice-box danger mb-3" role="alert">
          <AlertTriangle size={16} className="flex-shrink-0 mt-1" />
          <span>
            <strong>Budget overrun expected in {warnings.length} categor{warnings.length === 1 ? 'y' : 'ies'}: </strong>
            {warnings.map((w) => `${w.name} (${formatCurrency(w.overrun)} over)`).join(', ')}.
          </span>
        </div>
      )}

      <div className="row g-3">
        <div className="col-xl-7">
          <Card title="Predicted spending by category" subtitle={`${monthLabel(c.month)} month-end · each category is estimated independently`}>
            <CategoryForecastTable items={c.categories} />
          </Card>
        </div>
        <div className="col-xl-5">
          <Card title="Where you could save" subtitle="Based on your actual spending patterns">
            <InsightsPanel insights={{ ...i, insights: [] }} showObservations={false} />
          </Card>
        </div>
      </div>
    </div>
  );
}
