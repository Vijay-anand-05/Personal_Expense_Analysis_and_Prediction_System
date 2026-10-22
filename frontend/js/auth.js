/**
 * Authentication management and page route protection for frontend
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
    const currentPath = window.location.pathname + window.location.search;
    window.location.href = `/login.html?returnUrl=${encodeURIComponent(currentPath)}`;
    return null;
  }
  return auth;
}

export async function redirectIfAuth() {
  const auth = await checkAuth();
  if (auth) {
    const params = new URLSearchParams(window.location.search);
    const returnUrl = params.get('returnUrl') || '/index.html';
    window.location.href = returnUrl;
    return true;
  }
  return false;
}

export async function logout() {
  try {
    await api.auth.logout();
  } catch (err) {
    // Proceed to redirect anyway
  }
  currentUser = null;
  currentSettings = null;
  window.location.href = '/login.html';
}

export function getCurrentUser() {
  return currentUser;
}

export function getCurrentSettings() {
  return currentSettings;
}
