import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };

export default function ToastContainer() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((t) => {
        const Icon = ICONS[t.type] || Info;
        return (
          <div key={t.id} className={`toast-sw ${t.type}`} role={t.type === 'error' ? 'alert' : 'status'}>
            <Icon size={18} className="flex-shrink-0 mt-1" />
            <div className="flex-grow-1">{t.message}</div>
            <button type="button" className="btn-icon" style={{ width: 24, height: 24 }} onClick={() => dismissToast(t.id)} aria-label="Dismiss notification">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
