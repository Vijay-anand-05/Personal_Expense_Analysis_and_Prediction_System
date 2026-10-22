import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, currentMonth, monthLabel } from '../../utils/format';

// Last 24 months, newest first. Future months are not selectable.
export default function MonthPicker({ value, onChange }) {
  const now = currentMonth();
  const options = useMemo(() => Array.from({ length: 24 }, (_, i) => addMonths(now, -i)), [now]);
  const list = options.includes(value) ? options : [value, ...options];
  return (
    <div className="month-picker" role="group" aria-label="Select month">
      <button type="button" className="btn btn-outline-sw btn-sm" onClick={() => onChange(addMonths(value, -1))} aria-label="Previous month">
        <ChevronLeft size={16} />
      </button>
      <select className="form-select form-select-sm" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Month">
        {list.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
      </select>
      <button type="button" className="btn btn-outline-sw btn-sm" disabled={value >= now} onClick={() => onChange(addMonths(value, 1))} aria-label="Next month">
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
