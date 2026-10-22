/**
 * Application Shell Manager (Sidebar, Topbar, Mobile Toggle, Notifications, Icons)
 */
import { logout, getCurrentUser } from './auth.js';
import { getMonthOptions, currentMonth } from './utils/formatters.js';

export function renderShell(options = {}) {
  const {
    activeNav = 'dashboard',
    pageTitle = 'Dashboard',
    pageDesc = '',
    showMonthPicker = false,
    selectedMonth = currentMonth(),
    onMonthChange = null,
  } = options;

  const user = getCurrentUser() || { name: 'User', email: '' };
  const initials = user.name
    ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  const isRoot = window.location.pathname === '/' || window.location.pathname.endsWith('index.html');
  const pathPrefix = isRoot ? '' : '../';
  const pagesPrefix = isRoot ? 'pages/' : '';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', href: isRoot ? 'index.html' : '../index.html' },
    { id: 'expenses', label: 'Expenses', icon: 'receipt', href: isRoot ? 'pages/expenses.html' : 'expenses.html' },
    { id: 'categories', label: 'Categories', icon: 'tags', href: isRoot ? 'pages/categories.html' : 'categories.html' },
    { id: 'analytics', label: 'Analytics', icon: 'bar-chart-3', href: isRoot ? 'pages/analytics.html' : 'analytics.html' },
    { id: 'predictions', label: 'Predictions', icon: 'sparkles', href: isRoot ? 'pages/predictions.html' : 'predictions.html' },
    { id: 'settings', label: 'Settings', icon: 'settings', href: isRoot ? 'pages/settings.html' : 'settings.html' },
  ];

  const sidebarHtml = `
    <div class="sidebar-backdrop" id="sidebarBackdrop"></div>
    <aside class="sidebar" id="appSidebar" aria-label="Main navigation">
      <a href="${isRoot ? 'index.html' : '../index.html'}" class="brand" title="Personal Expense Analysis and Prediction System">
        <span class="brand-mark">
          <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
            <rect x="1.5" y="9" width="3.2" height="5.5" rx="1" fill="#DDF3E4" />
            <rect x="6.4" y="5.5" width="3.2" height="9" rx="1" fill="#DDF3E4" />
            <rect x="11.3" y="1.5" width="3.2" height="13" rx="1" fill="#F4A261" />
          </svg>
        </span>
        <div style="line-height: 1.15;">
          <div style="font-size: 0.86rem; font-weight: 700; color: var(--sw-text);">Personal Expense</div>
          <div style="font-size: 0.68rem; font-weight: 600; color: var(--sw-mint-strong); letter-spacing: 0.02em;">Analysis & Prediction</div>
        </div>
      </a>
      <nav>
        ${navItems
          .map(
            (item) => `
          <a href="${item.href}" class="nav-item-sw ${item.id === activeNav ? 'active' : ''}">
            <i data-lucide="${item.icon}" style="width: 17px; height: 17px;"></i>
            <span>${item.label}</span>
          </a>
        `
          )
          .join('')}
      </nav>
      <div class="sidebar-foot">
        Forecasts use transparent averaging, not a trained ML model.
      </div>
    </aside>
  `;

  const monthOptions = getMonthOptions();
  const monthPickerHtml = showMonthPicker
    ? `
    <div class="month-picker ms-auto">
      <select id="globalMonthPicker" class="form-select form-select-sm">
        ${monthOptions
          .map((m) => `<option value="${m.value}" ${m.value === selectedMonth ? 'selected' : ''}>${m.label}</option>`)
          .join('')}
      </select>
    </div>
  `
    : '';

  const topbarHtml = `
    <header class="topbar">
      <button class="btn btn-icon d-lg-none me-2" id="sidebarToggle" aria-label="Toggle navigation">
        <i data-lucide="menu" style="width: 20px; height: 20px;"></i>
      </button>
      <div>
        <h1 class="page-title">${pageTitle}</h1>
        ${pageDesc ? `<div class="page-desc">${pageDesc}</div>` : ''}
      </div>
      ${monthPickerHtml}
      <div class="dropdown ${showMonthPicker ? 'ms-2' : 'ms-auto'}">
        <button class="avatar border-0" type="button" data-bs-toggle="dropdown" aria-expanded="false" title="${user.name} (${user.email})">
          ${initials}
        </button>
        <ul class="dropdown-menu dropdown-menu-end shadow-sm border-0" style="border-radius: 12px; font-size: 0.85rem;">
          <li class="px-3 py-2 border-bottom">
            <div class="fw-semibold text-truncate" style="max-width: 180px;">${user.name}</div>
            <div class="text-muted small text-truncate" style="max-width: 180px;">${user.email}</div>
          </li>
          <li><a class="dropdown-item py-2" href="${isRoot ? 'pages/settings.html' : 'settings.html'}"><i data-lucide="settings" class="me-2" style="width: 15px; height: 15px;"></i> Settings</a></li>
          <li><hr class="dropdown-divider my-1"></li>
          <li><button class="dropdown-item py-2 text-danger" id="logoutBtn"><i data-lucide="log-out" class="me-2" style="width: 15px; height: 15px;"></i> Log Out</button></li>
        </ul>
      </div>
    </header>
  `;

  // Insert sidebar into appShell and topbar into main-area
  const shellContainer = document.getElementById('appShell');
  if (shellContainer) {
    shellContainer.innerHTML = sidebarHtml;
  }

  const mainArea = document.querySelector('.main-area');
  if (mainArea) {
    const existingTopbar = mainArea.querySelector('.topbar');
    if (existingTopbar) existingTopbar.remove();
    mainArea.insertAdjacentHTML('afterbegin', topbarHtml);
  } else if (shellContainer) {
    shellContainer.insertAdjacentHTML('beforeend', topbarHtml);
  }

  // Setup sidebar toggle
  const sidebar = document.getElementById('appSidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const toggleBtn = document.getElementById('sidebarToggle');

  function openSidebar() {
    sidebar.classList.add('open');
    backdrop.classList.add('open');
  }
  function closeSidebar() {
    sidebar.classList.remove('open');
    backdrop.classList.remove('open');
  }

  if (toggleBtn) toggleBtn.addEventListener('click', openSidebar);
  if (backdrop) backdrop.addEventListener('click', closeSidebar);

  // Setup month picker
  const monthPicker = document.getElementById('globalMonthPicker');
  if (monthPicker && onMonthChange) {
    monthPicker.addEventListener('change', (e) => onMonthChange(e.target.value));
  }

  // Setup logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => logout());
  }

  // Initialize Lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

/**
 * Toast Notification System
 */
export function showToast(message, type = 'success') {
  let stack = document.getElementById('toastStack');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'toastStack';
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }

  const toast = document.createElement('div');
  toast.className = `toast-sw ${type}`;
  toast.innerHTML = `
    <i data-lucide="${type === 'error' ? 'alert-circle' : type === 'info' ? 'info' : 'check-circle'}" style="width: 18px; height: 18px; flex-shrink: 0; color: ${type === 'error' ? 'var(--sw-danger)' : type === 'info' ? 'var(--sw-accent)' : 'var(--sw-mint-strong)'};"></i>
    <div style="flex: 1;">${message}</div>
  `;
  stack.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();

  setTimeout(() => {
    toast.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}
