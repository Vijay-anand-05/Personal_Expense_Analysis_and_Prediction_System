/**
 * Authentication management and page route protection for browser application.
 * Fully compatible with GitHub Pages subpaths and relative routing.
 */

import { api } from './api.js';

let currentUser = null;
let currentSettings = null;

export async function checkAuth() {
  try {
    const res = await api.auth.me();
    if (res.success && res.data && res.data.user) {
      currentUser = res.data.user;
      currentSettings = res.data.settings;
      return { user: currentUser, settings: currentSettings };
    }
  } catch (err) {
    currentUser = null;
    currentSettings = null;
  }
  return null;
}

export async function requireAuth() {
  const auth = await checkAuth();
  if (!auth) {
    const isPagesDir = window.location.pathname.includes('/pages/');
    const prefix = isPagesDir ? '../' : '';
    const currentFilename = window.location.pathname.split('/').pop() || 'index.html';
    const currentQuery = window.location.search || '';
    const returnTarget = (isPagesDir ? 'pages/' : '') + currentFilename + currentQuery;

    window.location.href = `${prefix}login.html?returnUrl=${encodeURIComponent(returnTarget)}`;
    return null;
  }
  return auth;
}

export async function redirectIfAuth() {
  const auth = await checkAuth();
  if (auth) {
    const isPagesDir = window.location.pathname.includes('/pages/');
    const defaultUrl = isPagesDir ? '../index.html' : 'index.html';
    const params = new URLSearchParams(window.location.search);
    const returnUrl = params.get('returnUrl');

    const safeUrl =
      returnUrl &&
      !returnUrl.startsWith('/') &&
      !returnUrl.includes('://') &&
      !returnUrl.startsWith('//')
        ? (isPagesDir && !returnUrl.startsWith('../') ? `../${returnUrl}` : returnUrl)
        : defaultUrl;

    window.location.href = safeUrl;
    return true;
  }
  return false;
}

export async function logout() {
  try {
    await api.auth.logout();
  } catch (err) {
    // Ignore error and clear local session state
  }
  currentUser = null;
  currentSettings = null;
  const isPagesDir = window.location.pathname.includes('/pages/');
  window.location.href = isPagesDir ? '../login.html' : 'login.html';
}

export function getCurrentUser() {
  return currentUser;
}

export function getCurrentSettings() {
  return currentSettings;
}
