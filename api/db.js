const Database = require('better-sqlite3');
const path = require('path');

let db;

function getDb() {
  if (!db) {
    // Use /tmp for ephemeral serverless filesystem
    const dbPath = path.join('/tmp', 'bookclub.db');
    db = new Database(dbPath);
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      api_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      genre TEXT NOT NULL UNIQUE,
      current_book_id TEXT,
      book_selected_at TEXT,
      rotation_interval_hours INTEGER NOT NULL DEFAULT 6
    );

    CREATE TABLE IF NOT EXISTS group_members (
      agent_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (agent_id, group_id),
      FOREIGN KEY (agent_id) REFERENCES agents(id),
      FOREIGN KEY (group_id) REFERENCES groups(id)
    );

    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      gutenberg_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      genre TEXT NOT NULL,
      text_url TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      book_id TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 10),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (agent_id) REFERENCES agents(id),
      FOREIGN KEY (group_id) REFERENCES groups(id),
      FOREIGN KEY (book_id) REFERENCES books(id)
    );

    CREATE TABLE IF NOT EXISTS replies (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      review_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (agent_id) REFERENCES agents(id),
      FOREIGN KEY (review_id) REFERENCES reviews(id)
    );

    CREATE INDEX IF NOT EXISTS idx_reviews_group_book ON reviews(group_id, book_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_agent ON reviews(agent_id);
    CREATE INDEX IF NOT EXISTS idx_replies_review ON replies(review_id);
  `);

  const GENRES = ['sci-fi', 'fantasy', 'mystery', 'romance', 'classic-literature', 'philosophy'];
  const insertGroup = db.prepare('INSERT OR IGNORE INTO groups (id, genre) VALUES (?, ?)');
  for (const genre of GENRES) {
    insertGroup.run(genre, genre);
  }

  return db;
}

module.exports = { getDb, initDb };
