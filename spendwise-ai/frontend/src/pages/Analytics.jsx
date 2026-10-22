import { useMemo, useState } from 'react';
import { CalendarRange, Download, Receipt, Gauge, TrendingUp, Wallet } from 'lucide-react';
import { api, getErrorMessage } from '../services/api';
import useApi from '../hooks/useApi';
import { useApp } from '../context/AppContext';
import Card from '../components/common/Card';
import StatCard from '../components/common/StatCard';
import { CardSkeleton, EmptyState, ErrorState } from '../components/common/States';
import { CategoryDonut, DailyChart, MonthlyTrendChart } from '../components/dashboard/Charts';
import BudgetVsActual from '../components/analytics/BudgetVsActual';
import MonthlyReport from '../components/analytics/MonthlyReport';
import CategoryTable from '../components/analytics/CategoryTable';
import { addMonths, currentMonth, formatCurrency, formatDate, formatPercent, monthLabel, monthRange } from '../utils/format';
import { downloadBlob } from '../utils/download';

const cur = currentMonth();
const PRESETS = [
  { id: 'this', label: 'This month', range: () => monthRange(cur) },
  { id: '3m', label: 'Last 3 months', range: () => ({ start: monthRange(addMonths(cur, -2)).start, end: monthRange(cur).end }) },
  { id: '6m', label: 'Last 6 months', range: () => ({ start: monthRange(addMonths(cur, -5)).start, end: monthRange(cur).end }) },
  { id: 'year', label: 'Last 12 months', range: () => ({ start: monthRange(addMonths(cur, -11)).start, end: monthRange(cur).end }) },
];

export default function Analytics() {
  const { notify } = useApp();
  const [preset, setPreset] = useState('3m');
  const [range, setRange] = useState(PRESETS[1].range());
  const [view, setView] = useState('auto'); // auto | daily | weekly
  const [exporting, setExporting] = useState(false);

  const invalid = !range.start || !range.end || range.end < range.start;
  const startMonth = range.start.slice(0, 7);
  const endMonth = range.end.slice(0, 7);
  // Month-over-month comparison is anchored on the last month of the range (never in the future).
  const compareMonth = endMonth > cur ? cur : endMonth;

  const key = [range.start, range.end];
  const cats = useApi(() => (invalid ? Promise.resolve(null) : api.getCategoryAnalytics({ start_date: range.start, end_date: range.end })), key);
  const daily = useApi(() => (invalid ? Promise.resolve(null) : api.getDaily({ start_date: range.start, end_date: range.end })), key);
  const monthly = useApi(() => (invalid ? Promise.resolve(null) : api.getMonthly({ start_month: startMonth, end_month: endMonth })), key);
  const compare = useApi(() => (invalid ? Promise.resolve(null) : api.getComparison(compareMonth)), [compareMonth, invalid]);

  const loading = !invalid && (cats.loading || daily.loading || monthly.loading) && !(cats.data && daily.data && monthly.data);
  const error = cats.error || daily.error || monthly.error;
  const reloadAll = () => { cats.reload(); daily.reload(); monthly.reload(); compare.reload(); };

  const d = daily.data?.data;
  const c = cats.data?.data;
  const m = monthly.data;
  const mode = view === 'auto' ? (d && d.days > 62 ? 'weekly' : 'daily') : view;

  const dailySeries = useMemo(() => {
    if (!d) return [];
    return mode === 'weekly' ? d.weekly.map((w) => ({ date: w.week_start, total: w.total })) : d.daily;
  }, [d, mode]);

  const choosePreset = (p) => { setPreset(p.id); setRange(p.range()); };
  const setDate = (field) => (e) => { setPreset('custom'); setRange((r) => ({ ...r, [field]: e.target.value })); };

  const exportCsv = async () => {
    setExporting(true);
    try {
      downloadBlob(await api.exportExpensesCsv({ start_date: range.start, end_date: range.end }), `expenses-${range.start}-to-${range.end}.csv`);
      notify('CSV exported');
    } catch (err) {
      notify(getErrorMessage(err), 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="card-sw card-body-sw mb-3">
        <div className="d-flex flex-wrap gap-3 align-items-end justify-content-between">
          <div>
            <div className="form-label">Date range</div>
            <div className="d-flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p.id} type="button" className={`btn btn-sm ${preset === p.id ? 'btn-primary' : 'btn-outline-sw'}`} onClick={() => choosePreset(p)}>{p.label}</button>
              ))}
            </div>
          </div>
          <div className="d-flex flex-wrap gap-2 align-items-end">
            <div>
              <label className="form-label" htmlFor="a-from">From</label>
              <input id="a-from" type="date" className="form-control form-control-sm" value={range.start} max={range.end || undefined} onChange={setDate('start')} />
            </div>
            <div>
              <label className="form-label" htmlFor="a-to">To</label>
              <input id="a-to" type="date" className={`form-control form-control-sm ${invalid ? 'is-invalid' : ''}`} value={range.end} min={range.start || undefined} onChange={setDate('end')} />
            </div>
            <button type="button" className="btn btn-outline-sw btn-sm" onClick={exportCsv} disabled={exporting || invalid}>
              <Download size={15} className="me-1" /> {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>
        </div>
        {invalid && <div className="text-danger small mt-2">Choose a valid range: the end date must not be before the start date.</div>}
        <div className="small-label mt-2">Exports every expense in the selected range.</div>
      </div>

      {error ? (
        <div className="card-sw"><ErrorState message={error} onRetry={reloadAll} /></div>
      ) : invalid ? null : loading || !d || !c || !m ? (
        <div className="row g-3"><div className="col-12"><CardSkeleton height={120} /></div><div className="col-lg-6"><CardSkeleton /></div><div className="col-lg-6"><CardSkeleton /></div></div>
      ) : d.total === 0 ? (
        <div className="card-sw"><EmptyState icon={CalendarRange} title="No expenses in this range" message="Pick a different date range or add some expenses." /></div>
      ) : (
        <>
          <div className="row row-cols-1 row-cols-sm-2 row-cols-xl-4 g-3 mb-3">
            <div className="col"><StatCard label="Total spent" value={formatCurrency(d.total)} icon={Wallet} sub={`${formatDate(range.start)} – ${formatDate(range.end)}`} /></div>
            <div className="col"><StatCard label="Average daily spending" value={formatCurrency(d.average_daily)} icon={Gauge} sub="Per elapsed day in range" /></div>
            <div className="col"><StatCard label="Highest-spending day" value={d.highest_day ? formatCurrency(d.highest_day.total) : '—'} icon={TrendingUp} accent sub={d.highest_day ? `${formatDate(d.highest_day.date)} · ${d.highest_day.count} transaction(s)` : ''} /></div>
            <div className="col"><StatCard label="Transactions" value={d.count} icon={Receipt} sub={d.count ? `Avg ${formatCurrency(d.total / d.count)} each` : ''} /></div>
          </div>

          <div className="row g-3">
            <div className="col-12">
              <Card
                title={mode === 'weekly' ? 'Weekly spending trend' : 'Daily spending trend'}
                subtitle={mode === 'weekly' ? 'Weeks start on Monday' : 'Dashed line marks the average day'}
                action={
                  <div className="btn-group btn-group-sm" role="group" aria-label="Trend granularity">
                    {['daily', 'weekly'].map((v) => (
                      <button key={v} type="button" className={`btn ${mode === v ? 'btn-primary' : 'btn-outline-sw'}`} onClick={() => setView(v)} aria-pressed={mode === v}>{v === 'daily' ? 'Daily' : 'Weekly'}</button>
                    ))}
                  </div>
                }
              >
                <DailyChart data={dailySeries} average={mode === 'daily' ? d.average_daily : 0} mode={mode === 'weekly' ? 'week' : 'date'} />
              </Card>
            </div>

            <div className="col-lg-6"><Card title="Monthly totals" subtitle={`${monthLabel(startMonth, 'short')} – ${monthLabel(endMonth, 'short')} · average ${formatCurrency(m.summary.average)} per month`}><MonthlyTrendChart data={m.data} selectedMonth={m.summary.highest_month?.month} /></Card></div>
            <div className="col-lg-6"><Card title="Monthly report" subtitle="Change compares each month with the one before"><MonthlyReport months={m.data} /></Card></div>

            <div className="col-lg-6"><Card title="Category distribution"><CategoryDonut data={c.categories} /></Card></div>
            <div className="col-lg-6">
              <Card title="Top five categories" subtitle={`Share of ${formatCurrency(c.total)}`}>
                <CategoryTable categories={c.top_five} />
              </Card>
            </div>

            <div className="col-lg-6"><Card title="Budget vs actual" subtitle="Monthly budgets × months in range"><BudgetVsActual rows={c.budget_vs_actual} /></Card></div>
            <div className="col-lg-6">
              <Card title={`${monthLabel(compareMonth)} vs previous month`} subtitle={compare.data ? `Same first ${compare.data.data.like_for_like.days} days of each month` : ''}>
                {compare.loading && !compare.data ? <CardSkeleton height={120} /> : compare.data ? (
                  <>
                    <p className="mb-2">
                      Total: <strong>{formatCurrency(compare.data.data.current_total)}</strong> vs {formatCurrency(compare.data.data.previous_total)}{' '}
                      <span className={compare.data.data.change_pct > 0 ? 'trend-up' : 'trend-down'}>{formatPercent(compare.data.data.change_pct, true)}</span>
                    </p>
                    <div className="table-responsive">
                      <table className="table table-sw">
                        <thead><tr><th>Category</th><th className="text-end">This</th><th className="text-end">Previous</th><th className="text-end">Change</th></tr></thead>
                        <tbody>
                          {compare.data.data.categories.slice(0, 8).map((r) => (
                            <tr key={r.id}>
                              <td>{r.name}</td>
                              <td className="text-end">{formatCurrency(r.current)}</td>
                              <td className="text-end">{formatCurrency(r.previous)}</td>
                              <td className={`text-end ${r.change_pct === null ? 'text-muted-sw' : r.change_pct > 0 ? 'trend-up' : 'trend-down'}`}>{formatPercent(r.change_pct, true)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : null}
              </Card>
            </div>

            <div className="col-12"><Card title="Spending percentage by category"><CategoryTable categories={c.categories} /></Card></div>
          </div>
        </>
      )}
    </>
  );
}
