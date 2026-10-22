import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api, getErrorMessage } from '../../services/api';
import useApi from '../../hooks/useApi';
import { PAYMENT_METHODS, todayISO } from '../../utils/format';
import { useApp } from '../../context/AppContext';
import { Skeleton } from '../common/States';

// Add / edit form. Used inside a Modal; `expense` present means edit mode.
export default function ExpenseForm({ expense, onSaved, onCancel }) {
  const { notify } = useApp();
  const { data: catData, loading: catLoading, error: catError, reload } = useApi(() => api.getCategories(), []);
  const [serverError, setServerError] = useState('');
  const editing = Boolean(expense);

  const defaults = editing
    ? {
        title: expense.title,
        amount: expense.amount,
        category_id: String(expense.category_id),
        expense_date: expense.expense_date,
        payment_method: expense.payment_method,
        notes: expense.notes || '',
      }
    : { title: '', amount: '', category_id: '', expense_date: todayISO(), payment_method: 'UPI', notes: '' };

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ defaultValues: defaults });

  const onSubmit = async (values) => {
    setServerError('');
    const payload = {
      title: values.title.trim(),
      amount: Number(values.amount),
      category_id: Number(values.category_id),
      expense_date: values.expense_date,
      payment_method: values.payment_method,
      notes: values.notes.trim(),
    };
    try {
      const res = editing ? await api.updateExpense(expense.id, payload) : await api.createExpense(payload);
      notify(res.message || 'Saved');
      if (!editing) reset({ ...defaults, expense_date: values.expense_date }); // clear the form after a successful add
      onSaved(res.data);
    } catch (err) {
      setServerError(getErrorMessage(err));
    }
  };

  if (catLoading) return <div aria-busy="true"><Skeleton height={38} className="mb-3" /><Skeleton height={38} className="mb-3" /><Skeleton height={38} /></div>;
  if (catError) return <div className="notice-box" role="alert">Could not load categories: {catError} <button type="button" className="btn btn-sm btn-outline-sw ms-2" onClick={reload}>Retry</button></div>;

  const categories = catData.data;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {serverError && <div className="notice-box mb-3" role="alert" style={{ background: 'var(--sw-danger-soft)', borderColor: '#f3c7c5', color: '#8f2b28' }}>{serverError}</div>}

      <div className="mb-3">
        <label className="form-label" htmlFor="exp-title">Expense title</label>
        <input id="exp-title" className={`form-control ${errors.title ? 'is-invalid' : ''}`} placeholder="e.g. Lunch at cafe" maxLength={120}
          {...register('title', { validate: (v) => v.trim().length > 0 || 'Title is required' })} />
        {errors.title && <div className="invalid-feedback">{errors.title.message}</div>}
      </div>

      <div className="row g-3 mb-3">
        <div className="col-sm-6">
          <label className="form-label" htmlFor="exp-amount">Amount (₹)</label>
          <input id="exp-amount" type="number" step="0.01" min="0" inputMode="decimal" className={`form-control ${errors.amount ? 'is-invalid' : ''}`} placeholder="0.00"
            {...register('amount', {
              required: 'Amount is required',
              validate: (v) => (Number(v) > 0 ? true : 'Amount must be greater than zero'),
            })} />
          {errors.amount && <div className="invalid-feedback">{errors.amount.message}</div>}
        </div>
        <div className="col-sm-6">
          <label className="form-label" htmlFor="exp-date">Date</label>
          <input id="exp-date" type="date" className={`form-control ${errors.expense_date ? 'is-invalid' : ''}`}
            {...register('expense_date', { required: 'Date is required' })} />
          {errors.expense_date && <div className="invalid-feedback">{errors.expense_date.message}</div>}
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-sm-6">
          <label className="form-label" htmlFor="exp-category">Category</label>
          <select id="exp-category" className={`form-select ${errors.category_id ? 'is-invalid' : ''}`} {...register('category_id', { required: 'Select a category' })}>
            <option value="">Select category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {errors.category_id && <div className="invalid-feedback">{errors.category_id.message}</div>}
        </div>
        <div className="col-sm-6">
          <label className="form-label" htmlFor="exp-method">Payment method</label>
          <select id="exp-method" className="form-select" {...register('payment_method', { required: true })}>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-4">
        <label className="form-label" htmlFor="exp-notes">Notes <span className="text-muted-sw fw-normal">(optional)</span></label>
        <textarea id="exp-notes" rows={2} maxLength={500} className="form-control" placeholder="Anything worth remembering" {...register('notes')} />
      </div>

      <div className="d-flex justify-content-end gap-2">
        <button type="button" className="btn btn-outline-sw" onClick={onCancel} disabled={isSubmitting}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : editing ? 'Save changes' : 'Add expense'}
        </button>
      </div>
    </form>
  );
}
