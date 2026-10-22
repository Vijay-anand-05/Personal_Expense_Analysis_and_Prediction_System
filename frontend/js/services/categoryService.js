/**
 * Browser-side Category Management Service.
 * Persists categories in IndexedDB scoped to active user.
 */

import { tx, getStoreItem, getAllStoreItems, putStoreItem, addStoreItem, deleteStoreItem } from '../storage/db.js';
import { requireActiveUser } from './authService.js';
import { round2 } from './dateUtils.js';

export async function listCategories() {
  const user = await requireActiveUser();

  return tx(['categories', 'expenses'], 'readonly', async ([cStore, eStore]) => {
    const allCats = await cStore.getAll();
    const userCats = allCats.filter((c) => c.user_id === user.id);

    const allExpenses = await eStore.getAll();
    const userExpenses = allExpenses.filter((e) => e.user_id === user.id);

    const counts = new Map();
    for (const exp of userExpenses) {
      counts.set(exp.category_id, (counts.get(exp.category_id) || 0) + 1);
    }

    const data = userCats
      .map((c) => ({
        id: c.id,
        user_id: c.user_id,
        name: c.name,
        color: c.color,
        icon: c.icon,
        monthly_budget: round2(c.monthly_budget || 0),
        created_at: c.created_at,
        expense_count: counts.get(c.id) || 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return { success: true, data };
  });
}

export async function createCategory(body) {
  const user = await requireActiveUser();
  if (!body.name || !body.name.trim()) throw new Error('Category name is required');

  const trimmedName = body.name.trim();

  return tx('categories', 'readwrite', async (store) => {
    const all = await store.getAll();
    const duplicate = all.find((c) => c.user_id === user.id && c.name.toLowerCase() === trimmedName.toLowerCase());
    if (duplicate) {
      const err = new Error('A category with this name already exists in your account');
      err.status = 409;
      throw err;
    }

    const now = new Date().toISOString();
    const newCat = {
      user_id: user.id,
      name: trimmedName,
      color: body.color || '#9AA59C',
      icon: body.icon || 'tag',
      monthly_budget: round2(body.monthly_budget || 0),
      created_at: now,
    };

    const id = await addStoreItem(store, newCat);
    newCat.id = id;
    newCat.expense_count = 0;

    return { success: true, message: 'Category created', data: newCat };
  });
}

export async function updateCategory(id, body) {
  const user = await requireActiveUser();
  const numId = Number(id);

  return tx('categories', 'readwrite', async (store) => {
    const cat = await getStoreItem(store, numId);
    if (!cat || cat.user_id !== user.id) {
      const err = new Error('Category not found');
      err.status = 404;
      throw err;
    }

    if (body.name && body.name.trim()) {
      const trimmedName = body.name.trim();
      const all = await store.getAll();
      const duplicate = all.find((c) => c.user_id === user.id && c.id !== numId && c.name.toLowerCase() === trimmedName.toLowerCase());
      if (duplicate) {
        const err = new Error('A category with this name already exists in your account');
        err.status = 409;
        throw err;
      }
      cat.name = trimmedName;
    }

    if (body.color !== undefined) cat.color = body.color;
    if (body.icon !== undefined) cat.icon = body.icon;
    if (body.monthly_budget !== undefined) cat.monthly_budget = round2(body.monthly_budget);

    await putStoreItem(store, cat);

    return { success: true, message: 'Category updated', data: cat };
  });
}

export async function deleteCategory(id, reassignTo = null) {
  const user = await requireActiveUser();
  const numId = Number(id);
  const numReassign = reassignTo ? Number(reassignTo) : null;

  return tx(['categories', 'expenses'], 'readwrite', async ([cStore, eStore]) => {
    const cat = await getStoreItem(cStore, numId);
    if (!cat || cat.user_id !== user.id) {
      const err = new Error('Category not found');
      err.status = 404;
      throw err;
    }

    const allExpenses = await eStore.getAll();
    const usedExpenses = allExpenses.filter((e) => e.user_id === user.id && e.category_id === numId);

    if (usedExpenses.length > 0 && !numReassign) {
      const err = new Error(`Cannot delete "${cat.name}": ${usedExpenses.length} expense(s) still use it. Reassign them to another category first.`);
      err.status = 409;
      err.errors = [{ field: 'category', message: 'in_use', count: usedExpenses.length }];
      throw err;
    }

    if (numReassign) {
      if (numReassign === numId) throw new Error('Choose a different category to reassign expenses to');
      const targetCat = await getStoreItem(cStore, numReassign);
      if (!targetCat || targetCat.user_id !== user.id) {
        throw new Error('Target category for reassignment does not exist in your account');
      }

      const now = new Date().toISOString();
      for (const exp of usedExpenses) {
        exp.category_id = numReassign;
        exp.updated_at = now;
        await putStoreItem(eStore, exp);
      }
    }

    await deleteStoreItem(cStore, numId);

    return {
      success: true,
      message: usedExpenses.length > 0 ? `Category deleted; ${usedExpenses.length} expense(s) reassigned` : 'Category deleted',
    };
  });
}
