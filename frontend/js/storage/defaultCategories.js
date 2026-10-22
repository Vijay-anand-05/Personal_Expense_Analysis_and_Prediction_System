/**
 * Default categories and payment methods for Personal Expense Analysis and Prediction System.
 */

export const DEFAULT_CATEGORIES = [
  { name: 'Food & Dining', color: '#F4A261', icon: 'utensils', monthly_budget: 6000 },
  { name: 'Transportation', color: '#2A9D8F', icon: 'car', monthly_budget: 3000 },
  { name: 'Shopping', color: '#9B72AA', icon: 'shopping-bag', monthly_budget: 4000 },
  { name: 'Bills & Utilities', color: '#173F35', icon: 'receipt', monthly_budget: 3500 },
  { name: 'Entertainment', color: '#E76F8B', icon: 'film', monthly_budget: 1500 },
  { name: 'Healthcare', color: '#C0504D', icon: 'heart-pulse', monthly_budget: 1500 },
  { name: 'Education', color: '#4D7EA8', icon: 'graduation-cap', monthly_budget: 2000 },
  { name: 'Travel', color: '#5BA4A4', icon: 'plane', monthly_budget: 3000 },
  { name: 'Groceries', color: '#7DB46C', icon: 'shopping-cart', monthly_budget: 6000 },
  { name: 'Housing', color: '#8C6D46', icon: 'home', monthly_budget: 13000 },
  { name: 'Personal Care', color: '#D4A5A5', icon: 'sparkles', monthly_budget: 1500 },
  { name: 'Other', color: '#9AA59C', icon: 'tag', monthly_budget: 1500 },
];

export const ICON_IDS = [
  ...new Set(DEFAULT_CATEGORIES.map((c) => c.icon)),
  'wallet',
  'coffee',
  'gift',
  'dumbbell',
  'smartphone',
  'book-open',
];

export const PAYMENT_METHODS = ['Cash', 'UPI', 'Debit Card', 'Credit Card', 'Bank Transfer', 'Other'];
