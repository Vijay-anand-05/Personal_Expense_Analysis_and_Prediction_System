import { formatCurrency, formatPercent, monthLabel } from '../../utils/format';

// Month-by-month table with change versus the month before (blank when that month had no spending).
export default function MonthlyReport({ months }) {
  return (
    <div className="table-responsive">
      <table className="table table-sw">
        <thead><tr><th>Month</th><th className="text-end">Total</th><th className="text-end">Transactions</th><th className="text-end">Change vs previous</th></tr></thead>
        <tbody>
          {months.map((m, i) => {
            const prev = i > 0 ? months[i - 1].total : 0;
            const change = prev > 0 ? ((m.total - prev) / prev) * 100 : null;
            return (
              <tr key={m.month}>
                <td>{monthLabel(m.month)}</td>
                <td className="text-end amount">{formatCurrency(m.total)}</td>
                <td className="text-end">{m.count}</td>
                <td className={`text-end ${change === null ? 'text-muted-sw' : change > 0 ? 'trend-up' : 'trend-down'}`}>{formatPercent(change, true)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
