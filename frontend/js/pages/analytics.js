/**
 * Analytics Page Controller
 */
import { api } from '../api.js';
import { requireAuth } from '../auth.js';
import { renderShell, showToast } from '../app.js';
import { inr, formatDate, downloadBlob, escapeHtml, todayISO, currentMonth } from '../utils/formatters.js';

let chartInstances = {};
let currentRange = {
  start: '',
  end: '',
};

export async function initAnalytics() {
  const auth = await requireAuth();
  if (!auth) return;

  renderShell({
    activeNav: 'analytics',
    pageTitle: 'Analytics',
    pageDesc: 'Multi-period spending patterns, category shares, and budget performance',
  });

  // Default to Last 30 Days / This Month
  setPreset('this_month');
  bindEvents();
  await loadAnalytics();
}

function setPreset(preset) {
  const today = todayISO();
  const d = new Date();

  if (preset === 'this_month') {
    const ym = currentMonth();
    currentRange.start = `${ym}-01`;
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    currentRange.end = `${ym}-${String(lastDay).padStart(2, '0')}`;
  } else if (preset === 'last_month') {
    const prevDate = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const ym = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    const lastDay = new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 0).getDate();
    currentRange.start = `${ym}-01`;
    currentRange.end = `${ym}-${String(lastDay).padStart(2, '0')}`;
  } else if (preset === 'last_90') {
    const past = new Date(d.getTime() - 90 * 24 * 60 * 60 * 1000);
    currentRange.start = past.toISOString().slice(0, 10);
    currentRange.end = today;
  } else if (preset === 'this_year') {
    currentRange.start = `${d.getFullYear()}-01-01`;
    currentRange.end = `${d.getFullYear()}-12-31`;
  }

  const startEl = document.getElementById('analyticsStartDate');
  const endEl = document.getElementById('analyticsEndDate');
  if (startEl) startEl.value = currentRange.start;
  if (endEl) endEl.value = currentRange.end;

  document.querySelectorAll('.preset-btn').forEach((btn) => {
    if (btn.dataset.preset === preset) btn.classList.add('active');
    else btn.classList.remove('active');
  });
}

function bindEvents() {
  document.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      setPreset(btn.dataset.preset);
      loadAnalytics();
    });
  });

  const startEl = document.getElementById('analyticsStartDate');
  const endEl = document.getElementById('analyticsEndDate');

  const onCustomDateChange = () => {
    if (startEl.value && endEl.value) {
      if (endEl.value < startEl.value) {
        showToast('End date cannot be earlier than start date', 'error');
        return;
      }
      currentRange.start = startEl.value;
      currentRange.end = endEl.value;
      document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('active'));
      loadAnalytics();
    }
  };

  startEl?.addEventListener('change', onCustomDateChange);
  endEl?.addEventListener('change', onCustomDateChange);

  document.getElementById('analyticsExportCsvBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('analyticsExportCsvBtn');
    btn.disabled = true;
    try {
      const blob = await api.expenses.exportCsv({
        start_date: currentRange.start,
        end_date: currentRange.end,
      });
      downloadBlob(blob, `expenses-${currentRange.start}-to-${currentRange.end}.csv`);
      showToast('CSV report exported');
    } catch (err) {
      showToast('Export failed: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

async function loadAnalytics() {
  const container = document.getElementById('analyticsContent');
  if (!container) return;

  // Clear previous charts
  Object.values(chartInstances).forEach((c) => {
    if (c && typeof c.destroy === 'function') c.destroy();
  });
  chartInstances = {};

  container.innerHTML = `
    <div class="text-center py-5 text-muted">
      <div class="spinner-border text-success" role="status"></div>
      <div class="mt-2 small">Aggregating analytics data…</div>
    </div>
  `;

  try {
    const [dailyRes, catRes] = await Promise.all([
      api.analytics.daily({ start_date: currentRange.start, end_date: currentRange.end }),
      api.analytics.categories({ start_date: currentRange.start, end_date: currentRange.end }),
    ]);

    const dailyData = dailyRes.data;
    const catData = catRes.data;

    container.innerHTML = `
      ${
        dailyData.total === 0
          ? `
        <div class="card-sw p-3 mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3 bg-white">
          <div class="d-flex align-items-center gap-3">
            <div class="cat-chip" style="width: 36px; height: 36px; background: #eef7f1; color: var(--sw-mint-strong);">
              <i data-lucide="sparkles" style="width: 18px; height: 18px;"></i>
            </div>
            <div>
              <div class="fw-semibold small">No expenses recorded for this date range</div>
              <div class="text-muted small">Record transactions on the Expenses page, or load sample data to explore analytics instantly.</div>
            </div>
          </div>
          <button class="btn btn-primary btn-sm" id="analyticsSeedDemoBtn">
            <i data-lucide="sparkles" class="me-1"></i> Load Sample Data
          </button>
        </div>
      `
          : ''
      }

      <!-- Metric Cards -->
      <div class="row g-3 mb-4">
        <div class="col-sm-6 col-lg-3">
          <div class="card-sw metric">
            <div class="eyebrow">Total Spending</div>
            <div class="stat-value text-truncate">${inr(dailyData.total)}</div>
            <div class="stat-sub">${dailyData.count} transaction${dailyData.count === 1 ? '' : 's'}</div>
          </div>
        </div>
        <div class="col-sm-6 col-lg-3">
          <div class="card-sw metric">
            <div class="eyebrow">Average Daily Spend</div>
            <div class="stat-value text-truncate">${inr(dailyData.average_daily)}</div>
            <div class="stat-sub">across ${dailyData.days} days in range</div>
          </div>
        </div>
        <div class="col-sm-6 col-lg-3">
          <div class="card-sw metric">
            <div class="eyebrow">Highest Day</div>
            <div class="stat-value text-truncate">${dailyData.highest_day ? inr(dailyData.highest_day.total) : '₹0'}</div>
            <div class="stat-sub text-muted-sw">${dailyData.highest_day ? formatDate(dailyData.highest_day.date) : 'No spend'}</div>
          </div>
        </div>
        <div class="col-sm-6 col-lg-3">
          <div class="card-sw metric">
            <div class="eyebrow">Active Categories</div>
            <div class="stat-value text-truncate">${catData.categories.length}</div>
            <div class="stat-sub">with recorded expenses</div>
          </div>
        </div>
      </div>

      <!-- Daily / Weekly Spending Trend -->
      <div class="row g-3 mb-4">
        <div class="col-lg-8">
          <div class="card-sw h-100">
            <div class="card-head">
              <div>
                <h2>Spending Timeline</h2>
                <div class="small-label">Daily trend across selected period</div>
              </div>
            </div>
            <div class="card-body-sw" style="height: 300px; position: relative;">
              <canvas id="timelineChart"></canvas>
            </div>
          </div>
        </div>
        <div class="col-lg-4">
          <div class="card-sw h-100">
            <div class="card-head">
              <div>
                <h2>Top 5 Expense Drivers</h2>
                <div class="small-label">Highest spending categories</div>
              </div>
            </div>
            <div class="card-body-sw">
              ${
                catData.top_five.length === 0
                  ? `<div class="text-muted small py-4 text-center">No expenses in this range.</div>`
                  : catData.top_five
                      .map(
                        (c) => `
                    <div class="mb-3">
                      <div class="d-flex justify-content-between align-items-center mb-1 small">
                        <span class="fw-semibold text-truncate me-2">${escapeHtml(c.name)}</span>
                        <span>${inr(c.total)} (${c.percentage}%)</span>
                      </div>
                      <div class="progress-sw">
                        <span style="width: ${c.percentage}%; background-color: ${c.color || 'var(--sw-primary)'};"></span>
                      </div>
                    </div>
                  `
                      )
                      .join('')
              }
            </div>
          </div>
        </div>
      </div>

      <!-- Budget vs Actual Performance -->
      <div class="card-sw p-0 mb-4">
        <div class="card-head px-3 pt-3">
          <div>
            <h2>Budget vs Actual Performance</h2>
            <div class="small-label">Compare actual spend against period budgets</div>
          </div>
        </div>
        <div class="table-responsive">
          <table class="table table-sw align-middle mb-0">
            <thead>
              <tr>
                <th class="ps-3">Category</th>
                <th>Period Budget</th>
                <th>Actual Spent</th>
                <th>Remaining</th>
                <th>Used %</th>
                <th class="text-end pe-3">Status</th>
              </tr>
            </thead>
            <tbody>
              ${
                catData.budget_vs_actual.length === 0
                  ? `<tr><td colspan="6" class="text-center py-4 text-muted small">No category budgets defined.</td></tr>`
                  : catData.budget_vs_actual
                      .map(
                        (b) => `
                    <tr>
                      <td class="ps-3 fw-semibold">
                        <span class="cat-dot me-2" style="background-color: ${b.color || 'var(--sw-primary)'};"></span>
                        ${escapeHtml(b.name)}
                      </td>
                      <td>${b.budget > 0 ? inr(b.budget) : '—'}</td>
                      <td class="amount">${inr(b.actual)}</td>
                      <td class="${b.remaining < 0 ? 'text-danger fw-semibold' : ''}">${b.budget > 0 ? inr(b.remaining) : '—'}</td>
                      <td>
                        ${
                          b.used_pct !== null
                            ? `
                          <div class="d-flex align-items-center gap-2" style="max-width: 140px;">
                            <div class="progress-sw w-100 ${b.over_budget ? 'over' : b.used_pct >= 90 ? 'near' : ''}">
                              <span style="width: ${Math.min(100, b.used_pct)}%;"></span>
                            </div>
                            <span class="small-label">${b.used_pct}%</span>
                          </div>
                        `
                            : '—'
                        }
                      </td>
                      <td class="text-end pe-3">
                        ${
                          b.over_budget
                            ? `<span class="badge-sw danger">Over Budget</span>`
                            : b.used_pct >= 90
                            ? `<span class="badge-sw accent">Near Limit</span>`
                            : `<span class="badge-sw">On Track</span>`
                        }
                      </td>
                    </tr>
                  `
                      )
                      .join('')
              }
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Render Timeline Chart
    const timelineEl = document.getElementById('timelineChart');
    if (timelineEl && dailyData.daily) {
      const labels = dailyData.daily.map((d) => d.date.slice(5));
      const data = dailyData.daily.map((d) => d.total);
      chartInstances.timeline = new Chart(timelineEl.getContext('2d'), {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Daily Spend',
              data,
              borderColor: '#173F35',
              backgroundColor: 'rgba(23, 63, 53, 0.08)',
              borderWidth: 2,
              pointRadius: 3,
              pointHoverRadius: 5,
              fill: true,
              tension: 0.3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: (items) => `Date: ${dailyData.daily[items[0].dataIndex].date}`,
                label: (item) => ` Spend: ${inr(item.raw)}`,
              },
            },
          },
          scales: {
            x: { grid: { display: false }, ticks: { maxRotation: 45, maxTicksLimit: 15 } },
            y: {
              beginAtZero: true,
              min: 0,
              suggestedMax: 1000,
              grid: { color: '#E4E9E3' },
              ticks: { callback: (v) => '₹' + (v >= 1000 ? Math.round(v / 1000) + 'k' : v) },
            },
          },
        },
      });
    }

    // Bind sample data button if present
    document.getElementById('analyticsSeedDemoBtn')?.addEventListener('click', async () => {
      const btn = document.getElementById('analyticsSeedDemoBtn');
      btn.disabled = true;
      try {
        const res = await api.auth.seedDemo();
        showToast(res.message || 'Sample data loaded successfully');
        loadAnalytics();
      } catch (err) {
        showToast('Failed to seed demo data: ' + err.message, 'error');
        btn.disabled = false;
      }
    });

    if (window.lucide) window.lucide.createIcons();
  } catch (err) {
    container.innerHTML = `<div class="alert alert-danger" role="alert">Failed to load analytics: ${escapeHtml(err.message)}</div>`;
  }
}
