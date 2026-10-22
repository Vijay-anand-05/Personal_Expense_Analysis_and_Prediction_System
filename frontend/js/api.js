
/**
 * Centralized API client for Personal Expense Analysis and Prediction System.
 * Uses native Fetch API with credentials: 'include' for server-side cookie sessions.
 *
 * IMPORTANT:
 * API_BASE must point to your deployed backend for online authentication.
 * '/api' only works when the API is served from the same origin.
 */

export const API_BASE = '/api';

function cleanParams(params = {}) {
  const out = {};

  for (const [key, value] of Object.entries(params)) {
    if (value !== '' && value !== null && value !== undefined) {
      out[key] = value;
    }
  }

  return out;
}

async function request(endpoint, options = {}) {
  const url = new URL(
    API_BASE + endpoint,
    window.location.origin
  );

  if (options.params) {
    const cleaned = cleanParams(options.params);

    for (const [key, value] of Object.entries(cleaned)) {
      url.searchParams.append(key, value);
    }
  }

  const config = {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      ...(options.headers || {}),
    },
    credentials: 'include',
  };

  if (
    options.body &&
    typeof options.body === 'object' &&
    !(options.body instanceof FormData)
  ) {
    config.headers['Content-Type'] = 'application/json';
    config.body = JSON.stringify(options.body);
  } else if (options.body) {
    config.body = options.body;
  }

  let response;

  try {
    response = await fetch(url.toString(), config);
  } catch (error) {
    throw new Error(
      'Cannot reach the server. Check your internet connection and backend URL.'
    );
  }

  // Handle CSV and other file downloads.
  if (options.responseType === 'blob') {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      throw new Error(
        errorData.message ||
        `Request failed (${response.status})`
      );
    }

    return response.blob();
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // Handle expired sessions without redirecting from auth pages.
    const currentPath = window.location.pathname;
    const isAuthPage =
      currentPath.endsWith('/login.html') ||
      currentPath.endsWith('/signup.html');

    if (response.status === 401 && !isAuthPage) {
      window.location.href = new URL(
        'login.html?expired=1',
        window.location.href
      ).href;
    }

    const error = new Error(
      data.message || `Request failed (${response.status})`
    );

    error.status = response.status;
    error.errors = data.errors;

    throw error;
  }

  return data;
}

export const api = {
  // Authentication
  auth: {
    register: (body) =>
      request('/auth/register', {
        method: 'POST',
        body,
      }),

    login: (body) =>
      request('/auth/login', {
        method: 'POST',
        body,
      }),

    logout: () =>
      request('/auth/logout', {
        method: 'POST',
      }),

    me: () =>
      request('/auth/me'),

    changePassword: (body) =>
      request('/auth/change-password', {
        method: 'POST',
        body,
      }),

    updateProfile: (body) =>
      request('/auth/profile', {
        method: 'PUT',
        body,
      }),

    seedDemo: (options = {}) =>
      request('/auth/seed-demo', {
        method: 'POST',
        body: options,
      }),
  },

  // Health check
  health: () =>
    request('/health'),

  // Expenses
  expenses: {
    list: (params) =>
      request('/expenses', { params }),

    get: (id) =>
      request(`/expenses/${id}`),

    create: (body) =>
      request('/expenses', {
        method: 'POST',
        body,
      }),

    update: (id, body) =>
      request(`/expenses/${id}`, {
        method: 'PUT',
        body,
      }),

    delete: (id) =>
      request(`/expenses/${id}`, {
        method: 'DELETE',
      }),

    truncate: (scope = 'user') =>
      request('/expenses/truncate', {
        method: 'POST',
        body: { scope },
      }),

    resetTables: (scope = 'user') =>
      request('/expenses/reset-tables', {
        method: 'POST',
        body: { scope },
      }),

    exportCsv: (params) =>
      request('/expenses/export', {
        params,
        responseType: 'blob',
      }),
  },

  // Categories
  categories: {
    list: () =>
      request('/categories'),

    create: (body) =>
      request('/categories', {
        method: 'POST',
        body,
      }),

    update: (id, body) =>
      request(`/categories/${id}`, {
        method: 'PUT',
        body,
      }),

    delete: (id, reassignTo) =>
      request(`/categories/${id}`, {
        method: 'DELETE',
        params: { reassign_to: reassignTo },
      }),
  },

  // Analytics
  analytics: {
    dashboard: (month) =>
      request('/analytics/dashboard', {
        params: { month },
      }),

    monthly: (params) =>
      request('/analytics/monthly', { params }),

    categories: (params) =>
      request('/analytics/categories', { params }),

    daily: (params) =>
      request('/analytics/daily', { params }),

    comparison: (month) =>
      request('/analytics/comparison', {
        params: { month },
      }),
  },

  // Predictions
  predictions: {
    monthEnd: (month) =>
      request('/predictions/month-end', {
        params: { month },
      }),

    nextMonth: () =>
      request('/predictions/next-month'),

    categories: (month) =>
      request('/predictions/categories', {
        params: { month },
      }),

    insights: (month) =>
      request('/predictions/insights', {
        params: { month },
      }),
  },
};
