// Date helpers. All dates are ISO strings (YYYY-MM-DD) and months are YYYY-MM.
// Calendar maths is done in UTC so daylight-saving changes can never shift a day.

const pad = (n) => String(n).padStart(2, '0');

function todayISO(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function currentMonth() {
  return todayISO().slice(0, 7);
}

// Strict check: rejects 2024-02-30 and other impossible dates.
function isValidISODate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function isValidMonth(s) {
  return typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

function daysInMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
}

function monthRange(ym) {
  const days = daysInMonth(ym);
  return { start: `${ym}-01`, end: `${ym}-${pad(days)}`, days };
}

function monthsBetween(startYm, endYm) {
  const out = [];
  for (let m = startYm; m <= endYm; m = addMonths(m, 1)) out.push(m);
  return out;
}

function toUTC(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDays(iso, n) {
  const dt = toUTC(iso);
  dt.setUTCDate(dt.getUTCDate() + n);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

// Number of days from a to b, inclusive.
function daysInclusive(a, b) {
  return Math.round((toUTC(b) - toUTC(a)) / 86400000) + 1;
}

// Monday of the week containing the date.
function weekStart(iso) {
  const dow = (toUTC(iso).getUTCDay() + 6) % 7; // Mon=0
  return addDays(iso, -dow);
}

const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

module.exports = {
  todayISO,
  currentMonth,
  isValidISODate,
  isValidMonth,
  daysInMonth,
  addMonths,
  monthRange,
  monthsBetween,
  addDays,
  daysInclusive,
  weekStart,
  round2,
};
