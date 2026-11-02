const express = require('express');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { parseTaskInput } = require('./parser');
const { runRollover, initScheduler, getLocalDateString } = require('./rolloverService');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'todos.db');

// Connect to SQLite DB
const db = new DatabaseSync(DB_PATH);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    raw_input TEXT,
    due_date TEXT,
    due_time TEXT,
    due_datetime TEXT,
    has_specific_time INTEGER DEFAULT 0,
    priority TEXT DEFAULT 'medium',
    completed INTEGER DEFAULT 0,
    completed_at TEXT,
    rolled_over INTEGER DEFAULT 0,
    rollover_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS morning_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_date TEXT NOT NULL,
    summary TEXT,
    focus_json TEXT,
    suggested_schedule_json TEXT,
    rolled_task_count INTEGER DEFAULT 0,
    total_task_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS rollover_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    executed_at TEXT DEFAULT (datetime('now', 'localtime')),
    rolled_count INTEGER DEFAULT 0,
    message TEXT
  );
`);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Seed sample data if empty so the user immediately sees a lively, populated dashboard
const taskCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get().count;
if (taskCount === 0) {
  const today = getLocalDateString(new Date());
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = getLocalDateString(tomorrowDate);

  const insertStmt = db.prepare(`
    INSERT INTO tasks (title, raw_input, due_date, due_time, due_datetime, has_specific_time, priority, completed, rolled_over, rollover_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertStmt.run("Call CA about Q4 filing", "call CA Friday 4pm, high", today, "16:00", `${today}T16:00:00`, 1, "high", 0, 0, 0);
  insertStmt.run("Review investor presentation", "Review investor presentation tomorrow 10am urgent", tomorrow, "10:00", `${tomorrow}T10:00:00`, 1, "high", 0, 0, 0);
  insertStmt.run("Submit monthly expenses", "Submit monthly expenses today 6pm, medium", today, "18:00", `${today}T18:00:00`, 1, "medium", 0, 1, 1);
  insertStmt.run("Order ergonomic chair", "Order ergonomic chair low priority", null, null, null, 0, "low", 0, 0, 0);
  insertStmt.run("Send weekly team recap", "Send weekly team recap", today, "11:00", `${today}T11:00:00`, 1, "medium", 1, 0, 0);

  // Generate initial morning plan
  try {
    runRollover(db);
  } catch (e) {
    console.error("Initial seed rollover notice:", e.message);
  }
}

// Start background auto-scheduler for 10:00 PM rollover
initScheduler(db);

// API: Live parse input
app.post('/api/parse', (req, res) => {
  const { input } = req.body;
  if (!input) {
    return res.json({ title: '', dueDate: null, dueTime: null, priority: 'medium' });
  }
  const parsed = parseTaskInput(input);
  res.json(parsed);
});

// API: List tasks with sorting and filtering
app.get('/api/tasks', (req, res) => {
  const { sort = 'smart', filter = 'all' } = req.query;
  const today = getLocalDateString(new Date());

  let query = 'SELECT * FROM tasks WHERE 1=1';
  const params = [];

  if (filter === 'pending') {
    query += ' AND completed = 0';
  } else if (filter === 'completed') {
    query += ' AND completed = 1';
  } else if (filter === 'today') {
    query += ' AND due_date = ?';
    params.push(today);
  } else if (filter === 'high') {
    query += ' AND priority = "high"';
  }

  // Sorting
  if (sort === 'deadline') {
    query += ` ORDER BY 
      completed ASC,
      CASE WHEN due_datetime IS NULL THEN 1 ELSE 0 END ASC,
      due_datetime ASC,
      CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END ASC`;
  } else if (sort === 'priority') {
    query += ` ORDER BY 
      completed ASC,
      CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END ASC,
      CASE WHEN due_datetime IS NULL THEN 1 ELSE 0 END ASC,
      due_datetime ASC`;
  } else {
    // 'smart': Completed at bottom, then Overdue (earliest first), then Today (by time & priority), then Future, then No Deadline
    query += ` ORDER BY 
      completed ASC,
      CASE 
        WHEN due_date IS NOT NULL AND due_date < '${today}' THEN 0
        WHEN due_date = '${today}' THEN 1
        WHEN due_date IS NOT NULL AND due_date > '${today}' THEN 2
        ELSE 3
      END ASC,
      CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END ASC,
      CASE WHEN due_datetime IS NULL THEN 1 ELSE 0 END ASC,
      due_datetime ASC,
      id DESC`;
  }

  const tasks = db.prepare(query).all(...params);
  res.json(tasks);
});

// API: Create task (Plain English or structured)
app.post('/api/tasks', (req, res) => {
  let { input, title, dueDate, dueTime, priority } = req.body;

  if (input) {
    const parsed = parseTaskInput(input);
    title = parsed.title;
    dueDate = parsed.dueDate;
    dueTime = parsed.dueTime;
    priority = parsed.priority;
  }

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Task title is required' });
  }

  title = title.trim();
  priority = ['high', 'medium', 'low'].includes(priority) ? priority : 'medium';

  let dueDateTime = null;
  const hasSpecificTime = dueTime ? 1 : 0;
  if (dueDate) {
    dueDateTime = dueTime ? `${dueDate}T${dueTime}:00` : `${dueDate}T23:59:59`;
  }

  const stmt = db.prepare(`
    INSERT INTO tasks (title, raw_input, due_date, due_time, due_datetime, has_specific_time, priority)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(title, input || title, dueDate || null, dueTime || null, dueDateTime, hasSpecificTime, priority);
  const created = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);

  res.status(201).json(created);
});

// API: Update task
app.patch('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);

  if (!existing) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const { title, dueDate, dueTime, priority, completed } = req.body;

  let newCompleted = existing.completed;
  let newCompletedAt = existing.completed_at;

  if (completed !== undefined) {
    newCompleted = completed ? 1 : 0;
    newCompletedAt = newCompleted ? new Date().toISOString() : null;
  }

  const newTitle = title !== undefined ? title.trim() : existing.title;
  const newDueDate = dueDate !== undefined ? dueDate : existing.due_date;
  const newDueTime = dueTime !== undefined ? dueTime : existing.due_time;
  const newPriority = priority !== undefined ? priority : existing.priority;

  let newDueDateTime = null;
  const hasSpecificTime = newDueTime ? 1 : 0;
  if (newDueDate) {
    newDueDateTime = newDueTime ? `${newDueDate}T${newDueTime}:00` : `${newDueDate}T23:59:59`;
  }

  const update = db.prepare(`
    UPDATE tasks 
    SET title = ?,
        due_date = ?,
        due_time = ?,
        due_datetime = ?,
        has_specific_time = ?,
        priority = ?,
        completed = ?,
        completed_at = ?
    WHERE id = ?
  `);

  update.run(newTitle, newDueDate, newDueTime, newDueDateTime, hasSpecificTime, newPriority, newCompleted, newCompletedAt, id);
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);

  res.json(updated);
});

// API: Delete task
app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  res.json({ success: true, id: Number(id) });
});

// API: Get latest Morning Plan
app.get('/api/morning-plan', (req, res) => {
  const plan = db.prepare(`
    SELECT * FROM morning_plans 
    ORDER BY id DESC 
    LIMIT 1
  `).get();

  if (!plan) {
    return res.json({ plan: null });
  }

  try {
    plan.focus = JSON.parse(plan.focus_json || '{}');
    plan.schedule = JSON.parse(plan.suggested_schedule_json || '[]');
  } catch (e) {
    plan.focus = {};
    plan.schedule = [];
  }

  res.json({ plan });
});

// API: Trigger rollover manually (Simulate 10:00 PM rollover & morning plan)
app.post('/api/rollover', (req, res) => {
  try {
    const result = runRollover(db);
    res.json(result);
  } catch (err) {
    console.error('Error running rollover:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: Status and rollover countdown
app.get('/api/status', (req, res) => {
  const now = new Date();
  const today = getLocalDateString(now);

  // Calculate time until next 10:00 PM
  const nextTenPm = new Date(now);
  nextTenPm.setHours(22, 0, 0, 0);
  if (now.getTime() >= nextTenPm.getTime()) {
    // If today's 10pm has already passed, next is tomorrow 10pm
    nextTenPm.setDate(nextTenPm.getDate() + 1);
  }
  const diffMs = nextTenPm.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  const total = db.prepare('SELECT COUNT(*) as count FROM tasks').get().count;
  const pending = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE completed = 0').get().count;
  const completed = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE completed = 1').get().count;
  const rolled = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE rolled_over = 1 AND completed = 0').get().count;
  const lastLog = db.prepare('SELECT * FROM rollover_logs ORDER BY id DESC LIMIT 1').get();

  res.json({
    currentTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    currentDate: today,
    nextRollover: {
      time: '10:00 PM',
      hoursRemaining: diffHours,
      minutesRemaining: diffMinutes,
      formatted: `${diffHours}h ${diffMinutes}m`
    },
    counts: { total, pending, completed, rolled },
    lastRollover: lastLog || null
  });
});

app.listen(PORT, () => {
  console.log(`To-Do Web App running at http://localhost:${PORT}`);
});
