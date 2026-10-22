/**
 * Expense Forecasting and Predictive Financial Intelligence Service.
 * Transparent statistical time-series forecasting (WMA + Day-Fraction Blend).
 */

import {
  addDays,
  addMonths,
  currentMonth,
  daysInMonth,
  monthRange,
  monthsBetween,
  round2,
} from './dateUtils.js';

import {
  monthTotalMem,
  categoryBreakdownMem,
  elapsedDays,
  comparisonMem,
  totalBudgetMem,
} from './analyticsService.js';

export const WEIGHTS = { 1: [1], 2: [0.6, 0.4], 3: [0.5, 0.3, 0.2] };
export const DISCRETIONARY = ['Food & Dining', 'Entertainment', 'Shopping', 'Travel', 'Personal Care'];

const inr = (v) => `₹${Math.round(v).toLocaleString('en-IN')}`;

function firstExpenseMonth(expenses) {
  if (!expenses || expenses.length === 0) return null;
  let minDate = expenses[0].expense_date;
  for (const e of expenses) {
    if (e.expense_date < minDate) minDate = e.expense_date;
  }
  return minDate ? minDate.slice(0, 7) : null;
}

export function completedMonths(expenses, month, categoryId = null) {
  const first = firstExpenseMonth(expenses);
  const last = addMonths(month, -1);
  if (!first || first > last) return [];

  const from = monthsBetween(first, last).length > 12 ? addMonths(last, -11) : first;
  const monthList = monthsBetween(from, last);

  const byMonth = new Map();
  for (const e of expenses) {
    if (categoryId !== null && e.category_id !== categoryId) continue;
    const ym = e.expense_date.slice(0, 7);
    if (ym >= from && ym <= last) {
      byMonth.set(ym, (byMonth.get(ym) || 0) + (Number(e.amount) || 0));
    }
  }

  return monthList.map((m) => ({ month: m, total: round2(byMonth.get(m) || 0) }));
}

export function weightedAverage(months) {
  const recent = months.slice(-3).reverse(); // newest first
  if (recent.length === 0) return null;
  const weights = WEIGHTS[recent.length];
  const value = recent.reduce((s, m, i) => s + m.total * weights[i], 0);
  return {
    value: round2(value),
    basis: recent.map((m, i) => ({ month: m.month, total: m.total, weight: weights[i] })),
  };
}

export function confidence(monthsOfData, elapsed) {
  let level = 'preliminary';
  let label = 'Preliminary';
  if (monthsOfData >= 6) {
    level = 'good';
    label = 'Good';
  } else if (monthsOfData >= 3) {
    level = 'moderate';
    label = 'Moderate';
  }

  const detail =
    level === 'preliminary'
      ? `Only ${monthsOfData} earlier month(s) of data are available, so this is a preliminary estimate with limited accuracy (3+ months recommended).`
      : level === 'moderate'
      ? `Based on ${monthsOfData} earlier months of data. Accuracy improves with 6+ months.`
      : `Based on ${monthsOfData} earlier months of data.`;

  return { level, label, months_of_history: monthsOfData, detail, early_in_month: elapsed > 0 && elapsed < 5 };
}

export function typicalFraction(expenses, history, elapsed, categoryId = null) {
  const recent = history.filter((m) => m.total > 0).slice(-3).reverse();
  if (!recent.length || elapsed <= 0) return null;
  const weights = WEIGHTS[recent.length];

  let fraction = 0;
  recent.forEach((m, i) => {
    const { start, days } = monthRange(m.month);
    const upto = addDays(start, Math.min(elapsed, days) - 1);

    const spendUpto = expenses.reduce((sum, e) => {
      if (categoryId !== null && e.category_id !== categoryId) return sum;
      if (e.expense_date >= start && e.expense_date <= upto) return sum + (Number(e.amount) || 0);
      return sum;
    }, 0);

    fraction += weights[i] * (spendUpto / m.total);
  });

  return fraction;
}

export function blend(spent, elapsed, days, hist, fraction, capAtPace = false) {
  if (elapsed <= 0) return hist ? hist.value : 0;
  const pace = (spent / elapsed) * days;
  let pattern = fraction !== null && fraction >= 0.1 ? spent / fraction : null;
  if (pattern !== null && capAtPace) pattern = Math.min(pattern, pace);
  const current = pattern !== null ? pattern : pace;
  if (!hist) return current;
  const alpha = elapsed / days;
  return alpha * current + (1 - alpha) * hist.value;
}

export function monthEndMem(categories, expenses, month = currentMonth()) {
  const days = daysInMonth(month);
  const elapsed = elapsedDays(month);
  const spent = monthTotalMem(expenses, month);
  const history = completedMonths(expenses, month);
  const monthsOfData = history.filter((m) => m.total > 0).length;
  const wma = weightedAverage(history);
  const isComplete = elapsed >= days;
  const notes = [];
  let fraction = null;

  const baseline = elapsed > 0 ? round2((spent / elapsed) * days) : 0;
  let projected;
  let method;

  if (isComplete) {
    projected = spent;
    method = 'This month is complete, so the total is the actual spending.';
  } else if (elapsed === 0) {
    projected = wma ? wma.value : 0;
    method = wma
      ? 'Future month: weighted moving average of recent completed months.'
      : 'No data available for this month.';
  } else {
    fraction = typicalFraction(expenses, history, elapsed);
    projected = Math.max(spent, round2(blend(spent, elapsed, days, wma, fraction)));
    method = wma
      ? `Blend of (a) spending so far divided by the share of a month normally spent by day ${elapsed} and (b) the weighted moving average of previous months. Weight on (a) grows as the month progresses.`
      : 'Current pace only (no earlier months available to compare).';
  }

  if (!isComplete && elapsed > 0) {
    if (elapsed < 5) {
      notes.push(`Only ${elapsed} day(s) of this month have passed; early-month forecasts can swing widely.`);
    }

    const { start, end } = monthRange(month);
    const monthExpenses = expenses
      .filter((e) => e.expense_date >= start && e.expense_date <= end)
      .sort((a, b) => b.amount - a.amount);
    const largest = monthExpenses[0];

    if (fraction === null && largest && spent > 0 && largest.amount / spent >= 0.35 && elapsed < days) {
      const without = round2(((spent - largest.amount) / elapsed) * days + largest.amount);
      notes.push(
        `One expense ("${largest.title}", ${inr(largest.amount)}) makes up ${Math.round((largest.amount / spent) * 100)}% of spending so far. Pace-based extrapolation repeats big one-off purchases, so the estimate may be too high; if that expense is a one-off, the pace-based figure would be about ${inr(without)}.`
      );
    }
  }

  if (spent === 0 && !isComplete && elapsed > 0) {
    notes.push('No expenses recorded yet this month.');
  }

  return {
    month,
    is_complete: isComplete,
    spent,
    elapsed_days: elapsed,
    days_in_month: days,
    remaining_days: Math.max(0, days - elapsed),
    baseline_projection: baseline,
    typical_fraction_spent: fraction === null ? null : round2(fraction * 100),
    historical_average: wma ? wma.value : null,
    historical_basis: wma ? wma.basis : [],
    projected: round2(projected),
    confidence: confidence(monthsOfData, elapsed),
    method,
    notes,
  };
}

export function nextMonthMem(categories, expenses) {
  const cur = currentMonth();
  const target = addMonths(cur, 1);
  const history = completedMonths(expenses, cur);
  const monthsOfData = history.filter((m) => m.total > 0).length;
  const wma = weightedAverage(history);
  const me = monthEndMem(categories, expenses, cur);

  const categoryForecasts = categories
    .map((c) => {
      const w = weightedAverage(completedMonths(expenses, cur, c.id));
      return {
        id: c.id,
        name: c.name,
        color: c.color,
        monthly_budget: c.monthly_budget,
        forecast: w ? w.value : 0,
      };
    })
    .filter((c) => c.forecast > 0)
    .sort((a, b) => b.forecast - a.forecast);

  const chart = history.slice(-6).map((m) => ({ month: m.month, actual: m.total, predicted: null }));
  chart.push({ month: cur, actual: me.spent, predicted: me.projected });
  if (wma) chart.push({ month: target, actual: null, predicted: wma.value });

  const budget = totalBudgetMem(categories);

  return {
    month: target,
    forecast: wma ? wma.value : null,
    basis: wma ? wma.basis : [],
    weights: WEIGHTS,
    confidence: confidence(monthsOfData, 0),
    budget,
    over_budget: wma !== null && budget > 0 && wma.value > budget,
    categories: categoryForecasts,
    chart,
    message: wma
      ? null
      : 'There is no completed month of history yet, so a next-month forecast cannot be calculated. Keep recording expenses.',
  };
}

export function categoryForecastMem(categories, expenses, month = currentMonth()) {
  const days = daysInMonth(month);
  const elapsed = elapsedDays(month);
  const { start, end } = monthRange(month);
  const spentRows = new Map(categoryBreakdownMem(categories, expenses, start, end).map((c) => [c.id, c]));

  const items = categories
    .map((c) => {
      const spent = spentRows.get(c.id)?.total || 0;
      const history = completedMonths(expenses, month, c.id);
      const monthsOfData = history.filter((m) => m.total > 0).length;
      const wma = monthsOfData >= 1 ? weightedAverage(history) : null;
      const fraction = wma && elapsed < days ? typicalFraction(expenses, history, elapsed, c.id) : null;
      let projected = elapsed >= days ? spent : Math.max(spent, round2(blend(spent, elapsed, days, wma, fraction, true)));
      if (elapsed === 0 && !wma) projected = 0;
      const budget = c.monthly_budget || 0;
      let status = 'no_budget';
      if (budget > 0) status = projected > budget ? 'over' : projected >= budget * 0.9 ? 'near' : 'ok';
      return {
        id: c.id,
        name: c.name,
        color: c.color,
        icon: c.icon,
        spent,
        projected: round2(projected),
        budget,
        status,
        overrun: budget > 0 ? round2(Math.max(0, projected - budget)) : 0,
        data_sufficiency: monthsOfData >= 2 ? 'sufficient' : 'limited',
        months_of_history: monthsOfData,
      };
    })
    .filter((c) => c.spent > 0 || c.projected > 0)
    .sort((a, b) => b.projected - a.projected);

  return { month, elapsed_days: elapsed, days_in_month: days, categories: items };
}

export function insightsMem(categories, expenses, month = currentMonth()) {
  const cmp = comparisonMem(categories, expenses, month);
  const me = monthEndMem(categories, expenses, month);
  const cf = categoryForecastMem(categories, expenses, month);
  const { start, end } = monthRange(month);
  const cats = categoryBreakdownMem(categories, expenses, start, end).filter((c) => c.total > 0);
  const out = [];
  const totalCount = expenses.length;

  let notice = null;
  if (totalCount === 0) notice = 'No expenses recorded yet. Add some expenses to see insights.';
  else if (cats.length === 0) notice = 'No expenses recorded for this month yet, so there is nothing to analyse.';
  else if (me.confidence.months_of_history < 1) notice = 'There is no earlier month to compare with yet, so trend insights are limited.';

  if (cats.length > 0) {
    const top = cats[0];
    out.push({
      type: 'top_category',
      tone: 'info',
      title: 'Highest spending category',
      message: `${top.name} is your largest category at ${inr(top.total)} (${Math.round(top.percentage * 10) / 10}% of this month's spending).`,
    });
  }

  const lfl = cmp.like_for_like;
  if (lfl.previous > 0 && lfl.current > 0) {
    const dir = lfl.change_pct >= 0 ? 'higher' : 'lower';
    const scope = me.is_complete ? 'than last month' : `than the same ${lfl.days} days of last month`;
    out.push({
      type: 'mom_change',
      tone: lfl.change_pct > 0 ? 'warning' : 'positive',
      title: 'Month-over-month change',
      message: `Spending is ${Math.round(Math.abs(lfl.change_pct) * 10) / 10}% ${dir} ${scope} (${inr(lfl.current)} vs ${inr(lfl.previous)}).`,
    });
  }

  const rising = cmp.categories
    .filter((c) => c.previous > 0 && c.change_pct !== null && c.change_pct >= 15 && c.change >= 300)
    .sort((a, b) => b.change - a.change);
  if (rising.length) {
    out.push({
      type: 'rising_categories',
      tone: 'warning',
      title: 'Categories with increasing spending',
      message: rising.slice(0, 3).map((c) => `${c.name} (+${Math.round(c.change_pct * 10) / 10}%)`).join(', ') + ' are running higher than last month.',
    });
  }

  if (!me.is_complete && me.spent > 0) {
    out.push({
      type: 'month_end',
      tone: 'forecast',
      title: 'Estimated month-end spending',
      message: `You are on track to spend about ${inr(me.projected)} by month-end (${me.confidence.label.toLowerCase()} confidence).`,
    });
  }

  cf.categories
    .filter((c) => c.status === 'over')
    .slice(0, 3)
    .forEach((c) => {
      out.push({
        type: 'budget_overrun',
        tone: 'danger',
        title: 'Budget overrun expected',
        message: `${c.name} is projected at ${inr(c.projected)} against a budget of ${inr(c.budget)} (${inr(c.overrun)} over).`,
      });
    });

  // ---- Savings suggestions ----
  const candidates = [];
  const worst = rising[0];
  if (worst) {
    candidates.push({
      title: `Review ${worst.name}`,
      message: `${worst.name} spending is ${Math.round(worst.change_pct * 10) / 10}% higher than last month (${inr(worst.current)} vs ${inr(worst.previous)}). Review these purchases to identify possible savings.`,
      estimated_saving: worst.change,
    });
  }
  const over = cf.categories.filter((c) => c.status === 'over').sort((a, b) => b.overrun - a.overrun)[0];
  if (over) {
    const left = over.budget - over.spent;
    const advice =
      left > 0 && me.remaining_days > 0
        ? `Limiting ${over.name} to about ${inr(left / me.remaining_days)} per day for the remaining ${me.remaining_days} days keeps you within budget.`
        : `The budget is already used up, so avoid further ${over.name} spending this month if possible.`;
    candidates.push({
      title: `Stay within the ${over.name} budget`,
      message: `${over.name} is projected to exceed its ${inr(over.budget)} budget by ${inr(over.overrun)}. ${advice}`,
      estimated_saving: over.overrun,
    });
  }
  const disc = cf.categories
    .filter((c) => DISCRETIONARY.includes(c.name) && c.projected > 0)
    .sort((a, b) => b.projected - a.projected)[0];
  if (disc) {
    candidates.push({
      title: `Trim ${disc.name} by 10%`,
      message: `${disc.name} is your biggest discretionary category (about ${inr(disc.projected)} this month). A 10% cut would save roughly ${inr(disc.projected * 0.1)}.`,
      estimated_saving: round2(disc.projected * 0.1),
    });
  }
  const smallExpenses = expenses.filter(
    (e) => e.expense_date >= start && e.expense_date <= end && Number(e.amount) < 300
  );
  if (smallExpenses.length >= 10) {
    const smallTotal = smallExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    candidates.push({
      title: 'Watch small purchases',
      message: `You made ${smallExpenses.length} purchases under ₹300 this month, adding up to ${inr(smallTotal)}. Small, frequent spends are easy to overlook; consider batching or skipping a few.`,
      estimated_saving: round2(smallTotal * 0.15),
    });
  }
  if (cats[0] && !candidates.some((c) => c.title.includes(cats[0].name))) {
    candidates.push({
      title: `Look closely at ${cats[0].name}`,
      message: `${cats[0].name} accounts for ${Math.round(cats[0].percentage * 10) / 10}% of this month's spending. Even a 10% reduction would save about ${inr(cats[0].total * 0.1)}.`,
      estimated_saving: round2(cats[0].total * 0.1),
    });
  }

  return {
    month,
    notice,
    insights: out,
    suggestions: candidates.slice(0, 3),
    suggestions_note:
      candidates.length < 3 && totalCount > 0
        ? 'Fewer than three suggestions are shown because the data does not yet support more.'
        : null,
  };
}
