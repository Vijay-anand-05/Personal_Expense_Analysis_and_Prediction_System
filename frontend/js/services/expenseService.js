/**
 * Browser-side Expense Management Service.
 * Implements filtering, sorting, pagination, CSV exports, truncation, and table resets in IndexedDB.
 */

import { tx, getStoreItem, getAllStoreItems, putStoreItem, addStoreItem, deleteStoreItem } from '../storage/db.js';
import { DEFAULT_CATEGORIES } from '../storage/defaultCategories.js';
import { requireActiveUser } from './authService.js';
import { round2, isValidISODate } from './dateUtils.js';

function filterExpenses(expenses, params) {
  let list = expenses;

  if (params.search) {
    const q = String(params.search).toLowerCase();
    list = list.filter((e) => (e.title && e.title.toLowerCase().includes(q)) || (e.notes && e.notes.toLowerCase().includes(q)));
  }

  if (params.category) {
    const catId = Number(params.category);
    list = list.filter((e) => e.category_id === catId);
  }

  if (params.payment_method) {
    list = list.filter((e) => e.payment_method === params.payment_method);
  }

  if (params.start_date) {
    list = list.filter((e) => e.expense_date >= params.start_date);
  }

  if (params.end_date) {
    list = list.filter((e) => e.expense_date <= params.end_date);
  }

  return list;
}

export async function listExpenses(params = {}) {
  const user = await requireActiveUser();
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(params.limit) || 10));

  return tx(['expenses', 'categories'], 'readonly', async ([eStore, cStore]) => {
    const allExpenses = await eStore.getAll();
    const userExpenses = allExpenses.filter((e) => e.user_id === user.id);

    const allCats = await cStore.getAll();
    const catMap = new Map(allCats.map((c) => [c.id, c]));

    const filtered = filterExpenses(userExpenses, params);

    // Sort by expense_date DESC, id DESC
    filtered.sort((a, b) => {
      if (a.expense_date !== b.expense_date) {
        return b.expense_date.localeCompare(a.expense_date);
      }
      return b.id - a.id;
    });

    const totalCount = filtered.length;
    const totalAmount = round2(filtered.reduce((sum, e) => sum + (Number(e.amount) || 0), 0));

    const offset = (page - 1) * limit;
    const pagedItems = filtered.slice(offset, offset + limit);

    const enrichedItems = pagedItems.map((e) => {
      const cat = catMap.get(e.category_id);
      return {
        id: e.id,
        user_id: e.user_id,
        title: e.title,
        amount: round2(e.amount),
        category_id: e.category_id,
        expense_date: e.expense_date,
        payment_method: e.payment_method,
        notes: e.notes || '',
        created_at: e.created_at,
        updated_at: e.updated_at,
        category_name: cat ? cat.name : 'Unknown',
        category_color: cat ? cat.color : '#9AA59C',
        category_icon: cat ? cat.icon : 'tag',
      };
    });

    return {
      success: true,
      data: enrichedItems,
      summary: { count: totalCount, total_amount: totalAmount },
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / limit)),
      },
    };
  });
}

export async function getExpense(id) {
  const user = await requireActiveUser();
  const numId = Number(id);

  return tx(['expenses', 'categories'], 'readonly', async ([eStore, cStore]) => {
    const exp = await getStoreItem(eStore, numId);
    if (!exp || exp.user_id !== user.id) {
      const err = new Error('Expense not found');
      err.status = 404;
      throw err;
    }

    const cat = await getStoreItem(cStore, exp.category_id);

    return {
      success: true,
      data: {
        ...exp,
        category_name: cat ? cat.name : 'Unknown',
        category_color: cat ? cat.color : '#9AA59C',
        category_icon: cat ? cat.icon : 'tag',
      },
    };
  });
}

export async function createExpense(body) {
  const user = await requireActiveUser();
  if (!body.title || !body.title.trim()) throw new Error('Title is required');
  if (!body.amount || Number(body.amount) <= 0) throw new Error('Amount must be greater than zero');
  if (!body.category_id) throw new Error('Category is required');
  if (!body.expense_date || !isValidISODate(body.expense_date)) throw new Error('Valid expense date is required');

  return tx(['expenses', 'categories'], 'readwrite', async ([eStore, cStore]) => {
    const cat = await getStoreItem(cStore, Number(body.category_id));
    if (!cat || cat.user_id !== user.id) {
      throw new Error('Category does not exist in your account');
    }

    const now = new Date().toISOString();
    const newExp = {
      user_id: user.id,
      title: body.title.trim(),
      amount: round2(body.amount),
      category_id: Number(body.category_id),
      expense_date: body.expense_date,
      payment_method: body.payment_method || 'UPI',
      notes: (body.notes || '').trim(),
      created_at: now,
      updated_at: now,
    };

    const id = await addStoreItem(eStore, newExp);
    newExp.id = id;
    newExp.category_name = cat.name;
    newExp.category_color = cat.color;
    newExp.category_icon = cat.icon;

    return { success: true, message: 'Expense created successfully', data: newExp };
  });
}

export async function updateExpense(id, body) {
  const user = await requireActiveUser();
  const numId = Number(id);

  return tx(['expenses', 'categories'], 'readwrite', async ([eStore, cStore]) => {
    const exp = await getStoreItem(eStore, numId);
    if (!exp || exp.user_id !== user.id) {
      const err = new Error('Expense not found');
      err.status = 404;
      throw err;
    }

    if (body.category_id) {
      const cat = await getStoreItem(cStore, Number(body.category_id));
      if (!cat || cat.user_id !== user.id) {
        throw new Error('Category does not exist in your account');
      }
      exp.category_id = Number(body.category_id);
    }

    if (body.title && body.title.trim()) exp.title = body.title.trim();
    if (body.amount !== undefined && Number(body.amount) > 0) exp.amount = round2(body.amount);
    if (body.expense_date && isValidISODate(body.expense_date)) exp.expense_date = body.expense_date;
    if (body.payment_method) exp.payment_method = body.payment_method;
    if (body.notes !== undefined) exp.notes = (body.notes || '').trim();
    exp.updated_at = new Date().toISOString();

    await putStoreItem(eStore, exp);

    const cat = await getStoreItem(cStore, exp.category_id);
    const result = {
      ...exp,
      category_name: cat ? cat.name : 'Unknown',
      category_color: cat ? cat.color : '#9AA59C',
      category_icon: cat ? cat.icon : 'tag',
    };

    return { success: true, message: 'Expense updated successfully', data: result };
  });
}

export async function deleteExpense(id) {
  const user = await requireActiveUser();
  const numId = Number(id);

  return tx('expenses', 'readwrite', async (store) => {
    const exp = await getStoreItem(store, numId);
    if (!exp || exp.user_id !== user.id) {
      const err = new Error('Expense not found');
      err.status = 404;
      throw err;
    }

    await deleteStoreItem(store, numId);
    return { success: true, message: 'Expense deleted successfully' };
  });
}

export async function truncateExpenses(scope = 'user') {
  const user = await requireActiveUser();

  return tx('expenses', 'readwrite', async (store) => {
    const all = await store.getAll();
    let deletedCount = 0;

    if (scope === 'all') {
      deletedCount = all.length;
      await store.clear();
    } else {
      for (const e of all) {
        if (e.user_id === user.id) {
          await store.delete(e.id);
          deletedCount++;
        }
      }
    }

    const remaining = (await store.getAll()).length;

    return {
      success: true,
      message:
        scope === 'all'
          ? `Expenses table truncated completely (${deletedCount} records deleted).`
          : `All your expenses have been truncated (${deletedCount} records deleted).`,
      data: { deletedCount, scope, totalRemaining: remaining },
    };
  });
}

export async function resetTables(scope = 'user') {
  const user = await requireActiveUser();

  return tx(['expenses', 'categories', 'users'], 'readwrite', async ([eStore, cStore, uStore]) => {
    let deletedExpenses = 0;
    let deletedCategories = 0;

    if (scope === 'all') {
      deletedExpenses = (await eStore.getAll()).length;
      await eStore.clear();

      deletedCategories = (await cStore.getAll()).length;
      await cStore.clear();

      const users = await uStore.getAll();
      const now = new Date().toISOString();
      for (const u of users) {
        for (const cat of DEFAULT_CATEGORIES) {
          await addStoreItem(cStore, {
            user_id: u.id,
            name: cat.name,
            color: cat.color,
            icon: cat.icon,
            monthly_budget: cat.monthly_budget,
            created_at: now,
          });
        }
      }
    } else {
      const allExp = await eStore.getAll();
      for (const e of allExp) {
        if (e.user_id === user.id) {
          await eStore.delete(e.id);
          deletedExpenses++;
        }
      }

      const allCats = await cStore.getAll();
      for (const c of allCats) {
        if (c.user_id === user.id) {
          await cStore.delete(c.id);
          deletedCategories++;
        }
      }

      const now = new Date().toISOString();
      for (const cat of DEFAULT_CATEGORIES) {
        await addStoreItem(cStore, {
          user_id: user.id,
          name: cat.name,
          color: cat.color,
          icon: cat.icon,
          monthly_budget: cat.monthly_budget,
          created_at: now,
        });
      }
    }

    return {
      success: true,
      message:
        scope === 'all'
          ? `All tables reset: cleared ${deletedExpenses} expenses and re-initialized default categories.`
          : `Account tables reset: cleared ${deletedExpenses} expenses and restored 12 default categories.`,
      data: { deletedExpenses, deletedCategories, scope },
    };
  });
}

function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportExpensesCsv(params = {}) {
  const user = await requireActiveUser();

  return tx(['expenses', 'categories'], 'readonly', async ([eStore, cStore]) => {
    const allExpenses = await eStore.getAll();
    const userExpenses = allExpenses.filter((e) => e.user_id === user.id);
    const allCats = await cStore.getAll();
    const catMap = new Map(allCats.map((c) => [c.id, c.name]));

    const filtered = filterExpenses(userExpenses, params);
    filtered.sort((a, b) => b.expense_date.localeCompare(a.expense_date) || b.id - a.id);

    const header = ['ID', 'Date', 'Title', 'Category', 'Amount (INR)', 'Payment Method', 'Notes'];
    const lines = [header.join(',')].concat(
      filtered.map((r) =>
        [
          r.id,
          r.expense_date,
          r.title,
          catMap.get(r.category_id) || 'Other',
          Number(r.amount).toFixed(2),
          r.payment_method,
          r.notes || '',
        ]
          .map(csvCell)
          .join(',')
      )
    );

    const csvContent = '\ufeff' + lines.join('\r\n');
    return new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  });
}
