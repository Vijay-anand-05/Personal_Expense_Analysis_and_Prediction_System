/**
 * Centralized API client for Personal Expense Analysis and Prediction System.
 * Uses native Fetch API with credentials: 'include' for server-side cookie sessions.
 */

const url = new URL(API_BASE + endpoint, window.location.origin);

function cleanParams(params = {}) {
  const out = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== '' && v !== null && v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

async function request(endpoint, options = {}) {
  const url = new URL(API_BASE + endpoint, window.location.origin);
  if (options.params) {
    const cleaned = cleanParams(options.params);
    for (const [k, v] of Object.entries(cleaned)) {
      url.searchParams.append(k, v);
    }
  }

  const config = {
    method: options.method || 'GET',
    headers: {
      'Accept': 'application/json',
      ...(options.headers || {}),
    },
    credentials: 'include',
  };

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json';
    config.body = JSON.stringify(options.body);
  } else if (options.body) {
    config.body = options.body;
  }

  let res;
  try {
    res = await fetch(url.toString(), config);
  } catch (err) {
    throw new Error('Cannot reach the server. Make sure the backend is running.');
  }

  // Handle CSV / Blob downloads
  if (options.responseType === 'blob') {
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || `Request failed with status ${res.status}`);
    }
    return res.blob();
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Session expiration interception (skip if already on auth pages)
    if (res.status === 401 && !window.location.pathname.includes('login.html') && !window.location.pathname.includes('signup.html')) {
      window.location.href = '/login.html?expired=1';
    }
    const message = data.message || `Request failed (${res.status})`;
    const error = new Error(message);
    error.status = res.status;
    error.errors = data.errors;
    throw error;
  }

  return data;
}

export const api = {
  // Authentication
  auth: {
    register: (body) => request('/auth/register', { method: 'POST', body }),
    login: (body) => request('/auth/login', { method: 'POST', body }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    me: () => request('/auth/me'),
    changePassword: (body) => request('/auth/change-password', { method: 'POST', body }),
    updateProfile: (body) => request('/auth/profile', { method: 'PUT', body }),
    seedDemo: (options = {}) => request('/auth/seed-demo', { method: 'POST', body: options }),
  },

  // Health
  health: () => request('/health'),

  // Expenses
  expenses: {
    list: (params) => request('/expenses', { params }),
    get: (id) => request(`/expenses/${id}`),
    create: (body) => request('/expenses', { method: 'POST', body }),
    update: (id, body) => request(`/expenses/${id}`, { method: 'PUT', body }),
    delete: (id) => request(`/expenses/${id}`, { method: 'DELETE' }),
    truncate: (scope = 'user') => request('/expenses/truncate', { method: 'POST', body: { scope } }),
    resetTables: (scope = 'user') => request('/expenses/reset-tables', { method: 'POST', body: { scope } }),
    exportCsv: (params) => request('/expenses/export', { params, responseType: 'blob' }),
  },

  // Categories
  categories: {
    list: () => request('/categories'),
    create: (body) => request('/categories', { method: 'POST', body }),
    update: (id, body) => request(`/categories/${id}`, { method: 'PUT', body }),
    delete: (id, reassignTo) =>
      request(`/categories/${id}`, { method: 'DELETE', params: { reassign_to: reassignTo } }),
  },

  // Analytics
  analytics: {
    dashboard: (month) => request('/analytics/dashboard', { params: { month } }),
    monthly: (params) => request('/analytics/monthly', { params }),
    categories: (params) => request('/analytics/categories', { params }),
    daily: (params) => request('/analytics/daily', { params }),
    comparison: (month) => request('/analytics/comparison', { params: { month } }),
  },

  // Predictions
  predictions: {
    monthEnd: (month) => request('/predictions/month-end', { params: { month } }),
    nextMonth: () => request('/predictions/next-month'),
    categories: (month) => request('/predictions/categories', { params: { month } }),
    insights: (month) => request('/predictions/insights', { params: { month } }),
  },
};
