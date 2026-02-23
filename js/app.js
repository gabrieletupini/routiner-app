import {
  initFirebase, onSyncStatus,
  subscribeToRoutines, createRoutine, updateRoutine, deleteRoutine,
  subscribeToCompletions, toggleCompletion
} from './firebase.js';
import { renderCalendar, renderLegend, getMonthLabel, computeWeeklyProgress } from './calendar.js';

const COLORS = [
  '#7c6ff7', '#3b82f6', '#06b6d4', '#34d399', '#a3e635',
  '#facc15', '#fb923c', '#f87171', '#e879f9', '#f472b6',
];

const ICONS = [
  '\u{1F9B7}', '\u{1F3CB}', '\u{1F4DA}', '\u{1F3B5}', '\u{1F9D8}',
  '\u{2615}', '\u{1F4A7}', '\u{1F48A}', '\u{1F333}', '\u{1F6B6}',
  '\u{1F9F9}', '\u{1F37D}', '\u{1F4BB}', '\u{1F6CC}', '\u{2B50}',
];

let currentYear, currentMonth;
let routines = [];
let completions = {};
let unsubCompletions = null;

// ---- DOM refs ----
const syncIndicator = document.getElementById('sync-indicator');
const syncLabelEl = document.getElementById('sync-label');
const calGrid = document.getElementById('calendar-grid');
const calLegend = document.getElementById('calendar-legend');
const monthLabel = document.getElementById('month-label');
const routinesList = document.getElementById('routines-list');
const routineModal = document.getElementById('routine-modal');
const routineForm = document.getElementById('routine-form');
const routineModalTitle = document.getElementById('routine-modal-title');
const routineDeleteBtn = document.getElementById('routine-delete-btn');
const colorPicker = document.getElementById('color-picker');
const iconPicker = document.getElementById('icon-picker');
const dayPicker = document.getElementById('day-picker');
const questAvatar = document.getElementById('quest-avatar');
const pathFill = document.getElementById('path-fill');
const checkpointsEl = document.getElementById('checkpoints');
const goldCountEl = document.getElementById('gold-count');

let selectedColor = COLORS[0];
let selectedIcon = ICONS[0];
let selectedDays = [0, 1, 2, 3, 4, 5, 6]; // all days by default

// ---- Init ----
function init() {
  initFirebase();

  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();

  let connected = false;
  onSyncStatus((status) => {
    connected = true;
    handleSyncStatus(status);
  });

  setupTabs();
  setupMonthNav();
  setupModal();
  setupDayPicker();
  buildColorPicker();
  buildIconPicker();

  // Render immediately with empty data so the page isn't blank
  renderAll();

  subscribeToRoutines((r) => {
    routines = r;
    renderAll();
  });

  subscribeMonth();

  handleSyncStatus('connecting');
  setTimeout(() => {
    if (!connected) handleSyncStatus('error');
  }, 8000);
}

// ---- Sync status ----
function handleSyncStatus(status) {
  if (!syncIndicator || !syncLabelEl) return;
  syncIndicator.className = 'sync-indicator';
  if (status === 'synced') {
    syncIndicator.classList.add('synced');
    syncLabelEl.textContent = 'Synced';
  } else if (status === 'syncing') {
    syncLabelEl.textContent = 'Saving...';
  } else if (status === 'error') {
    syncIndicator.classList.add('error');
    syncLabelEl.textContent = 'Offline';
  } else {
    syncLabelEl.textContent = 'Connecting...';
  }
}

// ---- Subscribe to month completions ----
function subscribeMonth() {
  if (unsubCompletions) unsubCompletions();
  unsubCompletions = subscribeToCompletions(currentYear, currentMonth, (c) => {
    completions = c;
    renderCalendarView();
  });
}

// ---- Tabs ----
function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
  });
}

// ---- Month Nav ----
function setupMonthNav() {
  document.getElementById('prev-month').addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    subscribeMonth();
    renderCalendarView();
  });
  document.getElementById('next-month').addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    subscribeMonth();
    renderCalendarView();
  });
}

// ---- Render ----
function renderAll() {
  renderCalendarView();
  renderRoutinesList();
}

function renderCalendarView() {
  monthLabel.textContent = getMonthLabel(currentYear, currentMonth);
  renderCalendar(calGrid, currentYear, currentMonth, routines, completions, handleToggle);
  renderLegend(calLegend, routines);
  updateQuestPath();
}

function handleToggle(dateStr, routineId) {
  const currentlyDone = !!(completions[dateStr] && completions[dateStr][routineId]);
  toggleCompletion(dateStr, routineId, currentlyDone);
}

// ---- Quest Path ----
function updateQuestPath() {
  const weeks = computeWeeklyProgress(currentYear, currentMonth, routines, completions);
  checkpointsEl.innerHTML = '';

  let completedWeeks = 0;

  weeks.forEach((w, i) => {
    const cp = document.createElement('div');
    cp.className = 'checkpoint';

    // A week is completed only when ALL expected routines are done (100%)
    const isCompleted = w.expected > 0 && w.completed >= w.expected;

    if (isCompleted) { cp.classList.add('completed'); completedWeeks++; }

    const node = document.createElement('div');
    node.className = 'checkpoint-node';
    node.title = `Week ${i + 1}: ${w.completed}/${w.expected} done`;
    cp.appendChild(node);

    const label = document.createElement('span');
    label.className = 'checkpoint-label';
    label.textContent = `Wk${i + 1}`;
    cp.appendChild(label);

    checkpointsEl.appendChild(cp);
  });

  // Gold coin only when ALL weeks of the month are fully completed
  const weeksWithWork = weeks.filter(w => w.expected > 0).length;
  const goldCoins = (weeksWithWork > 0 && completedWeeks >= weeksWithWork) ? 1 : 0;
  goldCountEl.textContent = goldCoins;

  const questSection = document.getElementById('quest-section');
  questSection.classList.toggle('has-gold', goldCoins > 0);

  requestAnimationFrame(() => {
    const totalCp = weeks.length;
    if (totalCp > 0) {
      const pathWidth = checkpointsEl.offsetWidth;
      const progress = completedWeeks / totalCp;
      questAvatar.style.left = (progress * (pathWidth - 40) + 4) + 'px';
      pathFill.style.width = (progress * (pathWidth - 40)) + 'px';
    }
  });
}

// ---- Routines List ----
function renderRoutinesList() {
  routinesList.innerHTML = '';
  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (routines.length === 0) {
    routinesList.innerHTML = `
      <div class="routines-empty">
        <div class="empty-icon">\u{1F4CB}</div>
        <p>No routines yet. Add one to get started!</p>
      </div>`;
    return;
  }

  routines.forEach(r => {
    const days = r.days || [];
    const dayNames = days.map(d => DAY_LABELS[d]).join(', ');
    const card = document.createElement('div');
    card.className = 'routine-card';
    card.style.borderLeftColor = r.color;
    card.innerHTML = `
      <div class="routine-icon" style="background:${r.color}22">${r.icon}</div>
      <div class="routine-info">
        <div class="routine-name">${escapeHtml(r.name)}</div>
        <div class="routine-desc">${r.description || ''}</div>
        <div class="routine-days">${dayNames || 'No days selected'}</div>
      </div>
      <div class="routine-freq">${days.length}x/wk</div>
    `;
    card.addEventListener('click', () => openEditRoutine(r));
    routinesList.appendChild(card);
  });
}

// ---- Day Picker ----
function setupDayPicker() {
  dayPicker.querySelectorAll('.day-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const day = parseInt(btn.dataset.day);
      const idx = selectedDays.indexOf(day);
      if (idx === -1) {
        selectedDays.push(day);
      } else {
        selectedDays.splice(idx, 1);
      }
      updateDayPickerUI();
    });
  });
}

function updateDayPickerUI() {
  dayPicker.querySelectorAll('.day-btn').forEach(btn => {
    const day = parseInt(btn.dataset.day);
    btn.classList.toggle('active', selectedDays.includes(day));
  });
}

// ---- Modal ----
function setupModal() {
  document.getElementById('add-routine-btn').addEventListener('click', openNewRoutine);
  document.getElementById('routine-modal-close').addEventListener('click', closeModal);
  routineModal.addEventListener('click', (e) => {
    if (e.target === routineModal) closeModal();
  });
  routineForm.addEventListener('submit', handleSaveRoutine);
  routineDeleteBtn.addEventListener('click', handleDeleteRoutine);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

function openNewRoutine() {
  routineModalTitle.textContent = 'New Routine';
  document.getElementById('routine-id').value = '';
  document.getElementById('routine-name').value = '';
  document.getElementById('routine-description').innerHTML = '';
  routineDeleteBtn.style.display = 'none';
  selectedColor = COLORS[0];
  selectedIcon = ICONS[0];
  selectedDays = [0, 1, 2, 3, 4, 5, 6];
  updatePickerSelection();
  updateDayPickerUI();
  routineModal.classList.add('open');
}

function openEditRoutine(routine) {
  routineModalTitle.textContent = 'Edit Routine';
  document.getElementById('routine-id').value = routine.id;
  document.getElementById('routine-name').value = routine.name;
  document.getElementById('routine-description').innerHTML = routine.description || '';
  routineDeleteBtn.style.display = 'block';
  selectedColor = routine.color;
  selectedIcon = routine.icon;
  selectedDays = [...(routine.days || [])];
  updatePickerSelection();
  updateDayPickerUI();
  routineModal.classList.add('open');
}

function closeModal() {
  routineModal.classList.remove('open');
}

async function handleSaveRoutine(e) {
  e.preventDefault();
  const id = document.getElementById('routine-id').value;
  const name = document.getElementById('routine-name').value.trim();
  const description = sanitizeHtml(document.getElementById('routine-description').innerHTML);
  const days = [...selectedDays].sort();

  if (!name) return;

  if (id) {
    await updateRoutine(id, { name, description, days, color: selectedColor, icon: selectedIcon });
  } else {
    await createRoutine({ name, description, days, color: selectedColor, icon: selectedIcon });
  }

  closeModal();
}

async function handleDeleteRoutine() {
  const id = document.getElementById('routine-id').value;
  if (!id) return;
  await deleteRoutine(id);
  closeModal();
}

// ---- Color Picker ----
function buildColorPicker() {
  colorPicker.innerHTML = '';
  COLORS.forEach(c => {
    const swatch = document.createElement('div');
    swatch.className = 'color-swatch' + (c === selectedColor ? ' selected' : '');
    swatch.style.backgroundColor = c;
    swatch.addEventListener('click', () => {
      selectedColor = c;
      updatePickerSelection();
    });
    colorPicker.appendChild(swatch);
  });
}

// ---- Icon Picker ----
function buildIconPicker() {
  iconPicker.innerHTML = '';
  ICONS.forEach(ic => {
    const opt = document.createElement('div');
    opt.className = 'icon-option' + (ic === selectedIcon ? ' selected' : '');
    opt.textContent = ic;
    opt.addEventListener('click', () => {
      selectedIcon = ic;
      updatePickerSelection();
    });
    iconPicker.appendChild(opt);
  });
}

function updatePickerSelection() {
  colorPicker.querySelectorAll('.color-swatch').forEach(s => {
    s.classList.toggle('selected', rgbToHex(s.style.backgroundColor) === selectedColor);
  });
  iconPicker.querySelectorAll('.icon-option').forEach(o => {
    o.classList.toggle('selected', o.textContent === selectedIcon);
  });
}

function rgbToHex(rgb) {
  if (rgb.startsWith('#')) return rgb;
  const m = rgb.match(/(\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return rgb;
  return '#' + [m[1], m[2], m[3]].map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
}

function sanitizeHtml(html) {
  const allowed = ['TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD',
    'UL', 'OL', 'LI', 'P', 'BR', 'STRONG', 'B', 'EM', 'I',
    'H1', 'H2', 'H3', 'H4', 'DIV', 'SPAN', 'A', 'COLGROUP', 'COL'];
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  // Remove script/style/iframe tags and event attributes
  tmp.querySelectorAll('script, style, iframe, object, embed').forEach(el => el.remove());
  tmp.querySelectorAll('*').forEach(el => {
    if (!allowed.includes(el.tagName)) {
      el.replaceWith(...el.childNodes);
      return;
    }
    // Strip event handlers, style, and other unsafe attributes
    [...el.attributes].forEach(attr => {
      if (attr.name.startsWith('on') || attr.name === 'srcdoc' || attr.name === 'style' || attr.name === 'class') {
        el.removeAttribute(attr.name);
      }
    });
  });
  const result = tmp.innerHTML.trim();
  // If empty or just <br>, return empty
  if (!result || result === '<br>' || result === '<br/>') return '';
  return result;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---- Start ----
document.addEventListener('DOMContentLoaded', init);
