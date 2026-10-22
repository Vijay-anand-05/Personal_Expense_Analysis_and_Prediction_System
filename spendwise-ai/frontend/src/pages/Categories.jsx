import { useMemo, useState } from 'react';
import { Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { api, getErrorMessage } from '../services/api';
import useApi from '../hooks/useApi';
import { useApp } from '../context/AppContext';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import CategoryForm from '../components/common/CategoryForm';
import { CategoryChip } from '../components/common/CategoryBadge';
import { CardSkeleton, EmptyState, ErrorState } from '../components/common/States';
import { currentMonth, formatCurrency, monthLabel, monthRange } from '../utils/format';

const month = currentMonth();
const range = monthRange(month);

export default function Categories() {
  const { notify } = useApp();
  const cats = useApi(() => api.getCategories(), []);
  const spend = useApi(() => api.getCategoryAnalytics({ start_date: range.start, end_date: range.end }), []);
  const [formState, setFormState] = useState(null); // { category } | null
  const [toDelete, setToDelete] = useState(null);
  const [reassignTo, setReassignTo] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = () => { cats.reload(); spend.reload(); };
  const spentById = useMemo(() => new Map((spend.data?.data.categories || []).map((c) => [c.id, c.total])), [spend.data]);
  const categories = cats.data?.data || [];
  const totalBudget = categories.reduce((s, c) => s + (c.monthly_budget || 0), 0);
  const others = toDelete ? categories.filter((c) => c.id !== toDelete.id) : [];
  const inUse = toDelete && toDelete.expense_count > 0;

  const confirmDelete = async () => {
    setBusy(true);
    try {
      const res = await api.deleteCategory(toDelete.id, inUse ? reassignTo : undefined);
      notify(res.message);
      setToDelete(null);
      reload();
    } catch (err) {
      notify(getErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (cats.error) return <div className="card-sw"><ErrorState message={cats.error} onRetry={reload} /></div>;
  if (cats.loading && !cats.data) return <CardSkeleton lines={6} />;

  return (
    <div className="fade-in">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div className="text-muted-sw">
          {categories.length} categories · combined budget <strong className="text-body tnum">{formatCurrency(totalBudget)}</strong> per month
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setFormState({ category: null })}><Plus size={16} className="me-1" /> New category</button>
      </div>

      {categories.length === 0 ? (
        <div className="card-sw"><EmptyState icon={Tags} title="No categories" message="Create a category to start organising expenses." /></div>
      ) : (
        <div className="row row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
          {categories.map((c) => {
            const spent = spentById.get(c.id) || 0;
            const pct = c.monthly_budget > 0 ? (spent / c.monthly_budget) * 100 : null;
            const level = pct === null ? '' : pct > 100 ? 'over' : pct >= 90 ? 'near' : '';
            return (
              <div className="col" key={c.id}>
                <div className="card-sw cat-card">
                  <div className="d-flex align-items-start justify-content-between gap-2">
                    <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                      <CategoryChip color={c.color} icon={c.icon} dot />
                      <div style={{ minWidth: 0 }}>
                        <div className="fw-semibold text-truncate">{c.name}</div>
                        <div className="small-label">{c.expense_count} expense{c.expense_count === 1 ? '' : 's'}</div>
                      </div>
                    </div>
                    <div className="text-nowrap">
                      <button type="button" className="btn-icon" onClick={() => setFormState({ category: c })} aria-label={`Edit ${c.name}`} title="Edit"><Pencil size={15} /></button>
                      <button type="button" className="btn-icon danger" onClick={() => { setToDelete(c); setReassignTo(''); }} aria-label={`Delete ${c.name}`} title="Delete"><Trash2 size={15} /></button>
                    </div>
                  </div>
                  <div>
                    <div className="d-flex justify-content-between align-items-baseline mb-1">
                      <span className="amount" style={{ fontSize: '1.15rem' }}>{formatCurrency(spent)}</span>
                      <span className="small-label tnum">{c.monthly_budget > 0 ? `of ${formatCurrency(c.monthly_budget)}` : 'No budget set'}</span>
                    </div>
                    {pct !== null ? (
                      <div className={`progress-sw ${level}`} role="progressbar" aria-valuenow={Math.round(Math.min(pct, 100))} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.name} budget used`}>
                        <span style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    ) : <div className="progress-sw" aria-hidden="true" />}
                    <div className={`small-label mt-1 ${level === 'over' ? 'trend-up' : ''}`}>
                      {pct === null ? `Spent in ${monthLabel(month)}` : pct > 100 ? `${formatCurrency(spent - c.monthly_budget)} over budget` : `${Math.round(pct)}% of ${monthLabel(month)} budget used`}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formState && (
        <Modal drawer title={formState.category ? 'Edit category' : 'New category'} onClose={() => setFormState(null)}>
          <CategoryForm category={formState.category} onCancel={() => setFormState(null)} onSaved={() => { setFormState(null); reload(); }} />
        </Modal>
      )}

      {toDelete && (
        <ConfirmDialog
          title={`Delete "${toDelete.name}"?`}
          confirmLabel={inUse ? 'Reassign & delete' : 'Delete'}
          busy={busy}
          confirmDisabled={inUse && !reassignTo}
          message={inUse
            ? `${toDelete.expense_count} expense(s) use this category. Choose a category to move them to before deleting.`
            : 'This category has no expenses and will be permanently removed.'}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        >
          {inUse && (
            <div className="mt-3">
              <label className="form-label" htmlFor="reassign">Move expenses to</label>
              <select id="reassign" className="form-select" value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
                <option value="">Select category</option>
                {others.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
