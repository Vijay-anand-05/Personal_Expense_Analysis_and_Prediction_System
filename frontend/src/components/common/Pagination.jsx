import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ page, totalPages, total, limit, onChange }) {
  if (total === 0) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return (
    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 pt-3">
      <span className="small-label">Showing {from}–{to} of {total}</span>
      <div className="d-flex align-items-center gap-2">
        <button type="button" className="btn btn-outline-sw btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
          <ChevronLeft size={16} />
        </button>
        <span className="small-label">Page {page} of {totalPages}</span>
        <button type="button" className="btn btn-outline-sw btn-sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="Next page">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
