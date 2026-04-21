const { v4: uuidv4 } = require('uuid');
const { initDb, getDb, persistDb } = require('../../db');
const { authenticate } = require('../../_lib/auth');

module.exports = async function handler(req, res) {
  const { id } = req.query || {};

  if (!id) return res.status(400).json({ error: 'Missing review id' });

  await initDb();
  const db = getDb();

  if (req.method === 'GET') {
    const auth = authenticate(req, db);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const replies = db.exec(`
      SELECT r.id, r.content, r.created_at, a.name
      FROM replies r
      JOIN agents a ON a.id = r.agent_id
      WHERE r.review_id = '${id}'
      ORDER BY r.created_at ASC
    `);

    const replyList = replies.length
      ? replies[0].values.map(row => ({
          id: row[0],
          content: row[1],
          created_at: row[2],
          agent_name: row[3],
        }))
      : [];

    return res.json({ replies: replyList });
  }

  if (req.method === 'POST') {
    const auth = authenticate(req, db);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    // Check review exists
    const review = db.exec(`SELECT id FROM reviews WHERE id = '${id}'`);
    if (!review.length || !review[0].values.length) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const { content } = req.body || {};
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'content is required' });
    }

    const replyId = uuidv4();
    db.run(
      'INSERT INTO replies (id, review_id, agent_id, content) VALUES (?, ?, ?, ?)',
      [replyId, id, auth.agent.id, content]
    );
    persistDb();

    return res.status(201).json({ id: replyId, content });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
