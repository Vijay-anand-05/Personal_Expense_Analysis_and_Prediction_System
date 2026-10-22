import { useCallback, useState } from 'react';
import Modal from '../common/Modal';
import ConfirmDialog from '../common/ConfirmDialog';
import ExpenseForm from './ExpenseForm';
import { api, getErrorMessage } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/format';

/**
 * Add / edit / delete flows shared by the Dashboard and Expenses pages.
 * `onChanged` is called after any successful change so the page can reload its data.
 */
export default function useExpenseModals(onChanged) {
  const { notify } = useApp();
  const [formState, setFormState] = useState(null); // { expense } | null
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const closeForm = useCallback(() => setFormState(null), []);

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      const res = await api.deleteExpense(toDelete.id);
      notify(res.message);
      setToDelete(null);
      onChanged();
    } catch (err) {
      notify(getErrorMessage(err), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const modals = (
    <>
      {formState && (
        <Modal drawer title={formState.expense ? "Edit expense" : "Add expense"} onClose={closeForm}>
          <ExpenseForm
            expense={formState.expense}
            onCancel={closeForm}
            onSaved={() => {
              closeForm();
              onChanged();
            }}
          />
        </Modal>
      )}
      {toDelete && (
        <ConfirmDialog
          title="Delete expense?"
          message={`"${toDelete.title}" (${formatCurrency(toDelete.amount, true)}) will be permanently removed. This cannot be undone.`}
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </>
  );

  return {
    openAdd: () => setFormState({ expense: null }),
    openEdit: (expense) => setFormState({ expense }),
    askDelete: setToDelete,
    modals,
  };
}
