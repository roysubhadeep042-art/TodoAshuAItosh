// State
let tasks = [];
let currentFilter = 'all';
let currentSort = 'smart';
let statusData = null;
let debounceTimer = null;

// DOM Elements
const taskForm = document.getElementById('taskForm');
const taskInput = document.getElementById('taskInput');
const liveParserChipBar = document.getElementById('liveParserChipBar');
const chipTitle = document.getElementById('chipTitle');
const chipDate = document.getElementById('chipDate');
const chipPriority = document.getElementById('chipPriority');

const taskList = document.getElementById('taskList');
const emptyState = document.getElementById('emptyState');
const filterTabs = document.querySelectorAll('.tab-btn');
const sortSelect = document.getElementById('sortSelect');

const currentDateDisplay = document.getElementById('currentDateDisplay');
const rolloverTickerText = document.getElementById('rolloverTickerText');
const simulateRolloverBtn = document.getElementById('simulateRolloverBtn');

const openPlanBtn = document.getElementById('openPlanBtn');
const planModal = document.getElementById('planModal');
const closePlanBtn = document.getElementById('closePlanBtn');
const dismissPlanBtn = document.getElementById('dismissPlanBtn');
const reTriggerPlanBtn = document.getElementById('reTriggerPlanBtn');
const modalPlanTitle = document.getElementById('modalPlanTitle');
const modalPlanDate = document.getElementById('modalPlanDate');
const planSummaryText = document.getElementById('planSummaryText');
const planScheduleContainer = document.getElementById('planScheduleContainer');

const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeIcon = document.getElementById('themeIcon');
const toastEl = document.getElementById('toast');

// Badge count elements
const countAll = document.getElementById('countAll');
const countToday = document.getElementById('countToday');
const countHigh = document.getElementById('countHigh');
const countPending = document.getElementById('countPending');
const countCompleted = document.getElementById('countCompleted');

const footerPendingText = document.getElementById('footerPendingText');
const footerRolledText = document.getElementById('footerRolledText');
const footerCompletedText = document.getElementById('footerCompletedText');

// Init
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  renderDateHeader();
  fetchStatus();
  fetchTasks();
  setupEventListeners();

  // Update status every 30 seconds
  setInterval(fetchStatus, 30000);
});

// Setup Event Listeners
function setupEventListeners() {
  // Input live typing parser
  taskInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const val = taskInput.value.trim();
    if (!val) {
      liveParserChipBar.classList.add('hidden');
      return;
    }
    debounceTimer = setTimeout(() => {
      parseInputPreview(val);
    }, 150);
  });

  // Form submit
  taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = taskInput.value.trim();
    if (!val) return;

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: val })
      });
      if (res.ok) {
        const created = await res.json();
        taskInput.value = '';
        liveParserChipBar.classList.add('hidden');
        showToast(`Added: "${created.title}"`);
        await fetchTasks();
        await fetchStatus();
      } else {
        showToast('Error adding task');
      }
    } catch (err) {
      showToast('Network error');
    }
  });

  // Quick suggestion buttons
  document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      taskInput.value = btn.dataset.text;
      taskInput.focus();
      parseInputPreview(btn.dataset.text);
    });
  });

  // Filter tabs
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      fetchTasks();
    });
  });

  // Sort change
  sortSelect.addEventListener('change', (e) => {
    currentSort = e.target.value;
    fetchTasks();
  });

  // Simulate Rollover button
  simulateRolloverBtn.addEventListener('click', triggerRollover);
  reTriggerPlanBtn.addEventListener('click', triggerRollover);

  // Modal open / close
  openPlanBtn.addEventListener('click', openMorningPlan);
  closePlanBtn.addEventListener('click', closeMorningPlan);
  dismissPlanBtn.addEventListener('click', closeMorningPlan);

  planModal.addEventListener('click', (e) => {
    if (e.target === planModal) closeMorningPlan();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !planModal.classList.contains('hidden')) {
      closeMorningPlan();
    }
  });

  // Theme toggle
  themeToggleBtn.addEventListener('click', toggleTheme);
}

// Live Parse Preview
async function parseInputPreview(text) {
  try {
    const res = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: text })
    });
    const parsed = await res.json();

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
  } catch (e) {
    // Silent fallback
  }
}

// Fetch & Render Tasks
async function fetchTasks() {
  try {
    const res = await fetch(`/api/tasks?sort=${currentSort}&filter=${currentFilter}`);
    tasks = await res.json();
    renderTasks();
    updateTabCounts();
  } catch (err) {
    console.error('Error fetching tasks:', err);
  }
}

function renderTasks() {
  taskList.innerHTML = '';

  if (tasks.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  const todayStr = getTodayISO();

  tasks.forEach(task => {
    const isCompleted = task.completed === 1;
    const isRolled = task.rolled_over === 1;
    const isOverdue = !isCompleted && task.due_date && task.due_date < todayStr;
    const isToday = task.due_date === todayStr;

    const card = document.createElement('div');
    card.className = `task-card ${isCompleted ? 'completed' : ''}`;
    card.dataset.id = task.id;

    // Badges HTML
    let metaBadges = '';

    // Priority badge
    metaBadges += `<span class="badge badge-${task.priority}">⚡ ${capitalize(task.priority)}</span>`;

    // Rollover badge
    if (isRolled) {
      const times = task.rollover_count > 1 ? ` (${task.rollover_count}x)` : '';
      metaBadges += `<span class="badge badge-rolled" title="Task rolled over from a previous day">🌙 Rolled${times}</span>`;
    }

    // Date & Time badge
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
    checkbox.addEventListener('click', () => toggleTaskComplete(task.id, !isCompleted));

    // Priority toggle click
    const prioBtn = card.querySelector('.btn-priority');
    prioBtn.addEventListener('click', () => cycleTaskPriority(task));

    // Delete click
    const deleteBtn = card.querySelector('.btn-delete');
    deleteBtn.addEventListener('click', () => deleteTask(task.id));

    taskList.appendChild(card);
  });
}

// Update Filter Count Badges
async function updateTabCounts() {
  try {
    const res = await fetch('/api/tasks?sort=smart&filter=all');
    const allTasks = await res.json();
    const todayStr = getTodayISO();

    const total = allTasks.length;
    const todayCount = allTasks.filter(t => t.due_date === todayStr).length;
    const highCount = allTasks.filter(t => t.priority === 'high' && !t.completed).length;
    const pendingCount = allTasks.filter(t => !t.completed).length;
    const completedCount = allTasks.filter(t => t.completed).length;
    const rolledCount = allTasks.filter(t => t.rolled_over && !t.completed).length;

    countAll.textContent = total;
    countToday.textContent = todayCount;
    countHigh.textContent = highCount;
    countPending.textContent = pendingCount;
    countCompleted.textContent = completedCount;

    footerPendingText.textContent = `${pendingCount} pending`;
    footerRolledText.textContent = `${rolledCount} rolled over`;
    footerCompletedText.textContent = `${completedCount} completed`;
  } catch (e) {}
}

// Task Actions
async function toggleTaskComplete(id, completed) {
  try {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed })
    });
    if (res.ok) {
      await fetchTasks();
      await fetchStatus();
    }
  } catch (err) {
    showToast('Failed to update task');
  }
}

async function cycleTaskPriority(task) {
  const map = { low: 'medium', medium: 'high', high: 'low' };
  const nextPriority = map[task.priority] || 'medium';

  try {
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority: nextPriority })
    });
    if (res.ok) {
      showToast(`Priority set to ${nextPriority}`);
      await fetchTasks();
    }
  } catch (err) {
    showToast('Failed to update priority');
  }
}

async function deleteTask(id) {
  try {
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Task deleted');
      await fetchTasks();
      await fetchStatus();
    }
  } catch (err) {
    showToast('Failed to delete');
  }
}

// Fetch Status & Rollover Countdown
async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    statusData = await res.json();

    if (statusData && statusData.nextRollover) {
      const { hoursRemaining, minutesRemaining } = statusData.nextRollover;
      rolloverTickerText.textContent = `Nightly 10:00 PM rollover in ${hoursRemaining}h ${minutesRemaining}m`;
    }
  } catch (e) {}
}

// Trigger Rollover Manually
async function triggerRollover() {
  simulateRolloverBtn.disabled = true;
  simulateRolloverBtn.textContent = 'Rolling...';

  try {
    const res = await fetch('/api/rollover', { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      showToast(`🌙 Rollover complete! ${data.rolledCount} tasks rolled to tomorrow.`);
      await fetchTasks();
      await fetchStatus();
      await openMorningPlan();
    } else {
      showToast('Rollover error');
    }
  } catch (err) {
    showToast('Failed to run rollover');
  } finally {
    simulateRolloverBtn.disabled = false;
    simulateRolloverBtn.textContent = '⚡ Run 10 PM Rollover';
  }
}

// Open / Close Morning Plan Modal
async function openMorningPlan() {
  try {
    const res = await fetch('/api/morning-plan');
    const data = await res.json();
    const plan = data.plan;

    if (!plan) {
      planSummaryText.textContent = 'No morning plan generated yet. Run the 10:00 PM rollover to generate one!';
      planScheduleContainer.innerHTML = '';
      modalPlanDate.textContent = 'No active plan';
    } else {
      modalPlanTitle.textContent = `Prioritised Morning Plan`;
      modalPlanDate.textContent = `Target Date: ${formatDateLong(plan.plan_date)} • ${plan.total_task_count} tasks planned`;
      planSummaryText.textContent = plan.summary;

      // Render schedule slots
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
    }

    planModal.classList.remove('hidden');
  } catch (err) {
    showToast('Failed to load morning plan');
  }
}

function closeMorningPlan() {
  planModal.classList.add('hidden');
}

// Theme
function initTheme() {
  const saved = localStorage.getItem('taskflow_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  setTheme(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next);
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('taskflow_theme', theme);
  themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// Helpers
function renderDateHeader() {
  const options = { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' };
  currentDateDisplay.textContent = new Date().toLocaleDateString(undefined, options);
}

function getTodayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateLabel(isoStr) {
  if (!isoStr) return '';
  const [y, m, d] = isoStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0,0,0,0);
  target.setHours(0,0,0,0);

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
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

let toastTimer = null;
function showToast(msg) {
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  toastTimer = setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 2600);
}
