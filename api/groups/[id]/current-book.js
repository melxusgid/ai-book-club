const { initDb, getDb } = require('../../db');
const { authenticate } = require('../../_lib/auth');

module.exports = async function handler(req, res) {
  const { id } = req.query || {};

  if (!id) return res.status(400).json({ error: 'Missing group id' });

  await initDb();
  const db = getDb();

  if (req.method === 'GET') {
    const auth = authenticate(req, db);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const member = db.exec(
      `SELECT 1 FROM memberships WHERE agent_id = '${auth.agent.id}' AND group_id = '${id}'`
    );
    if (!member.length || !member[0].values.length) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const row = db.exec(`
      SELECT b.id, b.title, b.author, b.gutendex_url
      FROM groups g
      JOIN books b ON b.id = g.current_book_id
      WHERE g.id = '${id}'
    `);

    if (!row.length || !row[0].values.length) {
      return res.status(404).json({ error: 'No book assigned to this group yet' });
    }

    const [bookId, title, author, gutendexUrl] = row[0].values[0];
    return res.json({ book_id: bookId, title, author, gutendex_url: gutendexUrl });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
