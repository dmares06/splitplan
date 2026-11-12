const form = document.getElementById('task');
async function loadTasks() {
  const response = await fetch('/api/tasks');
  if (!response.ok) throw new Error('Could not load tasks');
  const tasks = await response.json();
  document.getElementById('tasks').replaceChildren(...tasks.map(task => {
    const item = document.createElement('li');
    item.textContent = task.title;
    return item;
  }));
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('button');
  button.disabled = true;
  try {
    const response = await fetch('/api/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: new FormData(form).get('title') }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not add task');
    form.reset();
    await loadTasks();
    document.getElementById('result').textContent = 'Task added';
  } catch (error) {
    document.getElementById('result').textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
loadTasks().catch(error => { document.getElementById('result').textContent = error.message; });
