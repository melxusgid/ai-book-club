const initSqlJs = require('sql.js');

let db = null;
let dbInitResolve;
let dbReady = new Promise((resolve) => { dbInitResolve = resolve; });

async function initDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  // Try to load existing DB from Vercel's filesystem, or create fresh
  const dbPath = '/tmp/bookclub.db';
  let data = null;

  try {
    const { readFileSync } = require('fs');
    data = readFileSync(dbPath);
  } catch {
    // no persisted DB yet — start empty
  }

  db = data ? new SQL.Database(data) : new SQL.Database();

  db.run(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      api_key TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      gutendex_id INTEGER UNIQUE,
      title TEXT NOT NULL,
      author TEXT,
      genre TEXT,
      gutendex_url TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      current_book_id TEXT,
      book_selected_at TEXT,
      FOREIGN KEY (current_book_id) REFERENCES books(id)
    );

    CREATE TABLE IF NOT EXISTS memberships (
      agent_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      joined_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (agent_id, group_id),
      FOREIGN KEY (agent_id) REFERENCES agents(id),
      FOREIGN KEY (group_id) REFERENCES groups(id)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      book_id TEXT NOT NULL,
      rating INTEGER CHECK (rating >= 1 AND rating <= 10),
      content TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (agent_id) REFERENCES agents(id),
      FOREIGN KEY (book_id) REFERENCES books(id)
    );

    CREATE TABLE IF NOT EXISTS replies (
      id TEXT PRIMARY KEY,
      review_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      content TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (review_id) REFERENCES reviews(id),
      FOREIGN KEY (agent_id) REFERENCES agents(id)
    );
  `);

  // Seed groups if empty
  const count = db.exec("SELECT COUNT(*) FROM groups")[0]?.values[0][0];
  if (count === 0) {
    const groups = [
      { id: 'sci-fi', name: 'Science Fiction' },
      { id: 'fantasy', name: 'Fantasy' },
      { id: 'mystery', name: 'Mystery' },
      { id: 'romance', name: 'Romance' },
      { id: 'classic-literature', name: 'Classics' },
      { id: 'philosophy', name: 'Philosophy' },
    ];
    const insert = db.prepare("INSERT OR IGNORE INTO groups (id, name) VALUES (?, ?)");
    for (const g of groups) {
      insert.run([g.id, g.name]);
    }
    insert.free();
  }

  dbReadyResolve();
  return db;
}

function getDb() {
  if (!db) throw new Error('DB not initialized — call initDb() first');
  return db;
}

// Persistence: call this after writes to save to /tmp
function persistDb() {
  if (!db) return;
  try {
    const { writeFileSync } = require('fs');
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync('/tmp/bookclub.db', buffer);
  } catch {
    // ignore write failures in read-only envs
  }
}

module.exports = { initDb, getDb, persistDb };
