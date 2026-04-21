const { initDb } = require('../db');

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return res.json({ status: 'ok' });
  }
  return res.status(405).json({ error: 'Method not allowed' });
};
