import { useEffect, useState } from 'react';
import { Download, Plus, Receipt } from 'lucide-react';
import { api, getErrorMessage } from '../services/api';
import useApi from '../hooks/useApi';
import useDebounce from '../hooks/useDebounce';
import { useApp } from '../context/AppContext';
import ExpenseFilters, { EMPTY_FILTERS } from '../components/expenses/ExpenseFilters';
import ExpenseTable from '../components/expenses/ExpenseTable';
import useExpenseModals from '../components/expenses/useExpenseModals';
import Pagination from '../components/common/Pagination';
import { CardSkeleton, EmptyState, ErrorState } from '../components/common/States';
import { formatCurrency } from '../utils/format';
import { downloadBlob } from '../utils/download';

export default function Expenses() {
  const { pageSize, notify } = useApp();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const debouncedSearch = useDebounce(filters.search);

  // Skip the request while the date range is invalid (end before start).
  const rangeInvalid = filters.start_date && filters.end_date && filters.end_date < filters.start_date;
  const query = { ...filters, search: debouncedSearch.trim(), page, limit: pageSize };

  const { data, loading, error, reload } = useApi(
    () => (rangeInvalid ? Promise.resolve(null) : api.getExpenses(query)),
    [debouncedSearch, filters.category, filters.payment_method, filters.start_date, filters.end_date, page, pageSize]
  );
  const { data: catData } = useApi(() => api.getCategories(), []);
  const { openAdd, openEdit, askDelete, modals } = useExpenseModals(reload);

  // Return to page 1 whenever the filters change.
  useEffect(() => { setPage(1); }, [debouncedSearch, filters.category, filters.payment_method, filters.start_date, filters.end_date]);

  // If the last item on the last page was deleted, step back a page.
  useEffect(() => {
    if (data && data.pagination && page > data.pagination.total_pages) setPage(data.pagination.total_pages);
  }, [data, page]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await api.exportExpensesCsv({ ...filters, search: filters.search.trim() });
      downloadBlob(blob, 'personal-expenses.csv');
      notify('CSV exported');
    } catch (err) {
      notify(getErrorMessage(err), 'error');
    } finally {
      setExporting(false);
    }
  };

  const hasFilters = Object.values(filters).some(Boolean);
  const categories = catData?.data || [];

  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div className="text-muted-sw">Filter, search and export your transactions.</div>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-sw" onClick={exportCsv} disabled={exporting || rangeInvalid}>
            <Download size={16} className="me-1" /> {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          <button type="button" className="btn btn-primary" onClick={openAdd}><Plus size={16} className="me-1" /> Add expense</button>
        </div>
      </div>

      <ExpenseFilters filters={filters} categories={categories} onChange={setFilters} onClear={() => setFilters(EMPTY_FILTERS)} />

      {loading && !data ? (
        <CardSkeleton lines={6} />
      ) : error ? (
        <div className="card-sw"><ErrorState message={error} onRetry={reload} /></div>
      ) : data ? (
        <section className="card-sw">
          <div className="card-head">
            <div>
              <h2>Transactions</h2>
              <div className="small-label">
                {data.summary.count} record{data.summary.count === 1 ? '' : 's'} · Total {formatCurrency(data.summary.total_amount, true)}
                {hasFilters && ' (filtered)'}
              </div>
            </div>
          </div>
          <div className="card-body-sw">
            {data.data.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title={hasFilters ? 'No matching expenses' : 'No expenses yet'}
                message={hasFilters ? 'Try changing or clearing your filters.' : 'Add your first expense to start tracking your spending.'}
                action={hasFilters
                  ? <button type="button" className="btn btn-outline-sw btn-sm" onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</button>
                  : <button type="button" className="btn btn-primary btn-sm" onClick={openAdd}>Add expense</button>}
              />
            ) : (
              <>
                <ExpenseTable expenses={data.data} onEdit={openEdit} onDelete={askDelete} />
                <Pagination page={data.pagination.page} totalPages={data.pagination.total_pages} total={data.pagination.total} limit={data.pagination.limit} onChange={setPage} />
              </>
            )}
          </div>
        </section>
      ) : null}
      {modals}
    </>
  );
}
