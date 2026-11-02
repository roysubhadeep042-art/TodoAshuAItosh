const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const { runRollover, getLocalDateString } = require('./rolloverService');

const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE tasks (
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

  CREATE TABLE morning_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_date TEXT NOT NULL,
    summary TEXT,
    focus_json TEXT,
    suggested_schedule_json TEXT,
    rolled_task_count INTEGER DEFAULT 0,
    total_task_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE rollover_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    executed_at TEXT DEFAULT (datetime('now', 'localtime')),
    rolled_count INTEGER DEFAULT 0,
    message TEXT
  );
`);

const today = getLocalDateString(new Date());

// Insert test tasks
const insert = db.prepare(`
  INSERT INTO tasks (title, raw_input, due_date, due_time, priority, completed)
  VALUES (?, ?, ?, ?, ?, ?)
`);

insert.run("call CA", "call CA Friday 4pm, high", today, "16:00", "high", 0);
insert.run("buy milk", "buy milk today, low", today, null, "low", 0);
insert.run("already done task", "done", today, null, "medium", 1);

console.log("Before rollover:");
console.log(db.prepare("SELECT id, title, due_date, priority, completed, rolled_over FROM tasks").all());

const res = runRollover(db);
console.log("\nRollover result:", res);

console.log("\nAfter rollover:");
console.log(db.prepare("SELECT id, title, due_date, priority, completed, rolled_over, rollover_count FROM tasks").all());

console.log("\nMorning plans generated:");
console.log(db.prepare("SELECT * FROM morning_plans").all());
