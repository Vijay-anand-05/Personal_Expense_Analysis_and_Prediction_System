/**
 * Dashboard Page Controller
 */
import { api } from '../api.js';
import { requireAuth } from '../auth.js';
import { renderShell, showToast } from '../app.js';
import { inr, formatPct, formatDate, currentMonth, escapeHtml } from '../utils/formatters.js';
import {
  createCategoryDonutChart,
  createMonthlyTrendChart,
  createDailyBarChart,
  createCumulativeComparisonChart,
} from '../utils/charts.js';

let activeMonth = currentMonth();
let chartInstances = {};

export async function initDashboard() {
  const auth = await requireAuth();
  if (!auth) return;

  renderShell({
    activeNav: 'dashboard',
    pageTitle: 'Dashboard',
    pageDesc: 'Summary, spending trends, and statistical projections',
    showMonthPicker: true,
    selectedMonth: activeMonth,
    onMonthChange: (newMonth) => {
      activeMonth = newMonth;
      loadDashboardData();
    },
  });

  await loadDashboardData();
}

async function loadDashboardData() {
  const container = document.getElementById('dashboardContent');
  if (!container) return;

  // Destroy previous charts before recreating
  Object.values(chartInstances).forEach((c) => {
    if (c && typeof c.destroy === 'function') c.destroy();
  });
  chartInstances = {};

  try {
    const res = await api.analytics.dashboard(activeMonth);
    const data = res.data;
    const summary = data.summary;

    const deltaClass = summary.change_pct > 0 ? 'up' : summary.change_pct < 0 ? 'down' : '';
    const deltaIcon = summary.change_pct > 0 ? 'trending-up' : summary.change_pct < 0 ? 'trending-down' : 'minus';

    const budgetUsedPct = summary.budget > 0 ? Math.min(100, Math.round((summary.this_month / summary.budget) * 100)) : 0;
    const budgetStatusClass = budgetUsedPct >= 100 ? 'over' : budgetUsedPct >= 90 ? 'near' : '';

    container.innerHTML = `
      ${
        summary.this_month === 0 && (!data.recent || data.recent.length === 0)
          ? `
        <div class="card-sw p-3 mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3 bg-white">
          <div class="d-flex align-items-center gap-3">
            <div class="cat-chip" style="width: 36px; height: 36px; background: #eef7f1; color: var(--sw-mint-strong);">
              <i data-lucide="sparkles" style="width: 18px; height: 18px;"></i>
            </div>
            <div>
              <div class="fw-semibold small">Welcome to ExpenseWise!</div>
              <div class="text-muted small">Record your first expense, or load sample demo data to preview all dashboard analytics and charts.</div>
            </div>
          </div>
          <div class="d-flex gap-2">
            <a href="pages/expenses.html" class="btn btn-outline-sw btn-sm">Add Expense</a>
            <button class="btn btn-primary btn-sm" id="dashSeedDemoBtn">
              <i data-lucide="sparkles" class="me-1"></i> Load Sample Data
            </button>
          </div>
        </div>
      `
          : ''
      }

      <!-- Metric Cards Row -->
      <div class="row g-3 mb-4">
        <!-- This Month -->
        <div class="col-sm-6 col-xl-3">
          <div class="card-sw metric">
            <div class="eyebrow">This Month</div>
            <div class="stat-value text-truncate">${inr(summary.this_month)}</div>
            <div class="stat-sub d-flex align-items-center gap-1">
              <span class="delta ${deltaClass} d-inline-flex align-items-center gap-1">
                <i data-lucide="${deltaIcon}" style="width: 14px; height: 14px;"></i>
                ${formatPct(summary.change_pct)}
              </span>
              <span class="text-muted-sw">vs last month</span>
            </div>
          </div>
        </div>

        <!-- Budget Remaining -->
        <div class="col-sm-6 col-xl-3">
          <div class="card-sw metric">
            <div class="d-flex justify-content-between align-items-center">
              <div class="eyebrow">Budget Remaining</div>
              ${summary.budget > 0 ? `<span class="badge-sw ${budgetStatusClass}">${budgetUsedPct}% used</span>` : ''}
            </div>
            <div class="stat-value text-truncate ${summary.budget_remaining !== null && summary.budget_remaining < 0 ? 'text-danger' : ''}">
              ${summary.budget > 0 ? inr(summary.budget_remaining) : 'No Budget'}
            </div>
            <div class="stat-sub">
              ${summary.budget > 0 ? `of ${inr(summary.budget)} monthly budget` : 'Set category budgets to track'}
            </div>
            ${summary.budget > 0 ? `
              <div class="progress-sw ${budgetStatusClass} mt-2">
                <span style="width: ${budgetUsedPct}%;"></span>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Daily Average -->
        <div class="col-sm-6 col-xl-3">
          <div class="card-sw metric">
            <div class="eyebrow">Average Daily Spend</div>
            <div class="stat-value text-truncate">${inr(summary.average_daily)}</div>
            <div class="stat-sub">
              over ${summary.elapsed_days} elapsed day${summary.elapsed_days === 1 ? '' : 's'}
            </div>
          </div>
        </div>

        <!-- Projected Month-End -->
        <div class="col-sm-6 col-xl-3">
          <div class="card-sw metric forecast">
            <div class="d-flex justify-content-between align-items-center">
              <div class="eyebrow">Predicted Month-End</div>
              <span class="badge-sw accent">${escapeHtml(summary.forecast_confidence)}</span>
            </div>
            <div class="stat-value text-truncate" style="color: var(--sw-accent-ink);">${inr(summary.predicted_month_end)}</div>
            <div class="stat-sub text-muted-sw">Statistical WMA + pattern blend</div>
          </div>
        </div>
      </div>

      <!-- Charts Section: 6-Month Trend & Category Donut -->
      <div class="row g-3 mb-4">
        <div class="col-lg-8">
          <div class="card-sw h-100">
            <div class="card-head">
              <div>
                <h2>Six-Month Trend</h2>
                <div class="small-label">Monthly total expenditures</div>
              </div>
            </div>
            <div class="card-body-sw" style="height: 280px; position: relative;">
              <canvas id="monthlyTrendChart"></canvas>
            </div>
          </div>
        </div>

        <div class="col-lg-4">
          <div class="card-sw h-100">
            <div class="card-head">
              <div>
                <h2>Category Share</h2>
                <div class="small-label">Spending by category this month</div>
              </div>
            </div>
            <div class="card-body-sw d-flex flex-column" style="min-height: 280px;">
              <div style="height: 180px; position: relative;" class="mb-3">
                <canvas id="categoryDonutChart"></canvas>
              </div>
              <div class="overflow-auto pe-1" style="max-height: 100px;">
                ${data.category_distribution
                  .slice(0, 5)
                  .map(
                    (c) => `
                  <div class="d-flex align-items-center justify-content-between py-1 small">
                    <div class="d-flex align-items-center gap-2 text-truncate me-2">
                      <span class="cat-dot" style="background-color: ${c.color || 'var(--sw-primary)'};"></span>
                      <span class="text-truncate">${escapeHtml(c.name)}</span>
                    </div>
                    <span class="fw-semibold">${inr(c.total)} (${c.percentage}%)</span>
                  </div>
                `
                  )
                  .join('')}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Daily Spending Bars & Cumulative Comparison -->
      <div class="row g-3 mb-4">
        <div class="col-lg-6">
          <div class="card-sw h-100">
            <div class="card-head">
              <div>
                <h2>Daily Expenditure</h2>
                <div class="small-label">Spending by day in ${escapeHtml(data.month)}</div>
              </div>
            </div>
            <div class="card-body-sw" style="height: 250px; position: relative;">
              <canvas id="dailyBarChart"></canvas>
            </div>
          </div>
        </div>

        <div class="col-lg-6">
          <div class="card-sw h-100">
            <div class="card-head">
              <div>
                <h2>Cumulative Comparison</h2>
                <div class="small-label">This month vs previous month cumulative spend</div>
              </div>
            </div>
            <div class="card-body-sw" style="height: 250px; position: relative;">
              <canvas id="cumulativeChart"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Transactions & Insights Row -->
      <div class="row g-3">
        <!-- Recent Transactions -->
        <div class="col-lg-7">
          <div class="card-sw h-100">
            <div class="card-head">
              <div>
                <h2>Recent Transactions</h2>
                <div class="small-label">Latest recorded transactions</div>
              </div>
              <a href="pages/expenses.html" class="btn btn-outline-sw btn-sm">View All</a>
            </div>
            <div class="card-body-sw p-0">
              <div class="table-responsive">
                <table class="table table-sw align-middle mb-0">
                  <thead>
                    <tr>
                      <th class="ps-3">Date</th>
                      <th>Title</th>
                      <th>Category</th>
                      <th>Method</th>
                      <th class="text-end pe-3">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${
                      data.recent_expenses.length === 0
                        ? `<tr><td colspan="5" class="text-center py-4 text-muted small">No recent transactions recorded.</td></tr>`
                        : data.recent_expenses
                            .map(
                              (item) => `
                        <tr>
                          <td class="ps-3 text-nowrap text-muted-sw">${formatDate(item.expense_date)}</td>
                          <td class="fw-semibold text-truncate" style="max-width: 180px;">${escapeHtml(item.title)}</td>
                          <td>
                            <span class="badge-sw" style="background-color: ${item.category_color ? item.category_color + '22' : 'var(--sw-mint)'}; color: ${item.category_color || 'var(--sw-primary)'};">
                              <span class="cat-dot" style="background-color: ${item.category_color || 'var(--sw-primary)'};"></span>
                              ${escapeHtml(item.category_name)}
                            </span>
                          </td>
                          <td class="text-muted-sw small">${escapeHtml(item.payment_method)}</td>
                          <td class="text-end pe-3 amount">${inr(item.amount)}</td>
                        </tr>
                      `
                            )
                            .join('')
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- Insights & Cost Reduction -->
        <div class="col-lg-5">
          <div class="card-sw h-100">
            <div class="card-head">
              <div>
                <h2>Smart Insights</h2>
                <div class="small-label">Rule-based patterns & recommendations</div>
              </div>
            </div>
            <div class="card-body-sw">
              ${
                data.insights && data.insights.insights && data.insights.insights.length > 0
                  ? data.insights.insights
                      .slice(0, 4)
                      .map(
                        (ins) => `
                    <div class="insight">
                      <span class="insight-dot ${ins.tone || 'info'}"></span>
                      <div>
                        <div class="insight-title">${escapeHtml(ins.title)}</div>
                        <div class="insight-msg">${escapeHtml(ins.message)}</div>
                      </div>
                    </div>
                  `
                      )
                      .join('')
                  : `<div class="text-muted small py-3 text-center">Record more expenses across completed months to generate trend comparisons and insights.</div>`
              }
            </div>
          </div>
        </div>
      </div>
    `;

    // Re-initialize Lucide icons
    if (window.lucide) window.lucide.createIcons();

    // Render Charts
    const trendEl = document.getElementById('monthlyTrendChart');
    if (trendEl && data.monthly_trend) {
      chartInstances.trend = createMonthlyTrendChart(trendEl, data.monthly_trend);
    }

    const donutEl = document.getElementById('categoryDonutChart');
    if (donutEl && data.category_distribution) {
      chartInstances.donut = createCategoryDonutChart(donutEl, data.category_distribution);
    }

    const dailyEl = document.getElementById('dailyBarChart');
    if (dailyEl && data.daily) {
      chartInstances.daily = createDailyBarChart(dailyEl, data.daily);
    }

    const cumEl = document.getElementById('cumulativeChart');
    if (cumEl && data.comparison && data.comparison.cumulative) {
      chartInstances.cumulative = createCumulativeComparisonChart(cumEl, data.comparison.cumulative);
    }

    document.getElementById('dashSeedDemoBtn')?.addEventListener('click', async () => {
      const btn = document.getElementById('dashSeedDemoBtn');
      btn.disabled = true;
      try {
        const res = await api.auth.seedDemo();
        showToast(res.message || 'Sample data loaded successfully');
        loadDashboardData();
      } catch (err) {
        showToast('Failed to seed demo data: ' + err.message, 'error');
        btn.disabled = false;
      }
    });
  } catch (err) {
    container.innerHTML = `
      <div class="alert alert-danger" role="alert">
        <i data-lucide="alert-triangle" class="me-2" style="width: 18px; height: 18px;"></i>
        Failed to load dashboard: ${escapeHtml(err.message)}
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
  }
}
