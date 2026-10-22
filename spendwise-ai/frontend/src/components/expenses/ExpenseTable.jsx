import { Pencil, Trash2 } from 'lucide-react';
import CategoryBadge from '../common/CategoryBadge';
import { formatCurrency, formatDate } from '../../utils/format';

// Shared by the dashboard (recent expenses) and the Expenses page.
// On small screens the category and payment columns collapse into the title cell.
export default function ExpenseTable({ expenses, onEdit, onDelete }) {
  return (
    <div className="table-responsive">
      <table className="table table-sw align-middle">
        <thead>
          <tr>
            <th>Expense</th>
            <th className="d-none d-md-table-cell">Date</th>
            <th className="d-none d-lg-table-cell">Payment</th>
            <th className="text-end">Amount</th>
            <th className="text-end"><span className="visually-hidden">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((e) => (
            <tr key={e.id}>
              <td>
                <div className="fw-semibold">{e.title}</div>
                <div className="small-label d-flex flex-wrap align-items-center gap-1">
                  <CategoryBadge name={e.category_name} color={e.category_color} />
                  <span className="d-md-none">· {formatDate(e.expense_date)}</span>
                  {e.notes && <span className="d-none d-xl-inline text-truncate" style={{ maxWidth: 200 }} title={e.notes}>· {e.notes}</span>}
                </div>
              </td>
              <td className="d-none d-md-table-cell text-nowrap text-muted-sw">{formatDate(e.expense_date)}</td>
              <td className="d-none d-lg-table-cell text-muted-sw">{e.payment_method}</td>
              <td className="text-end amount">{formatCurrency(e.amount, true)}</td>
              <td className="text-end text-nowrap row-actions">
                <button type="button" className="btn-icon" onClick={() => onEdit(e)} aria-label={`Edit ${e.title}`} title="Edit"><Pencil size={15} /></button>
                <button type="button" className="btn-icon danger" onClick={() => onDelete(e)} aria-label={`Delete ${e.title}`} title="Delete"><Trash2 size={15} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
