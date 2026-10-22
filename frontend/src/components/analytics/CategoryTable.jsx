import { formatCurrency } from '../../utils/format';

// Spending by category with percentage share.
export default function CategoryTable({ categories }) {
  return (
    <div className="table-responsive">
      <table className="table table-sw">
        <thead><tr><th>Category</th><th className="text-end">Transactions</th><th className="text-end">Spent</th><th style={{ minWidth: 140 }}>Share</th></tr></thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id}>
              <td><span className="d-inline-flex align-items-center gap-2"><span className="cat-dot" style={{ background: c.color }} />{c.name}</span></td>
              <td className="text-end">{c.count}</td>
              <td className="text-end amount">{formatCurrency(c.total)}</td>
              <td>
                <div className="d-flex align-items-center gap-2">
                  <div className="progress-sw flex-grow-1"><span style={{ width: `${c.percentage}%`, background: c.color }} /></div>
                  <span className="small-label" style={{ width: 44 }}>{c.percentage}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
