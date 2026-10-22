import { Link } from 'react-router-dom';
import { Plus, Receipt } from 'lucide-react';
import { api } from '../services/api';
import useApi from '../hooks/useApi';
import { useApp } from '../context/AppContext';
import Card from '../components/common/Card';
import { CardSkeleton, EmptyState, ErrorState, Skeleton } from '../components/common/States';
import SummaryCards from '../components/dashboard/SummaryCards';
import { CategoryDonut, TrendForecastChart } from '../components/dashboard/Charts';
import InsightsPanel from '../components/dashboard/InsightsPanel';
import ExpenseTable from '../components/expenses/ExpenseTable';
import useExpenseModals from '../components/expenses/useExpenseModals';
import { formatCurrency, formatDate, monthLabel } from '../utils/format';

export default function Dashboard() {
  const { month } = useApp();
  const { data: res, loading, error, reload } = useApi(() => api.getDashboard(month), [month]);
  const { openAdd, openEdit, askDelete, modals } = useExpenseModals(reload);

  if (error) return <div className="card-sw"><ErrorState message={error} onRetry={reload} /></div>;
  if (loading && !res) {
    return (
      <>
        <Skeleton height={44} width="40%" className="mb-4" />
        <div className="row row-cols-1 row-cols-sm-2 row-cols-xl-4 g-3 mb-3">
          {Array.from({ length: 4 }, (_, i) => <div className="col" key={i}><div className="card-sw metric"><Skeleton width="50%" height={11} /><Skeleton height={28} className="mt-3" /></div></div>)}
        </div>
        <div className="row g-3"><div className="col-lg-8"><CardSkeleton height={300} /></div><div className="col-lg-4"><CardSkeleton height={300} /></div></div>
      </>
    );
  }

  const d = res.data;
  const s = d.summary;
  const isComplete = s.elapsed_days >= s.days_in_month;

  return (
    <div className="fade-in">
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3 mb-4 welcome">
        <div>
          <div className="eyebrow mb-1">{monthLabel(d.month)} · through {formatDate(d.today)}</div>
          <h2>Your money, in perspective.</h2>
        </div>
        <button type="button" className="btn btn-primary" onClick={openAdd}><Plus size={16} className="me-1" /> Add expense</button>
      </div>

      <div className="mb-3"><SummaryCards summary={s} daily={d.daily} comparison={d.comparison} /></div>

      <div className="row g-3 mb-3">
        <div className="col-lg-8">
          <Card title="Spending pace" subtitle="Cumulative spend by day, against last month and the forecast">
            <TrendForecastChart
              cumulative={d.comparison.cumulative}
              month={d.month}
              previousMonth={d.comparison.previous_month}
              elapsed={s.elapsed_days}
              projected={s.predicted_month_end}
              isComplete={isComplete}
            />
          </Card>
        </div>
        <div className="col-lg-4">
          <Card title="By category" subtitle={`${monthLabel(d.month)} · ${formatCurrency(s.this_month)}`}>
            <CategoryDonut data={d.category_distribution} stacked height={190} maxLegend={6} />
          </Card>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-xl-8">
          <Card title="Recent transactions" action={<Link to="/expenses" className="btn btn-outline-sw btn-sm">View all</Link>}>
            {d.recent_expenses.length === 0 ? (
              <EmptyState icon={Receipt} title="No expenses yet" message="Add your first expense and this dashboard will start to take shape."
                action={<button type="button" className="btn btn-primary btn-sm" onClick={openAdd}>Add expense</button>} />
            ) : (
              <ExpenseTable expenses={d.recent_expenses} onEdit={openEdit} onDelete={askDelete} />
            )}
          </Card>
        </div>
        <div className="col-xl-4">
          <Card title="Insights" subtitle="From your own expense history" action={<Link to="/predictions" className="btn btn-outline-sw btn-sm">Forecast</Link>}>
            <InsightsPanel insights={d.insights} showSuggestions={false} />
          </Card>
        </div>
      </div>
      {modals}
    </div>
  );
}
