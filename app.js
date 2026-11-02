/**
 * TaskFlow - 100% Client-Side Personal To-Do Web App
 * Backed by browser localStorage with hydration-safe defaults.
 * Zero server-side database requirements.
 */

// Safe Storage Wrapper (falls back to memory if localStorage is restricted)
const Storage = {
  _mem: {},
  get(key, fallback = null) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : fallback;
      }
    } catch (e) {
      console.warn('localStorage read warning:', e);
    }
    return this._mem[key] !== undefined ? this._mem[key] : fallback;
  },
  set(key, val) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, JSON.stringify(val));
        return;
      }
    } catch (e) {
      console.warn('localStorage write warning:', e);
    }
    this._mem[key] = val;
  }
};

const STORAGE_KEYS = {
  TASKS: 'taskflow_tasks_v2',
  PLANS: 'taskflow_morning_plans_v2',
  LAST_ROLLOVER: 'taskflow_last_rollover_date_v2',
  THEME: 'taskflow_theme_v2'
};

// Date Helpers
function getLocalDateString(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getOffsetDateString(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return getLocalDateString(d);
}

// Initial Hydration-Safe Seed Data
function getHydrationSafeDefaultTasks() {
  const today = getOffsetDateString(0);
  const tomorrow = getOffsetDateString(1);
  const friday = getOffsetDateString(4);

  return [
    {
      id: 'task-1',
      title: 'Call CA about Q4 filing',
      raw_input: 'call CA Friday 4pm, high',
      due_date: friday,
      due_time: '16:00',
      due_datetime: `${friday}T16:00:00`,
      has_specific_time: 1,
      priority: 'high',
      completed: 0,
      completed_at: null,
      rolled_over: 0,
      rollover_count: 0,
      created_at: new Date().toISOString()
    },
    {
      id: 'task-2',
      title: 'Review investor presentation',
      raw_input: 'Review investor presentation tomorrow 10am urgent',
      due_date: tomorrow,
      due_time: '10:00',
      due_datetime: `${tomorrow}T10:00:00`,
      has_specific_time: 1,
      priority: 'high',
      completed: 0,
      completed_at: null,
      rolled_over: 0,
      rollover_count: 0,
      created_at: new Date().toISOString()
    },
    {
      id: 'task-3',
      title: 'Submit monthly expenses',
      raw_input: 'Submit monthly expenses today 6pm, medium',
      due_date: today,
      due_time: '18:00',
      due_datetime: `${today}T18:00:00`,
      has_specific_time: 1,
      priority: 'medium',
      completed: 0,
      completed_at: null,
      rolled_over: 1,
      rollover_count: 1,
      created_at: new Date().toISOString()
    },
    {
      id: 'task-4',
      title: 'Order ergonomic chair',
      raw_input: 'Order ergonomic chair low priority',
      due_date: null,
      due_time: null,
      due_datetime: null,
      has_specific_time: 0,
      priority: 'low',
      completed: 0,
      completed_at: null,
      rolled_over: 0,
      rollover_count: 0,
      created_at: new Date().toISOString()
    },
    {
      id: 'task-5',
      title: 'Send weekly team recap',
      raw_input: 'Send weekly team recap',
      due_date: today,
      due_time: '11:00',
      due_datetime: `${today}T11:00:00`,
      has_specific_time: 1,
      priority: 'medium',
      completed: 1,
      completed_at: new Date().toISOString(),
      rolled_over: 0,
      rollover_count: 0,
      created_at: new Date().toISOString()
    }
  ];
}

// Client-Side Task Store
const TaskStore = {
  load() {
    let tasks = Storage.get(STORAGE_KEYS.TASKS);
    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      tasks = getHydrationSafeDefaultTasks();
      Storage.set(STORAGE_KEYS.TASKS, tasks);
    }
    return tasks;
  },

  save(tasks) {
    Storage.set(STORAGE_KEYS.TASKS, tasks);
  },

  getAll() {
    return this.load();
  },

  add(parsed) {
    const tasks = this.load();
    const newTask = {
      id: 'task-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      title: parsed.title,
      raw_input: parsed.rawInput || parsed.title,
      due_date: parsed.dueDate || null,
      due_time: parsed.dueTime || null,
      due_datetime: parsed.dueDateTime || null,
      has_specific_time: parsed.hasSpecificTime ? 1 : 0,
      priority: parsed.priority || 'medium',
      completed: 0,
      completed_at: null,
      rolled_over: 0,
      rollover_count: 0,
      created_at: new Date().toISOString()
    };
    tasks.unshift(newTask);
    this.save(tasks);
    return newTask;
  },

  update(id, updates) {
    const tasks = this.load();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx !== -1) {
      tasks[idx] = { ...tasks[idx], ...updates };
      this.save(tasks);
      return tasks[idx];
    }
    return null;
  },

  delete(id) {
    let tasks = this.load();
    tasks = tasks.filter(t => t.id !== id);
    this.save(tasks);
  },

  getPlans() {
    return Storage.get(STORAGE_KEYS.PLANS, []);
  },

  savePlan(plan) {
    const plans = this.getPlans();
    plans.unshift(plan);
    Storage.set(STORAGE_KEYS.PLANS, plans.slice(0, 30)); // Keep last 30 plans
  },

  getLatestPlan() {
    const plans = this.getPlans();
    if (plans.length > 0) return plans[0];

    // Generate a default plan on first visit
    return this.executeRollover(false);
  },

  executeRollover(isForced = false) {
    const now = new Date();
    const todayStr = getLocalDateString(now);
    const tomorrowStr = getOffsetDateString(1);

    const tasks = this.load();
    let rolledCount = 0;

    tasks.forEach(t => {
      // Roll unfinished tasks due on or before today
      if (!t.completed && t.due_date && t.due_date <= todayStr) {
        t.due_date = tomorrowStr;
        if (t.due_time) {
          t.due_datetime = `${tomorrowStr}T${t.due_time}:00`;
        } else {
          t.due_datetime = `${tomorrowStr}T23:59:59`;
        }
        t.rolled_over = 1;
        t.rollover_count = (t.rollover_count || 0) + 1;
        rolledCount++;
      }
    });

    this.save(tasks);
    Storage.set(STORAGE_KEYS.LAST_ROLLOVER, todayStr);

    // Build Prioritised Morning Plan for tomorrow
    const tomorrowTasks = tasks.filter(t => !t.completed && t.due_date === tomorrowStr);

    const priorityRank = { high: 1, medium: 2, low: 3 };
    tomorrowTasks.sort((a, b) => {
      const pDiff = (priorityRank[a.priority] || 4) - (priorityRank[b.priority] || 4);
      if (pDiff !== 0) return pDiff;
      if (a.due_datetime && b.due_datetime) return a.due_datetime.localeCompare(b.due_datetime);
      return 0;
    });

    const mustDo = tomorrowTasks.filter(t => t.priority === 'high');
    const shouldDo = tomorrowTasks.filter(t => t.priority === 'medium');
    const couldDo = tomorrowTasks.filter(t => t.priority === 'low');

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

    const topTask = mustDo[0] || shouldDo[0] || couldDo[0];
    const totalCount = tomorrowTasks.length;
    let summary = '';
    if (totalCount === 0) {
      summary = `All clear for tomorrow (${tomorrowStr})! No overdue or pending tasks. Enjoy a fresh start!`;
    } else {
      const focusText = topTask ? `Top priority: "${topTask.title}".` : '';
      summary = `Prepared for ${tomorrowStr}: ${rolledCount} task${rolledCount === 1 ? '' : 's'} rolled over, with ${totalCount} total planned task${totalCount === 1 ? '' : 's'}. ${focusText} Recommended action: knock out high-priority items before noon.`;
    }

    const plan = {
      id: 'plan-' + Date.now(),
      plan_date: tomorrowStr,
      summary,
      schedule,
      focus: { mustDo, shouldDo, couldDo },
      rolled_task_count: rolledCount,
      total_task_count: totalCount,
      created_at: new Date().toISOString()
    };

    this.savePlan(plan);
    return plan;
  }
};

// Client-Side NLP Parser (using bundled chrono with regex fallbacks)
function parseTaskInput(input, referenceDate = new Date()) {
  const original = input ? input.trim() : '';
  if (!original) {
    return {
      title: '',
      rawInput: '',
      dueDate: null,
      dueTime: null,
      hasSpecificTime: false,
      dueDateTime: null,
      priority: 'medium',
      extractedDetails: { dateText: '', priorityText: '' }
    };
  }

  let text = original;

  // 1. Detect and extract priority
  let priority = 'medium';
  let priorityMatchedText = '';

  const priorityPatterns = [
    { regex: /\b(?:priority\s*:\s*|p:)(urgent|p1|high|important|medium|normal|p2|low|p3)\b/i, extract: m => m[1] },
    { regex: /(?:^|\s)!(urgent|high|medium|low|p1|p2|p3)\b/i, extract: m => m[1] },
    { regex: /,\s*(urgent|high|medium|low|p1|p2|p3|important)\b/i, extract: m => m[1] },
    { regex: /\b(urgent|asap|critical|high priority|important)\b/i, extract: () => 'high' },
    { regex: /\b(medium priority|moderate|normal priority)\b/i, extract: () => 'medium' },
    { regex: /\b(low priority|whenever|minor)\b/i, extract: () => 'low' },
    { regex: /\b(high|medium|low|p1|p2|p3)\b(?=$|\s)/i, extract: m => m[1] }
  ];

  for (const { regex, extract } of priorityPatterns) {
    const match = text.match(regex);
    if (match) {
      const rawP = extract(match).toLowerCase();
      if (['urgent', 'p1', 'high', 'asap', 'critical', 'important'].includes(rawP)) {
        priority = 'high';
      } else if (['medium', 'normal', 'p2', 'moderate'].includes(rawP)) {
        priority = 'medium';
      } else if (['low', 'p3', 'minor', 'whenever'].includes(rawP)) {
        priority = 'low';
      }
      priorityMatchedText = match[0].trim();
      text = text.replace(regex, ' ').replace(/\s+/g, ' ').trim();
      break;
    }
  }

  // 2. Parse date & time using window.chrono if available
  let dueDate = null;
  let dueTime = null;
  let hasSpecificTime = false;
  let dueDateTime = null;
  let dateMatchedText = '';

  if (typeof window !== 'undefined' && window.chrono && typeof window.chrono.parse === 'function') {
    try {
      const parsedDates = window.chrono.parse(text, referenceDate, { forwardDate: true });
      if (parsedDates.length > 0) {
        const result = parsedDates[0];
        dateMatchedText = result.text;
        const start = result.start;

        hasSpecificTime = start.isCertain('hour');
        const dateObj = start.date();

        dueDate = getLocalDateString(dateObj);

        if (hasSpecificTime) {
          const hours = String(dateObj.getHours()).padStart(2, '0');
          const mins = String(dateObj.getMinutes()).padStart(2, '0');
          dueTime = `${hours}:${mins}`;
          dueDateTime = `${dueDate}T${dueTime}:00`;
        } else {
          dueDateTime = `${dueDate}T23:59:59`;
        }

        text = (text.substring(0, result.index) + text.substring(result.index + result.text.length))
          .replace(/\s+/g, ' ')
          .trim();
      }
    } catch (e) {
      console.warn('Chrono parse warning:', e);
    }
  }

  // Fallback regex date parser for common keywords if chrono didn't catch it
  if (!dueDate) {
    const lower = text.toLowerCase();
    const today = new Date();
    if (/\b(today|tonight|this evening)\b/.test(lower)) {
      dueDate = getLocalDateString(today);
      text = text.replace(/\b(today|tonight|this evening)\b/i, '').trim();
    } else if (/\btomorrow\b/.test(lower)) {
      dueDate = getOffsetDateString(1);
      text = text.replace(/\btomorrow\b/i, '').trim();
    }

    // Time detection: e.g. 4pm, 10:30am
    const timeMatch = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10);
      const m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const ampm = timeMatch[3].toLowerCase();
      if (ampm === 'pm' && h < 12) h += 12;
      if (ampm === 'am' && h === 12) h = 0;
      dueTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      hasSpecificTime = true;
      if (dueDate) {
        dueDateTime = `${dueDate}T${dueTime}:00`;
      }
      text = text.replace(timeMatch[0], '').trim();
    }
  }

  // Clean residual prepositions and punctuation
  text = text.replace(/^(by|on|at|due|for|to)\s+/i, '')
             .replace(/\s+(by|on|at|due|for|to)$/i, '')
             .replace(/[,\-;!]+$/, '')
             .replace(/^[,\-;!]+/, '')
             .trim();

  if (!text) text = original;

  return {
    title: text,
    rawInput: original,
    dueDate,
    dueTime,
    hasSpecificTime,
    dueDateTime,
    priority,
    extractedDetails: {
      dateText: dateMatchedText,
      priorityText: priorityMatchedText
    }
  };
}

// UI State
let currentFilter = 'all';
let currentSort = 'smart';
let debounceTimer = null;

// DOM Elements
let taskForm, taskInput, liveParserChipBar, chipTitle, chipDate, chipPriority;
let taskList, emptyState, filterTabs, sortSelect;
let currentDateDisplay, rolloverTickerText, simulateRolloverBtn;
let openPlanBtn, planModal, closePlanBtn, dismissPlanBtn, reTriggerPlanBtn;
let modalPlanTitle, modalPlanDate, planSummaryText, planScheduleContainer;
let themeToggleBtn, themeIcon, toastEl;
let countAll, countToday, countHigh, countPending, countCompleted;
let footerPendingText, footerRolledText, footerCompletedText;

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  cacheDOMElements();
  initTheme();
  renderDateHeader();
  checkAndRunNightlyRollover();
  renderAll();
  setupEventListeners();

  // Rollover timer & ticker: tick every second for smooth UI
  updateRolloverTicker();
  setInterval(() => {
    updateRolloverTicker();
    checkAndRunNightlyRollover();
  }, 1000);
});

function cacheDOMElements() {
  taskForm = document.getElementById('taskForm');
  taskInput = document.getElementById('taskInput');
  liveParserChipBar = document.getElementById('liveParserChipBar');
  chipTitle = document.getElementById('chipTitle');
  chipDate = document.getElementById('chipDate');
  chipPriority = document.getElementById('chipPriority');

  taskList = document.getElementById('taskList');
  emptyState = document.getElementById('emptyState');
  filterTabs = document.querySelectorAll('.tab-btn');
  sortSelect = document.getElementById('sortSelect');

  currentDateDisplay = document.getElementById('currentDateDisplay');
  rolloverTickerText = document.getElementById('rolloverTickerText');
  simulateRolloverBtn = document.getElementById('simulateRolloverBtn');

  openPlanBtn = document.getElementById('openPlanBtn');
  planModal = document.getElementById('planModal');
  closePlanBtn = document.getElementById('closePlanBtn');
  dismissPlanBtn = document.getElementById('dismissPlanBtn');
  reTriggerPlanBtn = document.getElementById('reTriggerPlanBtn');
  modalPlanTitle = document.getElementById('modalPlanTitle');
  modalPlanDate = document.getElementById('modalPlanDate');
  planSummaryText = document.getElementById('planSummaryText');
  planScheduleContainer = document.getElementById('planScheduleContainer');

  themeToggleBtn = document.getElementById('themeToggleBtn');
  themeIcon = document.getElementById('themeIcon');
  toastEl = document.getElementById('toast');

  countAll = document.getElementById('countAll');
  countToday = document.getElementById('countToday');
  countHigh = document.getElementById('countHigh');
  countPending = document.getElementById('countPending');
  countCompleted = document.getElementById('countCompleted');

  footerPendingText = document.getElementById('footerPendingText');
  footerRolledText = document.getElementById('footerRolledText');
  footerCompletedText = document.getElementById('footerCompletedText');
}

function setupEventListeners() {
  // Live NLP feedback on input
  taskInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const val = taskInput.value.trim();
    if (!val) {
      liveParserChipBar.classList.add('hidden');
      return;
    }
    debounceTimer = setTimeout(() => {
      renderLiveChipPreview(val);
    }, 100);
  });

  // Task form submission
  taskForm.addEventListener('submit', e => {
    e.preventDefault();
    const val = taskInput.value.trim();
    if (!val) return;

    const parsed = parseTaskInput(val);
    const created = TaskStore.add(parsed);

    taskInput.value = '';
    liveParserChipBar.classList.add('hidden');
    showToast(`Added: "${created.title}"`);
    renderAll();
  });

  // Quick suggestion chips
  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      taskInput.value = btn.dataset.text;
      taskInput.focus();
      renderLiveChipPreview(btn.dataset.text);
    });
  });

  // Filter tabs
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      renderTasks();
    });
  });

  // Sort dropdown
  sortSelect.addEventListener('change', e => {
    currentSort = e.target.value;
    renderTasks();
  });

  // Rollover simulation buttons
  simulateRolloverBtn.addEventListener('click', triggerManualRollover);
  reTriggerPlanBtn.addEventListener('click', triggerManualRollover);

  // Morning plan modal open/close
  openPlanBtn.addEventListener('click', openMorningPlanModal);
  closePlanBtn.addEventListener('click', closeMorningPlanModal);
  dismissPlanBtn.addEventListener('click', closeMorningPlanModal);

  planModal.addEventListener('click', e => {
    if (e.target === planModal) closeMorningPlanModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !planModal.classList.contains('hidden')) {
      closeMorningPlanModal();
    }
  });

  // Theme switch
  themeToggleBtn.addEventListener('click', toggleTheme);
}

// Live Chip Preview
function renderLiveChipPreview(text) {
  const parsed = parseTaskInput(text);
  if (!parsed.title && !parsed.dueDate && !parsed.priority) {
    liveParserChipBar.classList.add('hidden');
    return;
  }

  liveParserChipBar.classList.remove('hidden');
  chipTitle.textContent = parsed.title ? `📌 "${parsed.title}"` : '📌 (type title)';

  if (parsed.dueDate) {
    chipDate.classList.remove('hidden');
    const timeStr = parsed.dueTime ? ` at ${formatTime(parsed.dueTime)}` : '';
    chipDate.textContent = `📅 ${formatDateLabel(parsed.dueDate)}${timeStr}`;
  } else {
    chipDate.classList.add('hidden');
  }

  if (parsed.priority) {
    chipPriority.classList.remove('hidden');
    chipPriority.className = `chip chip-prio prio-${parsed.priority}`;
    chipPriority.textContent = `⚡ ${capitalize(parsed.priority)} Priority`;
  } else {
    chipPriority.classList.add('hidden');
  }
}

// Render Tasks & Badges
function renderAll() {
  renderTasks();
  updateStats();
}

function renderTasks() {
  const allTasks = TaskStore.getAll();
  const todayStr = getLocalDateString();

  // Filter
  let filtered = allTasks.filter(t => {
    if (currentFilter === 'pending') return !t.completed;
    if (currentFilter === 'completed') return t.completed;
    if (currentFilter === 'today') return t.due_date === todayStr;
    if (currentFilter === 'high') return t.priority === 'high';
    return true; // 'all'
  });

  // Sort
  const priorityRank = { high: 1, medium: 2, low: 3 };

  if (currentSort === 'deadline') {
    filtered.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed - b.completed;
      if (!a.due_datetime && b.due_datetime) return 1;
      if (a.due_datetime && !b.due_datetime) return -1;
      if (a.due_datetime && b.due_datetime) {
        const dDiff = a.due_datetime.localeCompare(b.due_datetime);
        if (dDiff !== 0) return dDiff;
      }
      return (priorityRank[a.priority] || 4) - (priorityRank[b.priority] || 4);
    });
  } else if (currentSort === 'priority') {
    filtered.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed - b.completed;
      const pDiff = (priorityRank[a.priority] || 4) - (priorityRank[b.priority] || 4);
      if (pDiff !== 0) return pDiff;
      if (!a.due_datetime && b.due_datetime) return 1;
      if (a.due_datetime && !b.due_datetime) return -1;
      return (a.due_datetime || '').localeCompare(b.due_datetime || '');
    });
  } else {
    // 'smart': Overdue first, Today by time & priority, Future deadlines, No deadline, Completed at bottom
    filtered.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed - b.completed;

      const getTier = t => {
        if (!t.due_date) return 3;
        if (t.due_date < todayStr) return 0; // Overdue
        if (t.due_date === todayStr) return 1; // Today
        return 2; // Future
      };

      const tierA = getTier(a);
      const tierB = getTier(b);
      if (tierA !== tierB) return tierA - tierB;

      const pDiff = (priorityRank[a.priority] || 4) - (priorityRank[b.priority] || 4);
      if (pDiff !== 0) return pDiff;

      return (a.due_datetime || '9999').localeCompare(b.due_datetime || '9999');
    });
  }

  taskList.innerHTML = '';
  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  filtered.forEach(task => {
    const isCompleted = task.completed === 1;
    const isRolled = task.rolled_over === 1;
    const isOverdue = !isCompleted && task.due_date && task.due_date < todayStr;
    const isToday = task.due_date === todayStr;

    const card = document.createElement('div');
    card.className = `task-card ${isCompleted ? 'completed' : ''}`;
    card.dataset.id = task.id;

    let metaBadges = '';
    metaBadges += `<span class="badge badge-${task.priority}">⚡ ${capitalize(task.priority)}</span>`;

    if (isRolled) {
      const times = task.rollover_count > 1 ? ` (${task.rollover_count}x)` : '';
      metaBadges += `<span class="badge badge-rolled" title="Task rolled over from previous day">🌙 Rolled${times}</span>`;
    }

    if (task.due_date) {
      let dateBadgeClass = 'badge-upcoming';
      let datePrefix = '📅 ';
      if (isOverdue) {
        dateBadgeClass = 'badge-overdue';
        datePrefix = '⚠️ Overdue: ';
      } else if (isToday) {
        dateBadgeClass = 'badge-today';
        datePrefix = '🎯 Today: ';
      }

      const timePart = task.due_time ? ` at ${formatTime(task.due_time)}` : '';
      metaBadges += `<span class="badge ${dateBadgeClass}">${datePrefix}${formatDateLabel(task.due_date)}${timePart}</span>`;
    }

    card.innerHTML = `
      <div class="task-checkbox-wrap">
        <div class="custom-checkbox" role="checkbox" aria-checked="${isCompleted}" title="${isCompleted ? 'Mark incomplete' : 'Mark complete'}">
          <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      </div>
      <div class="task-content">
        <div class="task-header-row">
          <span class="task-title">${escapeHTML(task.title)}</span>
          <div class="task-actions">
            <button class="btn-action btn-priority" title="Cycle Priority">⚡</button>
            <button class="btn-action btn-delete" title="Delete Task">✕</button>
          </div>
        </div>
        <div class="task-meta-row">
          ${metaBadges}
        </div>
      </div>
    `;

    // Checkbox click
    const checkbox = card.querySelector('.custom-checkbox');
    checkbox.addEventListener('click', () => {
      TaskStore.update(task.id, {
        completed: isCompleted ? 0 : 1,
        completed_at: isCompleted ? null : new Date().toISOString()
      });
      renderAll();
    });

    // Priority toggle click
    const prioBtn = card.querySelector('.btn-priority');
    prioBtn.addEventListener('click', () => {
      const nextMap = { low: 'medium', medium: 'high', high: 'low' };
      const nextP = nextMap[task.priority] || 'medium';
      TaskStore.update(task.id, { priority: nextP });
      showToast(`Priority set to ${nextP}`);
      renderAll();
    });

    // Delete task click
    const deleteBtn = card.querySelector('.btn-delete');
    deleteBtn.addEventListener('click', () => {
      TaskStore.delete(task.id);
      showToast('Task deleted');
      renderAll();
    });

    taskList.appendChild(card);
  });
}

function updateStats() {
  const all = TaskStore.getAll();
  const todayStr = getLocalDateString();

  const total = all.length;
  const todayCount = all.filter(t => t.due_date === todayStr).length;
  const highCount = all.filter(t => t.priority === 'high' && !t.completed).length;
  const pendingCount = all.filter(t => !t.completed).length;
  const completedCount = all.filter(t => t.completed).length;
  const rolledCount = all.filter(t => t.rolled_over && !t.completed).length;

  countAll.textContent = total;
  countToday.textContent = todayCount;
  countHigh.textContent = highCount;
  countPending.textContent = pendingCount;
  countCompleted.textContent = completedCount;

  footerPendingText.textContent = `${pendingCount} pending`;
  footerRolledText.textContent = `${rolledCount} rolled over`;
  footerCompletedText.textContent = `${completedCount} completed`;
}

// Automatic Nightly 10:00 PM Rollover Check
function checkAndRunNightlyRollover() {
  const now = new Date();
  const hours = now.getHours();
  const todayStr = getLocalDateString(now);
  const lastRolled = Storage.get(STORAGE_KEYS.LAST_ROLLOVER);

  // If local time is 10:00 PM (22:00) or later, and today's rollover hasn't run yet
  if (hours >= 22 && lastRolled !== todayStr) {
    console.log(`[Nightly Rollover] Running automatic 10:00 PM rollover for ${todayStr}...`);
    const plan = TaskStore.executeRollover(false);
    renderAll();
    showToast(`🌙 10:00 PM reached! Rolled ${plan.rolled_task_count} tasks to tomorrow.`);
  }
}

// 10 PM Countdown Ticker
function updateRolloverTicker() {
  const now = new Date();
  const nextTenPm = new Date(now);
  nextTenPm.setHours(22, 0, 0, 0);

  if (now.getTime() >= nextTenPm.getTime()) {
    nextTenPm.setDate(nextTenPm.getDate() + 1);
  }

  const diffMs = nextTenPm.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const diffSeconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  if (rolloverTickerText) {
    rolloverTickerText.textContent = `Nightly 10:00 PM rollover in ${diffHours}h ${diffMinutes}m ${diffSeconds}s`;
  }
}

// Manual Rollover Simulation
function triggerManualRollover() {
  simulateRolloverBtn.disabled = true;
  simulateRolloverBtn.textContent = 'Rolling...';

  setTimeout(() => {
    const plan = TaskStore.executeRollover(true);
    renderAll();
    showToast(`🌙 Rollover complete! ${plan.rolled_task_count} tasks rolled to tomorrow.`);
    openMorningPlanModal();
    simulateRolloverBtn.disabled = false;
    simulateRolloverBtn.textContent = '⚡ Run 10 PM Rollover';
  }, 200);
}

// Morning Plan Modal
function openMorningPlanModal() {
  const plan = TaskStore.getLatestPlan();
  if (!plan) return;

  modalPlanTitle.textContent = `Prioritised Morning Plan`;
  modalPlanDate.textContent = `Target Date: ${formatDateLong(plan.plan_date)} • ${plan.total_task_count} tasks planned`;
  planSummaryText.textContent = plan.summary;

  planScheduleContainer.innerHTML = '';
  if (plan.schedule && plan.schedule.length > 0) {
    plan.schedule.forEach(block => {
      const slotEl = document.createElement('div');
      slotEl.className = 'schedule-slot';

      let tasksHtml = '';
      if (block.tasks && block.tasks.length > 0) {
        tasksHtml = block.tasks.map(t => `
          <div class="slot-task-item">
            <span>${escapeHTML(t.title)}</span>
            <span class="badge badge-${t.priority}">⚡ ${capitalize(t.priority)}${t.rolled ? ' • 🌙 Rolled' : ''}</span>
          </div>
        `).join('');
      } else {
        tasksHtml = '<div class="slot-desc">No tasks in this block.</div>';
      }

      slotEl.innerHTML = `
        <div class="slot-header">
          <span class="slot-title">${escapeHTML(block.title)}</span>
          <span class="slot-time">${escapeHTML(block.slot)}</span>
        </div>
        <div class="slot-desc">${escapeHTML(block.description)}</div>
        <div class="slot-tasks">${tasksHtml}</div>
      `;
      planScheduleContainer.appendChild(slotEl);
    });
  } else {
    planScheduleContainer.innerHTML = '<p class="slot-desc">No specific schedule blocks available.</p>';
  }

  planModal.classList.remove('hidden');
}

function closeMorningPlanModal() {
  planModal.classList.add('hidden');
}

// Theme
function initTheme() {
  const saved = Storage.get(STORAGE_KEYS.THEME) ||
    (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  setTheme(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  Storage.set(STORAGE_KEYS.THEME, theme);
  if (themeIcon) themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// Date Format Helpers
function renderDateHeader() {
  const options = { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' };
  if (currentDateDisplay) {
    currentDateDisplay.textContent = new Date().toLocaleDateString(undefined, options);
  }
}

function formatDateLabel(isoStr) {
  if (!isoStr) return '';
  const [y, m, d] = isoStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) {
    return target.toLocaleDateString(undefined, { weekday: 'short' });
  }
  return target.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatDateLong(isoStr) {
  if (!isoStr) return '';
  const [y, m, d] = isoStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  return target.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 || 12;
  return `${displayHour}:${String(m).padStart(2, '0')} ${period}`;
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

let toastTimer = null;
function showToast(msg) {
  if (!toastEl) return;
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  toastTimer = setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 2600);
}
