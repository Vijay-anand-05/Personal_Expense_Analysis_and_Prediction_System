import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const client = axios.create({ baseURL: API_BASE, timeout: 15000 });

/** Turns any axios error into a readable message for the UI. */
export function getErrorMessage(err) {
  if (err.response) return err.response.data?.message || `Request failed (${err.response.status})`;
  if (err.code === 'ECONNABORTED') return 'The server took too long to respond.';
  return 'Cannot reach the server. Make sure the backend is running on port 5000.';
}

// Drop empty filter values so they are not sent as "?search=".
const clean = (params = {}) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined));

const get = (url, params) => client.get(url, { params: clean(params) }).then((r) => r.data);

export const api = {
  health: () => get('/health'),

  getExpenses: (params) => get('/expenses', params),
  createExpense: (body) => client.post('/expenses', body).then((r) => r.data),
  updateExpense: (id, body) => client.put(`/expenses/${id}`, body).then((r) => r.data),
  deleteExpense: (id) => client.delete(`/expenses/${id}`).then((r) => r.data),
  truncateExpenses: (scope = 'user') => client.post('/expenses/truncate', { scope }).then((r) => r.data),
  resetTables: (scope = 'user') => client.post('/expenses/reset-tables', { scope }).then((r) => r.data),
  seedDemo: (options = {}) => client.post('/auth/seed-demo', options).then((r) => r.data),
  exportExpensesCsv: (params) =>
    client.get('/expenses/export', { params: clean(params), responseType: 'blob' }).then((r) => r.data),

  getCategories: () => get('/categories'),
  createCategory: (body) => client.post('/categories', body).then((r) => r.data),
  updateCategory: (id, body) => client.put(`/categories/${id}`, body).then((r) => r.data),
  deleteCategory: (id, reassignTo) =>
    client.delete(`/categories/${id}`, { params: clean({ reassign_to: reassignTo }) }).then((r) => r.data),

  getDashboard: (month) => get('/analytics/dashboard', { month }),
  getMonthly: (params) => get('/analytics/monthly', params),
  getCategoryAnalytics: (params) => get('/analytics/categories', params),
  getDaily: (params) => get('/analytics/daily', params),
  getComparison: (month) => get('/analytics/comparison', { month }),

  getMonthEnd: (month) => get('/predictions/month-end', { month }),
  getNextMonth: () => get('/predictions/next-month'),
  getCategoryForecast: (month) => get('/predictions/categories', { month }),
  getInsights: (month) => get('/predictions/insights', { month }),
};
