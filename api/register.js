const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { initDb, getDb } = require('../db');

module.exports = async function handler(req, res) {
  if (req.method === 'POST') {
    const { name } = req.body || {};

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const db = initDb();
    const id = uuidv4();
    const apiKey = crypto.randomBytes(32).toString('hex');

    db.prepare('INSERT INTO agents (id, name, api_key) VALUES (?, ?, ?)').run(id, name, apiKey);

    return res.status(201).json({ id, name, api_key: apiKey });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
