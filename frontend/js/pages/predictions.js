/**
 * Predictions Page Controller
 */
import { api } from '../api.js';
import { requireAuth } from '../auth.js';
import { renderShell, showToast } from '../app.js';
import { inr, currentMonth, escapeHtml } from '../utils/formatters.js';
import { createPredictionForecastChart } from '../utils/charts.js';

let activeMonth = currentMonth();
let chartInstance = null;

export async function initPredictions() {
  const auth = await requireAuth();
  if (!auth) return;

  renderShell({
    activeNav: 'predictions',
    pageTitle: 'Predictions & Forecasts',
    pageDesc: 'Statistical estimates based on weighted moving averages and spending patterns',
    showMonthPicker: true,
    selectedMonth: activeMonth,
    onMonthChange: (m) => {
      activeMonth = m;
      loadPredictions();
    },
  });

  await loadPredictions();
}

async function loadPredictions() {
  const container = document.getElementById('predictionsContent');
  if (!container) return;

  if (chartInstance && typeof chartInstance.destroy === 'function') {
    chartInstance.destroy();
    chartInstance = null;
  }

  container.innerHTML = `
    <div class="text-center py-5 text-muted">
      <div class="spinner-border text-success" role="status"></div>
      <div class="mt-2 small">Calculating statistical forecasts…</div>
    </div>
  `;

  try {
    const [monthEndRes, nextMonthRes, catForecastRes, insightsRes] = await Promise.all([
      api.predictions.monthEnd(activeMonth),
      api.predictions.nextMonth(),
      api.predictions.categories(activeMonth),
      api.predictions.insights(activeMonth),
    ]);

    const me = monthEndRes.data;
    const nm = nextMonthRes.data;
    const cf = catForecastRes.data;
    const ins = insightsRes.data;

    container.innerHTML = `
      ${
        me.spent === 0
          ? `
        <div class="card-sw p-3 mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3 bg-white">
          <div class="d-flex align-items-center gap-3">
            <div class="cat-chip" style="width: 36px; height: 36px; background: #eef7f1; color: var(--sw-mint-strong);">
              <i data-lucide="sparkles" style="width: 18px; height: 18px;"></i>
            </div>
            <div>
              <div class="fw-semibold small">No expenses recorded for ${escapeHtml(me.month)} yet</div>
              <div class="text-muted small">Record transactions or load sample data to see the 3-tier forecasting model and trajectory predictions.</div>
            </div>
          </div>
          <button class="btn btn-primary btn-sm" id="predSeedDemoBtn">
            <i data-lucide="sparkles" class="me-1"></i> Load Sample Data
          </button>
        </div>
      `
          : ''
      }

      <!-- Hero Forecast Banner (Minimalist) -->
      <div class="card-sw hero-forecast mb-4">
        <div class="row align-items-center g-3">
          <div class="col-lg-7">
            <div class="d-flex align-items-center gap-2 mb-2">
              <span class="eyebrow">Month-End Projected Spending (${escapeHtml(me.month)})</span>
              <span class="badge-sw neutral">${escapeHtml(me.confidence.label)}</span>
            </div>
            <div class="hero-value">${inr(me.projected)}</div>
            <div class="text-muted-sw small mt-2">
              Spent <strong>${inr(me.spent)}</strong> to date over ${me.elapsed_days} of ${me.days_in_month} days (${me.remaining_days} days left).
            </div>
            <p class="small text-muted mb-0 mt-1">${escapeHtml(me.method)}</p>
          </div>
          <div class="col-lg-5">
            <div class="p-3 bg-white rounded-3 border" style="border-color: #f0f3ef !important;">
              <div class="d-flex justify-content-between mb-2 small">
                <span class="text-muted-sw">Pace Extrapolation:</span>
                <span class="fw-semibold amount">${inr(me.baseline_projection)}</span>
              </div>
              <div class="d-flex justify-content-between mb-2 small">
                <span class="text-muted-sw">Historical WMA:</span>
                <span class="fw-semibold">${me.historical_average ? inr(me.historical_average) : '—'}</span>
              </div>
              <div class="d-flex justify-content-between small">
                <span class="text-muted-sw">Intra-Month Pattern:</span>
                <span class="fw-semibold">${me.typical_fraction_spent ? me.typical_fraction_spent + '% spent by now' : 'Standard'}</span>
              </div>
            </div>
          </div>
        </div>
        ${
          me.notes && me.notes.length > 0
            ? `
          <div class="notice-box info mt-3">
            <i data-lucide="info" style="width: 16px; height: 16px; flex-shrink: 0;"></i>
            <div>${escapeHtml(me.notes.join(' '))}</div>
          </div>
        `
            : ''
        }
      </div>

      <!-- Forecast Chart & Next Month Card -->
      <div class="row g-3 mb-4">
        <div class="col-lg-8">
          <div class="card-sw h-100">
            <div class="card-head">
              <div>
                <h2>Historical vs Forecasted Trajectory</h2>
                <div class="small-label">Past completed months and projected future spending</div>
              </div>
            </div>
            <div class="card-body-sw" style="height: 300px; position: relative;">
              <canvas id="predictionChart"></canvas>
            </div>
          </div>
        </div>
        <div class="col-lg-4">
          <div class="card-sw h-100">
            <div class="card-head">
              <div>
                <h2>Next-Month Forecast</h2>
                <div class="small-label">Estimate for ${escapeHtml(nm.month)}</div>
              </div>
            </div>
            <div class="card-body-sw">
              <div class="stat-value text-truncate mb-1" style="color: var(--sw-primary);">
                ${nm.forecast ? inr(nm.forecast) : '—'}
              </div>
              <div class="stat-sub text-muted-sw mb-3">
                ${nm.message ? escapeHtml(nm.message) : 'Calculated using 3-month weighted moving average (50% / 30% / 20%).'}
              </div>

              ${
                nm.budget > 0
                  ? `
                <div class="border-top pt-3">
                  <div class="d-flex justify-content-between small mb-1">
                    <span class="text-muted-sw">Total Budget:</span>
                    <span class="fw-semibold">${inr(nm.budget)}</span>
                  </div>
                  <div class="d-flex justify-content-between small mb-2">
                    <span class="text-muted-sw">Budget Status:</span>
                    <span class="badge-sw ${nm.over_budget ? 'danger' : 'success'}">
                      ${nm.over_budget ? 'Over Budget Risk' : 'Within Budget'}
                    </span>
                  </div>
                </div>
              `
                  : ''
              }
            </div>
          </div>
        </div>
      </div>

      <!-- Category Forecasts & Budget Overruns -->
      <div class="card-sw p-0 mb-4">
        <div class="card-head px-3 pt-3">
          <div>
            <h2>Category Predictions & Overrun Alerts</h2>
            <div class="small-label">Predicted month-end total per category</div>
          </div>
        </div>
        <div class="table-responsive">
          <table class="table table-sw align-middle mb-0">
            <thead>
              <tr>
                <th class="ps-3">Category</th>
                <th>Spent to Date</th>
                <th>Predicted Month-End</th>
                <th>Monthly Budget</th>
                <th>Projected Overrun</th>
                <th class="text-end pe-3">Budget Status</th>
              </tr>
            </thead>
            <tbody>
              ${
                cf.categories.length === 0
                  ? `<tr><td colspan="6" class="text-center py-4 text-muted small">No expenses recorded for this month.</td></tr>`
                  : cf.categories
                      .map(
                        (c) => `
                    <tr>
                      <td class="ps-3 fw-semibold">
                        <span class="cat-dot me-2" style="background-color: ${c.color || 'var(--sw-primary)'};"></span>
                        ${escapeHtml(c.name)}
                      </td>
                      <td class="amount">${inr(c.spent)}</td>
                      <td class="amount fw-bold" style="color: ${c.status === 'over' ? 'var(--sw-danger)' : 'var(--sw-text)'};">${inr(c.projected)}</td>
                      <td>${c.budget > 0 ? inr(c.budget) : '—'}</td>
                      <td class="${c.overrun > 0 ? 'text-danger fw-semibold' : 'text-muted-sw'}">${c.overrun > 0 ? '+' + inr(c.overrun) : '₹0'}</td>
                      <td class="text-end pe-3">
                        ${
                          c.status === 'over'
                            ? `<span class="badge-sw danger">Over Budget</span>`
                            : c.status === 'near'
                            ? `<span class="badge-sw accent">Near Budget</span>`
                            : c.budget > 0
                            ? `<span class="badge-sw">On Track</span>`
                            : `<span class="badge-sw neutral">No Budget</span>`
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

      <!-- Actionable Cost Reduction Suggestions -->
      <div class="card-sw mb-4">
        <div class="card-head">
          <div>
            <h2>Actionable Cost-Reduction Suggestions</h2>
            <div class="small-label">Personalized suggestions derived from your spending data</div>
          </div>
        </div>
        <div class="card-body-sw">
          ${
            ins.suggestions && ins.suggestions.length > 0
              ? `
            <div class="row g-3">
              ${ins.suggestions
                .map(
                  (s) => `
                <div class="col-md-4">
                  <div class="p-3 bg-light rounded-3 h-100 border">
                    <div class="d-flex align-items-center justify-content-between mb-2">
                      <h3 class="h6 mb-0 fw-bold">${escapeHtml(s.title)}</h3>
                      ${s.estimated_saving ? `<span class="badge-sw accent">Save ~${inr(s.estimated_saving)}</span>` : ''}
                    </div>
                    <p class="small text-muted mb-0">${escapeHtml(s.message)}</p>
                  </div>
                </div>
              `
                )
                .join('')}
            </div>
            ${ins.suggestions_note ? `<div class="small-label text-muted-sw mt-3">${escapeHtml(ins.suggestions_note)}</div>` : ''}
          `
              : `<div class="text-muted small py-3 text-center">Keep recording expenses to generate customized cost-cutting suggestions.</div>`
          }
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // Render Prediction Chart
    const chartEl = document.getElementById('predictionChart');
    if (chartEl && nm.chart) {
      chartInstance = createPredictionForecastChart(chartEl, nm.chart);
    }

    document.getElementById('predSeedDemoBtn')?.addEventListener('click', async () => {
      const btn = document.getElementById('predSeedDemoBtn');
      btn.disabled = true;
      try {
        const res = await api.auth.seedDemo();
        showToast(res.message || 'Sample data loaded successfully');
        loadPredictions();
      } catch (err) {
        showToast('Failed to seed demo data: ' + err.message, 'error');
        btn.disabled = false;
      }
    });
  } catch (err) {
    container.innerHTML = `<div class="alert alert-danger" role="alert">Failed to load predictions: ${escapeHtml(err.message)}</div>`;
  }
}
