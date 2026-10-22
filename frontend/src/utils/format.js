// Shared formatting helpers. All currency is Indian Rupees in the en-IN locale.
const inr0 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });

export const PAYMENT_METHODS = ['Cash', 'UPI', 'Debit Card', 'Credit Card', 'Bank Transfer', 'Other'];

/** ₹1,23,456 (whole rupees) or ₹1,23,456.50 when `decimals` is true. */
export function formatCurrency(value, decimals = false) {
  const n = Number(value) || 0;
  return (decimals ? inr2 : inr0).format(n);
}

/** Short axis labels: ₹1.2K, ₹3L */
export function formatCompact(value) {
  return `₹${compact.format(Number(value) || 0)}`;
}

export function formatPercent(value, withSign = false) {
  if (value === null || value === undefined) return '—';
  const n = Number(value);
  return `${withSign && n > 0 ? '+' : ''}${n.toFixed(1).replace(/\.0$/, '')}%`;
}

// Parse YYYY-MM-DD as a local date (avoids the UTC off-by-one of `new Date('2024-01-05')`).
function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(iso) {
  if (!iso) return '';
  return parseISO(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatShortDate(iso) {
  if (!iso) return '';
  return parseISO(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function monthLabel(ym, style = 'long') {
  if (!ym) return '';
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', {
    month: style === 'long' ? 'long' : 'short',
    year: style === 'long' ? 'numeric' : '2-digit',
  });
}

const pad = (n) => String(n).padStart(2, '0');
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const currentMonth = () => todayISO().slice(0, 7);

export function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
}

export function monthRange(ym) {
  const [y, m] = ym.split('-').map(Number);
  return { start: `${ym}-01`, end: `${ym}-${pad(new Date(y, m, 0).getDate())}` };
}
