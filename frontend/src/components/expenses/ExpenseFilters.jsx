import { Search, X } from 'lucide-react';
import { PAYMENT_METHODS } from '../../utils/format';

export const EMPTY_FILTERS = { search: '', category: '', payment_method: '', start_date: '', end_date: '' };

export default function ExpenseFilters({ filters, categories, onChange, onClear }) {
  const set = (key) => (e) => onChange({ ...filters, [key]: e.target.value });
  const active = Object.values(filters).some(Boolean);
  const dateError = filters.start_date && filters.end_date && filters.end_date < filters.start_date;

  return (
    <div className="card-sw card-body-sw mb-3">
      <div className="row g-3 align-items-end">
        <div className="col-12 col-lg-3">
          <label className="form-label" htmlFor="f-search">Search</label>
          <div className="position-relative">
            <Search size={16} className="position-absolute text-muted-sw" style={{ left: 12, top: 12 }} />
            <input id="f-search" className="form-control" style={{ paddingLeft: 34 }} placeholder="Title or notes" value={filters.search} onChange={set('search')} />
          </div>
        </div>
        <div className="col-6 col-lg-2">
          <label className="form-label" htmlFor="f-cat">Category</label>
          <select id="f-cat" className="form-select" value={filters.category} onChange={set('category')}>
            <option value="">All</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="col-6 col-lg-2">
          <label className="form-label" htmlFor="f-pay">Payment</label>
          <select id="f-pay" className="form-select" value={filters.payment_method} onChange={set('payment_method')}>
            <option value="">All</option>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="col-6 col-lg-2">
          <label className="form-label" htmlFor="f-from">From</label>
          <input id="f-from" type="date" className="form-control" value={filters.start_date} max={filters.end_date || undefined} onChange={set('start_date')} />
        </div>
        <div className="col-6 col-lg-2">
          <label className="form-label" htmlFor="f-to">To</label>
          <input id="f-to" type="date" className={`form-control ${dateError ? 'is-invalid' : ''}`} value={filters.end_date} min={filters.start_date || undefined} onChange={set('end_date')} />
        </div>
        <div className="col-12 col-lg-1">
          <button type="button" className="btn btn-outline-sw w-100" onClick={onClear} disabled={!active} title="Clear filters">
            <X size={16} /> <span className="d-lg-none">Clear filters</span>
          </button>
        </div>
      </div>
      {dateError && <div className="text-danger small mt-2">"To" date cannot be before "From" date.</div>}
    </div>
  );
}
