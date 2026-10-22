/**
 * Date calculation and manipulation utilities.
 * All dates are ISO strings (YYYY-MM-DD) and months are YYYY-MM.
 * Calendar maths is done in UTC.
 */

const pad = (n) => String(n).padStart(2, '0');

export function todayISO(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function currentMonth() {
  return todayISO().slice(0, 7);
}

export function isValidISODate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isValidMonth(s) {
  return typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
}

export function monthRange(ym) {
  const days = daysInMonth(ym);
  return { start: `${ym}-01`, end: `${ym}-${pad(days)}`, days };
}

export function monthsBetween(startYm, endYm) {
  const out = [];
  for (let m = startYm; m <= endYm; m = addMonths(m, 1)) out.push(m);
  return out;
}

export function toUTC(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(iso, n) {
  const dt = toUTC(iso);
  dt.setUTCDate(dt.getUTCDate() + n);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function daysInclusive(a, b) {
  return Math.round((toUTC(b) - toUTC(a)) / 86400000) + 1;
}

export function weekStart(iso) {
  const dow = (toUTC(iso).getUTCDay() + 6) % 7; // Mon=0
  return addDays(iso, -dow);
}

export const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
