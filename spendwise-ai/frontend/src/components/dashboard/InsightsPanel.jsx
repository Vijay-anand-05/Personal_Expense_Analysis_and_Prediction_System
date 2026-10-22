import { Info } from 'lucide-react';
import { formatCurrency } from '../../utils/format';

// Editorial list of backend-generated observations: thin dividers, small tone markers.
// When data is insufficient the backend's explanation is shown instead of anything invented.
export default function InsightsPanel({ insights, showObservations = true, showSuggestions = true }) {
  const { notice, insights: list, suggestions, suggestions_note: note } = insights;
  const nothing = !notice && list.length === 0 && suggestions.length === 0;
  return (
    <div>
      {notice && <div className="notice-box info mb-3" role="status"><Info size={16} className="flex-shrink-0 mt-1" /><span>{notice}</span></div>}
      {showObservations && list.map((i) => (
        <div className="insight" key={`${i.type}-${i.message}`}>
          <span className={`insight-dot ${i.tone}`} aria-hidden="true" />
          <div>
            <div className="insight-title">{i.title}</div>
            <p className="insight-msg">{i.message}</p>
          </div>
        </div>
      ))}
      {showSuggestions && suggestions.length > 0 && (
        <>
          {showObservations && list.length > 0 && <div className="eyebrow mt-3 mb-2">Potential savings</div>}
          {suggestions.map((s, idx) => (
            <div className="insight" key={s.title}>
              <span className="tnum fw-semibold text-muted-sw" style={{ width: 16 }}>{idx + 1}</span>
              <div>
                <div className="insight-title">{s.title} <span className="badge-sw ms-1">save ~{formatCurrency(s.estimated_saving)}</span></div>
                <p className="insight-msg">{s.message}</p>
              </div>
            </div>
          ))}
          {note && <p className="small-label mt-2 mb-0">{note}</p>}
        </>
      )}
      {nothing && <p className="text-muted-sw mb-0">Not enough data to generate insights yet.</p>}
    </div>
  );
}
