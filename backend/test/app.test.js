const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { start } = require('../src/index');

test('tasks, expenses, and template listing work with the seeded project', async (t) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const server = await start({ pool, port: 0, host: '127.0.0.1' });
  const cleanup = [];
  t.after(async () => {
    for (const remove of cleanup) await remove();
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body) => fetch(base + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  assert.equal((await fetch(`${base}/health`)).status, 200);
  for (const body of [null, {}, { title: '' }, { title: 42 }]) {
    assert.equal((await post('/api/tasks', body)).status, 400);
  }
  const title = `Test task ${crypto.randomUUID()}`;
  const created = await post('/api/tasks', { title });
  assert.equal(created.status, 201);
  const task = await created.json();
  cleanup.push(() => pool.query('DELETE FROM tasks WHERE id = $1', [task.id]));
  const tasks = await (await fetch(`${base}/api/tasks`)).json();
  assert.ok(tasks.some(row => row.id === task.id && row.title === title));
  for (const body of [null, {}, { amount: -1 }, { amount: '49' }, { amount: 1.001 },
    { amount: 49, note: 42 }, { amount: 1e20 }]) {
    assert.equal((await post('/api/expenses', body)).status, 400);
  }
  for (const body of [{ amount: 49, note: 'filing fee' }, { amount: 0 }]) {
    const response = await post('/api/expenses', body);
    assert.equal(response.status, 201);
    const expense = await response.json();
    cleanup.push(() => pool.query('DELETE FROM expenses WHERE id = $1', [expense.id]));
    assert.equal(Number(expense.amount), body.amount);
  }
  const templates = await (await fetch(`${base}/api/templates`)).json();
  assert.equal(templates[0].name, 'Separation Checklist');
  assert.equal(templates[0].price, 19);
  assert.equal((await fetch(`${base}/api/missing`)).status, 404);
  const malformed = await fetch(`${base}/api/tasks`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
  });
  assert.equal(malformed.status, 400);
});

test('database failures produce a safe error response', async (t) => {
  const { createApp } = require('../src/app');
  const app = createApp({ query: async () => { throw new Error('private database detail'); } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/tasks`);
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Internal server error' });
});
