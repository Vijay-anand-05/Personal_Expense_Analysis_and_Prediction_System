import assert from 'node:assert';
import { currentMonth, monthRange, addMonths, round2, isValidISODate, daysInMonth } from '../frontend/js/services/dateUtils.js';
import * as predictionService from '../frontend/js/services/predictionService.js';
import * as analyticsService from '../frontend/js/services/analyticsService.js';
import { hashPassword, verifyPassword } from '../frontend/js/storage/crypto.js';

console.log('--- Starting Browser Services Automated Unit Tests ---');

// 1. Date Utils Tests
console.log('1. Testing dateUtils...');
const m = currentMonth();
assert.match(m, /^\d{4}-\d{2}$/, 'currentMonth should format as YYYY-MM');

const feb2024 = monthRange('2024-02');
assert.strictEqual(feb2024.days, 29, '2024-02 should have 29 days (leap year)');
assert.strictEqual(feb2024.start, '2024-02-01');
assert.strictEqual(feb2024.end, '2024-02-29');

const feb2023 = monthRange('2023-02');
assert.strictEqual(feb2023.days, 28, '2023-02 should have 28 days');

assert.strictEqual(addMonths('2024-01', 1), '2024-02');
assert.strictEqual(addMonths('2024-01', -1), '2023-12');
assert.strictEqual(addMonths('2024-12', 1), '2025-01');
assert.strictEqual(round2(12.3456), 12.35);
assert.strictEqual(isValidISODate('2024-05-15'), true);
assert.strictEqual(isValidISODate('2024-02-30'), false);
console.log('   dateUtils tests PASSED.');

// 2. Crypto Security Tests
console.log('2. Testing storage/crypto...');
const testPass = 'Secret@123';
const { hash, salt } = await hashPassword(testPass);
assert.ok(hash && salt, 'Password should generate hash and salt');
assert.notStrictEqual(hash, testPass, 'Hash must not equal plaintext');

const valid = await verifyPassword(testPass, hash, salt);
assert.strictEqual(valid, true, 'Matching password must verify to true');

const invalid = await verifyPassword('WrongPassword', hash, salt);
assert.strictEqual(invalid, false, 'Wrong password must verify to false');
console.log('   crypto tests PASSED.');

// 3. Analytics Aggregations Tests
console.log('3. Testing analyticsService...');
const sampleCategories = [
  { id: 1, name: 'Food & Dining', budget: 500, color: '#2A9D8F', icon: 'utensils' },
  { id: 2, name: 'Transportation', budget: 200, color: '#E76F51', icon: 'car' },
  { id: 3, name: 'Shopping', budget: 150, color: '#F4A261', icon: 'shopping-bag' },
];

const lastMonthStr = addMonths(m, -1);
const twoMonthsAgoStr = addMonths(m, -2);

const sampleExpenses = [
  { id: 101, user_id: 1, category_id: 1, amount: 50, expense_date: '2024-03-05', title: 'Groceries' },
  { id: 102, user_id: 1, category_id: 1, amount: 25.5, expense_date: '2024-03-12', title: 'Lunch' },
  { id: 103, user_id: 1, category_id: 2, amount: 60, expense_date: '2024-03-15', title: 'Fuel' },
  { id: 104, user_id: 1, category_id: 3, amount: 100, expense_date: '2024-02-10', title: 'Shoes' },
  { id: 105, user_id: 1, category_id: 1, amount: 120, expense_date: '2024-02-20', title: 'Dinner' },
  { id: 106, user_id: 1, category_id: 1, amount: 300, expense_date: `${lastMonthStr}-10`, title: 'Recent Grocery' },
  { id: 107, user_id: 1, category_id: 2, amount: 200, expense_date: `${twoMonthsAgoStr}-15`, title: 'Recent Fuel' },
];

const marTotal = analyticsService.monthTotalMem(sampleExpenses, '2024-03');
assert.strictEqual(marTotal, 135.5, 'March total should be 50 + 25.5 + 60 = 135.5');

const febTotal = analyticsService.monthTotalMem(sampleExpenses, '2024-02');
assert.strictEqual(febTotal, 220, 'February total should be 100 + 120 = 220');

const budget = analyticsService.totalBudgetMem(sampleCategories);
assert.strictEqual(budget, 850, 'Total budget should be 500 + 200 + 150 = 850');

const breakdown = analyticsService.categoryBreakdownMem(sampleCategories, sampleExpenses, '2024-03-01', '2024-03-31');
assert.strictEqual(breakdown.length, 3);
const foodCat = breakdown.find((c) => c.id === 1);
assert.strictEqual(foodCat.total, 75.5);
assert.strictEqual(foodCat.count, 2);
console.log('   analyticsService tests PASSED.');

// 4. Prediction Algorithms Tests
console.log('4. Testing predictionService...');
// Test WMA with known values: 100, 200, 300 (WMA weights 0.5 for most recent, 0.3 for middle, 0.2 for oldest)
// Expected = 300*0.5 + 200*0.3 + 100*0.2 = 150 + 60 + 20 = 230
const wmaResult = predictionService.weightedAverage([
  { month: '2024-01', total: 100 },
  { month: '2024-02', total: 200 },
  { month: '2024-03', total: 300 },
]);
assert.strictEqual(wmaResult.value, 230, 'WMA of [100, 200, 300] must equal 230');

// Test Next Month Forecast
const nextMonthForecast = predictionService.nextMonthMem(sampleCategories, sampleExpenses);
assert.ok(nextMonthForecast.forecast > 0, 'Next month predicted total must be > 0');
assert.ok(Array.isArray(nextMonthForecast.categories), 'Next month forecast must return category list');

// Test Month End Forecast for past closed month
const pastMonthEnd = predictionService.monthEndMem(sampleCategories, sampleExpenses, '2024-02');
assert.strictEqual(pastMonthEnd.projected, 220, 'Past month projection must equal actual total');
assert.ok(typeof pastMonthEnd.confidence.label === 'string' && pastMonthEnd.confidence.label.length > 0);

// Test Insights Generation
const insights = predictionService.insightsMem(sampleCategories, sampleExpenses, '2024-03');
assert.ok(Array.isArray(insights.insights), 'insights.insights should be an array');
assert.ok(Array.isArray(insights.suggestions), 'insights.suggestions should be an array');
console.log('   predictionService tests PASSED.');

console.log('\nALL UNIT TESTS PASSED SUCCESSFULLY! (100% Client-Side Engine Verified)');
