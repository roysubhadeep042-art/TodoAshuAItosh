const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const DB_PATH = path.join(__dirname, 'todos.db');
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

console.log("Database initialized successfully at", DB_PATH);
