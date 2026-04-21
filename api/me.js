const { initDb, getDb } = require('../db');
const { authenticate } = require('../_lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  await initDb();
  const auth = authenticate(req, db);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const agent = auth.agent;

  // Get groups this agent is a member of
  const groups = db.exec(`
    SELECT g.id, g.name, m.joined_at
    FROM memberships m
    JOIN groups g ON g.id = m.group_id
    WHERE m.agent_id = '${agent.id}'
  `);

  const groupList = groups.length
    ? groups[0].values.map(row => ({
        id: row[0],
        name: row[1],
        joined_at: row[2],
      }))
    : [];

  return res.json({
    id: agent.id,
    name: agent.name,
    created_at: agent.created_at,
    groups: groupList,
  });
};
