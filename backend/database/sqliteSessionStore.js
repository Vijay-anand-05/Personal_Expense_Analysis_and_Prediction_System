const session = require('express-session');

class SQLiteSessionStore extends session.Store {
  constructor(options = {}) {
    super();
    this.db = options.db;
    if (!this.db) {
      throw new Error('SQLiteSessionStore requires a better-sqlite3 database instance.');
    }
    this.table = options.table || 'sessions';

    // Prepare statements for high efficiency
    this.stmtGet = this.db.prepare(`SELECT sess FROM ${this.table} WHERE sid = ? AND expired > ?`);
    this.stmtSet = this.db.prepare(`INSERT OR REPLACE INTO ${this.table} (sid, sess, expired) VALUES (?, ?, ?)`);
    this.stmtDestroy = this.db.prepare(`DELETE FROM ${this.table} WHERE sid = ?`);
    this.stmtTouch = this.db.prepare(`UPDATE ${this.table} SET expired = ? WHERE sid = ?`);
    this.stmtPrune = this.db.prepare(`DELETE FROM ${this.table} WHERE expired <= ?`);

    // Prune expired sessions every 15 minutes
    this.pruneInterval = setInterval(() => this.prune(), 15 * 60 * 1000);
    if (this.pruneInterval.unref) this.pruneInterval.unref();
  }

  get(sid, callback) {
    try {
      const now = Date.now();
      const row = this.stmtGet.get(sid, now);
      if (!row) return callback(null, null);
      const data = JSON.parse(row.sess);
      return callback(null, data);
    } catch (err) {
      return callback(err);
    }
  }

  set(sid, sess, callback = () => {}) {
    try {
      const maxAge = sess && sess.cookie && typeof sess.cookie.maxAge === 'number'
        ? sess.cookie.maxAge
        : 7 * 24 * 60 * 60 * 1000;
      const expired = Date.now() + maxAge;
      const data = JSON.stringify(sess);
      this.stmtSet.run(sid, data, expired);
      return callback(null);
    } catch (err) {
      return callback(err);
    }
  }

  destroy(sid, callback = () => {}) {
    try {
      this.stmtDestroy.run(sid);
      return callback(null);
    } catch (err) {
      return callback(err);
    }
  }

  touch(sid, sess, callback = () => {}) {
    try {
      const maxAge = sess && sess.cookie && typeof sess.cookie.maxAge === 'number'
        ? sess.cookie.maxAge
        : 7 * 24 * 60 * 60 * 1000;
      const expired = Date.now() + maxAge;
      this.stmtTouch.run(expired, sid);
      return callback(null);
    } catch (err) {
      return callback(err);
    }
  }

  prune() {
    try {
      this.stmtPrune.run(Date.now());
    } catch (err) {
      // ignore prune errors
    }
  }
}

module.exports = SQLiteSessionStore;
