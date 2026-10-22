import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Accessible dialog. `drawer` slides in from the right; otherwise it is a centred modal.
// Escape closes, focus moves inside and returns afterwards, background click closes.
export default function Modal({ title, onClose, children, footer, size, drawer = false, labelId = 'modal-title' }) {
  const ref = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const first = ref.current?.querySelector('input, select, textarea, button:not([data-close])');
    (first || ref.current)?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, [onClose]);

  // Portal to <body>: an ancestor with an animation/transform would otherwise confine the fixed overlay.
  return createPortal(
    <div className={`sw-modal-backdrop ${drawer ? 'drawer' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`sw-modal ${size || ''} ${drawer ? 'drawer' : ''}`} role="dialog" aria-modal="true" aria-labelledby={labelId} ref={ref} tabIndex={-1}>
        <div className="sw-modal-head">
          <h2 id={labelId}>{title}</h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close dialog" data-close>
            <X size={18} />
          </button>
        </div>
        <div className="sw-modal-body">{children}</div>
        {footer && <div className="sw-modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
