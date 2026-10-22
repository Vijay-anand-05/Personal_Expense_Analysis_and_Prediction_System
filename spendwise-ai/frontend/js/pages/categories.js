/**
 * Categories Page Controller
 */
import { api } from '../api.js';
import { requireAuth } from '../auth.js';
import { renderShell, showToast } from '../app.js';
import { inr, escapeHtml } from '../utils/formatters.js';

const AVAILABLE_ICONS = [
  'utensils', 'car', 'shopping-bag', 'receipt', 'film', 'heart-pulse',
  'graduation-cap', 'plane', 'shopping-cart', 'home', 'sparkles', 'tag',
  'wallet', 'coffee', 'gift', 'dumbbell', 'smartphone', 'book-open'
];

let categories = [];
let editingCategoryId = null;
let deletingCategory = null;
let categoryModalInstance = null;
let deleteModalInstance = null;

export async function initCategories() {
  const auth = await requireAuth();
  if (!auth) return;

  renderShell({
    activeNav: 'categories',
    pageTitle: 'Categories & Budgets',
    pageDesc: 'Manage custom categories, color tags, icons, and monthly spending limits',
  });

  const catModalEl = document.getElementById('categoryModal');
  if (catModalEl) categoryModalInstance = new bootstrap.Modal(catModalEl);

  const delModalEl = document.getElementById('deleteCategoryModal');
  if (delModalEl) deleteModalInstance = new bootstrap.Modal(delModalEl);

  renderIconPicker();
  bindEvents();
  await loadCategories();
}

function renderIconPicker() {
  const container = document.getElementById('iconPickerGrid');
  if (!container) return;

  container.innerHTML = AVAILABLE_ICONS.map((icon) => `
    <button type="button" class="icon-option" data-icon="${icon}" title="${icon}">
      <i data-lucide="${icon}" style="width: 18px; height: 18px;"></i>
    </button>
  `).join('');

  container.querySelectorAll('.icon-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.icon-option').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('formCategoryIcon').value = btn.dataset.icon;
    });
  });
}

function selectIcon(iconName) {
  const container = document.getElementById('iconPickerGrid');
  if (!container) return;
  container.querySelectorAll('.icon-option').forEach((btn) => {
    if (btn.dataset.icon === iconName) btn.classList.add('selected');
    else btn.classList.remove('selected');
  });
  document.getElementById('formCategoryIcon').value = iconName;
}

async function loadCategories() {
  const grid = document.getElementById('categoriesGrid');
  const summaryBox = document.getElementById('categoriesSummary');
  if (!grid) return;

  grid.innerHTML = `
    <div class="col-12 text-center py-5 text-muted">
      <div class="spinner-border spinner-border-sm me-2" role="status"></div> Loading categories…
    </div>
  `;

  try {
    const res = await api.categories.list();
    categories = res.data || [];

    const totalBudget = categories.reduce((s, c) => s + (c.monthly_budget || 0), 0);

    if (summaryBox) {
      summaryBox.innerHTML = `
        <strong>${categories.length}</strong> active categories with a total monthly budget of <strong>${inr(totalBudget)}</strong>
      `;
    }

    if (categories.length === 0) {
      grid.innerHTML = `
        <div class="col-12 text-center py-5 text-muted">
          No categories found. Click "Add Category" to get started.
        </div>
      `;
    } else {
      grid.innerHTML = categories.map((cat) => `
        <div class="col-md-6 col-lg-4 col-xl-3">
          <div class="card-sw cat-card">
            <div class="d-flex align-items-start justify-content-between">
              <div class="d-flex align-items-center gap-2">
                <div class="cat-chip" style="width: 40px; height: 40px; background-color: ${cat.color}22; color: ${cat.color};">
                  <i data-lucide="${cat.icon || 'tag'}" style="width: 20px; height: 20px;"></i>
                </div>
                <div>
                  <h3 class="h6 mb-0 text-truncate" style="max-width: 140px;">${escapeHtml(cat.name)}</h3>
                  <div class="small-label">${cat.expense_count} expense${cat.expense_count === 1 ? '' : 's'}</div>
                </div>
              </div>
              <div class="dropdown">
                <button class="btn btn-icon" data-bs-toggle="dropdown" aria-expanded="false">
                  <i data-lucide="more-vertical" style="width: 16px; height: 16px;"></i>
                </button>
                <ul class="dropdown-menu dropdown-menu-end shadow-sm border-0" style="border-radius: 10px; font-size: 0.85rem;">
                  <li>
                    <button class="dropdown-item py-2 edit-cat-btn" data-id="${cat.id}">
                      <i data-lucide="pencil" class="me-2" style="width: 15px; height: 15px;"></i> Edit Category
                    </button>
                  </li>
                  <li>
                    <button class="dropdown-item py-2 text-danger delete-cat-btn" data-id="${cat.id}">
                      <i data-lucide="trash-2" class="me-2" style="width: 15px; height: 15px;"></i> Delete Category
                    </button>
                  </li>
                </ul>
              </div>
            </div>

            <div class="border-top pt-2 mt-auto">
              <div class="d-flex justify-content-between align-items-center">
                <span class="small-label">Monthly Budget</span>
                <span class="fw-semibold">${cat.monthly_budget > 0 ? inr(cat.monthly_budget) : '<span class="text-muted-sw">None</span>'}</span>
              </div>
            </div>
          </div>
        </div>
      `).join('');
    }

    if (window.lucide) window.lucide.createIcons();

    // Attach listeners
    document.querySelectorAll('.edit-cat-btn').forEach((btn) => {
      btn.addEventListener('click', () => openEditCategoryModal(btn.dataset.id));
    });
    document.querySelectorAll('.delete-cat-btn').forEach((btn) => {
      btn.addEventListener('click', () => openDeleteCategoryModal(btn.dataset.id));
    });
  } catch (err) {
    grid.innerHTML = `<div class="col-12 text-danger text-center py-4">Failed to load categories: ${escapeHtml(err.message)}</div>`;
  }
}

function bindEvents() {
  document.getElementById('openAddCategoryBtn')?.addEventListener('click', () => openAddCategoryModal());

  const form = document.getElementById('categoryForm');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const alertBox = document.getElementById('categoryFormAlert');
    alertBox.classList.add('d-none');

    const name = document.getElementById('formCategoryName').value.trim();
    const color = document.getElementById('formCategoryColor').value;
    const icon = document.getElementById('formCategoryIcon').value || 'tag';
    const monthly_budget = parseFloat(document.getElementById('formCategoryBudget').value) || 0;

    if (!name) {
      alertBox.textContent = 'Category name is required.';
      alertBox.classList.remove('d-none');
      return;
    }

    const payload = { name, color, icon, monthly_budget };
    const submitBtn = document.getElementById('saveCategoryBtn');
    submitBtn.disabled = true;

    try {
      if (editingCategoryId) {
        await api.categories.update(editingCategoryId, payload);
        showToast('Category updated successfully');
      } else {
        await api.categories.create(payload);
        showToast('Category created successfully');
      }
      categoryModalInstance.hide();
      loadCategories();
    } catch (err) {
      alertBox.textContent = err.message || 'Failed to save category.';
      alertBox.classList.remove('d-none');
    } finally {
      submitBtn.disabled = false;
    }
  });

  document.getElementById('confirmDeleteCategoryBtn')?.addEventListener('click', async () => {
    if (!deletingCategory) return;
    const btn = document.getElementById('confirmDeleteCategoryBtn');
    const alertBox = document.getElementById('deleteCatAlert');
    alertBox.classList.add('d-none');

    const reassignSelect = document.getElementById('reassignCategorySelect');
    const reassignTo = reassignSelect ? reassignSelect.value : null;

    if (deletingCategory.expense_count > 0 && !reassignTo) {
      alertBox.textContent = 'Please choose a category to reassign existing expenses to.';
      alertBox.classList.remove('d-none');
      return;
    }

    btn.disabled = true;
    try {
      await api.categories.delete(deletingCategory.id, reassignTo);
      showToast('Category deleted successfully');
      deleteModalInstance.hide();
      loadCategories();
    } catch (err) {
      alertBox.textContent = err.message || 'Failed to delete category.';
      alertBox.classList.remove('d-none');
    } finally {
      btn.disabled = false;
    }
  });
}

function openAddCategoryModal() {
  editingCategoryId = null;
  document.getElementById('categoryModalTitle').textContent = 'Add Category';
  document.getElementById('categoryFormAlert').classList.add('d-none');
  document.getElementById('formCategoryName').value = '';
  document.getElementById('formCategoryColor').value = '#173F35';
  document.getElementById('formCategoryBudget').value = '';
  selectIcon('tag');
  categoryModalInstance.show();
}

function openEditCategoryModal(id) {
  const cat = categories.find((c) => c.id === Number(id));
  if (!cat) return;

  editingCategoryId = cat.id;
  document.getElementById('categoryModalTitle').textContent = 'Edit Category';
  document.getElementById('categoryFormAlert').classList.add('d-none');
  document.getElementById('formCategoryName').value = cat.name;
  document.getElementById('formCategoryColor').value = cat.color || '#173F35';
  document.getElementById('formCategoryBudget').value = cat.monthly_budget || '';
  selectIcon(cat.icon || 'tag');
  categoryModalInstance.show();
}

function openDeleteCategoryModal(id) {
  const cat = categories.find((c) => c.id === Number(id));
  if (!cat) return;

  deletingCategory = cat;
  document.getElementById('deleteCategoryName').textContent = cat.name;
  document.getElementById('deleteCatAlert').classList.add('d-none');

  const reassignArea = document.getElementById('reassignSection');
  const reassignSelect = document.getElementById('reassignCategorySelect');

  if (cat.expense_count > 0) {
    reassignArea.classList.remove('d-none');
    const available = categories.filter((c) => c.id !== cat.id);
    reassignSelect.innerHTML =
      '<option value="" disabled selected>Select replacement category</option>' +
      available.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  } else {
    reassignArea.classList.add('d-none');
  }

  deleteModalInstance.show();
}
