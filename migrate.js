const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'spendwise.db'));
db.pragma('journal_mode = WAL');

try {
  db.exec('BEGIN TRANSACTION;');

  // 1. Create the new users table without the NOT NULL constraint on password
  //    and with new auth_provider and oauth_id columns
  db.exec(`
    CREATE TABLE users_new (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT,
      phone_number TEXT,
      preferences TEXT,
      auth_provider TEXT DEFAULT 'local',
      oauth_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Copy data over
  db.exec(`
    INSERT INTO users_new (user_id, name, email, password, phone_number, preferences, created_at)
    SELECT user_id, name, email, password, phone_number, preferences, created_at
    FROM users;
  `);

  // 3. Drop old table and rename new one
  // Note: Since accounts, transactions, etc have foreign keys referencing users,
  // SQLite handles the rename safely if PRAGMA foreign_keys = OFF, or we can just disable it temporarily.
  
  // Wait, let's rollback and disable foreign keys first to be safe
  db.exec('ROLLBACK;');
} catch (e) {
  console.log("Initial attempt rolled back.");
}

try {
  db.pragma('foreign_keys = OFF');
  db.exec('BEGIN TRANSACTION;');

  db.exec(`
    CREATE TABLE users_new (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT,
      phone_number TEXT,
      preferences TEXT,
      auth_provider TEXT DEFAULT 'local',
      oauth_id TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    INSERT INTO users_new (user_id, name, email, password, phone_number, preferences, created_at)
    SELECT user_id, name, email, password, phone_number, preferences, created_at
    FROM users;
  `);

  db.exec('DROP TABLE users;');
  db.exec('ALTER TABLE users_new RENAME TO users;');

  db.exec('COMMIT;');
  db.pragma('foreign_keys = ON');

  console.log('Successfully migrated users table to support OAuth!');
} catch (error) {
  db.exec('ROLLBACK;');
  console.error('Migration failed:', error);
}
