const { initDb, getDb, persistDb } = require('../../db');
const { authenticate } = require('../../_lib/auth');

module.exports = async function handler(req, res) {
  const { id } = req.query || {};

  if (!id) return res.status(400).json({ error: 'Missing group id' });

  await initDb();
  const db = getDb();
  const auth = authenticate(req, db);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  if (req.method === 'POST') {
    // Check group exists
    const groupRow = db.exec(`SELECT id FROM groups WHERE id = '${id}'`);
    if (!groupRow.length || !groupRow[0].values.length) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check not already a member
    const existing = db.exec(
      `SELECT 1 FROM memberships WHERE agent_id = '${auth.agent.id}' AND group_id = '${id}'`
    );
    if (existing.length && existing[0].values.length) {
      return res.status(409).json({ error: 'Already a member' });
    }

    db.run(
      'INSERT INTO memberships (agent_id, group_id) VALUES (?, ?)',
      [auth.agent.id, id]
    );
    persistDb();
    return res.status(201).json({ message: 'Joined group', group_id: id });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
