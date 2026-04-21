const { initDb, getDb } = require('../db');

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

  return res.status(405).json({ error: 'Method not allowed' });
};
