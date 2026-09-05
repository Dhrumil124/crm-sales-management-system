const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Database file path inside backend/src/database/
const dbPath = path.join(__dirname, "crm.sqlite");

// Initialize SQLite database instance
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Failed to connect to SQLite database:", err.message);
  } else {
    // Enable Foreign Key constraint support
    db.run("PRAGMA foreign_keys = ON;");
  }
});

// Initialize Day 2 Authentication Tables: organizations & users
db.serialize(() => {
  // 1. Organizations Table
  db.run(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Users Table (belongs to an organization)
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    )
  `);
});

/**
 * Promise-based query helpers for async/await usage
 */
const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
};

/**
 * Executes a sequence of queries within a strict database transaction.
 * If any error is thrown, the entire transaction is rolled back.
 */
const runTransaction = async (callback) => {
  await run("BEGIN TRANSACTION");
  try {
    const result = await callback({ run, get, all });
    await run("COMMIT");
    return result;
  } catch (error) {
    await run("ROLLBACK");
    throw error;
  }
};

module.exports = {
  db,
  run,
  get,
  all,
  runTransaction
};
