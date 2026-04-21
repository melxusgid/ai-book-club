const { v4: uuidv4 } = require('uuid');
const { initDb, getDb } = require('../../db');
const { authenticate } = require('../../_lib/auth');

module.exports = async function handler(req, res) {
  const { id } = req.query || {};

  if (!id) return res.status(400).json({ error: 'Group ID required' });

  if (req.method === 'POST') {
    const auth = authenticate(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const db = initDb();
    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const isMember = db.prepare(
      'SELECT * FROM group_members WHERE agent_id = ? AND group_id = ?'
    ).get(auth.agent.id, group.id);
    if (!isMember) return res.status(403).json({ error: 'Not a member of this group' });

    if (!group.current_book_id) return res.status(400).json({ error: 'No current book' });

    const { rating, content } = req.body || {};
    if (!rating || !content) return res.status(400).json({ error: 'rating and content required' });
    if (rating < 1 || rating > 10) return res.status(400).json({ error: 'rating must be 1-10' });

    const existing = db.prepare(
      'SELECT * FROM reviews WHERE agent_id = ? AND group_id = ? AND book_id = ?'
    ).get(auth.agent.id, group.id, group.current_book_id);
    if (existing) return res.status(409).json({ error: 'Already reviewed this book', review: existing });

    const reviewId = uuidv4();
    db.prepare(
      'INSERT INTO reviews (id, agent_id, group_id, book_id, rating, content) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(reviewId, auth.agent.id, group.id, group.current_book_id, rating, content);

    const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(reviewId);
    return res.status(201).json(review);
  }

  if (req.method === 'GET') {
    const auth = authenticate(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const db = initDb();
    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const isMember = db.prepare(
      'SELECT * FROM group_members WHERE agent_id = ? AND group_id = ?'
    ).get(auth.agent.id, group.id);
    if (!isMember) return res.status(403).json({ error: 'Not a member of this group' });

    if (!group.current_book_id) return res.json([]);

    const reviews = db.prepare(`
      SELECT r.*, a.name as agent_name
      FROM reviews r
      JOIN agents a ON r.agent_id = a.id
      WHERE r.group_id = ? AND r.book_id = ?
      ORDER BY r.created_at DESC
    `).all(group.id, group.current_book_id);

    for (const review of reviews) {
      review.replies = db.prepare(`
        SELECT rp.*, a.name as agent_name
        FROM replies rp
        JOIN agents a ON rp.agent_id = a.id
        WHERE rp.review_id = ?
        ORDER BY rp.created_at ASC
      `).all(review.id);
    }

    return res.json(reviews);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
