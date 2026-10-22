import { AlertTriangle, Inbox } from 'lucide-react';

export function Skeleton({ height = 16, width = '100%', className = '' }) {
  return <div className={`skeleton ${className}`} style={{ height, width }} aria-hidden="true" />;
}

// Placeholder block shaped like a card, used while data loads.
export function CardSkeleton({ height = 220, lines }) {
  return (
    <div className="card-sw card-body-sw" aria-busy="true" aria-label="Loading">
      <Skeleton width="40%" height={14} className="mb-3" />
      {lines ? Array.from({ length: lines }, (_, i) => <Skeleton key={i} height={34} className="mb-2" />) : <Skeleton height={height} />}
    </div>
  );
}

export function EmptyState({ title, message, action, icon: Icon = Inbox }) {
  return (
    <div className="state-box">
      <div className="state-icon"><Icon size={22} /></div>
      <h3>{title}</h3>
      {message && <p className="mb-3">{message}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="state-box error" role="alert">
      <div className="state-icon"><AlertTriangle size={22} /></div>
      <h3>Something went wrong</h3>
      <p className="mb-3">{message}</p>
      {onRetry && <button type="button" className="btn btn-outline-sw btn-sm" onClick={onRetry}>Try again</button>}
    </div>
  );
}
