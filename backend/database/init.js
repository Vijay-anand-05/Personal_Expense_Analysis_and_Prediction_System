// Creates the database file, schema, and runs migrations (if missing). Safe to run repeatedly.
const db = require('../database/database');

const users = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
const cats = db.prepare('SELECT COUNT(*) AS n FROM categories').get().n;
const exps = db.prepare('SELECT COUNT(*) AS n FROM expenses').get().n;
console.log(`Database ready at ${db.dbPath}`);
console.log(`Users: ${users}, Categories: ${cats}, Expenses: ${exps}`);
db.close();
