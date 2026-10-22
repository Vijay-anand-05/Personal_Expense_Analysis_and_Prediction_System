// End-to-end API & Authentication & Multi-user Isolation test suite.
// Uses a temporary database in the OS temp folder, so it never touches db.sqlite3.
// Run with:  npm test
const os = require('os');
const path = require('path');
const fs = require('fs');
const assert = require('assert');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'expense-test-'));
process.env.DB_PATH = path.join(tmp, 'test.sqlite3');
process.env.FRONTEND_URL = 'http://localhost:5000,http://localhost:5173';
process.env.SESSION_SECRET = 'test-secret-key-for-testing';

const app = require('../app');
const db = require('../database/database');
const { seedDemoData } = require('../database/seed');
const { currentMonth, todayISO } = require('../utils/dateUtils');

let passed = 0;
const server = app.listen(0);
const base = `http://localhost:${server.address().port}/api`;

// Cookie-aware HTTP client
class TestClient {
  constructor() {
    this.cookie = '';
  }

  async call(method, url, body, customHeaders = {}) {
    const headers = {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(this.cookie ? { Cookie: this.cookie } : {}),
      ...customHeaders,
    };

    const res = await fetch(base + url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Capture set-cookie header
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const match = setCookie.match(/connect\.sid=[^;]+/);
      if (match) this.cookie = match[0];
    }

    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // CSV or plain text
    }
    return { status: res.status, json, text, headers: res.headers };
  }
}

async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (e) {
    console.error(`FAIL  ${name}\n      ${e.message}`);
    process.exitCode = 1;
  }
}

(async () => {
  const clientA = new TestClient(); // User Alice
  const clientB = new TestClient(); // User Bob

  await test('health endpoint works without authentication', async () => {
    const r = await clientA.call('GET', '/health');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.json.status, 'ok');
    assert.strictEqual(r.json.database.connected, true);
  });

  await test('unauthenticated requests to protected endpoints return 401', async () => {
    assert.strictEqual((await clientA.call('GET', '/expenses')).status, 401);
    assert.strictEqual((await clientA.call('GET', '/categories')).status, 401);
    assert.strictEqual((await clientA.call('GET', '/analytics/dashboard')).status, 401);
    assert.strictEqual((await clientA.call('GET', '/predictions/month-end')).status, 401);
  });

  await test('user registration and password hashing validation', async () => {
    // Weak password rejection
    const weak = await clientA.call('POST', '/auth/register', {
      name: 'Alice Smith',
      email: 'alice@example.com',
      password: 'short',
      confirmPassword: 'short',
    });
    assert.strictEqual(weak.status, 400);

    // Mismatched passwords rejection
    const mismatch = await clientA.call('POST', '/auth/register', {
      name: 'Alice Smith',
      email: 'alice@example.com',
      password: 'Password123',
      confirmPassword: 'Different123',
    });
    assert.strictEqual(mismatch.status, 400);

    // Valid registration
    const valid = await clientA.call('POST', '/auth/register', {
      name: 'Alice Smith',
      email: 'alice@example.com',
      password: 'Password123',
      confirmPassword: 'Password123',
    });
    assert.strictEqual(valid.status, 201);
    assert.strictEqual(valid.json.data.email, 'alice@example.com');
    assert.ok(clientA.cookie, 'Session cookie established on registration');

    // Verify password is NOT stored in plaintext
    const userRow = db.prepare('SELECT password_hash FROM users WHERE email = ?').get('alice@example.com');
    assert.ok(userRow.password_hash.startsWith('$2'), 'Stored password is encrypted bcrypt hash');
    assert.ok(!userRow.password_hash.includes('Password123'), 'Plaintext password is not exposed in db');

    // Duplicate email rejection
    const dup = await clientA.call('POST', '/auth/register', {
      name: 'Alice Imposter',
      email: 'Alice@example.com',
      password: 'Password123',
      confirmPassword: 'Password123',
    });
    assert.strictEqual(dup.status, 409);
  });

  await test('user login and session authentication', async () => {
    const unauthClient = new TestClient();

    // Invalid password
    const wrong = await unauthClient.call('POST', '/auth/login', {
      email: 'alice@example.com',
      password: 'WrongPassword99',
    });
    assert.strictEqual(wrong.status, 401);

    // Non-existent user
    const noUser = await unauthClient.call('POST', '/auth/login', {
      email: 'nonexistent@example.com',
      password: 'Password123',
    });
    assert.strictEqual(noUser.status, 401);

    // Valid login
    const good = await unauthClient.call('POST', '/auth/login', {
      email: 'alice@example.com',
      password: 'Password123',
      rememberMe: true,
    });
    assert.strictEqual(good.status, 200);
    assert.ok(unauthClient.cookie, 'Cookie received');

    // GET /auth/me returns profile
    const me = await unauthClient.call('GET', '/auth/me');
    assert.strictEqual(me.status, 200);
    assert.strictEqual(me.json.data.user.name, 'Alice Smith');
  });

  let aliceExpenseId;
  let aliceCategoryId;
  await test('user A can create and manage their own categories and expenses', async () => {
    // 12 default categories should be seeded automatically for Alice
    const catsRes = await clientA.call('GET', '/categories');
    assert.strictEqual(catsRes.status, 200);
    assert.strictEqual(catsRes.json.data.length, 12);
    aliceCategoryId = catsRes.json.data[0].id;

    // Create an expense
    const exp = await clientA.call('POST', '/expenses', {
      title: 'Alice Laptop Bag',
      amount: 1450.5,
      category_id: aliceCategoryId,
      expense_date: todayISO(),
      payment_method: 'UPI',
      notes: 'Work essentials',
    });
    assert.strictEqual(exp.status, 201);
    aliceExpenseId = exp.json.data.id;
    assert.strictEqual(exp.json.data.title, 'Alice Laptop Bag');

    // List expenses
    const listRes = await clientA.call('GET', '/expenses');
    assert.strictEqual(listRes.status, 200);
    assert.strictEqual(listRes.json.data.length, 1);
  });

  await test('multi-user isolation: user B cannot view, modify, or delete user A data', async () => {
    // Register User Bob
    const regB = await clientB.call('POST', '/auth/register', {
      name: 'Bob Jones',
      email: 'bob@example.com',
      password: 'Password456',
      confirmPassword: 'Password456',
    });
    assert.strictEqual(regB.status, 201);

    // Bob has his own 12 default categories
    const bobCats = await clientB.call('GET', '/categories');
    assert.strictEqual(bobCats.status, 200);
    assert.strictEqual(bobCats.json.data.length, 12);

    // Bob has 0 expenses initially
    const bobExpenses = await clientB.call('GET', '/expenses');
    assert.strictEqual(bobExpenses.json.data.length, 0);

    // Bob tries to GET Alice's expense by ID -> 404 Not Found
    const getAliceExp = await clientB.call('GET', `/expenses/${aliceExpenseId}`);
    assert.strictEqual(getAliceExp.status, 404);

    // Bob tries to UPDATE Alice's expense -> 404 Not Found
    const updateAliceExp = await clientB.call('PUT', `/expenses/${aliceExpenseId}`, {
      title: 'Hacked by Bob',
      amount: 9999,
      category_id: bobCats.json.data[0].id,
      expense_date: todayISO(),
      payment_method: 'Cash',
    });
    assert.strictEqual(updateAliceExp.status, 404);

    // Bob tries to DELETE Alice's expense -> 404 Not Found
    const delAliceExp = await clientB.call('DELETE', `/expenses/${aliceExpenseId}`);
    assert.strictEqual(delAliceExp.status, 404);

    // Verify Alice's expense is unchanged
    const aliceCheck = await clientA.call('GET', `/expenses/${aliceExpenseId}`);
    assert.strictEqual(aliceCheck.status, 200);
    assert.strictEqual(aliceCheck.json.data.title, 'Alice Laptop Bag');
  });

  await test('seed demo data scopes to user and provides history', async () => {
    // Seed demo data for Alice
    const userAId = db.prepare('SELECT id FROM users WHERE email = ?').get('alice@example.com').id;
    const seededCount = seedDemoData(userAId, 3, true);
    assert.ok(seededCount > 100, `Seeded ${seededCount} expenses for Alice`);

    // Verify idempotency without force
    assert.strictEqual(seedDemoData(userAId, 3), 0);

    // Alice now has expenses
    const aliceList = await clientA.call('GET', '/expenses?limit=100');
    assert.ok(aliceList.json.data.length > 50);

    // Bob STILL has 0 expenses
    const bobList = await clientB.call('GET', '/expenses');
    assert.strictEqual(bobList.json.data.length, 0);
  });

  await test('dashboard and predictions calculations for authenticated user', async () => {
    const dash = await clientA.call('GET', '/analytics/dashboard');
    assert.strictEqual(dash.status, 200);
    const d = dash.json.data;
    assert.ok(d.summary.this_month > 0);
    assert.ok(d.summary.predicted_month_end >= d.summary.this_month);
    assert.strictEqual(d.monthly_trend.length, 6);
    assert.ok(d.recent_expenses.length > 0);

    const me = await clientA.call('GET', '/predictions/month-end');
    assert.strictEqual(me.status, 200);
    assert.ok(me.json.data.projected >= me.json.data.spent);

    const nm = await clientA.call('GET', '/predictions/next-month');
    assert.strictEqual(nm.status, 200);
    assert.ok(nm.json.data.forecast > 0);

    const ins = await clientA.call('GET', '/predictions/insights');
    assert.strictEqual(ins.status, 200);
    assert.ok(ins.json.data.insights.length > 0);
  });

  await test('safe category deletion with expense reassignment', async () => {
    // Find a category with expenses for Alice
    const usedCat = (await clientA.call('GET', '/categories')).json.data.find((c) => c.expense_count > 0);
    const otherCat = (await clientA.call('GET', '/categories')).json.data.find((c) => c.id !== usedCat.id);

    // Attempting delete without reassign_to should fail with 409
    const failedDel = await clientA.call('DELETE', `/categories/${usedCat.id}`);
    assert.strictEqual(failedDel.status, 409);

    // Delete with safe reassignment
    const successDel = await clientA.call('DELETE', `/categories/${usedCat.id}?reassign_to=${otherCat.id}`);
    assert.strictEqual(successDel.status, 200);

    // Verify category deleted and expenses reassigned
    const verifyCats = await clientA.call('GET', '/categories');
    assert.ok(!verifyCats.json.data.some((c) => c.id === usedCat.id));
  });

  await test('profile preferences and password change', async () => {
    // Update profile
    const profile = await clientA.call('PUT', '/auth/profile', {
      name: 'Alice M. Smith',
      pageSize: 50,
    });
    assert.strictEqual(profile.status, 200);
    assert.strictEqual(profile.json.data.display_name, 'Alice M. Smith');
    assert.strictEqual(profile.json.data.page_size, 50);

    // Change password
    const pwChange = await clientA.call('POST', '/auth/change-password', {
      currentPassword: 'Password123',
      newPassword: 'NewSecretPass123',
    });
    assert.strictEqual(pwChange.status, 200);

    // Login with new password
    const reLogin = await (new TestClient()).call('POST', '/auth/login', {
      email: 'alice@example.com',
      password: 'NewSecretPass123',
    });
    assert.strictEqual(reLogin.status, 200);
  });

  await test('truncate expenses and reset tables endpoints', async () => {
    // Truncate Alice's expenses
    const truncRes = await clientA.call('POST', '/expenses/truncate');
    assert.strictEqual(truncRes.status, 200);
    assert.ok(truncRes.json.data.deletedCount > 0);

    const listAfter = await clientA.call('GET', '/expenses');
    assert.strictEqual(listAfter.json.data.length, 0);

    // Seed sample demo data with clearFirst
    const seedRes = await clientA.call('POST', '/auth/seed-demo', { months: 2, clearFirst: true });
    assert.strictEqual(seedRes.status, 200);
    assert.ok(seedRes.json.data.seeded > 0);

    const listSeeded = await clientA.call('GET', '/expenses');
    assert.ok(listSeeded.json.data.length > 0);

    // Reset tables
    const resetRes = await clientA.call('POST', '/expenses/reset-tables');
    assert.strictEqual(resetRes.status, 200);
    const listReset = await clientA.call('GET', '/expenses');
    assert.strictEqual(listReset.json.data.length, 0);
    const catsReset = await clientA.call('GET', '/categories');
    assert.strictEqual(catsReset.json.data.length, 12);
  });

  await test('logout terminates user session', async () => {
    const logoutRes = await clientA.call('POST', '/auth/logout');
    assert.strictEqual(logoutRes.status, 200);

    // Subsequent call should be 401
    const check = await clientA.call('GET', '/auth/me');
    assert.strictEqual(check.status, 401);
  });

  await test('CORS origin restrictions work as expected', async () => {
    const ok = await fetch(base + '/health', { headers: { Origin: 'http://localhost:5000' } });
    assert.strictEqual(ok.headers.get('access-control-allow-origin'), 'http://localhost:5000');

    const bad = await fetch(base + '/health', { headers: { Origin: 'http://malicious-site.example' } });
    assert.strictEqual(bad.status, 403);
  });

  server.close();
  db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${passed} tests passed${process.exitCode ? ' (with failures above)' : ''}`);
})();
