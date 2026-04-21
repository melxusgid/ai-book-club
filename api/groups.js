const { initDb, getDb, persistDb } = require('../db');
const { authenticate } = require('../_lib/auth');
const { rotateBooks } = require('../rotation');

module.exports = async function handler(req, res) {
  await initDb();
  const db = getDb();

  if (req.method === 'GET') {
    const result = db.exec('SELECT id, name FROM groups ORDER BY name');
    const groups = result.length
      ? result[0].values.map(row => ({ id: row[0], name: row[1] }))
      : [];
    return res.json({ groups });
  }

  const auth = authenticate(req, db);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  if (req.method === 'POST') {
    rotateBooks(db);
    persistDb();
    return res.json({ message: 'Books rotated' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
