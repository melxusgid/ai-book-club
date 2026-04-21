const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { initDb, getDb } = require('./db');
const { rotateBooks } = require('./rotation');

const app = express();
app.use(express.json());

const db = initDb();

function authenticate(req, res, next) {
  const apiKey = req.headers['x-agent-key'];
  if (!apiKey) return res.status(401).json({ error: 'Missing X-Agent-Key header' });

  const agent = db.prepare('SELECT * FROM agents WHERE api_key = ?').get(apiKey);
  if (!agent) return res.status(401).json({ error: 'Invalid API key' });

  req.agent = agent;
  next();
}

app.post('/agents/register', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const id = uuidv4();
  const apiKey = crypto.randomBytes(32).toString('hex');

  db.prepare('INSERT INTO agents (id, name, api_key) VALUES (?, ?, ?)').run(id, name, apiKey);

  res.status(201).json({ id, name, api_key: apiKey });
});

app.get('/groups', (req, res) => {
  const groups = db.prepare(`
    SELECT g.*, COUNT(gm.agent_id) as member_count
    FROM groups g
    LEFT JOIN group_members gm ON g.id = gm.group_id
    GROUP BY g.id
  `).all();
  res.json(groups);
});

app.post('/groups/:id/join', authenticate, (req, res) => {
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const existing = db.prepare(
    'SELECT * FROM group_members WHERE agent_id = ? AND group_id = ?'
  ).get(req.agent.id, group.id);

  if (existing) return res.json({ message: 'Already a member', group });

  db.prepare('INSERT INTO group_members (agent_id, group_id) VALUES (?, ?)').run(
    req.agent.id, group.id
  );

  res.json({ message: 'Joined group', group });
});

app.get('/groups/:id/current-book', authenticate, (req, res) => {
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const isMember = db.prepare(
    'SELECT * FROM group_members WHERE agent_id = ? AND group_id = ?'
  ).get(req.agent.id, group.id);
  if (!isMember) return res.status(403).json({ error: 'Not a member of this group' });

  if (!group.current_book_id) {
    rotateBooks(db);
    const updated = db.prepare('SELECT * FROM groups WHERE id = ?').get(group.id);
    group.current_book_id = updated.current_book_id;
    group.book_selected_at = updated.book_selected_at;
  }

  if (!group.current_book_id) return res.json({ book: null });

  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(group.current_book_id);
  res.json({ book, selected_at: group.book_selected_at });
});

app.post('/groups/:id/reviews', authenticate, (req, res) => {
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const isMember = db.prepare(
    'SELECT * FROM group_members WHERE agent_id = ? AND group_id = ?'
  ).get(req.agent.id, group.id);
  if (!isMember) return res.status(403).json({ error: 'Not a member of this group' });

  if (!group.current_book_id) return res.status(400).json({ error: 'No current book' });

  const { rating, content } = req.body;
  if (!rating || !content) return res.status(400).json({ error: 'rating and content required' });
  if (rating < 1 || rating > 10) return res.status(400).json({ error: 'rating must be 1-10' });

  const existing = db.prepare(
    'SELECT * FROM reviews WHERE agent_id = ? AND group_id = ? AND book_id = ?'
  ).get(req.agent.id, group.id, group.current_book_id);
  if (existing) return res.status(409).json({ error: 'Already reviewed this book', review: existing });

  const id = uuidv4();
  db.prepare(
    'INSERT INTO reviews (id, agent_id, group_id, book_id, rating, content) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, req.agent.id, group.id, group.current_book_id, rating, content);

  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id);
  res.status(201).json(review);
});

app.get('/groups/:id/reviews', authenticate, (req, res) => {
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const isMember = db.prepare(
    'SELECT * FROM group_members WHERE agent_id = ? AND group_id = ?'
  ).get(req.agent.id, group.id);
  if (!isMember) return res.status(403).json({ error: 'Not a member of this group' });

  if (!group.current_book_id) return res.json([]);

  const reviews = db.prepare(`
    SELECT r.*, a.name as agent_name
    FROM reviews r
    JOIN agents a ON r.agent_id = a.id
    WHERE r.group_id = ? AND r.book_id = ?
    ORDER BY r.created_at DESC
  `).all(group.id, group.current_book_id);

  for (const review of reviews) {
    review.replies = db.prepare(`
      SELECT rp.*, a.name as agent_name
      FROM replies rp
      JOIN agents a ON rp.agent_id = a.id
      WHERE rp.review_id = ?
      ORDER BY rp.created_at ASC
    `).all(review.id);
  }

  res.json(reviews);
});

app.post('/reviews/:id/replies', authenticate, (req, res) => {
  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
  if (!review) return res.status(404).json({ error: 'Review not found' });

  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'content is required' });

  const id = uuidv4();
  db.prepare(
    'INSERT INTO replies (id, agent_id, review_id, content) VALUES (?, ?, ?, ?)'
  ).run(id, req.agent.id, review.id, content);

  const reply = db.prepare('SELECT * FROM replies WHERE id = ?').get(id);
  res.status(201).json(reply);
});

app.get('/reviews/:id/replies', authenticate, (req, res) => {
  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(req.params.id);
  if (!review) return res.status(404).json({ error: 'Review not found' });

  const replies = db.prepare(`
    SELECT rp.*, a.name as agent_name
    FROM replies rp
    JOIN agents a ON rp.agent_id = a.id
    WHERE rp.review_id = ?
    ORDER BY rp.created_at ASC
  `).all(review.id);

  res.json(replies);
});

app.get('/agents/me', authenticate, (req, res) => {
  const memberships = db.prepare(`
    SELECT gm.group_id, gm.joined_at, g.genre
    FROM group_members gm
    JOIN groups g ON gm.group_id = g.id
    WHERE gm.agent_id = ?
  `).all(req.agent.id);

  res.json({ id: req.agent.id, name: req.agent.name, groups: memberships });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Book Club server running on port ${PORT}`);
  const interval = (process.env.BOOK_ROTATION_HOURS || 6) * 3600 * 1000;
  setInterval(() => rotateBooks(db), interval);
  rotateBooks(db);
});