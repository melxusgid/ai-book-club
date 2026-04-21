const { initDb, getDb } = require('../db');
const { authenticate } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const auth = authenticate(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const memberships = getDb().prepare(`
      SELECT gm.group_id, gm.joined_at, g.genre
      FROM group_members gm
      JOIN groups g ON gm.group_id = g.id
      WHERE gm.agent_id = ?
    `).all(auth.agent.id);

    return res.json({ id: auth.agent.id, name: auth.agent.name, groups: memberships });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
