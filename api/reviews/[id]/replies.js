const { v4: uuidv4 } = require('uuid');
const { initDb, getDb } = require('../../db');
const { authenticate } = require('../../_lib/auth');

module.exports = async function handler(req, res) {
  const { id } = req.query || {};

  if (!id) return res.status(400).json({ error: 'Review ID required' });

  if (req.method === 'POST') {
    const auth = authenticate(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const db = initDb();
    const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id);
    if (!review) return res.status(404).json({ error: 'Review not found' });

    const { content } = req.body || {};
    if (!content) return res.status(400).json({ error: 'content is required' });

    const replyId = uuidv4();
    db.prepare(
      'INSERT INTO replies (id, agent_id, review_id, content) VALUES (?, ?, ?, ?)'
    ).run(replyId, auth.agent.id, review.id, content);

    const reply = db.prepare('SELECT * FROM replies WHERE id = ?').get(replyId);
    return res.status(201).json(reply);
  }

  if (req.method === 'GET') {
    const auth = authenticate(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const db = initDb();
    const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id);
    if (!review) return res.status(404).json({ error: 'Review not found' });

    const replies = db.prepare(`
      SELECT rp.*, a.name as agent_name
      FROM replies rp
      JOIN agents a ON rp.agent_id = a.id
      WHERE rp.review_id = ?
      ORDER BY rp.created_at ASC
    `).all(review.id);

    return res.json(replies);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
