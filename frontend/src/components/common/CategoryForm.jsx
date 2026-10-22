import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api, getErrorMessage } from '../../services/api';
import { ICONS, ICON_IDS } from '../../utils/categoryIcons';
import { useApp } from '../../context/AppContext';

export default function CategoryForm({ category, onSaved, onCancel }) {
  const { notify } = useApp();
  const editing = Boolean(category);
  const [serverError, setServerError] = useState('');
  const [icon, setIcon] = useState(category?.icon || 'tag');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      name: category?.name || '',
      // <input type=color> needs a lowercase #rrggbb value
      color: /^#[0-9a-f]{6}$/i.test(category?.color || '') ? category.color.toLowerCase() : '#2a9d8f',
      monthly_budget: category?.monthly_budget ?? 0,
    },
  });

  const onSubmit = async (v) => {
    setServerError('');
    const payload = { name: v.name.trim(), color: v.color, icon, monthly_budget: Number(v.monthly_budget) || 0 };
    try {
      const res = editing ? await api.updateCategory(category.id, payload) : await api.createCategory(payload);
      notify(res.message);
      onSaved();
    } catch (err) {
      setServerError(getErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {serverError && <div className="notice-box mb-3" role="alert">{serverError}</div>}
      <div className="mb-3">
        <label className="form-label" htmlFor="cat-name">Name</label>
        <input id="cat-name" className={`form-control ${errors.name ? 'is-invalid' : ''}`} maxLength={40} placeholder="e.g. Pets"
          {...register('name', { validate: (v) => v.trim().length > 0 || 'Name is required' })} />
        {errors.name && <div className="invalid-feedback">{errors.name.message}</div>}
      </div>
      <div className="row g-3 mb-3">
        <div className="col-6">
          <label className="form-label" htmlFor="cat-color">Colour</label>
          <input id="cat-color" type="color" className="color-swatch-input" {...register('color')} />
        </div>
        <div className="col-6">
          <label className="form-label" htmlFor="cat-budget">Monthly budget (₹)</label>
          <input id="cat-budget" type="number" min="0" step="1" className={`form-control ${errors.monthly_budget ? 'is-invalid' : ''}`}
            {...register('monthly_budget', { validate: (v) => v === '' || Number(v) >= 0 || 'Budget cannot be negative' })} />
          {errors.monthly_budget && <div className="invalid-feedback">{errors.monthly_budget.message}</div>}
        </div>
      </div>
      <div className="mb-4">
        <div className="form-label" id="icon-label">Icon</div>
        <div className="icon-grid" role="radiogroup" aria-labelledby="icon-label">
          {ICON_IDS.map((id) => {
            const Icon = ICONS[id];
            return (
              <button key={id} type="button" role="radio" aria-checked={icon === id} aria-label={id} title={id}
                className={`icon-option ${icon === id ? 'selected' : ''}`} onClick={() => setIcon(id)}>
                <Icon size={18} />
              </button>
            );
          })}
        </div>
      </div>
      <div className="d-flex justify-content-end gap-2">
        <button type="button" className="btn btn-outline-sw" onClick={onCancel} disabled={isSubmitting}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : editing ? 'Save changes' : 'Create category'}</button>
      </div>
    </form>
  );
}
