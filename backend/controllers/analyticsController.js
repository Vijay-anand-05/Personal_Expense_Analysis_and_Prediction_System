const analytics = require('../services/analyticsService');
const predictions = require('../services/predictionService');
const { addMonths, currentMonth, monthRange, round2, todayISO } = require('../utils/dateUtils');

function rangeFrom(q) {
  const m = monthRange(currentMonth());
  return { start: q.start_date || m.start, end: q.end_date || m.end };
}

function dashboard(req, res) {
  const userId = req.user.id;
  const month = req.query.month || currentMonth();
  const { start, end, days } = monthRange(month);
  const elapsed = analytics.elapsedDays(month);

  const thisMonth = analytics.monthTotal(userId, month);
  const lastMonth = analytics.monthTotal(userId, addMonths(month, -1));
  const budget = analytics.totalBudget(userId);
  const forecast = predictions.monthEnd(userId, month);

  const daily = analytics.dailyTotals(userId, start, end).slice(0, Math.max(elapsed, 0)).map((d) => ({ ...d, day: Number(d.date.slice(8, 10)) }));

  res.json({
    success: true,
    data: {
      month,
      today: todayISO(),
      summary: {
        this_month: thisMonth,
        last_month: lastMonth,
        change_pct: analytics.changePct(thisMonth, lastMonth),
        budget,
        budget_remaining: budget > 0 ? round2(budget - thisMonth) : null,
        average_daily: elapsed > 0 ? round2(thisMonth / elapsed) : 0,
        elapsed_days: elapsed,
        days_in_month: days,
        predicted_month_end: forecast.projected,
        forecast_confidence: forecast.confidence.label,
      },
      monthly_trend: analytics.monthlyTotals(userId, addMonths(month, -5), month),
      category_distribution: analytics.categoryBreakdown(userId, start, end).filter((c) => c.total > 0),
      daily,
      comparison: analytics.comparison(userId, month),
      recent_expenses: analytics.recentExpenses(userId, 8),
      insights: predictions.insights(userId, month),
    },
  });
}

function monthly(req, res) {
  const userId = req.user.id;
  const end = req.query.end_month || currentMonth();
  const start = req.query.start_month || addMonths(end, -5);
  const data = analytics.monthlyTotals(userId, start, end);
  const total = round2(data.reduce((s, m) => s + m.total, 0));
  const highest = data.reduce((best, m) => (m.total > (best?.total || 0) ? m : best), null);
  res.json({
    success: true,
    data,
    summary: { total, average: data.length ? round2(total / data.length) : 0, highest_month: highest },
  });
}

function categories(req, res) {
  const userId = req.user.id;
  const { start, end } = rangeFrom(req.query);
  const breakdown = analytics.categoryBreakdown(userId, start, end);
  const total = round2(breakdown.reduce((s, c) => s + c.total, 0));
  res.json({
    success: true,
    data: {
      start, end, total,
      categories: breakdown.filter((c) => c.total > 0),
      top_five: breakdown.filter((c) => c.total > 0).slice(0, 5),
      budget_vs_actual: analytics.budgetVsActual(userId, start, end),
    },
  });
}

function daily(req, res) {
  const userId = req.user.id;
  const { start, end } = rangeFrom(req.query);
  const summary = analytics.rangeSummary(userId, start, end);
  res.json({
    success: true,
    data: { ...summary, weekly: analytics.weeklyTotals(summary.daily) },
  });
}

function comparison(req, res) {
  const userId = req.user.id;
  res.json({ success: true, data: analytics.comparison(userId, req.query.month || currentMonth()) });
}

module.exports = { dashboard, monthly, categories, daily, comparison };
