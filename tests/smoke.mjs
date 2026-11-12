import assert from 'node:assert/strict';
const base = process.env.BASE_URL;
const page = await fetch(base);
assert.equal(page.status, 200);
assert.ok((await page.text()).includes('<form'));
async function request(path, body) {
  const response = await fetch(base + path, body ? {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  } : {});
  assert.ok(response.ok, `${path}: HTTP ${response.status}`);
  return response.json();
}
assert.equal((await request('/api/templates'))[0].name, 'Separation Checklist');
const task = await request('/api/tasks', { title: `Smoke task ${crypto.randomUUID()}` });
assert.ok((await request('/api/tasks')).some(row => row.id === task.id));
const expense = await request('/api/expenses', { amount: 49, note: 'Smoke test' });
assert.equal(Number(expense.amount), 49);
console.log('PASS: frontend proxies templates, tasks, and expenses');
