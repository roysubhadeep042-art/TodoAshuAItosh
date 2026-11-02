# TaskFlow • Personal Smart To-Do Web App

A minimal, intelligent personal to-do application with natural language parsing, priority ranking, and automated nightly rollovers with morning plan generation.

## Features
- **Plain English Task Input**: Add tasks naturally (e.g. `call CA Friday 4pm, high` or `doctor appointment tomorrow 10am urgent`).
- **Auto-Parsing**: Automatically detects due date, specific time, and priority level (High, Medium, Low), stripping them cleanly from the task title.
- **Smart Sorting**: Prioritizes overdue tasks first, then tasks due today by time and priority, followed by upcoming deadlines, and keeps completed tasks at the bottom.
- **Nightly 10:00 PM Rollover**: Every night at 10 PM, unfinished tasks due today or earlier automatically roll over to tomorrow.
- **Prioritised Morning Plan**: Automatically generates a structured morning briefing with time blocks (09:00 AM High-Focus, Midday Execution, Afternoon Wrap-up).
- **Interactive Rollover Simulation**: Includes a `⚡ Run 10 PM Rollover` button to test and trigger the rollover and morning plan at any time.
- **Local Storage**: All tasks, morning plans, and rollover history are stored locally in SQLite (`todos.db`).
- **Minimal, Mobile-Friendly UI**: Clean design, responsive layout, dark/light mode toggle, and micro-interactions.

## Running the App

```bash
cd "C:\Users\Lenovo\.gemini\antigravity\scratch\todo-app"
node server.js
```

Open your browser at: [http://localhost:3000](http://localhost:3000)
