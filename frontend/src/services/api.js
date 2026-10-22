import { api as browserApi } from '../../js/api.js';

export const API_BASE = 'browser-local';

/** Turns any error into a readable message for the UI. */
export function getErrorMessage(err) {
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.message) return err.message;
  return 'An unexpected error occurred.';
}

export const api = {
  health: () => browserApi.health(),

  getExpenses: (params) => browserApi.expenses.list(params),
  createExpense: (body) => browserApi.expenses.create(body),
  updateExpense: (id, body) => browserApi.expenses.update(id, body),
  deleteExpense: (id) => browserApi.expenses.delete(id),
  truncateExpenses: (scope = 'user') => browserApi.expenses.truncate(scope),
  resetTables: (scope = 'user') => browserApi.expenses.resetTables(scope),
  seedDemo: (options = {}) => browserApi.auth.seedDemo(options),
  exportExpensesCsv: (params) => browserApi.expenses.exportCsv(params),

  getCategories: () => browserApi.categories.list(),
  createCategory: (body) => browserApi.categories.create(body),
  updateCategory: (id, body) => browserApi.categories.update(id, body),
  deleteCategory: (id, reassignTo) => browserApi.categories.delete(id, reassignTo),

  getDashboard: (month) => browserApi.analytics.dashboard(month),
  getMonthly: (params) => browserApi.analytics.monthly(params),
  getCategoryAnalytics: (params) => browserApi.analytics.categories(params),
  getDaily: (params) => browserApi.analytics.daily(params),
  getComparison: (month) => browserApi.analytics.comparison(month),

  getMonthEnd: (month) => browserApi.predictions.monthEnd(month),
  getNextMonth: () => browserApi.predictions.nextMonth(),
  getCategoryForecast: (month) => browserApi.predictions.categories(month),
  getInsights: (month) => browserApi.predictions.insights(month),
};

