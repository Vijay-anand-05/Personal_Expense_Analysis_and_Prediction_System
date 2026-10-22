/**
 * Chart.js configurations matching the application's visual identity.
 * Replaces Recharts with zero-dependency Vanilla JS Chart.js implementations.
 */
import { inr } from './formatters.js';

const PALETTE = {
  primary: '#173f35',
  primaryLight: 'rgba(23, 63, 53, 0.1)',
  mint: '#2f7a5c',
  mintSoft: '#ddf3e4',
  accent: '#f4a261',
  accentSoft: 'rgba(244, 162, 97, 0.15)',
  danger: '#c85d54',
  border: '#e4e9e3',
  text: '#202923',
  muted: '#78827b',
  white: '#ffffff',
};

// Common Chart.js font and layout defaults
if (window.Chart) {
  Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.color = PALETTE.muted;
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(23, 63, 53, 0.9)';
}

/**
 * Category Donut Chart
 */
export function createCategoryDonutChart(canvasEl, categories) {
  if (!canvasEl) return null;
  const ctx = canvasEl.getContext('2d');

  const labels = categories.map((c) => c.name);
  const data = categories.map((c) => c.total);
  const bgColors = categories.map((c) => c.color || PALETTE.primary);

  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: bgColors,
          borderWidth: 2,
          borderColor: PALETTE.white,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => {
              const val = item.raw || 0;
              const cat = categories[item.dataIndex];
              return ` ${item.label}: ${inr(val)} (${cat ? cat.percentage : 0}%)`;
            },
          },
        },
      },
    },
  });
}

/**
 * 6-Month Monthly Trend Chart (Area / Line)
 */
export function createMonthlyTrendChart(canvasEl, monthlyData) {
  if (!canvasEl) return null;
  const ctx = canvasEl.getContext('2d');

  const labels = monthlyData.map((m) => {
    const [y, mon] = m.month.split('-');
    const date = new Date(Date.UTC(Number(y), Number(mon) - 1, 1));
    return date.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' });
  });
  const data = monthlyData.map((m) => m.total);

  return new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Spending',
          data,
          borderColor: PALETTE.primary,
          backgroundColor: PALETTE.primaryLight,
          borderWidth: 2.5,
          pointBackgroundColor: PALETTE.primary,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.35,
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
            label: (item) => ` Spend: ${inr(item.raw)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: PALETTE.muted },
        },
        y: {
          beginAtZero: true,
          min: 0,
          suggestedMax: 1000,
          grid: { color: PALETTE.border },
          ticks: {
            color: PALETTE.muted,
            callback: (v) => '₹' + (v >= 1000 ? Math.round(v / 1000) + 'k' : v),
          },
        },
      },
    },
  });
}

/**
 * Daily Spending Bar Chart
 */
export function createDailyBarChart(canvasEl, dailyData) {
  if (!canvasEl) return null;
  const ctx = canvasEl.getContext('2d');

  const labels = dailyData.map((d) => d.day);
  const data = dailyData.map((d) => d.total);

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Daily Spend',
          data,
          backgroundColor: PALETTE.mint,
          hoverBackgroundColor: PALETTE.primary,
          borderRadius: 4,
          maxBarThickness: 16,
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
            title: (items) => `Day ${items[0].label}`,
            label: (item) => ` Total: ${inr(item.raw)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: PALETTE.muted, maxRotation: 0 },
        },
        y: {
          beginAtZero: true,
          min: 0,
          suggestedMax: 1000,
          grid: { color: PALETTE.border },
          ticks: {
            color: PALETTE.muted,
            callback: (v) => '₹' + (v >= 1000 ? Math.round(v / 1000) + 'k' : v),
          },
        },
      },
    },
  });
}

/**
 * Cumulative This-Month vs Last-Month Line Chart
 */
export function createCumulativeComparisonChart(canvasEl, cumulativeData) {
  if (!canvasEl) return null;
  const ctx = canvasEl.getContext('2d');

  const labels = cumulativeData.map((d) => d.day);
  const currentData = cumulativeData.map((d) => d.current);
  const prevData = cumulativeData.map((d) => d.previous);

  return new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'This Month',
          data: currentData,
          borderColor: PALETTE.primary,
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 5,
          tension: 0.25,
        },
        {
          label: 'Last Month',
          data: prevData,
          borderColor: PALETTE.accent,
          borderDash: [5, 4],
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          tension: 0.25,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
        },
        tooltip: {
          callbacks: {
            title: (items) => `Day ${items[0].label}`,
            label: (item) => ` ${item.dataset.label}: ${item.raw !== null ? inr(item.raw) : '—'}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: PALETTE.muted },
        },
        y: {
          beginAtZero: true,
          min: 0,
          suggestedMax: 1000,
          grid: { color: PALETTE.border },
          ticks: {
            color: PALETTE.muted,
            callback: (v) => '₹' + (v >= 1000 ? Math.round(v / 1000) + 'k' : v),
          },
        },
      },
    },
  });
}

/**
 * Predictions Forecast Chart (History vs Forecast)
 */
export function createPredictionForecastChart(canvasEl, chartData) {
  if (!canvasEl) return null;
  const ctx = canvasEl.getContext('2d');

  const labels = chartData.map((d) => {
    const [y, mon] = d.month.split('-');
    const date = new Date(Date.UTC(Number(y), Number(mon) - 1, 1));
    return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  });

  const actualData = chartData.map((d) => d.actual);
  const predictedData = chartData.map((d) => d.predicted);

  return new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Actual Spending',
          data: actualData,
          borderColor: PALETTE.primary,
          backgroundColor: PALETTE.primaryLight,
          borderWidth: 2.5,
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.25,
        },
        {
          label: 'Forecasted',
          data: predictedData,
          borderColor: PALETTE.accent,
          borderDash: [6, 4],
          backgroundColor: PALETTE.accentSoft,
          borderWidth: 2.5,
          pointRadius: 5,
          pointHoverRadius: 7,
          pointBackgroundColor: PALETTE.accent,
          fill: false,
          tension: 0.25,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
        },
        tooltip: {
          callbacks: {
            label: (item) => ` ${item.dataset.label}: ${item.raw !== null ? inr(item.raw) : '—'}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: PALETTE.muted },
        },
        y: {
          beginAtZero: true,
          min: 0,
          suggestedMax: 1000,
          grid: { color: PALETTE.border },
          ticks: {
            color: PALETTE.muted,
            callback: (v) => '₹' + (v >= 1000 ? Math.round(v / 1000) + 'k' : v),
          },
        },
      },
    },
  });
}
