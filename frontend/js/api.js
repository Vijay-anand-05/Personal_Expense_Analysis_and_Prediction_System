/**
 * Browser-side API Layer for Personal Expense Analysis and Prediction System.
 * Replaces remote Express backend calls with direct IndexedDB service methods.
 * Preserves the exact same function signatures and response payloads.
 */

import { tx } from './storage/db.js';
import { ensureDatabaseInitialized } from './storage/seed.js';
import * as authService from './services/authService.js';
import * as expenseService from './services/expenseService.js';
import * as categoryService from './services/categoryService.js';
import * as analyticsService from './services/analyticsService.js';
import * as predictionService from './services/predictionService.js';
import { currentMonth, monthRange, addMonths, round2, todayISO } from './services/dateUtils.js';

const appStartTime = Date.now();

// Helper to normalize month parameter whether passed as string or object
function resolveMonth(param) {
  if (!param) return currentMonth();
  if (typeof param === 'string') return param;
  if (typeof param === 'object') return param.month || currentMonth();
  return currentMonth();
}

function resolveRange(params = {}) {
  const m = monthRange(currentMonth());
  return {
    start: params.start_date || m.start,
    end: params.end_date || m.end,
  };
}

export const api = {
  // Authentication & Local Profile Management
  auth: {
    register: (body) => authService.register(body),
    login: (body) => authService.login(body),
    logout: () => authService.logout(),
    me: () => authService.me(),
    changePassword: (body) => authService.changePassword(body),
    updateProfile: (body) => authService.updateProfile(body),
    seedDemo: (options = {}) => authService.seedDemo(options),
  },

  // Health and Storage Status
  health: async () => {
    await ensureDatabaseInitialized();
    return tx(['expenses', 'categories', 'users'], 'readonly', async ([eStore, cStore, uStore]) => {
      const expenses = (await eStore.getAll()).length;
      const categories = (await cStore.getAll()).length;
      const users = (await uStore.getAll()).length;

      return {
        success: true,
        status: 'ok',
        database: {
          connected: true,
          file: 'IndexedDB (Browser Local)',
          expenses,
          categories,
          users,
        },
        uptime_seconds: Math.floor((Date.now() - appStartTime) / 1000),
        environment: 'browser-static',
      };
    });
  },

  // Expense Management
  expenses: {
    list: (params = {}) => expenseService.listExpenses(params),
    get: (id) => expenseService.getExpense(id),
    create: (body) => expenseService.createExpense(body),
    update: (id, body) => expenseService.updateExpense(id, body),
    delete: (id) => expenseService.deleteExpense(id),
    truncate: (scope = 'user') => expenseService.truncateExpenses(scope),
    resetTables: (scope = 'user') => expenseService.resetTables(scope),
    exportCsv: (params = {}) => expenseService.exportExpensesCsv(params),
  },

  // Category Management
  categories: {
    list: () => categoryService.listCategories(),
    create: (body) => categoryService.createCategory(body),
    update: (id, body) => categoryService.updateCategory(id, body),
    delete: (id, reassignTo) => categoryService.deleteCategory(id, reassignTo),
  },

  // Visual Analytics Aggregations
  analytics: {
    dashboard: async (param) => {
      const user = await authService.requireActiveUser();
      const month = resolveMonth(param);
      const { start, end, days } = monthRange(month);
      const elapsed = analyticsService.elapsedDays(month);

      const { categories, expenses } = await analyticsService.getUserDataset(user.id);

      const thisMonth = analyticsService.monthTotalMem(expenses, month);
      const lastMonth = analyticsService.monthTotalMem(expenses, addMonths(month, -1));
      const budget = analyticsService.totalBudgetMem(categories);
      const forecast = predictionService.monthEndMem(categories, expenses, month);

      const daily = analyticsService
        .dailyTotalsMem(expenses, start, end)
        .slice(0, Math.max(elapsed, 0))
        .map((d) => ({ ...d, day: Number(d.date.slice(8, 10)) }));

      return {
        success: true,
        data: {
          month,
          today: todayISO(),
          summary: {
            this_month: thisMonth,
            last_month: lastMonth,
            change_pct: analyticsService.changePct(thisMonth, lastMonth),
            budget,
            budget_remaining: budget > 0 ? round2(budget - thisMonth) : null,
            average_daily: elapsed > 0 ? round2(thisMonth / elapsed) : 0,
            elapsed_days: elapsed,
            days_in_month: days,
            predicted_month_end: forecast.projected,
            forecast_confidence: forecast.confidence.label,
          },
          monthly_trend: analyticsService.monthlyTotalsMem(expenses, addMonths(month, -5), month),
          category_distribution: analyticsService
            .categoryBreakdownMem(categories, expenses, start, end)
            .filter((c) => c.total > 0),
          daily,
          comparison: analyticsService.comparisonMem(categories, expenses, month),
          recent_expenses: analyticsService.recentExpensesMem(categories, expenses, 8),
          insights: predictionService.insightsMem(categories, expenses, month),
        },
      };
    },

    monthly: async (params = {}) => {
      const user = await authService.requireActiveUser();
      const end = params.end_month || currentMonth();
      const start = params.start_month || addMonths(end, -5);

      const { expenses } = await analyticsService.getUserDataset(user.id);
      const data = analyticsService.monthlyTotalsMem(expenses, start, end);
      const total = round2(data.reduce((s, m) => s + m.total, 0));
      const highest = data.reduce((best, m) => (m.total > (best?.total || 0) ? m : best), null);

      return {
        success: true,
        data,
        summary: {
          total,
          average: data.length ? round2(total / data.length) : 0,
          highest_month: highest,
        },
      };
    },

    categories: async (params = {}) => {
      const user = await authService.requireActiveUser();
      const { start, end } = resolveRange(params);
      const { categories, expenses } = await analyticsService.getUserDataset(user.id);

      const breakdown = analyticsService.categoryBreakdownMem(categories, expenses, start, end);
      const total = round2(breakdown.reduce((s, c) => s + c.total, 0));

      return {
        success: true,
        data: {
          start,
          end,
          total,
          categories: breakdown.filter((c) => c.total > 0),
          top_five: breakdown.filter((c) => c.total > 0).slice(0, 5),
          budget_vs_actual: analyticsService.budgetVsActualMem(categories, expenses, start, end),
        },
      };
    },

    daily: async (params = {}) => {
      const user = await authService.requireActiveUser();
      const { start, end } = resolveRange(params);
      const { expenses } = await analyticsService.getUserDataset(user.id);
      const summary = analyticsService.rangeSummaryMem(expenses, start, end);

      return {
        success: true,
        data: {
          ...summary,
          weekly: analyticsService.weeklyTotals(summary.daily),
        },
      };
    },

    comparison: async (param) => {
      const user = await authService.requireActiveUser();
      const month = resolveMonth(param);
      const { categories, expenses } = await analyticsService.getUserDataset(user.id);

      return {
        success: true,
        data: analyticsService.comparisonMem(categories, expenses, month),
      };
    },
  },

  // Predictive Intelligence
  predictions: {
    monthEnd: async (param) => {
      const user = await authService.requireActiveUser();
      const month = resolveMonth(param);
      const { categories, expenses } = await analyticsService.getUserDataset(user.id);

      return {
        success: true,
        data: predictionService.monthEndMem(categories, expenses, month),
      };
    },

    nextMonth: async () => {
      const user = await authService.requireActiveUser();
      const { categories, expenses } = await analyticsService.getUserDataset(user.id);

      return {
        success: true,
        data: predictionService.nextMonthMem(categories, expenses),
      };
    },

    categories: async (param) => {
      const user = await authService.requireActiveUser();
      const month = resolveMonth(param);
      const { categories, expenses } = await analyticsService.getUserDataset(user.id);

      return {
        success: true,
        data: predictionService.categoryForecastMem(categories, expenses, month),
      };
    },

    insights: async (param) => {
      const user = await authService.requireActiveUser();
      const month = resolveMonth(param);
      const { categories, expenses } = await analyticsService.getUserDataset(user.id);

      return {
        success: true,
        data: predictionService.insightsMem(categories, expenses, month),
      };
    },
  },
};
