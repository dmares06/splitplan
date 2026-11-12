const express = require('express');

async function initialize(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      title TEXT NOT NULL,
      done BOOLEAN NOT NULL DEFAULT FALSE
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    INSERT INTO projects (id, name) VALUES (1, 'Demo project') ON CONFLICT (id) DO NOTHING;
    SELECT setval(pg_get_serial_sequence('projects', 'id'), (SELECT MAX(id) FROM projects));
  `);
}

function createApp(pool) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.get('/health', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  });
  app.get('/api/tasks', async (_req, res) => {
    const { rows } = await pool.query('SELECT * FROM tasks ORDER BY id DESC');
    res.json(rows);
  });
  app.post('/api/tasks', async (req, res) => {
    const { title } = req.body || {};
    if (typeof title !== 'string' || !title.trim() || title.length > 500) {
      return res.status(400).json({ error: 'Provide a task title of 1 to 500 characters.' });
    }
    const { rows } = await pool.query(
      'INSERT INTO tasks (project_id, title) VALUES (1, $1) RETURNING id, title, done', [title.trim()],
    );
    res.status(201).json(rows[0]);
  });
  app.post('/api/expenses', async (req, res) => {
    const { amount, note = '' } = req.body || {};
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 || amount > 9999999999.99 ||
      Math.abs(amount * 100 - Math.round(amount * 100)) > 0.0001 || typeof note !== 'string' || note.length > 2000) {
      return res.status(400).json({ error: 'Provide a nonnegative amount with at most two decimal places and a text note.' });
    }
    const { rows } = await pool.query(
      'INSERT INTO expenses (project_id, amount, note) VALUES (1, $1, $2) RETURNING id, amount, note', [amount, note.trim()],
    );
    res.status(201).json(rows[0]);
  });
  app.get('/api/templates', (_req, res) => {
    res.json([{ id: 1, name: 'Separation Checklist', price: 19 }]);
  });
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((error, _req, res, _next) => {
    const status = error.status === 400 || error.status === 413 ? error.status : 500;
    res.status(status).json({ error: status === 500 ? 'Internal server error' : 'Invalid JSON request body' });
  });
  return app;
}

module.exports = { createApp, initialize };
