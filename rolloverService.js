function getLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTomorrowDateString(date = new Date()) {
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return getLocalDateString(tomorrow);
}

function runRollover(db, forcedDate = null) {
  const now = forcedDate ? new Date(forcedDate) : new Date();
  const todayStr = getLocalDateString(now);
  const tomorrowStr = getTomorrowDateString(now);

  // Find unfinished tasks where due_date is on or before today
  const pendingStmt = db.prepare(`
    SELECT * FROM tasks 
    WHERE completed = 0 
      AND due_date IS NOT NULL 
      AND due_date <= ?
    ORDER BY 
      CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END ASC,
      due_datetime ASC
  `);
  const tasksToRoll = pendingStmt.all(todayStr);

  // Update these tasks to tomorrow
  const updateStmt = db.prepare(`
    UPDATE tasks 
    SET due_date = ?,
        due_datetime = CASE 
          WHEN due_time IS NOT NULL THEN ? || 'T' || due_time || ':00'
          ELSE ? || 'T23:59:59'
        END,
        rolled_over = 1,
        rollover_count = rollover_count + 1
    WHERE id = ?
  `);

  db.exec('BEGIN TRANSACTION');
  try {
    for (const t of tasksToRoll) {
      updateStmt.run(tomorrowStr, tomorrowStr, tomorrowStr, t.id);
    }

    // Now gather all tasks for tomorrow (both newly rolled and already scheduled)
    const tomorrowTasksStmt = db.prepare(`
      SELECT * FROM tasks 
      WHERE completed = 0 
        AND due_date = ?
      ORDER BY 
        CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END ASC,
        due_datetime ASC
    `);
    const allTomorrowTasks = tomorrowTasksStmt.all(tomorrowStr);

    // Group into Must Do, Should Do, Could Do
    const mustDo = allTomorrowTasks.filter(t => t.priority === 'high');
    const shouldDo = allTomorrowTasks.filter(t => t.priority === 'medium');
    const couldDo = allTomorrowTasks.filter(t => t.priority === 'low');

    // Build intelligent schedule blocks
    const schedule = [];
    if (mustDo.length > 0) {
      schedule.push({
        slot: '09:00 AM - 11:30 AM',
        title: '🌅 Morning High-Focus Block',
        description: 'Tackle urgent priorities and rolled-over tasks first thing.',
        tasks: mustDo.map(t => ({ id: t.id, title: t.title, priority: t.priority, rolled: t.rolled_over }))
      });
    }

    if (shouldDo.length > 0) {
      schedule.push({
        slot: '11:30 AM - 01:30 PM',
        title: '⚡ Midday Execution Block',
        description: 'Important tasks to power through before the afternoon dip.',
        tasks: shouldDo.map(t => ({ id: t.id, title: t.title, priority: t.priority, rolled: t.rolled_over }))
      });
    }

    if (couldDo.length > 0 || schedule.length === 0) {
      schedule.push({
        slot: '02:30 PM - 04:30 PM',
        title: '☕ Afternoon Wrap-up & Quick Wins',
        description: 'Low-friction tasks, planning, and follow-ups.',
        tasks: couldDo.map(t => ({ id: t.id, title: t.title, priority: t.priority, rolled: t.rolled_over }))
      });
    }

    // Generate crisp briefing summary
    const rollCount = tasksToRoll.length;
    const totalTomorrow = allTomorrowTasks.length;
    const topTask = mustDo[0] || shouldDo[0] || couldDo[0];

    let summary = '';
    if (totalTomorrow === 0) {
      summary = `All clear for tomorrow (${tomorrowStr})! No overdue or pending tasks on your plate. Enjoy a fresh start!`;
    } else {
      const topFocusText = topTask ? `Top priority: "${topTask.title}".` : '';
      summary = `Prepared for ${tomorrowStr}: ${rollCount} task${rollCount === 1 ? '' : 's'} rolled over from today, with a total of ${totalTomorrow} planned task${totalTomorrow === 1 ? '' : 's'}. ${topFocusText} Recommended action: knock out high-priority items before noon.`;
    }

    const insertPlan = db.prepare(`
      INSERT INTO morning_plans (plan_date, summary, focus_json, suggested_schedule_json, rolled_task_count, total_task_count)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertPlan.run(
      tomorrowStr,
      summary,
      JSON.stringify({ mustDo, shouldDo, couldDo }),
      JSON.stringify(schedule),
      rollCount,
      totalTomorrow
    );

    // Log the rollover
    const logStmt = db.prepare(`
      INSERT INTO rollover_logs (rolled_count, message)
      VALUES (?, ?)
    `);
    logStmt.run(rollCount, `Rolled ${rollCount} tasks to ${tomorrowStr}. Total active tomorrow: ${totalTomorrow}`);

    db.exec('COMMIT');

    return {
      success: true,
      rolledCount: rollCount,
      targetDate: tomorrowStr,
      summary,
      schedule,
      tasks: allTomorrowTasks
    };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function initScheduler(db) {
  let lastRolloverDate = null;

  // Check every 30 seconds
  setInterval(() => {
    try {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const todayStr = getLocalDateString(now);

      // Trigger at 22:00 (10 PM)
      if (hours === 22 && minutes === 0 && lastRolloverDate !== todayStr) {
        console.log(`[Auto-Scheduler] 10:00 PM reached! Running nightly rollover for ${todayStr}...`);
        const result = runRollover(db);
        lastRolloverDate = todayStr;
        console.log(`[Auto-Scheduler] Rollover complete:`, result.summary);
      }
    } catch (err) {
      console.error('[Auto-Scheduler] Error running rollover:', err);
    }
  }, 30 * 1000);

  console.log('[Auto-Scheduler] Nightly 10:00 PM rollover watcher active.');
}

module.exports = {
  getLocalDateString,
  getTomorrowDateString,
  runRollover,
  initScheduler
};
