/**
 * Expenses Page Controller
 */
import { api } from '../api.js';
import { requireAuth } from '../auth.js';
import { renderShell, showToast } from '../app.js';
import { inr, formatDate, downloadBlob, escapeHtml, todayISO } from '../utils/formatters.js';

let categories = [];
let filters = {
  search: '',
  category: '',
  payment_method: '',
  start_date: '',
  end_date: '',
  page: 1,
  limit: 10,
};

let currentEditingId = null;
let currentDeletingId = null;
let expenseModalInstance = null;
let deleteModalInstance = null;

export async function initExpenses() {
  const auth = await requireAuth();
  if (!auth) return;

  renderShell({
    activeNav: 'expenses',
    pageTitle: 'Expenses',
    pageDesc: 'Record, search, filter, and export your transactions',
  });

  // Initialize Bootstrap modals
  const modalEl = document.getElementById('expenseModal');
  if (modalEl) expenseModalInstance = new bootstrap.Modal(modalEl);

  const delModalEl = document.getElementById('deleteConfirmModal');
  if (delModalEl) deleteModalInstance = new bootstrap.Modal(delModalEl);

  // Load categories and initial expenses
  await loadCategories();
  bindFilterEvents();
  bindModalEvents();
  await loadExpenses();
}

async function loadCategories() {
  try {
    const res = await api.categories.list();
    categories = res.data || [];

    // Populate category dropdown in filters
    const filterSelect = document.getElementById('filterCategory');
    if (filterSelect) {
      filterSelect.innerHTML =
        '<option value="">All Categories</option>' +
        categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    }

    // Populate category dropdown in form modal
    const modalSelect = document.getElementById('formCategory');
    if (modalSelect) {
      modalSelect.innerHTML =
        '<option value="" disabled selected>Select a category</option>' +
        categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    }
  } catch (err) {
    showToast('Failed to load categories: ' + err.message, 'error');
  }
}

async function loadExpenses() {
  const tableBody = document.getElementById('expensesTableBody');
  const summaryBox = document.getElementById('expensesSummary');
  const paginationBox = document.getElementById('paginationControls');

  if (!tableBody) return;

  tableBody.innerHTML = `
    <tr><td colspan="6" class="text-center py-4 text-muted">
      <div class="spinner-border spinner-border-sm me-2" role="status"></div> Loading expenses…
    </td></tr>
  `;

  try {
    const res = await api.expenses.list(filters);
    const { data: items, summary, pagination } = res;

    // Update Summary
    if (summaryBox) {
      summaryBox.innerHTML = `
        Showing <strong>${summary.count}</strong> transactions totaling <strong>${inr(summary.total_amount)}</strong>
      `;
    }

    // Render Table Rows
    if (items.length === 0) {
      tableBody.innerHTML = `
        <tr><td colspan="6" class="text-center py-5 text-muted">
          <i data-lucide="inbox" style="width: 32px; height: 32px; display: block; margin: 0 auto 0.5rem; opacity: 0.5;"></i>
          No expenses found.
          <div class="mt-3">
            <button class="btn btn-primary btn-sm me-2" id="emptyAddExpenseBtn">
              <i data-lucide="plus" class="me-1"></i> Add Expense
            </button>
            <button class="btn btn-outline-sw btn-sm" id="expensesSeedDemoBtn">
              <i data-lucide="sparkles" class="me-1"></i> Load Sample Data
            </button>
          </div>
        </td></tr>
      `;
      document.getElementById('emptyAddExpenseBtn')?.addEventListener('click', () => openAddModal());
      document.getElementById('expensesSeedDemoBtn')?.addEventListener('click', async () => {
        const btn = document.getElementById('expensesSeedDemoBtn');
        btn.disabled = true;
        try {
          const res = await api.auth.seedDemo();
          showToast(res.message || 'Sample data loaded successfully');
          loadExpenses();
        } catch (err) {
          showToast('Failed to seed demo data: ' + err.message, 'error');
          btn.disabled = false;
        }
      });
    } else {
      tableBody.innerHTML = items
        .map(
          (item) => `
        <tr>
          <td class="ps-3 text-nowrap text-muted-sw">${formatDate(item.expense_date)}</td>
          <td>
            <div class="fw-semibold">${escapeHtml(item.title)}</div>
            ${item.notes ? `<div class="small text-muted text-truncate" style="max-width: 260px;">${escapeHtml(item.notes)}</div>` : ''}
          </td>
          <td>
            <span class="badge-sw" style="background-color: ${item.category_color ? item.category_color + '22' : 'var(--sw-mint)'}; color: ${item.category_color || 'var(--sw-primary)'};">
              <span class="cat-dot" style="background-color: ${item.category_color || 'var(--sw-primary)'};"></span>
              ${escapeHtml(item.category_name)}
            </span>
          </td>
          <td class="text-muted-sw small">${escapeHtml(item.payment_method)}</td>
          <td class="amount">${inr(item.amount)}</td>
          <td class="text-end pe-3 row-actions">
            <button class="btn btn-icon edit-btn" data-id="${item.id}" title="Edit expense">
              <i data-lucide="pencil" style="width: 15px; height: 15px;"></i>
            </button>
            <button class="btn btn-icon danger delete-btn" data-id="${item.id}" data-title="${escapeHtml(item.title)}" title="Delete expense">
              <i data-lucide="trash-2" style="width: 15px; height: 15px;"></i>
            </button>
          </td>
        </tr>
      `
        )
        .join('');
    }

    // Render Pagination
    if (paginationBox) {
      if (pagination.total_pages <= 1) {
        paginationBox.innerHTML = '';
      } else {
        paginationBox.innerHTML = `
          <button class="btn btn-outline-sw btn-sm" id="prevPageBtn" ${pagination.page <= 1 ? 'disabled' : ''}>
            <i data-lucide="chevron-left" style="width: 14px; height: 14px;"></i> Previous
          </button>
          <span class="small text-muted-sw align-self-center px-2">Page ${pagination.page} of ${pagination.total_pages}</span>
          <button class="btn btn-outline-sw btn-sm" id="nextPageBtn" ${pagination.page >= pagination.total_pages ? 'disabled' : ''}>
            Next <i data-lucide="chevron-right" style="width: 14px; height: 14px;"></i>
          </button>
        `;

        document.getElementById('prevPageBtn')?.addEventListener('click', () => {
          if (filters.page > 1) {
            filters.page--;
            loadExpenses();
          }
        });
        document.getElementById('nextPageBtn')?.addEventListener('click', () => {
          if (filters.page < pagination.total_pages) {
            filters.page++;
            loadExpenses();
          }
        });
      }
    }

    // Re-initialize Lucide icons
    if (window.lucide) window.lucide.createIcons();

    // Attach row action listeners
    document.querySelectorAll('.edit-btn').forEach((btn) => {
      btn.addEventListener('click', () => openEditModal(btn.dataset.id));
    });
    document.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', () => openDeleteModal(btn.dataset.id, btn.dataset.title));
    });
  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="6" class="text-danger py-4 text-center">Failed to load expenses: ${escapeHtml(err.message)}</td></tr>`;
  }
}

function bindFilterEvents() {
  const searchInput = document.getElementById('filterSearch');
  const catSelect = document.getElementById('filterCategory');
  const methodSelect = document.getElementById('filterPaymentMethod');
  const startInput = document.getElementById('filterStartDate');
  const endInput = document.getElementById('filterEndDate');
  const clearBtn = document.getElementById('clearFiltersBtn');
  const exportBtn = document.getElementById('exportCsvBtn');

  let debounceTimer;
  searchInput?.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      filters.search = e.target.value.trim();
      filters.page = 1;
      loadExpenses();
    }, 300);
  });

  catSelect?.addEventListener('change', (e) => {
    filters.category = e.target.value;
    filters.page = 1;
    loadExpenses();
  });

  methodSelect?.addEventListener('change', (e) => {
    filters.payment_method = e.target.value;
    filters.page = 1;
    loadExpenses();
  });

  startInput?.addEventListener('change', (e) => {
    filters.start_date = e.target.value;
    filters.page = 1;
    loadExpenses();
  });

  endInput?.addEventListener('change', (e) => {
    filters.end_date = e.target.value;
    filters.page = 1;
    loadExpenses();
  });

  clearBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    if (catSelect) catSelect.value = '';
    if (methodSelect) methodSelect.value = '';
    if (startInput) startInput.value = '';
    if (endInput) endInput.value = '';
    filters = { search: '', category: '', payment_method: '', start_date: '', end_date: '', page: 1, limit: 10 };
    loadExpenses();
  });

  exportBtn?.addEventListener('click', async () => {
    exportBtn.disabled = true;
    try {
      const blob = await api.expenses.exportCsv(filters);
      downloadBlob(blob, 'personal-expenses.csv');
      showToast('CSV exported successfully');
    } catch (err) {
      showToast('Export failed: ' + err.message, 'error');
    } finally {
      exportBtn.disabled = false;
    }
  });

  document.getElementById('openAddExpenseBtn')?.addEventListener('click', () => openAddModal());
}

function bindModalEvents() {
  const form = document.getElementById('expenseForm');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const alertBox = document.getElementById('formAlert');
    alertBox.classList.add('d-none');

    const title = document.getElementById('formTitle').value.trim();
    const amount = parseFloat(document.getElementById('formAmount').value);
    const category_id = parseInt(document.getElementById('formCategory').value, 10);
    const expense_date = document.getElementById('formDate').value;
    const payment_method = document.getElementById('formPaymentMethod').value;
    const notes = document.getElementById('formNotes').value.trim();

    if (!title || isNaN(amount) || amount <= 0 || !category_id || !expense_date || !payment_method) {
      alertBox.textContent = 'Please fill out all required fields with valid values.';
      alertBox.classList.remove('d-none');
      return;
    }

    const payload = { title, amount, category_id, expense_date, payment_method, notes };
    const submitBtn = document.getElementById('saveExpenseBtn');
    submitBtn.disabled = true;

    try {
      if (currentEditingId) {
        await api.expenses.update(currentEditingId, payload);
        showToast('Expense updated successfully');
      } else {
        await api.expenses.create(payload);
        showToast('Expense added successfully');
      }
      expenseModalInstance.hide();
      loadExpenses();
    } catch (err) {
      alertBox.textContent = err.message || 'Failed to save expense.';
      alertBox.classList.remove('d-none');
    } finally {
      submitBtn.disabled = false;
    }
  });

  document.getElementById('confirmDeleteBtn')?.addEventListener('click', async () => {
    if (!currentDeletingId) return;
    const btn = document.getElementById('confirmDeleteBtn');
    btn.disabled = true;
    try {
      await api.expenses.delete(currentDeletingId);
      showToast('Expense deleted successfully');
      deleteModalInstance.hide();
      loadExpenses();
    } catch (err) {
      showToast('Delete failed: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

function openAddModal() {
  currentEditingId = null;
  document.getElementById('expenseModalTitle').textContent = 'Add Expense';
  document.getElementById('formAlert').classList.add('d-none');
  document.getElementById('formTitle').value = '';
  document.getElementById('formAmount').value = '';
  document.getElementById('formCategory').value = '';
  document.getElementById('formDate').value = todayISO();
  document.getElementById('formPaymentMethod').value = 'UPI';
  document.getElementById('formNotes').value = '';
  expenseModalInstance.show();
}

async function openEditModal(id) {
  currentEditingId = id;
  document.getElementById('expenseModalTitle').textContent = 'Edit Expense';
  document.getElementById('formAlert').classList.add('d-none');

  try {
    const res = await api.expenses.get(id);
    const exp = res.data;
    document.getElementById('formTitle').value = exp.title;
    document.getElementById('formAmount').value = exp.amount;
    document.getElementById('formCategory').value = exp.category_id;
    document.getElementById('formDate').value = exp.expense_date;
    document.getElementById('formPaymentMethod').value = exp.payment_method;
    document.getElementById('formNotes').value = exp.notes || '';
    expenseModalInstance.show();
  } catch (err) {
    showToast('Failed to load expense details: ' + err.message, 'error');
  }
}

function openDeleteModal(id, title) {
  currentDeletingId = id;
  document.getElementById('deleteExpenseTitle').textContent = title;
  deleteModalInstance.show();
}
