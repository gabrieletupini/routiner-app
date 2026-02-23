import {
  initFirebase, onSyncStatus,
  subscribeToRoutines, createRoutine, updateRoutine, deleteRoutine,
  subscribeToCompletions, toggleCompletion
} from './firebase.js';
import { renderCalendar, renderLegend, getMonthLabel } from './calendar.js';

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
const syncDot = document.getElementById('sync-dot');
const syncLabel = document.getElementById('sync-label');
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

let selectedColor = COLORS[0];
let selectedIcon = ICONS[0];

// ---- Init ----
function init() {
  initFirebase();

  const now = new Date();
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();

  onSyncStatus(handleSyncStatus);

  setupTabs();
  setupMonthNav();
  setupModal();
  buildColorPicker();
  buildIconPicker();

  // Subscribe to routines (always active)
  subscribeToRoutines((r) => {
    routines = r;
    renderAll();
  });

  // Subscribe to completions for current month
  subscribeMonth();

  // Initial sync indicator
  handleSyncStatus('connecting');
  setTimeout(() => {
    if (syncLabel && syncLabel.textContent === 'Connecting...') {
      handleSyncStatus('error');
    }
  }, 8000);
}

// ---- Sync status ----
function handleSyncStatus(status) {
  if (!syncDot || !syncLabel) return;
  syncDot.className = 'sync-dot';
  if (status === 'synced') {
    syncDot.classList.add('synced');
    syncLabel.textContent = 'Synced';
  } else if (status === 'syncing') {
    syncDot.classList.add('syncing');
    syncLabel.textContent = 'Saving...';
  } else if (status === 'error') {
    syncDot.classList.add('error');
    syncLabel.textContent = 'Offline';
  } else {
    syncLabel.textContent = 'Connecting...';
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
}

function handleToggle(dateStr, routineId) {
  const currentlyDone = !!(completions[dateStr] && completions[dateStr][routineId]);
  toggleCompletion(dateStr, routineId, currentlyDone);
}

// ---- Routines List ----
function renderRoutinesList() {
  routinesList.innerHTML = '';

  if (routines.length === 0) {
    routinesList.innerHTML = `
      <div class="routines-empty">
        <div class="empty-icon">\u{1F4CB}</div>
        <p>No routines yet. Add one to get started!</p>
      </div>`;
    return;
  }

  routines.forEach(r => {
    const card = document.createElement('div');
    card.className = 'routine-card';
    card.style.borderLeftColor = r.color;
    card.innerHTML = `
      <div class="routine-icon" style="background:${r.color}22">${r.icon}</div>
      <div class="routine-info">
        <div class="routine-name">${escapeHtml(r.name)}</div>
        <div class="routine-desc">${escapeHtml(r.description || '')}</div>
      </div>
      <div class="routine-freq">${r.timesPerWeek}x/wk</div>
    `;
    card.addEventListener('click', () => openEditRoutine(r));
    routinesList.appendChild(card);
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
}

function openNewRoutine() {
  routineModalTitle.textContent = 'New Routine';
  document.getElementById('routine-id').value = '';
  document.getElementById('routine-name').value = '';
  document.getElementById('routine-description').value = '';
  document.getElementById('routine-times').value = '7';
  routineDeleteBtn.style.display = 'none';
  selectedColor = COLORS[0];
  selectedIcon = ICONS[0];
  updatePickerSelection();
  routineModal.classList.add('open');
}

function openEditRoutine(routine) {
  routineModalTitle.textContent = 'Edit Routine';
  document.getElementById('routine-id').value = routine.id;
  document.getElementById('routine-name').value = routine.name;
  document.getElementById('routine-description').value = routine.description || '';
  document.getElementById('routine-times').value = routine.timesPerWeek;
  routineDeleteBtn.style.display = 'block';
  selectedColor = routine.color;
  selectedIcon = routine.icon;
  updatePickerSelection();
  routineModal.classList.add('open');
}

function closeModal() {
  routineModal.classList.remove('open');
}

async function handleSaveRoutine(e) {
  e.preventDefault();
  const id = document.getElementById('routine-id').value;
  const name = document.getElementById('routine-name').value.trim();
  const description = document.getElementById('routine-description').value.trim();
  const timesPerWeek = parseInt(document.getElementById('routine-times').value, 10);

  if (!name) return;

  if (id) {
    await updateRoutine(id, { name, description, timesPerWeek, color: selectedColor, icon: selectedIcon });
  } else {
    await createRoutine({ name, description, timesPerWeek, color: selectedColor, icon: selectedIcon });
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

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---- Start ----
document.addEventListener('DOMContentLoaded', init);
