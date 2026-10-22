/**
 * Browser-side Analytics Calculation Service.
 * Performs statistical aggregations, burn rate calculations, category breakdowns,
 * and trend analysis directly over IndexedDB data.
 */

import { tx } from '../storage/db.js';
import { requireActiveUser } from './authService.js';
import {
  addDays,
  addMonths,
  currentMonth,
  daysInclusive,
  daysInMonth,
  monthRange,
  monthsBetween,
  round2,
  todayISO,
  weekStart,
} from './dateUtils.js';

export const pct = (part, whole) => (whole > 0 ? round2((part / whole) * 100) : 0);
export const changePct = (current, previous) => (previous > 0 ? round2(((current - previous) / previous) * 100) : null);

/** Fetch all categories and expenses for current user */
export async function getUserDataset(userId) {
  return tx(['categories', 'expenses'], 'readonly', async ([cStore, eStore]) => {
    const allCats = await cStore.getAll();
    const categories = allCats.filter((c) => c.user_id === userId);

    const allExp = await eStore.getAll();
    const expenses = allExp.filter((e) => e.user_id === userId);

    return { categories, expenses };
  });
}

export function totalBetweenMem(expenses, start, end) {
  const matching = expenses.filter((e) => e.expense_date >= start && e.expense_date <= end);
  const total = round2(matching.reduce((sum, e) => sum + (Number(e.amount) || 0), 0));
  return { total, count: matching.length };
}

export function monthTotalMem(expenses, ym) {
  const { start, end } = monthRange(ym);
  return totalBetweenMem(expenses, start, end).total;
}

export function monthlyTotalsMem(expenses, startMonth, endMonth) {
  const byMonth = new Map();
  for (const e of expenses) {
    const ym = e.expense_date.slice(0, 7);
    if (ym >= startMonth && ym <= endMonth) {
      const cur = byMonth.get(ym) || { total: 0, count: 0 };
      cur.total += Number(e.amount) || 0;
      cur.count += 1;
      byMonth.set(ym, cur);
    }
  }

  return monthsBetween(startMonth, endMonth).map((m) => ({
    month: m,
    total: round2(byMonth.get(m)?.total || 0),
    count: byMonth.get(m)?.count || 0,
  }));
}

export function categoryBreakdownMem(categories, expenses, start, end) {
  const catMap = new Map();
  for (const c of categories) {
    catMap.set(c.id, {
      id: c.id,
      name: c.name,
      color: c.color,
      icon: c.icon,
      monthly_budget: round2(c.monthly_budget || 0),
      total: 0,
      count: 0,
    });
  }

  for (const e of expenses) {
    if (e.expense_date >= start && e.expense_date <= end) {
      const entry = catMap.get(e.category_id);
      if (entry) {
        entry.total += Number(e.amount) || 0;
        entry.count += 1;
      }
    }
  }

  const rows = [...catMap.values()];
  const grand = rows.reduce((s, r) => s + r.total, 0);
  rows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  return rows.map((r) => ({
    ...r,
    total: round2(r.total),
    percentage: pct(r.total, grand),
  }));
}

export function dailyTotalsMem(expenses, start, end) {
  const byDate = new Map();
  for (const e of expenses) {
    if (e.expense_date >= start && e.expense_date <= end) {
      const cur = byDate.get(e.expense_date) || { total: 0, count: 0 };
      cur.total += Number(e.amount) || 0;
      cur.count += 1;
      byDate.set(e.expense_date, cur);
    }
  }

  const out = [];
  const n = daysInclusive(start, end);
  for (let i = 0; i < n; i += 1) {
    const date = addDays(start, i);
    out.push({ date, total: round2(byDate.get(date)?.total || 0), count: byDate.get(date)?.count || 0 });
  }
  return out;
}

export function weeklyTotals(daily) {
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

export function elapsedDays(ym) {
  const cur = currentMonth();
  if (ym < cur) return daysInMonth(ym);
  if (ym > cur) return 0;
  return Number(todayISO().slice(8, 10));
}

export function rangeSummaryMem(expenses, start, end) {
  const daily = dailyTotalsMem(expenses, start, end);
  const total = round2(daily.reduce((s, d) => s + d.total, 0));
  const today = todayISO();
  const elapsed = Math.max(0, Math.min(daysInclusive(start, end), end > today ? daysInclusive(start, today) : daily.length));
  let top = null;
  daily.forEach((d) => {
    if (d.total > 0 && (!top || d.total > top.total)) top = d;
  });
  const count = daily.reduce((s, d) => s + d.count, 0);

  return {
    start,
    end,
    total,
    count,
    days: daily.length,
    average_daily: elapsed > 0 ? round2(total / elapsed) : 0,
    highest_day: top,
    daily,
  };
}

export function comparisonMem(categories, expenses, month) {
  const prevMonth = addMonths(month, -1);
  const elapsed = elapsedDays(month);
  const windowDays = Math.min(elapsed || daysInMonth(month), daysInMonth(prevMonth));
  const cur = monthRange(month);
  const prev = monthRange(prevMonth);
  const curEnd = addDays(cur.start, Math.min(windowDays, cur.days) - 1);
  const prevEnd = addDays(prev.start, windowDays - 1);

  const curCats = categoryBreakdownMem(categories, expenses, cur.start, curEnd);
  const prevCats = new Map(categoryBreakdownMem(categories, expenses, prev.start, prevEnd).map((c) => [c.id, c.total]));

  const categoryComparison = curCats
    .map((c) => {
      const previous = prevCats.get(c.id) || 0;
      return {
        id: c.id,
        name: c.name,
        color: c.color,
        current: c.total,
        previous,
        change: round2(c.total - previous),
        change_pct: changePct(c.total, previous),
      };
    })
    .filter((c) => c.current > 0 || c.previous > 0);

  const curDaily = dailyTotalsMem(expenses, cur.start, cur.end);
  const prevDaily = dailyTotalsMem(expenses, prev.start, prev.end);
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

  const currentTotal = monthTotalMem(expenses, month);
  const previousTotal = monthTotalMem(expenses, prevMonth);
  const likeCur = totalBetweenMem(expenses, cur.start, curEnd).total;
  const likePrev = totalBetweenMem(expenses, prev.start, prevEnd).total;

  return {
    month,
    previous_month: prevMonth,
    current_total: currentTotal,
    previous_total: previousTotal,
    change: round2(currentTotal - previousTotal),
    change_pct: changePct(currentTotal, previousTotal),
    like_for_like: {
      days: windowDays,
      current: likeCur,
      previous: likePrev,
      change_pct: changePct(likeCur, likePrev),
    },
    categories: categoryComparison,
    cumulative,
  };
}

export function recentExpensesMem(categories, expenses, limit = 8) {
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const sorted = [...expenses].sort((a, b) => b.expense_date.localeCompare(a.expense_date) || b.id - a.id);
  return sorted.slice(0, limit).map((e) => {
    const cat = catMap.get(e.category_id);
    return {
      id: e.id,
      title: e.title,
      amount: round2(e.amount),
      category_id: e.category_id,
      expense_date: e.expense_date,
      payment_method: e.payment_method,
      notes: e.notes || '',
      category_name: cat ? cat.name : 'Unknown',
      category_color: cat ? cat.color : '#9AA59C',
      category_icon: cat ? cat.icon : 'tag',
    };
  });
}

export function totalBudgetMem(categories) {
  return round2(categories.reduce((sum, c) => sum + (Number(c.monthly_budget ?? c.budget) || 0), 0));
}

export function budgetVsActualMem(categories, expenses, start, end) {
  const monthsCount = monthsBetween(start.slice(0, 7), end.slice(0, 7)).length;
  return categoryBreakdownMem(categories, expenses, start, end)
    .filter((c) => c.monthly_budget > 0 || c.total > 0)
    .map((c) => {
      const budget = round2(c.monthly_budget * monthsCount);
      return {
        id: c.id,
        name: c.name,
        color: c.color,
        budget,
        actual: c.total,
        remaining: round2(budget - c.total),
        used_pct: budget > 0 ? round2((c.total / budget) * 100) : null,
        over_budget: budget > 0 && c.total > budget,
      };
    });
}
