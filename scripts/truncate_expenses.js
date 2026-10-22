const fs = require('fs');
const path = require('path');
const Database = require(path.resolve(__dirname, '../backend/node_modules/better-sqlite3'));

const dbPath = path.resolve(__dirname, '../backend/db.sqlite3');
const backupPath = path.resolve(__dirname, '../backend/db.sqlite3.before_truncate.bak');

if (!fs.existsSync(dbPath)) {
  console.error('Database file not found at:', dbPath);
  process.exit(1);
}

// Backup current database
fs.copyFileSync(dbPath, backupPath);
console.log('Backed up database to:', backupPath);

const db = new Database(dbPath);

const beforeCount = db.prepare('SELECT COUNT(*) as count FROM expenses').get().count;
console.log('Expenses count before truncate:', beforeCount);

const truncateTx = db.transaction(() => {
  db.prepare('DELETE FROM expenses').run();
  try {
    db.prepare("DELETE FROM sqlite_sequence WHERE name = 'expenses'").run();
  } catch (err) {
    console.log('Note on sqlite_sequence:', err.message);
  }
});

truncateTx();
db.pragma('vacuum');

const afterCount = db.prepare('SELECT COUNT(*) as count FROM expenses').get().count;
console.log('Expenses count after truncate:', afterCount);

db.close();
console.log('Expenses table successfully truncated.');
