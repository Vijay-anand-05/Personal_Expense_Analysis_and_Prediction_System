/**
 * Demo data seeder. Run with:  npm run seed   (from the backend folder)
 *
 * - Deterministic: a fixed-seed pseudo-random generator, so every run produces
 *   identical amounts/titles for the same calendar dates.
 * - Covers three full previous months plus the current month up to today, so the
 *   dashboard and predictions have history to work with.
 * - Scoped to user_id (defaults to demo user).
 */
const db = require('../database/database');
const { addDays, addMonths, currentMonth, daysInclusive, monthRange, todayISO } = require('../utils/dateUtils');
const { PAYMENT_METHODS } = require('../utils/defaultCategories');

// mulberry32: tiny seeded PRNG
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FOOD = ['Lunch at Saravana Bhavan', 'Swiggy order', 'Zomato dinner', 'Coffee with friends', 'Street food', 'Biryani takeaway', 'Pizza night', 'Breakfast cafe'];
const TRANSPORT = ['Uber ride', 'Auto fare', 'Metro recharge', 'Bus pass', 'Ola cab'];
const SHOPPING = ['Amazon purchase', 'Clothes at Max', 'Flipkart order', 'Shoes', 'Headphones', 'Home decor'];
const ENTERTAINMENT = ['Movie tickets', 'Concert pass', 'Gaming subscription', 'Bowling'];
const GROCERY = ['Weekly groceries - DMart', 'Vegetables & fruits', 'BigBasket order', 'Milk & essentials'];

function generate(today, monthsBack) {
  const rng = makeRng(20240101);
  const rand = (min, max) => min + rng() * (max - min);
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const round10 = (v) => Math.round(v / 10) * 10;
  const out = [];
  const add = (date, title, category, amount, method, notes = '') => {
    if (date <= today) out.push({ date, title, category, amount: Math.max(10, round10(amount)), method, notes });
  };

  const cur = currentMonth();
  for (let offset = -monthsBack; offset <= 0; offset += 1) {
    const ym = addMonths(cur, offset);
    const { start, days } = monthRange(ym);
    const d = (n) => `${ym}-${String(Math.min(n, days)).padStart(2, '0')}`;
    const foodFactor = offset === 0 ? 1.3 : 1;

    // Fixed monthly items
    add(d(1), 'House rent', 'Housing', 12000, 'Bank Transfer', 'Monthly rent');
    add(d(5), 'Electricity bill', 'Bills & Utilities', rand(1100, 1900), 'UPI');
    add(d(8), 'Broadband bill', 'Bills & Utilities', 799, 'UPI');
    add(d(10), 'Mobile recharge', 'Bills & Utilities', 299, 'UPI');
    add(d(15), 'OTT subscription', 'Entertainment', 649, 'Credit Card');
    add(d(randInt(18, 24)), 'Salon visit', 'Personal Care', rand(300, 900), 'Cash');

    // Occasional items
    if (offset % 2 === 0) add(d(randInt(12, 26)), 'Doctor consultation', 'Healthcare', rand(500, 1400), 'UPI', 'Clinic visit');
    if (offset % 2 !== 0) add(d(randInt(3, 20)), 'Online course', 'Education', rand(1200, 2200), 'Debit Card');
    if (offset !== 0) add(d(randInt(20, 27)), 'Weekend trip', 'Travel', rand(1800, 5200), 'Credit Card', 'Short getaway');
    add(d(randInt(6, 22)), pick(SHOPPING), 'Shopping', rand(700, 3200), pick(['Credit Card', 'UPI', 'Debit Card']));
    add(d(randInt(6, 26)), pick(SHOPPING), 'Shopping', rand(400, 2200), pick(['Credit Card', 'UPI']));
    add(d(randInt(2, 27)), pick(ENTERTAINMENT), 'Entertainment', rand(350, 900), 'UPI');
    add(d(randInt(2, 27)), 'Other expense', 'Other', rand(200, 900), 'Cash');

    // Day-by-day spending
    const n = daysInclusive(start, addDays(start, days - 1));
    for (let i = 0; i < n; i += 1) {
      const date = addDays(start, i);
      if (date > today) break;
      const dow = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7; // Mon=0
      if (rng() < 0.65) add(date, pick(FOOD), 'Food & Dining', rand(120, 480) * foodFactor, pick(['UPI', 'UPI', 'Cash', 'Credit Card']));
      if (dow >= 5 && rng() < 0.5) add(date, pick(FOOD), 'Food & Dining', rand(300, 750) * foodFactor, pick(['UPI', 'Credit Card']));
      if (dow < 5 && rng() < 0.6) add(date, pick(TRANSPORT), 'Transportation', rand(60, 380), pick(['UPI', 'Cash']));
      if (dow === 5) add(date, pick(GROCERY), 'Groceries', rand(900, 2300), pick(['UPI', 'Debit Card']));
      if (i % 12 === 7) add(date, 'Petrol', 'Transportation', rand(800, 1300), 'Debit Card');
    }
  }
  return out;
}

function seedDemoData(targetUserId = null, monthsBack = 3, force = false) {
  let userId = targetUserId;
  if (!userId) {
    const demo = db.prepare('SELECT id FROM users WHERE email = ?').get('demo@expensewise.local');
    userId = demo ? demo.id : 1;
  }

  const existing = db.prepare('SELECT COUNT(*) AS n FROM expenses WHERE user_id = ?').get(userId).n;
  if (existing > 0 && !force) {
    console.log(`Seed skipped: user ${userId} already contains ${existing} expense(s). Existing data was not modified.`);
    return 0;
  }

  // Ensure user has categories
  db.seedUserCategories(userId);
  const cats = new Map(db.prepare('SELECT id, name FROM categories WHERE user_id = ?').all(userId).map((c) => [c.name, c.id]));
  const fallback = cats.get('Other') || [...cats.values()][0];
  if (!fallback) {
    console.log('Seed skipped: no categories exist for user.');
    return 0;
  }

  const rows = generate(todayISO(), monthsBack);
  const insert = db.prepare(
    `INSERT INTO expenses (user_id, title, amount, category_id, expense_date, payment_method, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const now = new Date().toISOString();
  db.transaction(() => {
    rows.forEach((r) => {
      if (!PAYMENT_METHODS.includes(r.method)) throw new Error(`Bad payment method in seed: ${r.method}`);
      insert.run(userId, r.title, r.amount, cats.get(r.category) || fallback, r.date, r.method, r.notes, now, now);
    });
  })();
  console.log(`Seeded ${rows.length} demo expenses for user ${userId}.`);
  return rows.length;
}

if (require.main === module) {
  const arg = process.argv.find((a) => a.startsWith('--months='));
  const n = arg ? Number(arg.split('=')[1]) : 3;
  seedDemoData(null, Number.isInteger(n) && n >= 1 && n <= 12 ? n : 3);
  db.close();
}

module.exports = { seedDemoData };
