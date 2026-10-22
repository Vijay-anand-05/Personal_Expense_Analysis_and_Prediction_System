/**
 * Settings Page Controller
 */
import { api } from '../api.js';
import { requireAuth, logout, getCurrentUser, getCurrentSettings } from '../auth.js';
import { renderShell, showToast } from '../app.js';
import { downloadBlob, escapeHtml } from '../utils/formatters.js';

let changePasswordModal = null;
let truncateExpensesModal = null;
let resetTablesModal = null;

export async function initSettings() {
  const auth = await requireAuth();
  if (!auth) return;

  renderShell({
    activeNav: 'settings',
    pageTitle: 'Settings',
    pageDesc: 'Account preferences, security, table truncate, sample data seeding, and database status',
  });

  const pwModalEl = document.getElementById('changePasswordModal');
  if (pwModalEl) changePasswordModal = new bootstrap.Modal(pwModalEl);

  const truncModalEl = document.getElementById('truncateExpensesModal');
  if (truncModalEl) truncateExpensesModal = new bootstrap.Modal(truncModalEl);

  const resetModalEl = document.getElementById('resetTablesModal');
  if (resetModalEl) resetTablesModal = new bootstrap.Modal(resetModalEl);

  populateUserForm(auth.user, auth.settings);
  bindEvents();
  loadSystemHealth();
  if (window.lucide) window.lucide.createIcons();
}

function populateUserForm(user, settings) {
  const nameInput = document.getElementById('settingsDisplayName');
  const emailInput = document.getElementById('settingsEmail');
  const pageSizeSelect = document.getElementById('settingsPageSize');

  if (nameInput) nameInput.value = (settings && settings.display_name) || user.name || '';
  if (emailInput) emailInput.value = user.email || '';
  if (pageSizeSelect) pageSizeSelect.value = (settings && settings.page_size) || 10;
}

function bindEvents() {
  // Save profile preferences
  const profileForm = document.getElementById('profileForm');
  profileForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('settingsDisplayName').value.trim();
    const pageSize = parseInt(document.getElementById('settingsPageSize').value, 10);
    const saveBtn = document.getElementById('saveProfileBtn');
    saveBtn.disabled = true;

    try {
      await api.auth.updateProfile({ name, pageSize });
      showToast('Profile preferences saved successfully');
    } catch (err) {
      showToast('Failed to save profile: ' + err.message, 'error');
    } finally {
      saveBtn.disabled = false;
    }
  });

  // Change password modal open
  document.getElementById('openChangePasswordBtn')?.addEventListener('click', () => {
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmNewPassword').value = '';
    document.getElementById('passwordModalAlert').classList.add('d-none');
    changePasswordModal?.show();
  });

  // Change password submit
  const pwForm = document.getElementById('changePasswordForm');
  pwForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const alertBox = document.getElementById('passwordModalAlert');
    alertBox.classList.add('d-none');

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      alertBox.textContent = 'Please fill out all password fields.';
      alertBox.classList.remove('d-none');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      alertBox.textContent = 'New passwords do not match.';
      alertBox.classList.remove('d-none');
      return;
    }

    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      alertBox.textContent = 'New password must be at least 8 characters long with at least one uppercase letter and one number.';
      alertBox.classList.remove('d-none');
      return;
    }

    const saveBtn = document.getElementById('savePasswordBtn');
    saveBtn.disabled = true;

    try {
      await api.auth.changePassword({ currentPassword, newPassword });
      showToast('Password updated successfully');
      changePasswordModal?.hide();
    } catch (err) {
      alertBox.textContent = err.message || 'Failed to update password.';
      alertBox.classList.remove('d-none');
    } finally {
      saveBtn.disabled = false;
    }
  });

  // Export all expenses CSV
  document.getElementById('exportAllExpensesBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('exportAllExpensesBtn');
    btn.disabled = true;
    try {
      const blob = await api.expenses.exportCsv({});
      downloadBlob(blob, 'all-personal-expenses.csv');
      showToast('All expenses exported to CSV');
    } catch (err) {
      showToast('Export failed: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // Seed Sample Demo Data with Months & Clear Options
  document.getElementById('seedDemoDataBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('seedDemoDataBtn');
    const monthsSelect = document.getElementById('seedMonthsSelect');
    const clearToggle = document.getElementById('seedClearFirstToggle');

    const months = monthsSelect ? parseInt(monthsSelect.value, 10) : 3;
    const clearFirst = clearToggle ? clearToggle.checked : true;

    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Seeding…`;

    try {
      const res = await api.auth.seedDemo({ months, clearFirst });
      showToast(res.message || `Loaded ${res.data?.seeded || ''} sample expenses successfully!`);
      await loadSystemHealth();
    } catch (err) {
      showToast('Failed to seed demo data: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalText;
      if (window.lucide) window.lucide.createIcons();
    }
  });

  // Open Truncate Expenses Modal
  document.getElementById('openTruncateModalBtn')?.addEventListener('click', () => {
    const scopeSelect = document.getElementById('truncateScopeSelect');
    const scope = scopeSelect ? scopeSelect.value : 'user';
    const label = document.getElementById('truncateModalScopeLabel');
    if (label) {
      label.textContent = scope === 'all' ? 'the ENTIRE database (all users)' : 'your active user account';
    }
    truncateExpensesModal?.show();
  });

  // Confirm Truncate Expenses
  document.getElementById('confirmTruncateBtn')?.addEventListener('click', async () => {
    const confirmBtn = document.getElementById('confirmTruncateBtn');
    const scopeSelect = document.getElementById('truncateScopeSelect');
    const scope = scopeSelect ? scopeSelect.value : 'user';

    confirmBtn.disabled = true;
    const origText = confirmBtn.innerHTML;
    confirmBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Truncating…`;

    try {
      const res = await api.expenses.truncate(scope);
      showToast(res.message || 'Expenses table truncated successfully.');
      truncateExpensesModal?.hide();
      await loadSystemHealth();
    } catch (err) {
      showToast('Failed to truncate expenses: ' + err.message, 'error');
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = origText;
      if (window.lucide) window.lucide.createIcons();
    }
  });

  // Open Reset All Tables Modal
  document.getElementById('openResetTablesModalBtn')?.addEventListener('click', () => {
    resetTablesModal?.show();
  });

  // Confirm Reset All Tables
  document.getElementById('confirmResetTablesBtn')?.addEventListener('click', async () => {
    const confirmBtn = document.getElementById('confirmResetTablesBtn');
    confirmBtn.disabled = true;
    const origText = confirmBtn.innerHTML;
    confirmBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Resetting…`;

    try {
      const res = await api.expenses.resetTables('user');
      showToast(res.message || 'All tables reset successfully.');
      resetTablesModal?.hide();
      await loadSystemHealth();
    } catch (err) {
      showToast('Failed to reset tables: ' + err.message, 'error');
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = origText;
      if (window.lucide) window.lucide.createIcons();
    }
  });

  // Refresh System Status Button
  document.getElementById('refreshHealthBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('refreshHealthBtn');
    btn.disabled = true;
    try {
      await loadSystemHealth();
      showToast('System status refreshed');
    } finally {
      btn.disabled = false;
    }
  });

  // Account logout
  document.getElementById('logoutSettingsBtn')?.addEventListener('click', () => {
    logout();
  });
}

async function loadSystemHealth() {
  const healthBox = document.getElementById('systemHealthBox');
  if (!healthBox) return;

  try {
    const res = await api.health();
    const data = res;
    healthBox.innerHTML = `
      <div class="row g-3 small align-items-center">
        <div class="col-md-3 col-6">
          <div class="text-muted-sw mb-1">System Status</div>
          <div class="fw-semibold text-success d-flex align-items-center gap-1">
            <span class="cat-dot" style="background-color: var(--sw-mint-strong); width: 8px; height: 8px; border-radius: 50%;"></span> Operational
          </div>
        </div>
        <div class="col-md-3 col-6">
          <div class="text-muted-sw mb-1">Database File</div>
          <div class="font-monospace fw-semibold">${escapeHtml(data.database?.file || 'db.sqlite3')}</div>
        </div>
        <div class="col-md-2 col-4">
          <div class="text-muted-sw mb-1">Total Expenses</div>
          <div class="fs-6 fw-bold text-primary">${data.database?.expenses ?? 0}</div>
        </div>
        <div class="col-md-2 col-4">
          <div class="text-muted-sw mb-1">Total Categories</div>
          <div class="fs-6 fw-bold text-primary">${data.database?.categories ?? 0}</div>
        </div>
        <div class="col-md-2 col-4">
          <div class="text-muted-sw mb-1">Server Uptime</div>
          <div class="fw-semibold">${data.uptime_seconds ? Math.floor(data.uptime_seconds / 60) + ' min' : '< 1 min'}</div>
        </div>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    healthBox.innerHTML = `<div class="text-danger small">Failed to query health: ${escapeHtml(err.message)}</div>`;
  }
}
