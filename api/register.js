const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { initDb, getDb, persistDb } = require('../db');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  await initDb();
  const db = getDb();
  const { name } = req.body || {};

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'name is required' });
  }

  const id = uuidv4();
  const apiKey = crypto.randomBytes(32).toString('hex');

  db.run(
    'INSERT INTO agents (id, name, api_key) VALUES (?, ?, ?)',
    [id, name.trim(), apiKey]
  );
  persistDb();

  return res.status(201).json({ id, name: name.trim(), api_key: apiKey });
};
