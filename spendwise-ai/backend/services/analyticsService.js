// Aggregation queries, scoped strictly to the authenticated user.
// Every figure comes from SQL over the expenses table;
// missing days/months are zero-filled here so charts never have gaps.
const db = require('../database/database');
const {
  addDays, addMonths, currentMonth, daysInclusive, daysInMonth, monthRange, monthsBetween,
  round2, todayISO, weekStart,
} = require('../utils/dateUtils');

const pct = (part, whole) => (whole > 0 ? round2((part / whole) * 100) : 0);

// Percentage change; null when the previous value is zero (undefined change).
const changePct = (current, previous) => (previous > 0 ? round2(((current - previous) / previous) * 100) : null);

function totalBetween(userId, start, end) {
  const r = db
    .prepare('SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM expenses WHERE user_id = ? AND expense_date BETWEEN ? AND ?')
    .get(userId, start, end);
  return { total: round2(r.total), count: r.count };
}

function monthTotal(userId, ym) {
  const { start, end } = monthRange(ym);
  return totalBetween(userId, start, end).total;
}

// Monthly totals for [startMonth, endMonth], zero-filled.
function monthlyTotals(userId, startMonth, endMonth) {
  const rows = db
    .prepare(
      `SELECT substr(expense_date, 1, 7) AS month, SUM(amount) AS total, COUNT(*) AS count
       FROM expenses WHERE user_id = ? AND expense_date BETWEEN ? AND ? GROUP BY month`
    )
    .all(userId, `${startMonth}-01`, monthRange(endMonth).end);
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  return monthsBetween(startMonth, endMonth).map((m) => ({
    month: m,
    total: round2(byMonth.get(m)?.total || 0),
    count: byMonth.get(m)?.count || 0,
  }));
}

// Per-category totals for a date range. LEFT JOIN keeps categories with zero spend.
function categoryBreakdown(userId, start, end) {
  const rows = db
    .prepare(
      `SELECT c.id, c.name, c.color, c.icon, c.monthly_budget,
              COALESCE(SUM(e.amount), 0) AS total, COUNT(e.id) AS count
       FROM categories c
       LEFT JOIN expenses e ON e.category_id = c.id AND e.user_id = ? AND e.expense_date BETWEEN ? AND ?
       WHERE c.user_id = ?
       GROUP BY c.id ORDER BY total DESC, c.name`
    )
    .all(userId, start, end, userId);
  const grand = rows.reduce((s, r) => s + r.total, 0);
  return rows.map((r) => ({ ...r, total: round2(r.total), percentage: pct(r.total, grand) }));
}

// Daily totals for [start, end], zero-filled.
function dailyTotals(userId, start, end) {
  const rows = db
    .prepare(
      'SELECT expense_date AS date, SUM(amount) AS total, COUNT(*) AS count FROM expenses WHERE user_id = ? AND expense_date BETWEEN ? AND ? GROUP BY expense_date'
    )
    .all(userId, start, end);
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const out = [];
  const n = daysInclusive(start, end);
  for (let i = 0; i < n; i += 1) {
    const date = addDays(start, i);
    out.push({ date, total: round2(byDate.get(date)?.total || 0), count: byDate.get(date)?.count || 0 });
  }
  return out;
}

function weeklyTotals(daily) {
  const map = new Map();
  daily.forEach((d) => {
    const w = weekStart(d.date);
    const cur = map.get(w) || { week_start: w, total: 0, count: 0 };
    cur.total += d.total;
    cur.count += d.count;
    map.set(w, cur);
  });
  return [...map.values()].map((w) => ({ ...w, total: round2(w.total) }));
}

// Days of `ym` that have elapsed (all of them for past months, none for future ones).
function elapsedDays(ym) {
  const cur = currentMonth();
  if (ym < cur) return daysInMonth(ym);
  if (ym > cur) return 0;
  return Number(todayISO().slice(8, 10));
}

// Summary for an arbitrary date range, used by the Analytics page.
function rangeSummary(userId, start, end) {
  const daily = dailyTotals(userId, start, end);
  const total = round2(daily.reduce((s, d) => s + d.total, 0));
  // Only count days up to today so a range ending in the future does not dilute the average.
  const today = todayISO();
  const elapsed = Math.max(0, Math.min(daysInclusive(start, end), end > today ? daysInclusive(start, today) : daily.length));
  let top = null;
  daily.forEach((d) => { if (d.total > 0 && (!top || d.total > top.total)) top = d; });
  const count = daily.reduce((s, d) => s + d.count, 0);
  return {
    start, end, total, count,
    days: daily.length,
    average_daily: elapsed > 0 ? round2(total / elapsed) : 0,
    highest_day: top,
    daily,
  };
}

/**
 * Month vs previous month. Category rows compare like-for-like windows.
 */
function comparison(userId, month) {
  const prevMonth = addMonths(month, -1);
  const elapsed = elapsedDays(month);
  const window = Math.min(elapsed || daysInMonth(month), daysInMonth(prevMonth));
  const cur = monthRange(month);
  const prev = monthRange(prevMonth);
  const curEnd = addDays(cur.start, Math.min(window, cur.days) - 1);
  const prevEnd = addDays(prev.start, window - 1);

  const curCats = categoryBreakdown(userId, cur.start, curEnd);
  const prevCats = new Map(categoryBreakdown(userId, prev.start, prevEnd).map((c) => [c.id, c.total]));
  const categories = curCats
    .map((c) => {
      const previous = prevCats.get(c.id) || 0;
      return { id: c.id, name: c.name, color: c.color, current: c.total, previous, change: round2(c.total - previous), change_pct: changePct(c.total, previous) };
    })
    .filter((c) => c.current > 0 || c.previous > 0);

  // Cumulative spend per day-of-month for the line chart.
  const curDaily = dailyTotals(userId, cur.start, cur.end);
  const prevDaily = dailyTotals(userId, prev.start, prev.end);
  let runCur = 0;
  let runPrev = 0;
  const cumulative = [];
  for (let day = 1; day <= Math.max(cur.days, prev.days); day += 1) {
    if (day <= prev.days) runPrev += prevDaily[day - 1].total;
    if (day <= cur.days) runCur += curDaily[day - 1].total;
    cumulative.push({
      day,
      current: day <= elapsed && day <= cur.days ? round2(runCur) : null,
      previous: day <= prev.days ? round2(runPrev) : null,
    });
  }

  const currentTotal = monthTotal(userId, month);
  const previousTotal = monthTotal(userId, prevMonth);
  const likeCur = totalBetween(userId, cur.start, curEnd).total;
  const likePrev = totalBetween(userId, prev.start, prevEnd).total;
  return {
    month, previous_month: prevMonth,
    current_total: currentTotal,
    previous_total: previousTotal,
    change: round2(currentTotal - previousTotal),
    change_pct: changePct(currentTotal, previousTotal),
    like_for_like: { days: window, current: likeCur, previous: likePrev, change_pct: changePct(likeCur, likePrev) },
    categories,
    cumulative,
  };
}

function recentExpenses(userId, limit = 8) {
  return db
    .prepare(
      `SELECT e.id, e.title, e.amount, e.category_id, e.expense_date, e.payment_method, e.notes,
              c.name AS category_name, c.color AS category_color, c.icon AS category_icon
       FROM expenses e JOIN categories c ON c.id = e.category_id
       WHERE e.user_id = ?
       ORDER BY e.expense_date DESC, e.id DESC LIMIT ?`
    )
    .all(userId, limit);
}

function totalBudget(userId) {
  return round2(db.prepare('SELECT COALESCE(SUM(monthly_budget), 0) AS b FROM categories WHERE user_id = ?').get(userId).b);
}

// Budget vs actual: monthly budgets are scaled by the number of calendar months the range touches.
function budgetVsActual(userId, start, end) {
  const months = monthsBetween(start.slice(0, 7), end.slice(0, 7)).length;
  return categoryBreakdown(userId, start, end)
    .filter((c) => c.monthly_budget > 0 || c.total > 0)
    .map((c) => {
      const budget = round2(c.monthly_budget * months);
      return {
        id: c.id, name: c.name, color: c.color, budget, actual: c.total,
        remaining: round2(budget - c.total),
        used_pct: budget > 0 ? round2((c.total / budget) * 100) : null,
        over_budget: budget > 0 && c.total > budget,
      };
    });
}

module.exports = {
  totalBetween, monthTotal, monthlyTotals, categoryBreakdown, dailyTotals, weeklyTotals,
  elapsedDays, rangeSummary, comparison, recentExpenses, totalBudget, budgetVsActual,
  changePct, pct,
};
