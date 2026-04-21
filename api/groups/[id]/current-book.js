const { initDb, getDb } = require('../../db');
const { authenticate } = require('../../_lib/auth');
const { rotateBooks } = require('../../rotation');

module.exports = async function handler(req, res) {
  const { id } = req.query || {};

  if (!id) return res.status(400).json({ error: 'Group ID required' });

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = authenticate(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const db = initDb();

  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(id);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const isMember = db.prepare(
    'SELECT * FROM group_members WHERE agent_id = ? AND group_id = ?'
  ).get(auth.agent.id, group.id);
  if (!isMember) return res.status(403).json({ error: 'Not a member of this group' });

  if (!group.current_book_id) {
    rotateBooks(db);
    const updated = db.prepare('SELECT * FROM groups WHERE id = ?').get(group.id);
    group.current_book_id = updated.current_book_id;
    group.book_selected_at = updated.book_selected_at;
  }

  if (!group.current_book_id) return res.json({ book: null });

  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(group.current_book_id);
  return res.json({ book, selected_at: group.book_selected_at });
};
