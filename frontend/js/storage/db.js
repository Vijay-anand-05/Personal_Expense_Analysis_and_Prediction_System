/**
 * IndexedDB Database Layer for Personal Expense Analysis and Prediction System.
 * Fully browser-local persistence for users, categories, expenses, settings, and sessions.
 */

const DB_NAME = 'personal_expense_db';
const DB_VERSION = 1;

let dbInstance = null;

export function openDatabase() {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. Users Store
      if (!db.objectStoreNames.contains('users')) {
        const userStore = db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
        userStore.createIndex('email', 'email', { unique: true });
      }

      // 2. Sessions Store (active local session)
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'key' });
      }

      // 3. User Settings Store
      if (!db.objectStoreNames.contains('user_settings')) {
        db.createObjectStore('user_settings', { keyPath: 'user_id' });
      }

      // 4. Categories Store
      if (!db.objectStoreNames.contains('categories')) {
        const catStore = db.createObjectStore('categories', { keyPath: 'id', autoIncrement: true });
        catStore.createIndex('user_id', 'user_id', { unique: false });
        catStore.createIndex('user_name', ['user_id', 'name'], { unique: true });
      }

      // 5. Expenses Store
      if (!db.objectStoreNames.contains('expenses')) {
        const expStore = db.createObjectStore('expenses', { keyPath: 'id', autoIncrement: true });
        expStore.createIndex('user_id', 'user_id', { unique: false });
        expStore.createIndex('user_date', ['user_id', 'expense_date'], { unique: false });
        expStore.createIndex('category_id', 'category_id', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject(new Error(`Failed to open IndexedDB: ${event.target.error?.message || 'Unknown error'}`));
    };
  });
}

/** Helper to run a transaction in a promise */
export async function tx(storeNames, mode, callback) {
  const db = await openDatabase();
  const transaction = db.transaction(storeNames, mode);
  const stores = Array.isArray(storeNames)
    ? storeNames.map((name) => transaction.objectStore(name))
    : transaction.objectStore(storeNames);

  return new Promise((resolve, reject) => {
    let result;
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = (e) => reject(transaction.error || e.target?.error);
    transaction.onabort = (e) => reject(new Error('Transaction aborted'));

    try {
      result = callback(stores, transaction);
    } catch (err) {
      reject(err);
    }
  });
}

/** Promisified store get */
export function getStoreItem(store, key) {
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/** Promisified store getAll */
export function getAllStoreItems(store, query, count) {
  return new Promise((resolve, reject) => {
    const req = store.getAll(query, count);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/** Promisified index get */
export function getFromIndex(index, key) {
  return new Promise((resolve, reject) => {
    const req = index.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/** Promisified index getAll */
export function getAllFromIndex(index, query, count) {
  return new Promise((resolve, reject) => {
    const req = index.getAll(query, count);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/** Promisified store put (upsert) */
export function putStoreItem(store, value) {
  return new Promise((resolve, reject) => {
    const req = store.put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Promisified store add (insert) */
export function addStoreItem(store, value) {
  return new Promise((resolve, reject) => {
    const req = store.add(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Promisified store delete */
export function deleteStoreItem(store, key) {
  return new Promise((resolve, reject) => {
    const req = store.delete(key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

/** Promisified store clear */
export function clearStore(store) {
  return new Promise((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

/** Promisified store count */
export function countStoreItems(store, query) {
  return new Promise((resolve, reject) => {
    const req = store.count(query);
    req.onsuccess = () => resolve(req.result || 0);
    req.onerror = () => reject(req.error);
  });
}
