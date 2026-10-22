/**
 * Demo and initial data seeder for browser-based IndexedDB.
 * Deterministic pseudo-random generation matching original system behavior.
 */

import { tx, getStoreItem, getAllStoreItems, putStoreItem, addStoreItem, getFromIndex } from './db.js';
import { DEFAULT_CATEGORIES, PAYMENT_METHODS } from './defaultCategories.js';
import { generateSalt, hashPassword } from './crypto.js';
import { addDays, addMonths, currentMonth, daysInclusive, monthRange, todayISO } from '../services/dateUtils.js';

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

export function generateSeedExpenses(today, monthsBack = 3) {
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

/**
 * Seed default categories for a user if they don't have any.
 */
export async function seedUserCategories(userId) {
  return tx('categories', 'readwrite', async (store) => {
    const userIndex = store.index('user_id');
    const existing = await userIndex.getAll(userId);
    if (existing.length === 0) {
      const now = new Date().toISOString();
      for (const cat of DEFAULT_CATEGORIES) {
        await addStoreItem(store, {
          user_id: userId,
          name: cat.name,
          color: cat.color,
          icon: cat.icon,
          monthly_budget: cat.monthly_budget,
          created_at: now,
        });
      }
    }
  });
}

/**
 * Seed demo expenses for target user.
 */
export async function seedDemoData(targetUserId, monthsBack = 3, force = true) {
  let userId = targetUserId;
  if (!userId) {
    const users = await tx('users', 'readonly', (store) => store.getAll());
    const demo = users.find((u) => u.email === 'demo@expensewise.local');
    userId = demo ? demo.id : (users[0]?.id || 1);
  }

  await seedUserCategories(userId);

  return tx(['categories', 'expenses'], 'readwrite', async ([catStore, expStore]) => {
    const userExpIndex = expStore.index('user_id');
    const existing = await userExpIndex.getAll(userId);

    if (existing.length > 0 && !force) {
      return 0;
    }

    const catIndex = catStore.index('user_id');
    const userCats = await catIndex.getAll(userId);
    const catMap = new Map(userCats.map((c) => [c.name, c.id]));
    const fallbackId = catMap.get('Other') || userCats[0]?.id;

    if (!fallbackId) {
      return 0;
    }

    const rows = generateSeedExpenses(todayISO(), monthsBack);
    const now = new Date().toISOString();

    for (const r of rows) {
      const categoryId = catMap.get(r.category) || fallbackId;
      await addStoreItem(expStore, {
        user_id: userId,
        title: r.title,
        amount: r.amount,
        category_id: categoryId,
        expense_date: r.date,
        payment_method: r.method,
        notes: r.notes || '',
        created_at: now,
        updated_at: now,
      });
    }

    return rows.length;
  });
}

/**
 * Ensures the initial demo profile and seed data exist on first application launch.
 */
export async function ensureDatabaseInitialized() {
  return tx(['users', 'sessions', 'user_settings', 'categories', 'expenses'], 'readwrite', async ([uStore, sStore, setStore, cStore, eStore]) => {
    const users = await uStore.getAll();
    let demoUser = users.find((u) => u.email === 'demo@expensewise.local');

    if (!demoUser) {
      const now = new Date().toISOString();
      const salt = generateSalt();
      const passwordHash = await hashPassword('Demo@123', salt);

      const userId = await addStoreItem(uStore, {
        name: 'Demo User',
        email: 'demo@expensewise.local',
        password_hash: passwordHash,
        salt,
        created_at: now,
        updated_at: now,
      });

      demoUser = { id: userId, name: 'Demo User', email: 'demo@expensewise.local' };

      await addStoreItem(setStore, {
        user_id: userId,
        display_name: 'Demo User',
        page_size: 10,
        theme: 'light',
        created_at: now,
        updated_at: now,
      });

      // Default categories
      const catMap = new Map();
      for (const cat of DEFAULT_CATEGORIES) {
        const catId = await addStoreItem(cStore, {
          user_id: userId,
          name: cat.name,
          color: cat.color,
          icon: cat.icon,
          monthly_budget: cat.monthly_budget,
          created_at: now,
        });
        catMap.set(cat.name, catId);
      }

      // Generate seed expenses for demo user
      const fallbackId = catMap.get('Other') || [...catMap.values()][0];
      const rows = generateSeedExpenses(todayISO(), 3);
      for (const r of rows) {
        await addStoreItem(eStore, {
          user_id: userId,
          title: r.title,
          amount: r.amount,
          category_id: catMap.get(r.category) || fallbackId,
          expense_date: r.date,
          payment_method: r.method,
          notes: r.notes || '',
          created_at: now,
          updated_at: now,
        });
      }

      // Automatically sign in as Demo User on fresh load if no session exists
      const currentSession = await sStore.get('active_session');
      if (!currentSession) {
        await putStoreItem(sStore, {
          key: 'active_session',
          userId: demoUser.id,
          email: demoUser.email,
          name: demoUser.name,
          loginTime: Date.now(),
        });
      }
    }
  });
}
