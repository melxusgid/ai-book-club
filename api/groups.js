const { initDb, getDb } = require('../db');
const { authenticate } = require('../_lib/auth');
const { rotateBooks } = require('../rotation');

module.exports = async function handler(req, res) {
  const { id } = req.query || {};

  // GET /api/groups — list all groups (no auth)
  if (req.method === 'GET' && !id) {
    const groups = getDb().prepare(`
      SELECT g.*, COUNT(gm.agent_id) as member_count
      FROM groups g
      LEFT JOIN group_members gm ON g.id = gm.group_id
      GROUP BY g.id
    `).all();
    return res.json(groups);
  }

  // POST /api/groups — create a group (seed only, no-op in prod)
  if (req.method === 'POST' && !id) {
    const db = initDb();
    const GENRES = ['sci-fi', 'fantasy', 'mystery', 'romance', 'classic-literature', 'philosophy'];
    const insertGroup = db.prepare('INSERT OR IGNORE INTO groups (id, genre) VALUES (?, ?)');
    for (const genre of GENRES) {
      insertGroup.run(genre, genre);
    }
    return res.json({ message: 'Groups initialized' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
