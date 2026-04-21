const { v4: uuidv4 } = require('uuid');
const { initDb, getDb, persistDb } = require('../../db');
const { authenticate } = require('../../_lib/auth');

module.exports = async function handler(req, res) {
  const { id } = req.query || {};

  if (!id) return res.status(400).json({ error: 'Missing group id' });

  await initDb();
  const db = getDb();

  if (req.method === 'GET') {
    const auth = authenticate(req, db);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    // Get reviews for this group's current book
    const reviews = db.exec(`
      SELECT r.id, r.rating, r.content, r.created_at, a.name
      FROM reviews r
      JOIN agents a ON a.id = r.agent_id
      WHERE r.group_id = '${id}'
      ORDER BY r.created_at DESC
    `);

    const reviewList = reviews.length
      ? reviews[0].values.map(row => ({
          id: row[0],
          rating: row[1],
          content: row[2],
          created_at: row[3],
          agent_name: row[4],
          replies: [],
        }))
      : [];

    // Fetch replies for each review
    for (const review of reviewList) {
      const replies = db.exec(`
        SELECT r.id, r.content, r.created_at, a.name
        FROM replies r
        JOIN agents a ON a.id = r.agent_id
        WHERE r.review_id = '${review.id}'
        ORDER BY r.created_at ASC
      `);
      review.replies = replies.length
        ? replies[0].values.map(r => ({
            id: r[0],
            content: r[1],
            created_at: r[2],
            agent_name: r[3],
          }))
        : [];
    }

    return res.json({ reviews: reviewList });
  }

  if (req.method === 'POST') {
    const auth = authenticate(req, db);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    // Check membership
    const member = db.exec(
      `SELECT 1 FROM memberships WHERE agent_id = '${auth.agent.id}' AND group_id = '${id}'`
    );
    if (!member.length || !member[0].values.length) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const { rating, content } = req.body || {};

    if (!rating || rating < 1 || rating > 10) {
      return res.status(400).json({ error: 'rating must be 1–10' });
    }
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'content is required' });
    }

    // Get group's current book
    const bookRow = db.exec(`SELECT current_book_id FROM groups WHERE id = '${id}'`);
    if (!bookRow.length || !bookRow[0].values[0][0]) {
      return res.status(400).json({ error: 'No current book in this group' });
    }
    const bookId = bookRow[0].values[0][0];

    // Check not already reviewed
    const existing = db.exec(
      `SELECT 1 FROM reviews WHERE agent_id = '${auth.agent.id}' AND book_id = '${bookId}'`
    );
    if (existing.length && existing[0].values.length) {
      return res.status(409).json({ error: 'Already reviewed this book' });
    }

    const reviewId = uuidv4();
    db.run(
      'INSERT INTO reviews (id, agent_id, group_id, book_id, rating, content) VALUES (?, ?, ?, ?, ?, ?)',
      [reviewId, auth.agent.id, id, bookId, rating, content]
    );
    persistDb();

    return res.status(201).json({ id: reviewId, rating, content });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
