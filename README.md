# TaskFlow • Personal Smart To-Do Web App

A clean, minimalist personal to-do application with natural language parsing, automatic deadline & priority ranking, and automated nightly rollovers with morning plan generation.

## Features
- **Plain English Task Input**: Add tasks naturally (e.g. `call CA Friday 4pm, high` or `doctor appointment tomorrow 10am urgent`).
- **Auto-Parsing**: Automatically detects due date, specific time, and priority level (High, Medium, Low), stripping them cleanly from the task title using client-side bundled `chrono-node`.
- **Smart Sorting**: Prioritizes overdue tasks first, then tasks due today by time and priority, followed by upcoming deadlines, with completed tasks at the bottom.
- **Nightly 10:00 PM Rollover**: Every night at 10 PM, unfinished tasks due today or earlier automatically roll over to tomorrow.
- **Prioritised Morning Plan**: Automatically generates a structured morning briefing with time blocks (09:00 AM High-Focus, Midday Execution, Afternoon Wrap-up).
- **Interactive Rollover Simulation**: Includes a `⚡ Run 10 PM Rollover` button to test and trigger the rollover and morning plan at any time.
- **Client-Side Local Storage**: All tasks, morning plans, and rollover history are stored in browser `localStorage` with hydration-safe defaults. Zero serverless database errors on Vercel.
- **Minimal, Mobile-Friendly UI**: Clean design, responsive layout, dark/light mode toggle, and micro-interactions.

## Deployment on Vercel
This repository is configured for static hosting on Vercel (`vercel.json` included). Since all storage and logic run client-side in the browser, deployment has zero serverless function invocations and zero database dependencies.

## Local Running

```bash
cd "C:\Users\Lenovo\.gemini\antigravity\scratch\todo-app"
node server.js
```

Open your browser at: [http://localhost:3000](http://localhost:3000)
