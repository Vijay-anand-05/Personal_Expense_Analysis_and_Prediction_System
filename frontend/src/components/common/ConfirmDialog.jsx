import Modal from './Modal';

export default function ConfirmDialog({ title, message, confirmLabel = 'Delete', busy, confirmDisabled, onConfirm, onCancel, children }) {
  return (
    <Modal
      title={title}
      size="sm"
      onClose={busy ? () => {} : onCancel}
      footer={
        <>
          <button type="button" className="btn btn-outline-sw" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy || confirmDisabled}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="mb-0">{message}</p>
      {children}
    </Modal>
  );
}
