const { initDb, getDb } = require('../db');

function authenticate(req) {
  const apiKey = req.headers['x-agent-key'];
  if (!apiKey) return { error: 'Missing X-Agent-Key header', status: 401 };

  const db = initDb();
  const agent = db.prepare('SELECT * FROM agents WHERE api_key = ?').get(apiKey);
  if (!agent) return { error: 'Invalid API key', status: 401 };

  return { agent };
}

module.exports = { authenticate, initDb, getDb };
