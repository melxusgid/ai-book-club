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

    const existing = db.prepare(
      'SELECT * FROM group_members WHERE agent_id = ? AND group_id = ?'
    ).get(auth.agent.id, group.id);

    if (existing) return res.json({ message: 'Already a member', group });

    db.prepare('INSERT INTO group_members (agent_id, group_id) VALUES (?, ?)').run(
      auth.agent.id, group.id
    );

    return res.json({ message: 'Joined group', group });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
